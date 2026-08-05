/**
 * Sentry initialization placeholder.
 * Install @sentry/react when ready to enable error tracking:
 *   npm install @sentry/react
 *
 * Once installed, uncomment the implementation below.
 */

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  // TODO: Uncomment after installing @sentry/react
  // import("@sentry/react").then((Sentry) => {
  //   Sentry.init({
  //     dsn,
  //     environment: import.meta.env.MODE,
  //     integrations: [
  //       Sentry.browserTracingIntegration(),
  //       Sentry.replayIntegration(),
  //     ],
  //     tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
  //     replaysSessionSampleRate: 0.1,
  //     replaysOnErrorSampleRate: 1.0,
  //   });
  // });

  console.log("[Sentry] Would initialize with DSN:", dsn.slice(0, 20) + "...");
}
