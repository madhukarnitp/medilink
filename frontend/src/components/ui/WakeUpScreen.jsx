import { RefreshCw, Server } from "lucide-react";

const bootLines = [
  "Initializing MediLink services...",
  "Checking secure API connection...",
  "Loading doctor-patient modules...",
  "Waiting for server response...",
];

const lineDelays = [
  "[animation-delay:180ms]",
  "[animation-delay:520ms]",
  "[animation-delay:860ms]",
  "[animation-delay:1200ms]",
];

export default function WakeUpScreen() {
  return (
    <main
      className="fixed inset-0 z-50 isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 py-6 font-sans text-[#e0f2fe] sm:px-6"
      role="status"
      aria-live="polite"
    >
      <div className="absolute inset-0 -z-30 opacity-40 [background-image:linear-gradient(rgba(34,211,238,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(37,99,235,0.14)_1px,transparent_1px)] [background-size:44px_44px] animate-grid-scroll" />
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_115%,rgba(37,99,235,0.25),transparent_44%)]" />
      <div className="absolute -left-24 top-12 -z-10 h-72 w-72 rounded-full bg-[#22d3ee]/20 blur-3xl animate-orb-float sm:h-96 sm:w-96" />
      <div className="absolute -right-28 bottom-8 -z-10 h-80 w-80 rounded-full bg-[#2563eb]/20 blur-3xl animate-orb-float-reverse sm:h-[28rem] sm:w-[28rem]" />
      <div className="absolute left-1/2 top-1/4 -z-10 h-48 w-48 -translate-x-1/2 rounded-full bg-[#22c55e]/10 blur-3xl animate-glow-breathe sm:h-64 sm:w-64" />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/70 to-transparent shadow-[0_0_26px_rgba(34,211,238,0.7)] animate-data-sweep" />

      <section className="relative w-full max-w-[34rem] overflow-hidden rounded-3xl border border-[#22d3ee]/35 bg-[rgba(15,23,42,0.78)] p-5 text-center shadow-[0_0_80px_rgba(34,211,238,0.24),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl animate-fade-in-up sm:p-8">
        <div className="absolute left-0 top-0 h-px w-2/3 bg-gradient-to-r from-transparent via-[#22d3ee] to-transparent shadow-[0_0_18px_rgba(34,211,238,0.95)] animate-scan-line" />
        <div className="pointer-events-none absolute inset-x-8 top-0 h-24 bg-[#22d3ee]/5 blur-2xl" />

        <div className="relative mx-auto mb-6 flex justify-center">
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[#22d3ee]/45 bg-slate-950/85 shadow-[0_0_42px_rgba(34,211,238,0.34)] animate-pulse-ring">
            <span className="absolute inset-2 rounded-full border border-[#22c55e]/20 animate-inner-glow" />
            <span className="absolute inset-0 rounded-full border border-[#22d3ee]/20 animate-spin-slow" />
            <Server
              className="relative h-10 w-10 text-[#22d3ee] drop-shadow-[0_0_14px_rgba(34,211,238,0.9)]"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <RefreshCw
              className="absolute -right-1 bottom-2 h-6 w-6 rounded-full bg-slate-950/90 p-1 text-[#22c55e] shadow-[0_0_16px_rgba(34,197,94,0.65)] animate-spin-slow"
              strokeWidth={2.2}
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#22d3ee]/75">
            Secure Health System
          </p>
          <h1 className="bg-gradient-to-r from-[#e0f2fe] via-[#22d3ee] to-[#22c55e] bg-clip-text font-heading text-3xl font-bold tracking-normal text-transparent sm:text-4xl">
            MediLink Server
          </h1>
          <h2 className="text-lg font-semibold text-cyan-100 sm:text-xl">
            Waking Up Securely
          </h2>
          <p className="mx-auto max-w-md text-sm leading-6 text-[#94a3b8] sm:text-base">
            Our backend is starting after inactivity. We are reconnecting you
            safely.
          </p>
        </div>

        <div className="mt-6 inline-flex max-w-full items-center gap-2 rounded-full border border-[#22c55e]/25 bg-[#22c55e]/10 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-[0_0_18px_rgba(34,197,94,0.12)] sm:text-sm">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-70 animate-ping-slow" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.9)]" />
          </span>
          <span className="truncate">Trying to connect with backend server...</span>
        </div>

        <div className="mt-6 h-2 overflow-hidden rounded-full border border-[#22d3ee]/20 bg-slate-950/80">
          <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-[#22d3ee] via-[#22c55e] to-[#22d3ee] shadow-[0_0_18px_rgba(34,211,238,0.8)] animate-shimmer" />
        </div>

        <div className="mt-6 rounded-2xl border border-[#22d3ee]/15 bg-slate-950/70 p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="mb-3 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-300/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]/80" />
          </div>
          <div className="space-y-2 font-mono text-xs leading-5 text-cyan-100/85 sm:text-sm">
            {bootLines.map((line, index) => (
              <p
                className={`flex min-w-0 items-center gap-2 opacity-0 animate-terminal-line ${lineDelays[index]}`}
                key={line}
              >
                <span className="text-[#22c55e]">&gt;</span>
                <span className="truncate animate-typewriter">{line}</span>
                {index === bootLines.length - 1 ? (
                  <span className="h-4 w-1.5 bg-[#22d3ee] animate-cursor-blink" />
                ) : null}
              </p>
            ))}
          </div>
        </div>

        <p className="mt-5 text-xs font-medium text-[#94a3b8] sm:text-sm">
          Please keep this page open. You will be redirected automatically.
        </p>
      </section>
    </main>
  );
}
