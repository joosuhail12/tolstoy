import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );
  
  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove non-whitelisted properties
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Transform plain objects to DTO classes
      disableErrorMessages: false, // Show validation error messages
    }),
  );
  
  await app.listen(3000, '0.0.0.0');
  console.log('Application is running on: http://localhost:3000');
}

bootstrap();