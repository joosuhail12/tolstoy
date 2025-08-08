// IMPORTANT: Make sure to import `instrument.ts` at the top of your file.
import './instrument';

// All other imports below
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
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

  // Configure Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Tolstoy API')
    .setDescription('Interactive API reference for Tolstoy workflow automation platform')
    .setVersion(process.env.APP_VERSION || '1.0.0')
    .addServer('https://tolstoy.getpullse.com', 'Production')
    .addServer('http://localhost:3000', 'Development')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-org-id',
        in: 'header',
        description: 'Organization ID for multi-tenant access'
      },
      'x-org-id'
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-user-id', 
        in: 'header',
        description: 'User ID for request context'
      },
      'x-user-id'
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [AppModule],
    deepScanRoutes: true,
  });

  // Write OpenAPI spec to docs/openapi.json
  const outPath = path.resolve(__dirname, '../docs/openapi.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2));

  // If running in generate-openapi mode, exit after generating the spec
  if (process.argv.includes('--generate-openapi')) {
    console.log('OpenAPI spec generated at:', outPath);
    process.exit(0);
  }

  // Serve Swagger UI at /api-docs (optional)
  await SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Add a dedicated CORS-enabled OpenAPI spec endpoint for Stainless
  app.register(async (fastify: any) => {
    await fastify.route({
      method: 'GET',
      url: '/openapi.json',
      handler: async (request: any, reply: any) => {
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET');
        reply.header('Access-Control-Allow-Headers', 'Content-Type');
        reply.header('Content-Type', 'application/json');
        return document;
      }
    });
  });

  await app.listen(3000, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log('Application is running on: http://localhost:3000', 'Bootstrap');
}

bootstrap();
