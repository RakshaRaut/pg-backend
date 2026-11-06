import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: unknown) {
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !Number.isInteger((payload as { sub?: unknown }).sub) ||
      typeof (payload as { email?: unknown }).email !== 'string'
    ) {
      throw new UnauthorizedException('Invalid access token');
    }

    const validPayload = payload as { sub: number; email: string };
    return {
      userId: validPayload.sub,
      email: validPayload.email,
    };
  }
}
