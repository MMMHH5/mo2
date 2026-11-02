import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;
const configuredSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.05');
const tracesSampleRate = Number.isFinite(configuredSampleRate)
    ? Math.min(1, Math.max(0, configuredSampleRate))
    : 0.05;

Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate,
    initialScope: {
        tags: {
            surface: process.env.ADMIN_SURFACE === '1' ? 'admin' : 'learner',
        },
    },
    dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        databaseQueryData: false,
        stackFrameVariables: false,
    },
    beforeSend(event) {
        delete event.user;
        if (event.request) {
            delete event.request.cookies;
            delete event.request.data;
            delete event.request.headers;
            delete event.request.query_string;
            if (event.request.url) {
                event.request.url = event.request.url.split(/[?#]/, 1)[0];
            }
        }
        return event;
    },
});
