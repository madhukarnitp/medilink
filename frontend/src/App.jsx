import { lazy, Suspense } from "react";
import { AppProvider, useApp, PAGES } from "./context/AppContext";
import AppShell from "./components/layout/AppShell";
import DoctorShell from "./components/layout/DoctorShell";
import IncomingCallNotice from "./components/layout/IncomingCallNotice";
import Toast from "./components/ui/Toast";
import "./styles/globals.css";

const Login = lazy(() => import("./components/pages/Login"));
const Dashboard = lazy(() => import("./components/pages/Dashboard"));
const DoctorDashboard = lazy(() => import("./components/pages/DoctorDashboard"));
const DoctorList = lazy(() => import("./components/pages/DoctorList"));
const Consultation = lazy(() => import("./components/pages/Consultation"));
const Prescription = lazy(() => import("./components/pages/Prescription"));
const PrescriptionList = lazy(() => import("./components/pages/PrescriptionList"));
const ConsultationList = lazy(() => import("./components/pages/ConsultationList"));
const CreatePrescription = lazy(() => import("./components/pages/CreatePrescription"));
const DoctorPrescriptions = lazy(() => import("./components/pages/DoctorPrescriptions"));
const HealthRecords = lazy(() => import("./components/pages/HealthRecords"));
const Orders = lazy(() => import("./components/pages/Orders"));
const SOSPage = lazy(() => import("./components/pages/SOSPage"));
const AdminDashboard = lazy(() => import("./components/pages/AdminDashboard"));
const Profile = lazy(() => import("./components/pages/Profile"));
const ChatbotWidget = lazy(() => import("./components/ui/ChatbotWidget"));

const loadingFallback = (
  <div className="spinner-page">
    <div className="spinner" />
  </div>
);

const adminPages = {
  [PAGES.ADMIN_DASHBOARD]: AdminDashboard,
  [PAGES.PROFILE]: Profile,
};

const doctorPages = {
  [PAGES.DOCTOR_DASHBOARD]: DoctorDashboard,
  [PAGES.CREATE_PRESCRIPTION]: CreatePrescription,
  [PAGES.DOCTOR_PRESCRIPTIONS]: DoctorPrescriptions,
  [PAGES.CONSULTATION]: Consultation,
  [PAGES.PRESCRIPTION]: Prescription,
  [PAGES.PROFILE]: Profile,
};

const patientPages = {
  [PAGES.DASHBOARD]: Dashboard,
  [PAGES.DOCTORS]: DoctorList,
  [PAGES.CONSULTATION]: Consultation,
  [PAGES.PRESCRIPTION]: Prescription,
  [PAGES.PRESCRIPTION_LIST]: PrescriptionList,
  [PAGES.CONSULTATION_LIST]: ConsultationList,
  [PAGES.RECORDS]: HealthRecords,
  [PAGES.ORDERS]: Orders,
  [PAGES.SOS]: SOSPage,
  [PAGES.PROFILE]: Profile,
};

function PageRouter() {
  const { activePage, user } = useApp();
  let Page;

  if (user?.role === "admin") {
    Page = adminPages[activePage] ?? AdminDashboard;
  } else if (user?.role === "doctor") {
    Page = doctorPages[activePage] ?? DoctorDashboard;
  } else {
    Page = patientPages[activePage] ?? Dashboard;
  }

  return <Page />;
}

function AppContent() {
  const {
    activePage,
    dismissToast,
    isAuthenticated,
    loading,
    selectedPrescriptionId,
    toasts,
    user,
  } = useApp();
  if (loading)
    return (
      <div className="spinner-page">
        <div className="spinner" />
      </div>
    );
  const isPublicPrescription =
    !isAuthenticated &&
    activePage === PAGES.PRESCRIPTION &&
    selectedPrescriptionId;

  if (isPublicPrescription) {
    return (
      <>
        <Suspense fallback={loadingFallback}>
          <Prescription />
        </Suspense>
        <Toast onDismiss={dismissToast} toasts={toasts} />
      </>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Suspense fallback={loadingFallback}>
          <Login />
        </Suspense>
        <Toast onDismiss={dismissToast} toasts={toasts} />
      </>
    );
  }

  const Shell = user?.role === "doctor" ? DoctorShell : AppShell;
  return (
    <Shell>
      <IncomingCallNotice />
      <Suspense fallback={loadingFallback}>
        <PageRouter />
      </Suspense>
      <Toast onDismiss={dismissToast} toasts={toasts} />
      <Suspense fallback={null}>
        <ChatbotWidget />
      </Suspense>
    </Shell>
  );
}

export default function App() {
  return (
    <div className="light-theme">
      <AppProvider>
        <AppContent />
      </AppProvider>
    </div>
  );
}
