import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    instrument:
      process.env.OBSERVE_APP_KEY && process.env.OBSERVE_APP_SECRET
        ? ObserveInstrument
        : undefined,
  });
  app.enableCors({
    origin: process.env.FRONTEND_URL?.split(',').map((origin) => origin.trim()) ?? [
      'http://localhost:5173',
    ],
    credentials: true,
  });
  app.setGlobalPrefix('api', {
    exclude: ['/', 'favicon.ico'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Backend listening on port ${port}`);
}
await bootstrap();
