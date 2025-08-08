// IMPORTANT: Make sure to import `instrument.ts` at the top of your file.
import './instrument';

// All other imports below
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
    { bufferLogs: true },
  );

  // Use Pino logger globally
  app.useLogger(app.get(Logger));

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Transform plain objects to DTO classes
      disableErrorMessages: false, // Show validation error messages
    }),
  );

  // Set up global Sentry exception filter
  app.useGlobalFilters(new SentryExceptionFilter(app.get(Logger)));

  await app.listen(3000, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log('Application is running on: http://localhost:3000', 'Bootstrap');
}

bootstrap();
