export default function ConsultationHeader({
  accepting,
  canAccept,
  consultationStatus,
  isActive,
  onAccept,
  peerName,
  socketReady,
  specialization,
}) {
  const statusText =
    consultationStatus === "pending"
      ? "Waiting for doctor acceptance"
      : consultationStatus
        ? consultationStatus.charAt(0).toUpperCase() +
          consultationStatus.slice(1)
        : "Connecting";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[22px] font-bold text-med-text">
          {isActive ? "Live Consultation" : "Consultation Request"}
        </h1>
        <p className="mt-1 text-[13px] text-med-muted">
          {socketReady ? (
            <>
              <span className="text-[10px] text-med-primary">●</span> Connected with{" "}
              {peerName}
              {specialization ? ` · ${specialization}` : ""} · {statusText}
            </>
          ) : (
            `Connecting to ${peerName}...`
          )}
        </p>
      </div>

      {canAccept && (
        <button
          className="ml-auto min-h-[38px] shrink-0 whitespace-nowrap rounded-med bg-med-primary px-3.5 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
          onClick={onAccept}
          disabled={accepting}
          type="button"
        >
          {accepting ? "Accepting..." : "Accept Consultation"}
        </button>
      )}
    </div>
  );
}
