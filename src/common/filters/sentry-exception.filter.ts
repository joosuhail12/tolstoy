import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import * as Sentry from '@sentry/nestjs';

@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(SentryExceptionFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();

    // Extract request context for Sentry
    const requestContext = {
      url: request.url,
      method: request.method,
      headers: this.sanitizeHeaders(request.headers),
      query: request.query,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
    };

    // Extract tenant context if available
    const tenantContext: Record<string, unknown> = {};
    if (request.headers['x-org-id']) {
      tenantContext.orgId = request.headers['x-org-id'];
    }
    if (request.headers['x-user-id']) {
      tenantContext.userId = request.headers['x-user-id'];
    }

    // Determine HTTP status and error details
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode: string | undefined;
    let validationErrors: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        const responseObj = response as Record<string, unknown>;
        message = (responseObj.message as string) || message;
        errorCode = responseObj.error as string;
        validationErrors = responseObj.errors;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Only report to Sentry if it's a server error or unhandled exception
    const shouldReportToSentry = status >= 500 || !(exception instanceof HttpException);

    if (shouldReportToSentry) {
      // Configure Sentry context
      Sentry.withScope(scope => {
        // Set request context
        scope.setContext('request', requestContext);

        // Set tenant tags
        if (tenantContext.orgId) {
          scope.setTag('orgId', tenantContext.orgId as string);
        }
        if (tenantContext.userId) {
          scope.setTag('userId', tenantContext.userId as string);
        }

        // Set error details
        scope.setTag('httpStatus', status);
        if (errorCode) {
          scope.setTag('errorCode', errorCode);
        }

        // Add extra context
        scope.setExtra('httpMethod', request.method);
        scope.setExtra('url', request.url);
        if (validationErrors) {
          scope.setExtra('validationErrors', validationErrors);
        }

        // Set error level based on status
        scope.setLevel(status >= 500 ? 'error' : 'warning');

        // Capture the exception
        Sentry.captureException(exception);
      });

      this.logger.error(
        {
          error: exception instanceof Error ? exception.message : String(exception),
          stack: exception instanceof Error ? exception.stack : undefined,
          status,
          url: request.url,
          method: request.method,
          ...tenantContext,
        },
        'Unhandled exception captured by Sentry filter',
      );
    } else {
      // Log client errors at debug level
      this.logger.debug(
        {
          error: message,
          status,
          url: request.url,
          method: request.method,
          ...tenantContext,
        },
        'Client error handled by Sentry filter',
      );
    }

    // Prepare error response
    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Add validation errors if present
    if (validationErrors) {
      errorResponse.errors = validationErrors;
    }

    // Add error code if present
    if (errorCode) {
      errorResponse.error = errorCode;
    }

    // Send response
    reply.code(status).send(errorResponse);
  }

  /**
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
