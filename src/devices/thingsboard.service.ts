import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

type ThingsBoardToken = {
  token: string;
  expiresAt: number;
};

type ThingsBoardTelemetryPoint = {
  ts: number;
  value: string | number;
};

export type LatestTelemetry = {
  temperature: number | null;
  humidity: number | null;
  battery: number | null;
  timestamp: string | null;
};

@Injectable()
export class ThingsBoardService {
  private readonly logger = new Logger(ThingsBoardService.name);
  private cachedToken?: ThingsBoardToken;

  private get baseUrl() {
    const configuredUrl =
      process.env.TB_BASE_URL || process.env.THINGSBOARD_URL;
    if (!configuredUrl) {
      throw new ServiceUnavailableException(
        'ThingsBoard URL is not configured',
      );
    }
    return configuredUrl.replace(/\/$/, '');
  }

  private getTokenExpiration(token: string) {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      ) as { exp?: number };
      return typeof payload.exp === 'number' ? payload.exp * 1000 : undefined;
    } catch {
      return undefined;
    }
  }

  private async authenticate() {
    const configuredToken =
      process.env.TB_JWT_TOKEN || process.env.THINGSBOARD_JWT_TOKEN;
    if (configuredToken) {
      const expiresAt = this.getTokenExpiration(configuredToken);
      if (expiresAt !== undefined && expiresAt <= Date.now() + 30_000) {
        throw new ServiceUnavailableException(
          'ThingsBoard access token is expired or near expiry',
        );
      }
      return configuredToken;
    }

    const username =
      process.env.TB_USERNAME || process.env.THINGSBOARD_USERNAME;
    const password =
      process.env.TB_PASSWORD || process.env.THINGSBOARD_PASSWORD;
    if (!username || !password) {
      throw new ServiceUnavailableException(
        'ThingsBoard credentials are not configured',
      );
    }

    if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 30_000) {
      return this.cachedToken.token;
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      this.logger.error(
        'ThingsBoard authentication request failed',
        JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
          cause: error instanceof Error ? error.cause : undefined,
        }),
      );
      throw new ServiceUnavailableException('ThingsBoard service unavailable');
    }
    if (!response.ok) {
      this.logger.warn(
        `ThingsBoard authentication rejected (${response.status})`,
      );
      throw new ServiceUnavailableException(
        'ThingsBoard authentication failed',
      );
    }

    let body: { token?: string };
    try {
      body = (await response.json()) as { token?: string };
    } catch (error) {
      this.logger.error(
        'ThingsBoard authentication returned invalid JSON',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'ThingsBoard authentication returned an invalid response',
      );
    }
    if (!body.token) {
      throw new ServiceUnavailableException(
        'ThingsBoard authentication returned no token',
      );
    }
    this.cachedToken = {
      token: body.token,
      expiresAt:
        this.getTokenExpiration(body.token) ??
        Date.now() + Number(process.env.TB_TOKEN_TTL_MS || 14 * 60 * 1000),
    };
    return body.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const configuredToken =
      process.env.TB_JWT_TOKEN || process.env.THINGSBOARD_JWT_TOKEN;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = await this.authenticate();
      let response: Response;
      try {
        response = await fetch(`${this.baseUrl}${path}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
            'X-Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        this.logger.error(
          `ThingsBoard request failed before receiving a response (${path})`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new ServiceUnavailableException(
          'ThingsBoard service unavailable',
        );
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        const body = await response.text();
        return (body ? JSON.parse(body) : undefined) as T;
      }

      const errorBody = await response.text();
      this.logger.warn(
        `ThingsBoard request failed (${response.status}) ${path}: ${this.getErrorMessage(errorBody)}`,
      );
      if (response.status === 400) {
        throw new BadRequestException(
          `ThingsBoard rejected the device request: ${this.getErrorMessage(errorBody)}`,
        );
      }
      if (response.status === 403) {
        throw new ForbiddenException(
          'ThingsBoard credentials do not have permission for this operation',
        );
      }

      if (response.status === 401 && !configuredToken) {
        this.cachedToken = undefined;
        continue;
      }
      if (response.status === 401) {
        throw new ServiceUnavailableException(
          'ThingsBoard access token was rejected',
        );
      }
      throw new ServiceUnavailableException('ThingsBoard service unavailable');
    }

    throw new ServiceUnavailableException('ThingsBoard service unavailable');
  }

  private getErrorMessage(body: string) {
    try {
      const parsed = JSON.parse(body) as { message?: unknown };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
    } catch {
      // Use the plain response when ThingsBoard does not return JSON.
    }

    return body.trim().slice(0, 500) || 'No response body';
  }

  async createDevice(input: { name: string; type: string; label?: string }) {
    const body = await this.request<{ id?: { id?: string } }>('/api/device', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const id = body.id?.id;
    if (!id) {
      throw new ServiceUnavailableException(
        'ThingsBoard returned an invalid device',
      );
    }
    return id;
  }

  async updateDevice(
    deviceId: string,
    input: { name: string; type: string; label?: string },
  ) {
    return this.request('/api/device', {
      method: 'POST',
      body: JSON.stringify({
        ...input,
        id: { entityType: 'DEVICE', id: deviceId },
      }),
    });
  }

  async deleteDevice(deviceId: string) {
    return this.request(`/api/device/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  }

  async sendTelemetry(
    deviceId: string,
    telemetry: Record<string, number | string>,
  ) {
    return this.request(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/timeseries/ANY`,
      {
        method: 'POST',
        body: JSON.stringify(telemetry),
      },
    );
  }

  async getTelemetry(deviceId: string) {
    const keys =
      process.env.TB_TELEMETRY_KEYS || 'temperature,humidity,battery';
    return this.request<Record<string, ThingsBoardTelemetryPoint[]>>(
      `/api/plugins/telemetry/DEVICE/${encodeURIComponent(deviceId)}/values/timeseries?keys=${encodeURIComponent(keys)}&useStrictDataTypes=true`,
    );
  }

  async getLatestTelemetry(deviceId: string): Promise<LatestTelemetry> {
    const readings = (await this.getTelemetry(deviceId)) || {};
    const latest = (key: string) => {
      const point = (readings[key] || []).reduce<
        ThingsBoardTelemetryPoint | undefined
      >(
        (current, candidate) =>
          !current || candidate.ts > current.ts ? candidate : current,
        undefined,
      );
      return point ? Number(point.value) : null;
    };
    const timestamps = Object.values(readings)
      .flat()
      .map((point) => point.ts)
      .filter((timestamp) => Number.isFinite(timestamp));

    return {
      temperature: latest('temperature'),
      humidity: latest('humidity'),
      battery: latest('battery'),
      timestamp: timestamps.length
        ? new Date(Math.max(...timestamps)).toISOString()
        : null,
    };
  }
}
