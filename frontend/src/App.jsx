import { lazy, Suspense } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppProvider, useApp, PAGES } from "./context/AppContext";
import AppShell from "./components/layout/AppShell";
import DoctorShell from "./components/layout/DoctorShell";
import AdminShell from "./components/layout/AdminShell";
import IncomingCallNotice from "./components/layout/IncomingCallNotice";
import Toast from "./components/ui/Toast";
import "./styles/globals.css";

const Login = lazy(() => import("./components/pages/Login"));
const Dashboard = lazy(() => import("./components/pages/Dashboard"));
const DoctorDashboard = lazy(() => import("./components/pages/DoctorDashboard"));
const DoctorPatients = lazy(() => import("./components/pages/DoctorPatients"));
const PatientVitals = lazy(() => import("./components/pages/PatientVitals"));
const PatientReports = lazy(() => import("./components/pages/PatientReports"));
const DoctorList = lazy(() => import("./components/pages/DoctorList"));
const Consultation = lazy(() => import("./components/pages/Consultation"));
const Appointments = lazy(() => import("./components/pages/Appointments"));
const Prescription = lazy(() => import("./components/pages/Prescription"));
const PrescriptionList = lazy(() => import("./components/pages/PrescriptionList"));
const ConsultationList = lazy(() => import("./components/pages/ConsultationList"));
const CreatePrescription = lazy(() => import("./components/pages/CreatePrescription"));
const DoctorPrescriptions = lazy(() => import("./components/pages/DoctorPrescriptions"));
const HealthRecords = lazy(() => import("./components/pages/HealthRecords"));
const Orders = lazy(() => import("./components/pages/Orders"));
const SOSPage = lazy(() => import("./components/pages/SOSPage"));
const AdminDashboard = lazy(() => import("./components/pages/AdminDashboard"));
const AdminUsers = lazy(() => import("./components/pages/AdminUsers"));
const AdminDoctors = lazy(() => import("./components/pages/AdminDoctors"));
const AdminOrders = lazy(() => import("./components/pages/AdminOrders"));
const AdminMedicines = lazy(() => import("./components/pages/AdminMedicines"));
const Profile = lazy(() => import("./components/pages/Profile"));
const ErrorPage = lazy(() => import("./components/pages/ErrorPage"));
const ChatbotWidget = lazy(() => import("./components/ui/ChatbotWidget"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const loadingFallback = (
  <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
  </div>
);

const adminPages = {
  [PAGES.ADMIN_DASHBOARD]: AdminDashboard,
  [PAGES.ADMIN_USERS]: AdminUsers,
  [PAGES.ADMIN_DOCTORS]: AdminDoctors,
  [PAGES.ADMIN_ORDERS]: AdminOrders,
  [PAGES.ADMIN_MEDICINES]: AdminMedicines,
  [PAGES.PROFILE]: Profile,
  [PAGES.NOT_FOUND]: ErrorPage,
};

const doctorPages = {
  [PAGES.DOCTOR_DASHBOARD]: DoctorDashboard,
  [PAGES.DOCTOR_PATIENTS]: DoctorPatients,
  [PAGES.PATIENT_VITALS]: PatientVitals,
  [PAGES.PATIENT_REPORTS]: PatientReports,
  [PAGES.CREATE_PRESCRIPTION]: CreatePrescription,
  [PAGES.DOCTOR_PRESCRIPTIONS]: DoctorPrescriptions,
  [PAGES.CONSULTATION]: Consultation,
  [PAGES.CONSULTATION_LIST]: ConsultationList,
  [PAGES.APPOINTMENTS]: Appointments,
  [PAGES.PRESCRIPTION]: Prescription,
  [PAGES.PRESCRIPTION_VERIFY]: Prescription,
  [PAGES.PROFILE]: Profile,
  [PAGES.NOT_FOUND]: ErrorPage,
};

const patientPages = {
  [PAGES.DASHBOARD]: Dashboard,
  [PAGES.DOCTORS]: DoctorList,
  [PAGES.CONSULTATION]: Consultation,
  [PAGES.APPOINTMENTS]: Appointments,
  [PAGES.PRESCRIPTION]: Prescription,
  [PAGES.PRESCRIPTION_VERIFY]: Prescription,
  [PAGES.PRESCRIPTION_LIST]: PrescriptionList,
  [PAGES.CONSULTATION_LIST]: ConsultationList,
  [PAGES.RECORDS]: HealthRecords,
  [PAGES.ORDERS]: Orders,
  [PAGES.SOS]: SOSPage,
  [PAGES.PROFILE]: Profile,
  [PAGES.NOT_FOUND]: ErrorPage,
};

function PageRouter() {
  const { activePage, user } = useApp();
  let Page;

  if (user?.role === "admin") {
    Page = adminPages[activePage] ?? ErrorPage;
  } else if (user?.role === "doctor") {
    Page = doctorPages[activePage] ?? ErrorPage;
  } else {
    Page = patientPages[activePage] ?? ErrorPage;
  }

  return <Page />;
}

function AppContent() {
  const location = useLocation();
  const {
    activePage,
    dismissToast,
    isAuthenticated,
    loading,
    pageParams,
    selectedPrescriptionId,
    toasts,
    user,
  } = useApp();
  if (loading)
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
      </div>
    );
  const isVerificationPage =
    activePage === PAGES.PRESCRIPTION_VERIFY &&
    (selectedPrescriptionId || pageParams?.prescriptionId);
  const isPublicPrescription =
    activePage === PAGES.PRESCRIPTION &&
    (selectedPrescriptionId || pageParams?.prescriptionId) &&
    pageParams?.publicDetail;
  const rawRoute =
    location.hash.replace(/^#\/?/, "") || location.pathname.replace(/^\/+/, "");
  const isPublicPrescriptionUrl = /^prescription\/[^/?#]+/i.test(rawRoute);
  const isPublicError = !isAuthenticated && activePage === PAGES.NOT_FOUND;

  if (
    isVerificationPage ||
    isPublicPrescription ||
    isPublicPrescriptionUrl ||
    pageParams?.publicVerification
  ) {
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
          {isPublicError ? <ErrorPage /> : <Login />}
        </Suspense>
        <Toast onDismiss={dismissToast} toasts={toasts} />
      </>
    );
  }

  const Shell =
    user?.role === "doctor"
      ? DoctorShell
      : user?.role === "admin"
        ? AdminShell
        : AppShell;
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
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <AppProvider>
            <AppContent />
          </AppProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </div>
  );
}
