// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Initialize Sentry as early as possible
const sentryDsn = process.env.SENTRY_DSN;
const nodeEnv = process.env.NODE_ENV || 'development';

if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    integrations: [nodeProfilingIntegration()],
    environment: nodeEnv,
    // Tracing
    tracesSampleRate: nodeEnv === 'production' ? 0.25 : 1.0, // Capture 25% in prod, 100% in dev
    // Set sampling rate for profiling - this is evaluated only once per SDK.init call
    profileSessionSampleRate: nodeEnv === 'production' ? 0.1 : 1.0,
    // Trace lifecycle automatically enables profiling during active traces
    profileLifecycle: 'trace',

    // Send structured logs to Sentry
    enableLogs: true,

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: false, // Keep false for privacy

    beforeSend(event) {
      // Filter out sensitive information
      if (event.request?.data) {
        delete event.request.data;
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
        sensitiveHeaders.forEach(header => {
          if (event.request?.headers?.[header]) {
            event.request.headers[header] = '[REDACTED]';
          }
        });
      }

      return event;
    },
  });

  console.log(`Sentry initialized for ${nodeEnv} environment`);
} else {
  console.log('Sentry DSN not provided, skipping Sentry initialization');
}
