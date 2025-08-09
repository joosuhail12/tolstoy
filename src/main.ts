// IMPORTANT: Make sure to import `instrument.ts` at the top of your file.
import './instrument';

// All other imports below
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { SentryExceptionFilter } from './common/filters/sentry-exception.filter';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';

interface FastifyInstance {
  route(options: {
    method: string;
    url: string;
    handler: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown>;
  }): Promise<void>;
}

interface FastifyRequest {
  [key: string]: unknown;
}

interface FastifyReply {
  header(name: string, value: string): FastifyReply;
  [key: string]: unknown;
}

async function bootstrap() {
  const app: NestFastifyApplication = await NestFactory.create(
    AppModule,
    new FastifyAdapter({ 
      logger: false,
      trustProxy: true, // Trust proxy headers from Cloudflare
    }),
    { bufferLogs: true },
  );

  // Use Pino logger globally
  app.useLogger(app.get(Logger));
  
  // Get configuration service
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const domain = configService.get('DOMAIN', 'tolstoy.getpullse.com');
  const port = parseInt(configService.get('PORT', '3000'), 10);

  // Configure security headers with Helmet
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`, 'cdnjs.cloudflare.com'],
        scriptSrc: [`'self'`, 'cdnjs.cloudflare.com'],
        imgSrc: [`'self'`, 'data:', 'https:'],
        connectSrc: [`'self'`],
        fontSrc: [`'self'`, 'cdnjs.cloudflare.com'],
        objectSrc: [`'none'`],
        mediaSrc: [`'self'`],
        frameSrc: [`'none'`],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
  });

  // Configure CORS for production domain
  await app.register(fastifyCors, {
    origin: isProduction 
      ? [`https://${domain}`, 'https://*.getpullse.com']
      : true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-org-id',
      'x-user-id',
      'x-api-key',
      'Accept',
      'User-Agent',
    ],
  });

  // Configure rate limiting
  await app.register(fastifyRateLimit, {
    max: parseInt(configService.get('RATE_LIMIT_MAX_REQUESTS', '1000'), 10),
    timeWindow: parseInt(configService.get('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 minutes
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded, please try again later.',
    }),
  });

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
  const baseUrl = isProduction ? `https://${domain}` : `http://localhost:${port}`;
  const config = new DocumentBuilder()
    .setTitle('Tolstoy API')
    .setDescription('Interactive API reference for Tolstoy workflow automation platform')
    .setVersion(configService.get('APP_VERSION', '1.1.0'))
    .addServer(baseUrl, isProduction ? 'Production' : 'Development')
    .addServer('https://tolstoy.getpullse.com', 'Production')
    .addServer('http://localhost:3000', 'Development')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-org-id',
        in: 'header',
        description: 'Organization ID for multi-tenant access',
      },
      'x-org-id',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-user-id',
        in: 'header',
        description: 'User ID for request context',
      },
      'x-user-id',
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
  app.register(async (fastify: unknown) => {
    const fastifyInstance = fastify as FastifyInstance;
    await fastifyInstance.route({
      method: 'GET',
      url: '/openapi.json',
      handler: async (_request: FastifyRequest, reply: FastifyReply) => {
        reply.header('Access-Control-Allow-Origin', '*');
        reply.header('Access-Control-Allow-Methods', 'GET');
        reply.header('Access-Control-Allow-Headers', 'Content-Type');
        reply.header('Content-Type', 'application/json');
        return document;
      },
    });
  });

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Application is running on: ${baseUrl}`, 'Bootstrap');
  logger.log(`Environment: ${configService.get('NODE_ENV', 'development')}`, 'Bootstrap');
  logger.log(`Domain: ${domain}`, 'Bootstrap');
  logger.log(`CORS origins: ${isProduction ? `https://${domain}, https://*.getpullse.com` : 'all origins'}`, 'Bootstrap');
}

bootstrap();
