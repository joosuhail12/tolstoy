// All imports below
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
import { SentryConfigService } from './config/sentry-config.service';
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

  // Initialize Sentry with AWS Secrets Manager integration
  const sentryConfigService = app.get(SentryConfigService);
  await sentryConfigService.initializeSentry();

  // Get configuration service
  const configService = app.get(ConfigService);
  const isProduction = configService.get('NODE_ENV') === 'production';
  const domain = configService.get('DOMAIN', 'tolstoy.getpullse.com');
  const port = parseInt(configService.get('PORT', '3000'), 10);

  // Configure security headers with Helmet
  await app.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'cdnjs.cloudflare.com'],
        scriptSrc: ["'self'", 'cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'cdnjs.cloudflare.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Disable for API compatibility
  });

  // Configure CORS for production domain
  await app.register(fastifyCors, {
    origin: isProduction ? [`https://${domain}`, 'https://*.getpullse.com'] : true, // Allow all origins in development
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

  // Serve basic Swagger UI at /api-docs (optional)
  await SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Serve enhanced Swagger UI at /docs
  await SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: '/openapi.json',
    yamlDocumentUrl: '/openapi.yaml',
    customSiteTitle: 'Tolstoy API - Advanced Documentation & Playground',
    customCss: `
      :root {
        --primary: #2563eb;
        --primary-light: #3b82f6;
        --success: #10b981;
        --warning: #f59e0b;
        --error: #ef4444;
      }
      
      .swagger-ui .topbar { display: none; }
      
      .swagger-ui .info { 
        background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
        color: white;
        padding: 2rem;
        border-radius: 8px;
        margin-bottom: 2rem;
      }
      
      .swagger-ui .info .title {
        color: white;
        font-size: 2.5rem;
        margin-bottom: 0.5rem;
      }
      
      .swagger-ui .info .description {
        color: rgba(255,255,255,0.9);
        font-size: 1.1rem;
      }
      
      .swagger-ui .scheme-container {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 8px;
        padding: 1rem;
        margin-bottom: 2rem;
      }
      
      .swagger-ui .auth-wrapper {
        background: #e3f2fd;
        border: 1px solid #bbdefb;
        border-radius: 8px;
        padding: 1rem;
        margin: 1rem 0;
      }
      
      .swagger-ui .btn.authorize {
        background: var(--primary);
        border-color: var(--primary);
        color: white;
      }
      
      .swagger-ui .btn.authorize:hover {
        background: var(--primary-light);
        border-color: var(--primary-light);
      }
    `,
    customJs: `
      (function() {
        // Enhanced authentication and history tracking
        let requestHistory = JSON.parse(localStorage.getItem('tolstoy-request-history') || '[]');
        
        // Add authentication helper
        function addAuthenticationHelper() {
          const authContainer = document.querySelector('.auth-wrapper') || document.querySelector('.scheme-container');
          if (!authContainer) return;
          
          const helperHtml = \`
            <div style="background: #fff3cd; border: 1px solid #ffecb5; border-radius: 6px; padding: 1rem; margin: 1rem 0;">
              <h4 style="color: #856404; margin: 0 0 0.5rem 0;">🔐 Multi-tenant Authentication</h4>
              <p style="margin: 0; color: #856404;">
                This API requires <strong>x-org-id</strong> and <strong>x-user-id</strong> headers for all requests except /health.
                Use the "Authorize" button above or set them manually in each request.
              </p>
              <div style="margin-top: 0.5rem;">
                <input type="text" id="quick-org-id" placeholder="Organization ID" style="margin-right: 0.5rem; padding: 0.25rem;">
                <input type="text" id="quick-user-id" placeholder="User ID" style="margin-right: 0.5rem; padding: 0.25rem;">
                <button onclick="setQuickAuth()" style="background: var(--primary); color: white; border: none; padding: 0.25rem 0.5rem; border-radius: 4px;">Set Auth</button>
              </div>
            </div>
          \`;
          
          authContainer.insertAdjacentHTML('afterend', helperHtml);
        }
        
        // Quick auth function
        window.setQuickAuth = function() {
          const orgId = document.getElementById('quick-org-id').value;
          const userId = document.getElementById('quick-user-id').value;
          
          if (orgId && userId) {
            localStorage.setItem('tolstoy-org-id', orgId);
            localStorage.setItem('tolstoy-user-id', userId);
            
            // Update Swagger UI auth
            const ui = window.ui;
            if (ui) {
              ui.preauthorizeApiKey('x-org-id', orgId);
              ui.preauthorizeApiKey('x-user-id', userId);
            }
            
            alert('Authentication credentials set! They will be included in all requests.');
          }
        };
        
        // Load saved credentials
        const savedOrgId = localStorage.getItem('tolstoy-org-id');
        const savedUserId = localStorage.getItem('tolstoy-user-id');
        
        // Wait for SwaggerUI to load
        setTimeout(() => {
          addAuthenticationHelper();
          
          // Pre-fill saved credentials
          if (savedOrgId) document.getElementById('quick-org-id').value = savedOrgId;
          if (savedUserId) document.getElementById('quick-user-id').value = savedUserId;
          
          // Pre-authorize if credentials exist
          if (savedOrgId && savedUserId && window.ui) {
            window.ui.preauthorizeApiKey('x-org-id', savedOrgId);
            window.ui.preauthorizeApiKey('x-user-id', savedUserId);
          }
        }, 2000);
        
        // Add request/response interceptors if possible
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          const [url, options = {}] = args;
          
          // Add auth headers if not present and not health endpoint
          if (!url.includes('/health') && !url.includes('/openapi.json')) {
            const orgId = localStorage.getItem('tolstoy-org-id');
            const userId = localStorage.getItem('tolstoy-user-id');
            
            if (orgId || userId) {
              options.headers = options.headers || {};
              if (orgId) options.headers['x-org-id'] = orgId;
              if (userId) options.headers['x-user-id'] = userId;
            }
          }
          
          // Track request
          const requestData = {
            url: url,
            method: options.method || 'GET',
            timestamp: new Date().toISOString()
          };
          
          return originalFetch.apply(this, [url, options])
            .then(response => {
              // Track response
              requestHistory.unshift({
                ...requestData,
                status: response.status,
                statusText: response.statusText
              });
              requestHistory = requestHistory.slice(0, 50);
              localStorage.setItem('tolstoy-request-history', JSON.stringify(requestHistory));
              
              return response;
            });
        };
      })();
    `,
    swaggerOptions: {
      persistAuthorization: true,
      requestInterceptor: function(request) {
        // This will be stringified, so keep it simple
        const orgId = localStorage.getItem('tolstoy-org-id');
        const userId = localStorage.getItem('tolstoy-user-id');
        
        if (!request.url.includes('/health') && !request.url.includes('/openapi.json')) {
          request.headers = request.headers || {};
          if (orgId) request.headers['x-org-id'] = orgId;
          if (userId) request.headers['x-user-id'] = userId;
        }
        
        return request;
      }
    }
  });

  // OpenAPI endpoint is now automatically created by SwaggerModule.setup with the jsonDocumentUrl option

  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Application is running on: ${baseUrl}`, 'Bootstrap');
  logger.log(`Environment: ${configService.get('NODE_ENV', 'development')}`, 'Bootstrap');
  logger.log(`Domain: ${domain}`, 'Bootstrap');
  logger.log(
    `CORS origins: ${isProduction ? `https://${domain}, https://*.getpullse.com` : 'all origins'}`,
    'Bootstrap',
  );
}

bootstrap();
