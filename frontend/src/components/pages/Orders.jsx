import { useApp } from "../../context/AppContext";
import { ErrorMsg, PageSkeleton } from "../ui/UI";
import { ordersStyles as styles } from "../../styles/tailwindStyles";
import FulfillmentSelector from "./orders/FulfillmentSelector";
import OrderSummaryCard from "./orders/OrderSummaryCard";
import OrdersHero from "./orders/OrdersHero";
import OrderTracker from "./orders/OrderTracker";
import PrescriptionItems from "./orders/PrescriptionItems";
import PromiseGrid from "./orders/PromiseGrid";
import { useMedicineOrder } from "./orders/useMedicineOrder";

export default function Orders() {
  const { profile, showToast, user } = useApp();
  const order = useMedicineOrder({ profile, showToast, user });

  if (order.loading)
    return (
      <div className={styles.page}>
        <PageSkeleton />
      </div>
    );

  return (
    <div className={styles.page}>
      {order.error && <ErrorMsg message={order.error} onRetry={order.load} />}

      <OrdersHero
        eta={order.summary.eta}
        itemCount={order.medicines.length}
        prescription={order.prescription}
        total={order.summary.total}
      />

      <div className={styles.layout}>
        <div>
          <PrescriptionItems
            medicines={order.medicines}
            prescription={order.prescription}
          />
          <FulfillmentSelector
            deliveryMode={order.deliveryMode}
            onChange={order.setDeliveryMode}
          />
          <PromiseGrid />
        </div>

        <div className={styles.right}>
          <OrderSummaryCard
            deliveryMode={order.deliveryMode}
            itemCount={order.medicines.length}
            latestOrder={order.latestOrder}
            onPlaceOrder={order.placeOrder}
            ordered={order.ordered}
            orderedAt={order.orderedAt}
            placing={order.placing}
            summary={order.summary}
            user={user}
          />
          <OrderTracker
            currentStep={order.currentStep}
            ordered={Boolean(order.latestOrder || order.ordered)}
            status={order.latestOrder?.status}
          />
        </div>
      </div>

      <PreviousOrders orders={order.orderHistory} />
    </div>
  );
}

function PreviousOrders({ orders }) {
  return (
    <section className={styles.historySection}>
      <div
        className={`${styles.sectionTop} max-[520px]:![flex-direction:row] max-[520px]:!items-start`}
      >
        <div className="min-w-0">
          <h2 className={styles.colTitle}>Previous Orders</h2>
          <p className={`${styles.emptyText} break-words`}>
            Track medicine orders and fulfilment status.
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className={styles.emptyCard}>
          <div className={styles.emptyIcon}>Rx</div>
          <div>
            <div className={styles.medName}>No orders yet</div>
            <div className={styles.medMeta}>
              Placed medicine orders will appear here.
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.historyList}>
          {orders.map((item) => (
            <article
              className={`${styles.historyCard} max-[520px]:![flex-direction:row] max-[520px]:!items-center max-[520px]:gap-2`}
              key={item._id || item.id}
            >
              <div className="min-w-0 flex-1">
                <div className={`${styles.historyTitle} truncate`}>
                  {item.orderNumber ||
                    `Order ${String(item._id || item.id || "").slice(-6)}`}
                </div>
                <div className={`${styles.historyMeta} truncate`}>
                  {(item.items || []).length} item
                  {(item.items || []).length === 1 ? "" : "s"} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
              </div>
              <div
                className={`${styles.historyRight} max-[520px]:!items-end max-[520px]:shrink-0`}
              >
                <span
                  className={`${styles.statusPill} max-[520px]:text-[10px] ${styles[`status_${item.status}`] || ""}`}
                >
                  {formatStatus(item.status)}
                </span>
                <span className={`${styles.historyTotal} max-[520px]:text-sm`}>
                  ₹{item.total || 0}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function formatStatus(status = "pending") {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
