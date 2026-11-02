import * as Sentry from '@sentry/nextjs';
import { initializeSentry } from './sentry-config';

initializeSentry('browser');

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
