import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals";

function reportMetric(metric: Metric) {
  // Send to Sentry or analytics endpoint
  if (import.meta.env.VITE_SENTRY_DSN) {
    // In production, send to Sentry performance monitoring
    console.log(`[Web Vitals] ${metric.name}: ${metric.value.toFixed(2)}`);
  }

  // Could also send to PostHog/Plausible
  if (typeof window !== "undefined" && "navigator" in window && "sendBeacon" in navigator) {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      id: metric.id,
      navigationType: metric.navigationType,
    });
    // navigator.sendBeacon('/api/analytics/vitals', body);
    void body; // Will be used when analytics endpoint is set up
  }
}

export function initWebVitals() {
  onCLS(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onFCP(reportMetric);
  onTTFB(reportMetric);
}
