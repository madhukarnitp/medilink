import { useEffect, useMemo, useState } from "react";
import { Button, PageHeader, StatusPill } from "../../components/ui/UI";

const getBackendHealthUrl = () => {
  const backendUrl = import.meta.env?.VITE_BACKEND_URL;
  if (backendUrl) return `${backendUrl.replace(/\/$/, "")}/api/health`;

  const apiUrl = import.meta.env?.VITE_API_URL || "http://localhost:5001/api";
  return `${apiUrl.replace(/\/api\/?$/, "").replace(/\/$/, "")}/api/health`;
};

const getRealtimeHealthUrl = () => {
  const realtimeUrl =
    import.meta.env?.VITE_REALTIME_URL ||
    (import.meta.env?.DEV ? "http://localhost:5002" : window.location.origin);
  return `${realtimeUrl.replace(/\/$/, "")}/health`;
};

async function checkUrl(url, signal) {
  const startedAt = performance.now();
  const response = await fetch(url, { cache: "no-store", signal });
  return {
    ok: response.ok,
    status: response.status,
    latencyMs: Math.round(performance.now() - startedAt),
  };
}

export default function StatusPage() {
  const endpoints = useMemo(
    () => ({
      backend: getBackendHealthUrl(),
      realtime: getRealtimeHealthUrl(),
    }),
    [],
  );
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState("");
  const [status, setStatus] = useState({
    frontend: { ok: true, status: "running" },
    backend: { ok: false, status: "checking" },
    realtime: { ok: false, status: "checking" },
  });

  const refresh = async () => {
    setChecking(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3500);

    const settle = async (key, url) => {
      try {
        return [key, await checkUrl(url, controller.signal)];
      } catch {
        return [
          key,
          {
            ok: false,
            status: "starting",
            message: "Server is starting. Please try again in a few seconds.",
          },
        ];
      }
    };

    const results = await Promise.all([
      settle("backend", endpoints.backend),
      settle("realtime", endpoints.realtime),
    ]);

    window.clearTimeout(timeout);
    setStatus((current) => ({
      ...current,
      frontend: { ok: true, status: "running" },
      ...Object.fromEntries(results),
    }));
    setLastChecked(new Date().toLocaleString());
    setChecking(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="System"
        title="MediLink Status"
        subtitle="Live frontend, backend API, and realtime server checks."
        actions={
          <Button disabled={checking} onClick={refresh}>
            {checking ? "Checking..." : "Refresh"}
          </Button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <StatusCard label="Frontend" value="Running" item={status.frontend} />
        <StatusCard label="Backend API" value={endpoints.backend} item={status.backend} />
        <StatusCard label="Socket Server" value={endpoints.realtime} item={status.realtime} />
      </div>

      <p className="text-sm text-med-muted">
        Last checked: {lastChecked || "Checking now..."}
      </p>
    </div>
  );
}

function StatusCard({ item, label, value }) {
  return (
    <section className="rounded-med border border-med-border bg-med-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-med-text">{label}</h2>
        <StatusPill status={item.ok ? "success" : "warning"}>
          {item.ok ? "Online" : "Starting"}
        </StatusPill>
      </div>
      <p className="mt-3 break-words text-xs text-med-muted">{value}</p>
      <p className="mt-3 text-sm font-semibold text-med-text">
        {item.latencyMs ? `${item.latencyMs} ms` : item.message || item.status}
      </p>
    </section>
  );
}
