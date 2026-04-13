import { useState, useEffect } from "react";
import { useApp, PAGES } from "../../context/AppContext";
import { Button, Spinner, ErrorMsg } from "../ui/UI";
import {
  prescriptions as rxApi,
  patients as patientsApi,
} from "../../services/api";
import styles from "./CSS/Prescription.module.css";

const statusDisplay = (s) =>
  ({
    active: {
      text: "Active",
      badgeClassName: styles.statusActive,
      valueClassName: styles.valueActive,
    },
    expired: {
      text: "Expired",
      badgeClassName: styles.statusExpired,
      valueClassName: styles.valueExpired,
    },
    cancelled: {
      text: "Cancelled",
      badgeClassName: styles.statusCancelled,
      valueClassName: styles.valueCancelled,
    },
  })[s] || {
    text: "Active",
    badgeClassName: styles.statusActive,
    valueClassName: styles.valueActive,
  };

export default function Prescription() {
  const { navigate, user, selectedPrescriptionId } = useApp();
  const [rx, setRx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const isPublicVerification = !user;

  useEffect(() => {
    if (!selectedPrescriptionId) {
      setRx(null);
      setLoading(false);
      return;
    }

    let ignore = false;
    setLoading(true);
    setError("");
    setQrCodeUrl("");

    (async () => {
      try {
        const r =
          user?.role === "doctor"
            ? await rxApi.getById(selectedPrescriptionId)
            : user?.role === "patient"
              ? await patientsApi.getPrescriptionById(selectedPrescriptionId)
              : await rxApi.verify(selectedPrescriptionId);
        if (ignore) return;
        setRx(r.data);

        const QRCode = (await import("qrcode")).default;
        const prescriptionUrl = `${window.location.origin}/#/prescription/${r.data._id}`;
        const qrUrl = await QRCode.toDataURL(prescriptionUrl, {
          width: 120,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        if (!ignore) setQrCodeUrl(qrUrl);
      } catch (e) {
        if (!ignore) setError(e.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [selectedPrescriptionId, user?.role]);

  if (loading)
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <Spinner size={36} />
        </div>
      </div>
    );
  if (error && isPublicVerification)
    return (
      <PublicVerificationState
        message={error}
        onHome={() => {
          window.location.href = "/";
        }}
      />
    );
  if (error)
    return (
      <div className={styles.page}>
        <ErrorMsg message={error} />
      </div>
    );
  if (!rx)
    if (isPublicVerification)
      return (
        <PublicVerificationState
          message="No prescription record was found for this QR code."
          onHome={() => {
            window.location.href = "/";
          }}
        />
      );
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          Prescription not found.
          <br />
          <button
            className={styles.emptyBackButton}
            onClick={() => {
              if (!user) window.location.href = "/";
              else
                navigate(
                  user?.role === "doctor"
                    ? PAGES.DOCTOR_PRESCRIPTIONS
                    : PAGES.PRESCRIPTION_LIST,
                );
            }}
          >
            ← Go back
          </button>
        </div>
      </div>
    );

  const sd = statusDisplay(rx.status);
  const docName =
    rx.createdBy?.userId?.name ||
    rx.doctor?.userId?.name ||
    rx.doctor?.name ||
    "Doctor";
  const patName =
    rx.createdFor?.userId?.name ||
    rx.patient?.userId?.name ||
    rx.patient?.name ||
    (user?.role === "patient" ? user?.name : "Patient");

  const handleDownloadPDF = async () => {
    const element = document.getElementById("prescription-card");
    if (!element) return;

    // Generate QR code
    const QRCode = (await import("qrcode")).default;
    const qrCanvas = document.createElement("canvas");
    const prescriptionUrl = `${window.location.origin}/#/prescription/${rx._id}`;
    await QRCode.toCanvas(qrCanvas, prescriptionUrl, {
      width: 100,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // Add QR code to the prescription element temporarily
    const qrContainer = document.createElement("div");
    qrContainer.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      text-align: center;
      font-size: 10px;
      color: #666;
    `;
    qrContainer.innerHTML = `
      <div>Scan to verify</div>
      <img src="${qrCanvas.toDataURL()}" style="width: 80px; height: 80px; margin: 5px 0;" />
      <div style="font-size: 8px;">ID: ${rx.rxId}</div>
    `;

    element.style.position = "relative";
    element.appendChild(qrContainer);

    const html2pdf = (await import("html2pdf.js")).default;
    html2pdf()
      .from(element)
      .set({
        margin: 10,
        filename: `Prescription_${rx.rxId || "Document"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          ignoreElements: (el) => el.id === "pdf-actions",
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .save()
      .finally(() => {
        // Remove QR code after PDF generation
        element.removeChild(qrContainer);
        element.style.position = "";
      });
  };

  return (
    <div className={styles.page}>
      <div className={styles.greeting}>
        <div className={styles.backBtn}>
          <button
            onClick={() => {
              if (!user) window.location.href = "/";
              else
                navigate(
                  user?.role === "doctor"
                    ? PAGES.DOCTOR_PRESCRIPTIONS
                    : PAGES.PRESCRIPTION_LIST,
                );
            }}
          >
            ← Back
          </button>
        </div>
        <div>
          <h1>{isPublicVerification ? "Prescription Verification" : "Prescription"}</h1>
          <p>
            Issued by {docName} ·{" "}
            {new Date(rx.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
      <div className={styles.card} id="prescription-card">
        <div className={styles.rxHeader}>
          <div>
            <div className={styles.rxLogo}>MediLink</div>
            <div className={styles.rxId}>{rx.rxId}</div>
          </div>
          <div className={styles.rxDate}>
            <div className={styles.rxDateLabel}>Date</div>
            <div className={styles.rxDateVal}>
              {new Date(rx.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <div className={styles.qrSection}>
            <div className={styles.qrCode}>
              {qrCodeUrl && <img src={qrCodeUrl} alt="Prescription QR Code" />}
            </div>
            <div className={styles.qrLabel}>Scan to verify</div>
          </div>
          <div className={`${styles.statusBadge} ${sd.badgeClassName}`}>
            {sd.text}
          </div>
        </div>
        {rx.verification?.verified && (
          <div className={styles.successBanner}>
            Verified MediLink prescription. Checked{" "}
            {new Date(rx.verification.checkedAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </div>
        )}
        {rx.status === "expired" && (
          <div className={styles.warningBanner}>
            ⚠️ This prescription has expired. Please consult your doctor for a
            new one.
          </div>
        )}
        <div className={styles.parties}>
          <div className={styles.party}>
            <div className={styles.partyLabel}>Prescribed by</div>
            <div className={styles.partyName}>{docName}</div>
            <div className={styles.partyDetail}>
              {rx.createdBy?.qualification || ""}
              <br />
              Reg. No: {rx.createdBy?.regNo || "—"}
              <br />
              <span className={styles.verified}>✓ Verified</span>
            </div>
          </div>
          <div className={styles.party}>
            <div className={styles.partyLabel}>Patient</div>
            <div className={styles.partyName}>{patName}</div>
            <div className={styles.partyDetail}>
              {rx.createdFor?.age ? `Age: ${rx.createdFor.age}` : ""}
            </div>
          </div>
        </div>
        <div className={styles.validityBox}>
          <div className={styles.validityItem}>
            <span className={styles.label}>Issued</span>
            <span className={styles.value}>
              {new Date(rx.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
          <div className={styles.validityItem}>
            <span className={styles.label}>Expires</span>
            <span className={styles.value}>
              {rx.expiresAt
                ? new Date(rx.expiresAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>
          <div className={styles.validityItem}>
            <span className={styles.label}>Status</span>
            <span className={`${styles.value} ${sd.valueClassName}`}>
              {sd.text}
            </span>
          </div>
        </div>
        <div className={styles.tableWrap}>
          <div className={styles.diagnosis}>Diagnosis: {rx.diagnosis}</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Dosage</th>
                <th>Frequency</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {(rx.medicines || []).map((m, i) => (
                <tr key={i}>
                  <td>{m.name}</td>
                  <td>{m.dosage}</td>
                  <td>{m.frequency}</td>
                  <td>{m.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rx.advice && (
            <div className={styles.instructions}>
              <div className={styles.instructionsLabel}>Instructions</div>
              <div className={styles.instructionsText}>{rx.advice}</div>
            </div>
          )}
          {rx.followUpDate && (
            <div className={styles.followUp}>
              <span className={styles.followUpIcon}>📅</span>
              <span>
                Follow-up:{" "}
                {new Date(rx.followUpDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
        <div className={styles.actions} id="pdf-actions">
          <Button variant="outline" onClick={handleDownloadPDF}>
            Download PDF
          </Button>
          {rx.status === "active" && user?.role === "patient" && (
            <Button variant="primary" onClick={() => navigate(PAGES.ORDERS)}>
              Order Medicines
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicVerificationState({ message, onHome }) {
  const isNotFound = /not found/i.test(message || "");

  return (
    <div className={styles.publicPage}>
      <section className={styles.verifyPanel}>
        <div className={styles.verifyMarkError}>{isNotFound ? "404" : "!"}</div>
        <div className={styles.verifyContent}>
          <span className={styles.verifyEyebrow}>Prescription verification</span>
          <h1>{isNotFound ? "Prescription not found" : "Verification failed"}</h1>
          <p>
            {isNotFound
              ? "This QR code does not match an active MediLink prescription record."
              : "MediLink could not verify this prescription right now. Check the QR code or try again."}
          </p>
          <div className={styles.verifyReason}>
            <span>Status</span>
            <strong>{message || "Unable to verify prescription"}</strong>
          </div>
          <div className={styles.verifyActions}>
            <button onClick={() => window.location.reload()} type="button">
              Try again
            </button>
            <button onClick={onHome} type="button">
              Go to MediLink
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
