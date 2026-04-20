import { Badge } from "../../ui/UI";
import { ordersStyles as styles } from "../../../styles/tailwindStyles";

export default function PrescriptionItems({ medicines, prescription }) {
  return (
    <>
      <div
        className={`${styles.sectionTop} max-[520px]:![flex-direction:row] max-[520px]:!items-center max-[520px]:gap-2`}
      >
        <h2 className={styles.colTitle}>Prescription Items</h2>
        {prescription && (
          <span className={`${styles.rxBadge} max-[520px]:shrink-0`}>
            Verified Rx
          </span>
        )}
      </div>

      {medicines.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>Rx</div>
          <p className={styles.emptyText}>
            No active prescription medicines found. Consult a doctor first.
          </p>
        </div>
      ) : (
        <div className={styles.medList}>
          {medicines.map((medicine, index) => (
            <MedicineRow
              key={`${medicine.name}-${index}`}
              medicine={medicine}
            />
          ))}
        </div>
      )}
    </>
  );
}

function MedicineRow({ medicine }) {
  return (
    <div
      className={`${styles.medRow} max-[520px]:!grid max-[520px]:![grid-template-columns:34px_minmax(0,1fr)_auto] max-[520px]:items-center max-[520px]:gap-2 max-[520px]:p-3`}
    >
      <div className={styles.medIcon}>💊</div>
      <div className={`${styles.medInfo} min-w-0`}>
        <div className={`${styles.medName} break-words`}>{medicine.name}</div>
        <div
          className={`${styles.medMeta} break-words max-[520px]:text-[10px] max-[520px]:leading-snug`}
        >
          {medicine.dosage} · {medicine.frequency} · {medicine.duration}
        </div>
      </div>
      <div
        className={`${styles.medRight} max-[520px]:items-end max-[520px]:gap-1`}
      >
        <Badge type="success">In stock</Badge>
        <span className={`${styles.medPrice} max-[520px]:text-sm`}>₹80</span>
      </div>
    </div>
  );
}
