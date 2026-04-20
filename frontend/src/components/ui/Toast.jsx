import { toastStyles as styles } from "../../styles/tailwindStyles";

const STATUS = {
  success: {
    icon: "✓",
    label: "Success",
    className: styles.success,
  },
  error: {
    icon: "✕",
    label: "Error",
    className: styles.error,
  },
  warning: {
    icon: "!",
    label: "Warning",
    className: styles.warning,
  },
  info: {
    icon: "i",
    label: "Info",
    className: styles.info,
  },
  loading: {
    icon: "…",
    label: "Status",
    className: styles.loading,
  },
};

export default function Toast({
  message,
  onDismiss,
  toasts,
  type = "success",
}) {
  const items = toasts || (message ? [{ id: "single", message, type }] : []);
  if (items.length === 0) return null;

  return (
    <div className={styles.wrap} aria-live="polite" aria-atomic="false">
      {items.map((item) => {
        const status = STATUS[item.type] || STATUS.info;
        return (
          <div
            className={`${styles.toast} ${status.className}`}
            key={item.id}
            role={item.type === "error" ? "alert" : "status"}
          >
            <div className={styles.icon}>{status.icon}</div>
            <div className={styles.body}>
              <div className={styles.label}>{status.label}</div>
              <div className={styles.message}>{item.message}</div>
            </div>
            {onDismiss && (
              <button
                aria-label="Dismiss notification"
                className={styles.close}
                onClick={() => onDismiss(item.id)}
                type="button"
              >
                ×
              </button>
            )}
            <span className={styles.progress} />
          </div>
        );
      })}
    </div>
  );
}
