import { useEffect, useMemo, useState } from "react";
import { useApp, PAGES } from "../../context/AppContext";
import { Button, ErrorMsg, PageSkeleton } from "../ui/UI";
import { doctors as doctorsApi, resolveAssetUrl } from "../../services/api";
import { doctorPatientsStyles as styles } from "../../styles/tailwindStyles";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
];

const formatDate = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (name = "Patient") =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "P";

const getStatusClassName = (status) =>
  ({
    pending: styles.statusPending,
    completed: styles.statusCompleted,
    active: styles.statusActive,
    cancelled: styles.statusCancelled,
  })[status] || styles.statusDefault;

export default function DoctorPatients() {
  const { navigate } = useApp();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await doctorsApi.getPatients({ limit: 50 });
      setPatients(response.data || []);
    } catch (err) {
      setError(err.message || "Unable to load patients");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(
    () => ({
      patients: patients.length,
      consultations: patients.reduce(
        (sum, row) => sum + (row.totalConsultations || 0),
        0,
      ),
      active: patients.reduce(
        (sum, row) => sum + (row.activeConsultations || 0),
        0,
      ),
      prescriptions: patients.reduce(
        (sum, row) => sum + (row.prescriptionsIssued || 0),
        0,
      ),
    }),
    [patients],
  );

  const filteredPatients = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return patients.filter((row) => {
      const patient = row.patient || {};
      const user = patient.userId || {};
      const haystack = [
        user.name,
        user.email,
        user.phone,
        patient._id,
        row.lastConsultation?.reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !normalized || haystack.includes(normalized);
      const matchesFilter =
        filter === "all" || (row[`${filter}Consultations`] || 0) > 0;
      return matchesQuery && matchesFilter;
    });
  }, [filter, patients, query]);

  if (loading) {
    return (
      <div className={styles.page}>
        <PageSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorMsg message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>My Patients</h1>
          <p className={styles.headerSubtitle}>
            People who have consulted with you, including old patients.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate(PAGES.CONSULTATION_LIST)}>
          Consultation Records
        </Button>
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span>Total Patients</span>
          <strong>{summary.patients}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Consultations</span>
          <strong>{summary.consultations}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Active Now</span>
          <strong>{summary.active}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Rx Issued</span>
          <strong>{summary.prescriptions}</strong>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patient, email, phone, or reason"
            type="search"
          />
        </div>
        <div className={styles.filterBar}>
          {FILTERS.map((item) => (
            <button
              key={item.value}
              className={`${styles.filterBtn} ${
                filter === item.value ? styles.active : ""
              }`}
              onClick={() => setFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.list}>
        {filteredPatients.length === 0 ? (
          <div className={styles.empty}>
            <strong>No patients found</strong>
            <span>
              {patients.length === 0
                ? "Your consulted patients will appear here after a consultation starts."
                : "Try a different search or filter."}
            </span>
          </div>
        ) : (
          filteredPatients.map((row) => {
            const patient = row.patient || {};
            const user = patient.userId || {};
            const name = user.name || "Patient";
            const avatarUrl = resolveAssetUrl(user.avatar);
            const last = row.lastConsultation || {};
            const activeOrPending =
              (row.activeConsultations || 0) + (row.pendingConsultations || 0);

            return (
              <article className={styles.card} key={patient._id}>
                <div className={styles.patientBlock}>
                  <div className={styles.avatar}>
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : getInitials(name)}
                  </div>
                  <div className={styles.patientInfo}>
                    <div className={styles.nameRow}>
                      <h2>{name}</h2>
                      <span
                        className={`${styles.status} ${getStatusClassName(last.status)}`}
                      >
                        {last.status || "history"}
                      </span>
                    </div>
                    <div className={styles.meta}>
                      <span>{user.email || "No email"}</span>
                      <span>{user.phone || "No phone"}</span>
                      <span>ID: {patient._id?.slice(-6)}</span>
                    </div>
                    <div className={`${styles.lastReason} break-words`}>
                      Last consultation:{" "}
                      {formatDate(row.lastConsultationAt || last.createdAt)}
                    </div>
                  </div>
                </div>

                <div className={styles.stats}>
                  <span>
                    <strong>{row.totalConsultations || 0}</strong>
                    Consults
                  </span>
                  <span>
                    <strong>{row.completedConsultations || 0}</strong>
                    Completed
                  </span>
                  <span>
                    <strong>{activeOrPending}</strong>
                    Open
                  </span>
                  <span>
                    <strong>{row.prescriptionsIssued || 0}</strong>
                    Rx
                  </span>
                </div>

                <div className={styles.actions}>
                  {last._id && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(PAGES.CONSULTATION, {
                          consultationId: last._id,
                        })
                      }
                    >
                      Open Last
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(PAGES.PATIENT_VITALS, {
                        patientId: patient._id,
                      })
                    }
                  >
                    Vitals
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      navigate(PAGES.PATIENT_REPORTS, {
                        patientId: patient._id,
                      })
                    }
                  >
                    Reports
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() =>
                      navigate(PAGES.CREATE_PRESCRIPTION, {
                        patientId: patient._id,
                      })
                    }
                  >
                    New Rx
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
