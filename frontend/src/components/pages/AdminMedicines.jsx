import { useEffect, useState } from "react";
import { admin as adminApi } from "../../services/api";
import { Button, ErrorMsg, Spinner } from "../ui/UI";
import { adminDashboardStyles as styles } from "../../styles/tailwindStyles";

const MEDICINE_FILTERS = ["all", "available", "low_stock", "out_of_stock"];

const EMPTY_MEDICINE_FORM = {
  name: "",
  genericName: "",
  brand: "",
  category: "General",
  dosageForm: "tablet",
  strength: "",
  unitPrice: "",
  mrp: "",
  stock: "",
  lowStockThreshold: "10",
  manufacturer: "",
  available: true,
  requiresPrescription: true,
};

export default function AdminMedicines() {
  const [medicines, setMedicines] = useState([]);
  const [query, setQuery] = useState("");
  const [medicineFilter, setMedicineFilter] = useState("all");
  const [medicineForm, setMedicineForm] = useState(EMPTY_MEDICINE_FORM);
  const [editingMedicineId, setEditingMedicineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const medicinesRes = await adminApi.getMedicines({ limit: 100 });
      setMedicines(medicinesRes.data?.medicines || medicinesRes.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetMedicineForm = () => {
    setEditingMedicineId("");
    setMedicineForm(EMPTY_MEDICINE_FORM);
  };

  const saveMedicine = async (event) => {
    event?.preventDefault();
    setSavingId(editingMedicineId || "new-medicine");
    try {
      const payload = normalizeMedicineForm(medicineForm);
      if (editingMedicineId) {
        await adminApi.updateMedicine(editingMedicineId, payload);
      } else {
        await adminApi.createMedicine(payload);
      }
      resetMedicineForm();
      await load();
    } catch (e) {
      setError(e.message || "Could not save medicine");
    } finally {
      setSavingId("");
    }
  };

  const editMedicine = (medicine) => {
    setEditingMedicineId(medicine._id || medicine.id);
    setMedicineForm({
      name: medicine.name || "",
      genericName: medicine.genericName || "",
      brand: medicine.brand || "",
      category: medicine.category || "General",
      dosageForm: medicine.dosageForm || "tablet",
      strength: medicine.strength || "",
      unitPrice: String(medicine.unitPrice ?? ""),
      mrp: String(medicine.mrp ?? ""),
      stock: String(medicine.stock ?? ""),
      lowStockThreshold: String(medicine.lowStockThreshold ?? 10),
      manufacturer: medicine.manufacturer || "",
      available: medicine.available !== false,
      requiresPrescription: medicine.requiresPrescription !== false,
    });
  };

  const updateMedicine = async (medicineId, payload) => {
    setSavingId(medicineId);
    try {
      await adminApi.updateMedicine(medicineId, payload);
      await load();
    } catch (e) {
      setError(e.message || "Could not update medicine");
    } finally {
      setSavingId("");
    }
  };

  const archiveMedicine = async (medicineId) => {
    setSavingId(medicineId);
    try {
      await adminApi.archiveMedicine(medicineId);
      await load();
      if (editingMedicineId === medicineId) resetMedicineForm();
    } catch (e) {
      setError(e.message || "Could not archive medicine");
    } finally {
      setSavingId("");
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <Spinner size={36} />
        </div>
      </div>
    );
  }

  const visibleMedicines = filterMedicines(medicines, {
    query,
    stockStatus: medicineFilter,
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Medicine Inventory</span>
          <h1>Medicine Management</h1>
          <p>
            Manage stock, delivery availability, pricing, and prescription
            requirements.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <ErrorMsg message={error} onRetry={load} />}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Medicine name, brand, category..."
          />
        </div>
        <div className={styles.viewTabs}>
          <div className={styles.filters}>
            {MEDICINE_FILTERS.map((filter) => (
              <button
                className={`${styles.filterBtn} ${medicineFilter === filter ? styles.filterActive : ""}`}
                key={filter}
                onClick={() => setMedicineFilter(filter)}
                type="button"
              >
                {formatStatus(filter)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <MedicineForm
        form={medicineForm}
        editing={Boolean(editingMedicineId)}
        onChange={setMedicineForm}
        onReset={resetMedicineForm}
        onSubmit={saveMedicine}
        saving={savingId === (editingMedicineId || "new-medicine")}
      />

      <section className={styles.sectionCard}>
        <div className={styles.medicineGrid}>
          {visibleMedicines.length === 0 ? (
            <div className={styles.empty}>No medicines found</div>
          ) : (
            visibleMedicines.map((medicine) => (
              <MedicineCard
                key={medicine._id || medicine.id}
                medicine={medicine}
                onArchive={archiveMedicine}
                onEdit={editMedicine}
                onUpdate={updateMedicine}
                saving={savingId === (medicine._id || medicine.id)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MedicineForm({
  form,
  editing,
  onChange,
  onReset,
  onSubmit,
  saving,
}) {
  const setField = (field, value) => {
    onChange((current) => ({ ...current, [field]: value }));
  };

  return (
    <form className={styles.medicineForm} onSubmit={onSubmit}>
      <div className={styles.formGrid}>
        <label>
          Medicine
          <input
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="Paracetamol"
            required
          />
        </label>
        <label>
          Generic
          <input
            value={form.genericName}
            onChange={(event) => setField("genericName", event.target.value)}
            placeholder="Acetaminophen"
          />
        </label>
        <label>
          Brand
          <input
            value={form.brand}
            onChange={(event) => setField("brand", event.target.value)}
            placeholder="Brand name"
          />
        </label>
        <label>
          Category
          <input
            value={form.category}
            onChange={(event) => setField("category", event.target.value)}
            placeholder="Fever"
          />
        </label>
        <label>
          Form
          <input
            value={form.dosageForm}
            onChange={(event) => setField("dosageForm", event.target.value)}
            placeholder="tablet"
          />
        </label>
        <label>
          Strength
          <input
            value={form.strength}
            onChange={(event) => setField("strength", event.target.value)}
            placeholder="500mg"
          />
        </label>
        <label>
          Unit price
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.unitPrice}
            onChange={(event) => setField("unitPrice", event.target.value)}
          />
        </label>
        <label>
          MRP
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.mrp}
            onChange={(event) => setField("mrp", event.target.value)}
          />
        </label>
        <label>
          Stock
          <input
            min="0"
            type="number"
            value={form.stock}
            onChange={(event) => setField("stock", event.target.value)}
          />
        </label>
        <label>
          Low stock alert
          <input
            min="0"
            type="number"
            value={form.lowStockThreshold}
            onChange={(event) =>
              setField("lowStockThreshold", event.target.value)
            }
          />
        </label>
        <label>
          Manufacturer
          <input
            value={form.manufacturer}
            onChange={(event) => setField("manufacturer", event.target.value)}
            placeholder="Manufacturer"
          />
        </label>
      </div>
      <div className={styles.switchRow}>
        <label>
          <input
            checked={form.available}
            onChange={(event) => setField("available", event.target.checked)}
            type="checkbox"
          />
          Available for delivery
        </label>
        <label>
          <input
            checked={form.requiresPrescription}
            onChange={(event) =>
              setField("requiresPrescription", event.target.checked)
            }
            type="checkbox"
          />
          Requires prescription
        </label>
      </div>
      <div className={styles.formActions}>
        <Button disabled={saving} type="submit" variant="primary">
          {saving ? "Saving..." : editing ? "Update Medicine" : "Add Medicine"}
        </Button>
        {editing && (
          <Button disabled={saving} onClick={onReset} type="button" variant="outline">
            Cancel Edit
          </Button>
        )}
      </div>
    </form>
  );
}

function MedicineCard({ medicine, onArchive, onEdit, onUpdate, saving }) {
  const id = medicine._id || medicine.id;
  const stockStatus = getMedicineStockStatus(medicine);

  return (
    <article className={styles.medicineCard}>
      <div className={styles.medicineTop}>
        <div>
          <h3>{medicine.name}</h3>
          <p>
            {[medicine.strength, medicine.dosageForm, medicine.brand]
              .filter(Boolean)
              .join(" · ") || "General medicine"}
          </p>
        </div>
        <span className={`${styles.statusPill} ${styles[stockStatus.tone]}`}>
          {formatStatus(stockStatus.label)}
        </span>
      </div>
      <div className={styles.medicineStats}>
        <span>Stock <strong>{medicine.stock || 0}</strong></span>
        <span>Price <strong>₹{medicine.unitPrice || 0}</strong></span>
        <span>Category <strong>{medicine.category || "General"}</strong></span>
      </div>
      <div className={styles.switchRow}>
        <label>
          <input
            checked={medicine.available !== false}
            disabled={saving}
            onChange={(event) => onUpdate(id, { available: event.target.checked })}
            type="checkbox"
          />
          Delivery available
        </label>
        <label>
          <input
            checked={medicine.requiresPrescription !== false}
            disabled={saving}
            onChange={(event) =>
              onUpdate(id, { requiresPrescription: event.target.checked })
            }
            type="checkbox"
          />
          Prescription required
        </label>
      </div>
      <div className={styles.rowActions}>
        <button disabled={saving} onClick={() => onEdit(medicine)} type="button">
          Edit
        </button>
        <button
          disabled={saving}
          onClick={() =>
            onUpdate(id, {
              stock: Number(medicine.stock || 0) + 10,
              available: true,
            })
          }
          type="button"
        >
          +10 Stock
        </button>
        <button disabled={saving} onClick={() => onArchive(id)} type="button">
          Archive
        </button>
      </div>
    </article>
  );
}

function filterMedicines(medicines, { query, stockStatus }) {
  const needle = query.trim().toLowerCase();

  return medicines.filter((medicine) => {
    const status = getMedicineStockStatus(medicine).label;
    const searchable = [
      medicine.name,
      medicine.genericName,
      medicine.brand,
      medicine.category,
      medicine.manufacturer,
      status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (stockStatus === "all" || status === stockStatus) &&
      (!needle || searchable.includes(needle))
    );
  });
}

function normalizeMedicineForm(form) {
  return {
    ...form,
    unitPrice: Number(form.unitPrice || 0),
    mrp: Number(form.mrp || 0),
    stock: Number(form.stock || 0),
    lowStockThreshold: Number(form.lowStockThreshold || 0),
  };
}

function getMedicineStockStatus(medicine) {
  const stock = Number(medicine.stock || 0);
  const threshold = Number(medicine.lowStockThreshold || 0);
  if (medicine.available === false || stock <= 0) {
    return { label: "out_of_stock", tone: "danger" };
  }
  if (stock <= threshold) return { label: "low_stock", tone: "warn" };
  return { label: "available", tone: "good" };
}

function formatStatus(status) {
  return status.replaceAll("_", " ");
}