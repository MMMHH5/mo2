import * as Sentry from '@sentry/nextjs';

export function initializeSentry(runtime: 'browser' | 'node' | 'edge') {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    const configuredSampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? '0.05');
    const tracesSampleRate = Number.isFinite(configuredSampleRate)
        ? Math.min(1, Math.max(0, configuredSampleRate))
        : 0.05;

    Sentry.init({
        dsn,
        enabled: Boolean(dsn),
        environment: process.env.NODE_ENV ?? 'development',
        tracesSampleRate,
        initialScope: {
            tags: {
                runtime,
                app_mode: process.env.NEXT_PUBLIC_APP_MODE ?? 'unknown',
            },
        },
        dataCollection: {
            userInfo: false,
            cookies: false,
            httpHeaders: false,
            httpBodies: [],
            urlQueryParams: false,
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
        beforeBreadcrumb(breadcrumb) {
            if (
                (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr')
                && typeof breadcrumb.data?.url === 'string'
            ) {
                breadcrumb.data.url = breadcrumb.data.url.split(/[?#]/, 1)[0];
            }
            return breadcrumb;
        },
    });
}
