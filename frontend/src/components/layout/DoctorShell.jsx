import TopNavbar from "./TopNavbar";
import Sidebar from "./Sidebar";
import styles from "./AppShell.module.css";

export default function DoctorShell({ children }) {
  return (
    <div className={styles.shell}>
      <TopNavbar />
      <Sidebar />
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
