import { API_BASE_URL } from "./api";

const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
const REALTIME_ORIGIN =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_REALTIME_URL) ||
  (typeof import.meta !== "undefined" && import.meta.env?.DEV
    ? "http://localhost:5002"
    : API_ORIGIN);

const KEEPALIVE_ENABLED =
  ((typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_KEEPALIVE_ENABLED) ||
    "true") !== "false";
const KEEPALIVE_INTERVAL_MS = Math.max(
  60_000,
  Number(
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_KEEPALIVE_INTERVAL_MS) ||
      4 * 60_000,
  ) || 4 * 60_000,
);
const KEEPALIVE_TIMEOUT_MS = Math.max(
  2_000,
  Number(
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_KEEPALIVE_TIMEOUT_MS) ||
      8_000,
  ) || 8_000,
);

const HEALTH_ENDPOINTS = [...new Set([
  `${API_ORIGIN}/api/health`,
  `${REALTIME_ORIGIN.replace(/\/$/, "")}/health`,
])];

let keepAliveTimer = null;
let visibilityHandlerBound = false;
let started = false;

const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";

const shouldRunKeepAlive = () =>
  KEEPALIVE_ENABLED &&
  isBrowser() &&
  document.visibilityState === "visible" &&
  navigator.onLine !== false;

const pingUrl = async (url) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), KEEPALIVE_TIMEOUT_MS);

  try {
    await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      keepalive: true,
    });
  } catch {
    // Intentionally ignore warmup failures. Real requests will surface actual issues.
  } finally {
    window.clearTimeout(timeout);
  }
};

const runKeepAlive = async () => {
  if (!shouldRunKeepAlive()) return;
  await Promise.all(HEALTH_ENDPOINTS.map((url) => pingUrl(url)));
};

const scheduleKeepAlive = () => {
  if (!KEEPALIVE_ENABLED || !isBrowser()) return;
  if (keepAliveTimer) {
    window.clearTimeout(keepAliveTimer);
    keepAliveTimer = null;
  }
  if (!shouldRunKeepAlive()) return;

  keepAliveTimer = window.setTimeout(async () => {
    await runKeepAlive();
    scheduleKeepAlive();
  }, KEEPALIVE_INTERVAL_MS);
};

const handleVisibilityChange = async () => {
  if (!shouldRunKeepAlive()) {
    if (keepAliveTimer) {
      window.clearTimeout(keepAliveTimer);
      keepAliveTimer = null;
    }
    return;
  }

  await runKeepAlive();
  scheduleKeepAlive();
};

export const startKeepAlive = () => {
  if (started || !KEEPALIVE_ENABLED || !isBrowser()) return;
  started = true;

  if (!visibilityHandlerBound) {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleVisibilityChange);
    visibilityHandlerBound = true;
  }

  runKeepAlive().finally(() => {
    scheduleKeepAlive();
  });
};

export const stopKeepAlive = () => {
  if (!isBrowser()) return;
  if (keepAliveTimer) {
    window.clearTimeout(keepAliveTimer);
    keepAliveTimer = null;
  }
  if (visibilityHandlerBound) {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleVisibilityChange);
    visibilityHandlerBound = false;
  }
  started = false;
};

export const keepAliveConfig = {
  enabled: KEEPALIVE_ENABLED,
  intervalMs: KEEPALIVE_INTERVAL_MS,
  timeoutMs: KEEPALIVE_TIMEOUT_MS,
  endpoints: HEALTH_ENDPOINTS,
};
