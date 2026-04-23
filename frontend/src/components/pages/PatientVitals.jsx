import { useEffect, useState } from "react";
import { useApp, PAGES } from "../../context/AppContext";
import { Button, ErrorMsg, PageSkeleton, Modal } from "../ui/UI";
import { vitals as vitalsApi } from "../../services/api";
import { patientVitalsStyles as styles } from "../../styles/tailwindStyles";

const formatDate = (value) => {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function PatientVitals() {
  const { navigate, pageParams } = useApp();
  const patientId = pageParams.patientId;
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    bloodPressure: { systolic: "", diastolic: "" },
    heartRate: "",
    temperature: { value: "", unit: "Celsius" },
    weight: "",
    height: "",
    oxygenSaturation: "",
    respiratoryRate: "",
    notes: "",
  });

  const loadVitals = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await vitalsApi.getForPatient(patientId);
      setVitals(response.data || []);
    } catch (err) {
      setError(err.message || "Unable to load vitals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      loadVitals();
    } else {
      setLoading(false);
      setError("Patient ID is required");
    }
  }, [patientId]);

  const handleAddVital = async () => {
    try {
      const vitalData = {
        ...formData,
        bloodPressure: {
          systolic: parseFloat(formData.bloodPressure.systolic) || undefined,
          diastolic: parseFloat(formData.bloodPressure.diastolic) || undefined,
        },
        heartRate: parseFloat(formData.heartRate) || undefined,
        temperature: {
          value: parseFloat(formData.temperature.value) || undefined,
          unit: formData.temperature.unit,
        },
        weight: parseFloat(formData.weight) || undefined,
        height: parseFloat(formData.height) || undefined,
        oxygenSaturation: parseFloat(formData.oxygenSaturation) || undefined,
        respiratoryRate: parseFloat(formData.respiratoryRate) || undefined,
      };

      await vitalsApi.addForPatient(patientId, vitalData);
      setShowAddModal(false);
      setFormData({
        bloodPressure: { systolic: "", diastolic: "" },
        heartRate: "",
        temperature: { value: "", unit: "Celsius" },
        weight: "",
        height: "",
        oxygenSaturation: "",
        respiratoryRate: "",
        notes: "",
      });
      loadVitals();
    } catch (err) {
      setError(err.message || "Unable to add vital");
    }
  };

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
        <ErrorMsg message={error} onRetry={loadVitals} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.headerTitle}>Patient Vitals</h1>
          <p className={styles.headerSubtitle}>
            Track and manage patient vital signs and measurements.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="outline"
            onClick={() =>
              navigate(PAGES.DOCTOR_PATIENTS, {}, { updateUrl: true, replace: true })
            }
          >
            Back
          </Button>
          <Button variant="primary" onClick={() => setShowAddModal(true)}>
            Add Vital
          </Button>
        </div>
      </div>

      <div className={styles.list}>
        {vitals.length === 0 ? (
          <div className={styles.empty}>
            <strong>No vitals recorded</strong>
            <span>Start by adding the patient's vital signs.</span>
          </div>
        ) : (
          vitals.map((vital) => (
            <div className={styles.vitalCard} key={vital._id}>
              <div className={styles.vitalHeader}>
                <h3>{formatDate(vital.createdAt)}</h3>
              </div>
              <div className={styles.vitalGrid}>
                {vital.bloodPressure?.systolic && vital.bloodPressure?.diastolic && (
                  <div className={styles.vitalItem}>
                    <span className={styles.label}>Blood Pressure</span>
                    <span className={styles.value}>
                      {vital.bloodPressure.systolic}/{vital.bloodPressure.diastolic} mmHg
                    </span>
                  </div>
                )}
                {vital.heartRate && (
                  <div className={styles.vitalItem}>
                    <span className={styles.label}>Heart Rate</span>
                    <span className={styles.value}>{vital.heartRate} bpm</span>
                  </div>
                )}
                {vital.temperature?.value && (
                  <div className={styles.vitalItem}>
                    <span className={styles.label}>Temperature</span>
                    <span className={styles.value}>
                      {vital.temperature.value}° {vital.temperature.unit}
                    </span>
                  </div>
                )}
                {vital.weight && (
                  <div className={styles.vitalItem}>
                    <span className={styles.label}>Weight</span>
                    <span className={styles.value}>{vital.weight} kg</span>
                  </div>
                )}
                {vital.height && (
                  <div className={styles.vitalItem}>
                    <span className={styles.label}>Height</span>
                    <span className={styles.value}>{vital.height} cm</span>
                  </div>
                )}
                {vital.oxygenSaturation && (
                  <div className={styles.vitalItem}>
                    <span className={styles.label}>Oxygen Saturation</span>
                    <span className={styles.value}>{vital.oxygenSaturation}%</span>
                  </div>
                )}
                {vital.respiratoryRate && (
                  <div className={styles.vitalItem}>
                    <span className={styles.label}>Respiratory Rate</span>
                    <span className={styles.value}>{vital.respiratoryRate} breaths/min</span>
                  </div>
                )}
              </div>
              {vital.notes && (
                <div className={styles.notes}>
                  <strong>Notes:</strong> {vital.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <div className={styles.modalContent}>
            <h2>Add Vital Signs</h2>
            <div className={styles.form}>
              <div className={styles.formRow}>
                <label>
                  Blood Pressure (mmHg)
                  <div className={styles.bpInputs}>
                    <input
                      type="number"
                      placeholder="Systolic"
                      value={formData.bloodPressure.systolic}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bloodPressure: { ...formData.bloodPressure, systolic: e.target.value },
                        })
                      }
                    />
                    <span>/</span>
                    <input
                      type="number"
                      placeholder="Diastolic"
                      value={formData.bloodPressure.diastolic}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bloodPressure: { ...formData.bloodPressure, diastolic: e.target.value },
                        })
                      }
                    />
                  </div>
                </label>
              </div>
              <div className={styles.formRow}>
                <label>
                  Heart Rate (bpm)
                  <input
                    type="number"
                    value={formData.heartRate}
                    onChange={(e) => setFormData({ ...formData, heartRate: e.target.value })}
                  />
                </label>
              </div>
              <div className={styles.formRow}>
                <label>
                  Temperature
                  <div className={styles.tempInputs}>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Value"
                      value={formData.temperature.value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          temperature: { ...formData.temperature, value: e.target.value },
                        })
                      }
                    />
                    <select
                      value={formData.temperature.unit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          temperature: { ...formData.temperature, unit: e.target.value },
                        })
                      }
                    >
                      <option value="Celsius">°C</option>
                      <option value="Fahrenheit">°F</option>
                    </select>
                  </div>
                </label>
              </div>
              <div className={styles.formRow}>
                <label>
                  Weight (kg)
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </label>
                <label>
                  Height (cm)
                  <input
                    type="number"
                    step="0.1"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  />
                </label>
              </div>
              <div className={styles.formRow}>
                <label>
                  Oxygen Saturation (%)
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.oxygenSaturation}
                    onChange={(e) => setFormData({ ...formData, oxygenSaturation: e.target.value })}
                  />
                </label>
                <label>
                  Respiratory Rate (breaths/min)
                  <input
                    type="number"
                    value={formData.respiratoryRate}
                    onChange={(e) => setFormData({ ...formData, respiratoryRate: e.target.value })}
                  />
                </label>
              </div>
              <div className={styles.formRow}>
                <label>
                  Notes
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </label>
              </div>
              <div className={styles.modalActions}>
                <Button variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleAddVital}>
                  Add Vital
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
