import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useLocation, useNavigate as useRouterNavigate } from "react-router-dom";
import {
  auth as authApi,
  clearTokens,
  notifications as notificationsApi,
  prescriptionSelection,
} from "../services/api";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  EVENTS,
  declineVideoCall,
} from "../services/socket";
import {
  playIncomingMessageTone,
  playNotificationSound,
} from "../services/sounds";
import notificationIcon from "../assets/logo_2.png";

export const PAGES = {
  DASHBOARD: "dashboard",
  DOCTORS: "doctors",
  CONSULTATION: "consultation",
  APPOINTMENTS: "appointments",
  PRESCRIPTION: "prescription",
  PRESCRIPTION_VERIFY: "prescription_verify",
  PRESCRIPTION_LIST: "prescription_list",
  CONSULTATION_LIST: "consultation_list",
  RECORDS: "records",
  ORDERS: "orders",
  SOS: "sos",
  PROFILE: "profile",
  DOCTOR_DASHBOARD: "doctor_dashboard",
  DOCTOR_PATIENTS: "doctor_patients",
  CREATE_PRESCRIPTION: "create_prescription",
  DOCTOR_PRESCRIPTIONS: "doctor_prescriptions",
  PATIENT_VITALS: "patient_vitals",
  PATIENT_REPORTS: "patient_reports",
  ADMIN_DASHBOARD: "admin_dashboard",
  ADMIN_USERS: "admin_users",
  ADMIN_DOCTORS: "admin_doctors",
  ADMIN_ORDERS: "admin_orders",
  ADMIN_MEDICINES: "admin_medicines",
  NOT_FOUND: "not_found",
};

export const getHomePage = (role) => {
  if (role === "admin") return PAGES.ADMIN_DASHBOARD;
  if (role === "doctor") return PAGES.DOCTOR_DASHBOARD;
  return PAGES.DASHBOARD;
};

const PAGE_PATHS = {
  [PAGES.DASHBOARD]: "/dashboard",
  [PAGES.DOCTORS]: "/doctors",
  [PAGES.CONSULTATION_LIST]: "/consultations",
  [PAGES.APPOINTMENTS]: "/appointments",
  [PAGES.PRESCRIPTION_LIST]: "/prescriptions",
  [PAGES.RECORDS]: "/records",
  [PAGES.ORDERS]: "/orders",
  [PAGES.SOS]: "/sos",
  [PAGES.PROFILE]: "/profile",
  [PAGES.DOCTOR_DASHBOARD]: "/doctor/dashboard",
  [PAGES.DOCTOR_PATIENTS]: "/doctor/patients",
  [PAGES.CREATE_PRESCRIPTION]: "/doctor/prescriptions/new",
  [PAGES.DOCTOR_PRESCRIPTIONS]: "/doctor/prescriptions",
  [PAGES.PATIENT_VITALS]: "/doctor/patients",
  [PAGES.PATIENT_REPORTS]: "/doctor/patients",
  [PAGES.ADMIN_DASHBOARD]: "/admin",
  [PAGES.ADMIN_USERS]: "/admin/users",
  [PAGES.ADMIN_DOCTORS]: "/admin/doctors",
  [PAGES.ADMIN_ORDERS]: "/admin/orders",
  [PAGES.ADMIN_MEDICINES]: "/admin/medicines",
  [PAGES.NOT_FOUND]: "/not-found",
};

const getPathForPage = (page, params = {}) => {
  if (page === PAGES.PRESCRIPTION_VERIFY && params.prescriptionId) {
    const token = params.verificationToken
      ? `?token=${encodeURIComponent(params.verificationToken)}`
      : "";
    return `/verify/prescription/${encodeURIComponent(params.prescriptionId)}${token}`;
  }
  if (page === PAGES.PRESCRIPTION && params.prescriptionId) {
    return `/prescription/${encodeURIComponent(params.prescriptionId)}`;
  }
  if (page === PAGES.PRESCRIPTION) {
    return PAGE_PATHS[PAGES.PRESCRIPTION_LIST];
  }
  if (page === PAGES.CONSULTATION) {
    if (!params.consultationId) return "/consultation";
    const mode = params.mode === "call" ? "/call" : "";
    return `/consultation/${encodeURIComponent(params.consultationId)}${mode}`;
  }
  if (page === PAGES.PATIENT_VITALS && params.patientId) {
    return `/doctor/patients/${encodeURIComponent(params.patientId)}/vitals`;
  }
  if (page === PAGES.PATIENT_REPORTS && params.patientId) {
    return `/doctor/patients/${encodeURIComponent(params.patientId)}/reports`;
  }
  if (page === PAGES.CREATE_PRESCRIPTION && params.patientId) {
    const query = new URLSearchParams({
      patientId: String(params.patientId),
    });
    if (params.consultationId) {
      query.set("consultationId", String(params.consultationId));
    }
    return `/doctor/prescriptions/new?${query.toString()}`;
  }
  const basePath = PAGE_PATHS[page] || PAGE_PATHS[PAGES.NOT_FOUND];
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || typeof value === "object") return;
    query.set(key, String(value));
  });
  const queryString = query.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
};

const shouldSyncUrl = (page, params = {}, options = {}) =>
  Boolean(options.updateUrl) ||
  (page === PAGES.PRESCRIPTION_VERIFY && Boolean(params.prescriptionId));

const getDeepLinkTarget = () => {
  if (typeof window === "undefined") return null;

  const rawHash = window.location.hash.replace(/^#\/?/, "");
  const source = rawHash || window.location.pathname.replace(/^\/+/, "");
  const [route] = source.split(/[?#]/);
  const hashQuery = source.includes("?") ? source.split("?")[1].split("#")[0] : "";
  const parts = route.split("/").filter(Boolean);

  if (parts.length === 0) return null;
  if (parts[0] === "login") return null;

  const query = new URLSearchParams(hashQuery || window.location.search);
  const queryParams = Object.fromEntries(query.entries());

  if (
    parts[0] === "verify" &&
    (parts[1] === "prescription" || parts[1] === "rx") &&
    parts[2]
  ) {
    return {
      page: PAGES.PRESCRIPTION_VERIFY,
      params: {
        prescriptionId: decodeURIComponent(parts[2]),
        verificationToken: queryParams.token,
        publicVerification: true,
      },
    };
  }

  if (parts[0] === "verify" && parts[1]) {
    return {
      page: PAGES.PRESCRIPTION_VERIFY,
      params: {
        prescriptionId: decodeURIComponent(parts[1]),
        verificationToken: queryParams.token,
        publicVerification: true,
      },
    };
  }

  if (parts[0] === "prescription" && parts[1]) {
    return {
      page: PAGES.PRESCRIPTION,
      params: {
        prescriptionId: decodeURIComponent(parts[1]),
        publicDetail: true,
      },
    };
  }

  if (parts[0] === "consultation" && parts[1]) {
    return {
      page: PAGES.CONSULTATION,
      params: {
        consultationId: decodeURIComponent(parts[1]),
        mode: parts[2] === "call" ? "call" : "chat",
      },
    };
  }

  if (parts[0] === "dashboard") return { page: PAGES.DASHBOARD };
  if (parts[0] === "doctors") return { page: PAGES.DOCTORS, params: queryParams };
  if (parts[0] === "consultation") return { page: PAGES.CONSULTATION };
  if (parts[0] === "consultations") {
    return { page: PAGES.CONSULTATION_LIST, params: queryParams };
  }
  if (parts[0] === "appointments") {
    return { page: PAGES.APPOINTMENTS, params: queryParams };
  }
  if (parts[0] === "prescriptions") return { page: PAGES.PRESCRIPTION_LIST };
  if (parts[0] === "records") return { page: PAGES.RECORDS };
  if (parts[0] === "orders") return { page: PAGES.ORDERS };
  if (parts[0] === "sos") return { page: PAGES.SOS };
  if (parts[0] === "profile") return { page: PAGES.PROFILE };
  if (parts[0] === "admin") {
    if (parts[1] === "users") return { page: PAGES.ADMIN_USERS };
    if (parts[1] === "doctors") return { page: PAGES.ADMIN_DOCTORS };
    if (parts[1] === "orders") return { page: PAGES.ADMIN_ORDERS };
    if (parts[1] === "medicines") return { page: PAGES.ADMIN_MEDICINES };
    return { page: PAGES.ADMIN_DASHBOARD };
  }
  if (parts[0] === "doctor" && parts[1] === "dashboard") {
    return { page: PAGES.DOCTOR_DASHBOARD };
  }
  if (parts[0] === "doctor" && parts[1] === "patients" && parts[2]) {
    const patientId = decodeURIComponent(parts[2]);
    if (parts[3] === "vitals") {
      return { page: PAGES.PATIENT_VITALS, params: { patientId } };
    }
    if (parts[3] === "reports") {
      return { page: PAGES.PATIENT_REPORTS, params: { patientId } };
    }
    return { page: PAGES.DOCTOR_PATIENTS, params: { patientId } };
  }
  if (parts[0] === "doctor" && parts[1] === "patients") {
    return { page: PAGES.DOCTOR_PATIENTS };
  }
  if (parts[0] === "doctor" && parts[1] === "prescriptions" && parts[2] === "new") {
    return { page: PAGES.CREATE_PRESCRIPTION, params: queryParams };
  }
  if (parts[0] === "doctor" && parts[1] === "prescriptions") {
    return { page: PAGES.DOCTOR_PRESCRIPTIONS };
  }

  return {
    page: PAGES.NOT_FOUND,
    params: { attemptedPath: `/${route}` },
  };
};

const getToastTypeForNotification = (type) => {
  if (type === "video_call" || type === "consultation_request") {
    return "warning";
  }
  if (type === "message" || type === "consultation_ended") {
    return "info";
  }
  if (type === "consultation_accepted" || type === "appointment") {
    return "success";
  }
  return "info";
};

const normalizeNotification = (item = {}) => ({
  id: item.id || item._id,
  title: item.title || "MediLink notification",
  body: item.body || item.message || "Open MediLink for details.",
  type: item.type || "general",
  page: item.page,
  params: item.params,
  createdAt: item.createdAt || new Date().toISOString(),
  readAt: item.readAt || null,
});

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const location = useLocation();
  const routerNavigate = useRouterNavigate();
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState(null);
  const [pageParams, setPageParams] = useState({});
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState(null);
  const [notifications, setNotifications] = useState(0);
  const [notificationItems, setNotificationItems] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification === "undefined"
      ? "unsupported"
      : Notification.permission,
  );
  const [toasts, setToasts] = useState([]);
  const toastTimers = useRef(new Map());
  const activePageRef = useRef(activePage);
  const selectedConsultationIdRef = useRef(selectedConsultationId);
  const userRef = useRef(user);
  const pendingDeepLinkRef = useRef(getDeepLinkTarget());

  activePageRef.current = activePage;
  selectedConsultationIdRef.current = selectedConsultationId;
  userRef.current = user;

  const applyNavigationTarget = useCallback((page, params = {}) => {
    setActivePage(page);
    setPageParams(params);
    if (params.doctor !== undefined) setSelectedDoctor(params.doctor);
    const isPrescriptionPage =
      page === PAGES.PRESCRIPTION || page === PAGES.PRESCRIPTION_VERIFY;
    if (isPrescriptionPage && params.prescriptionId !== undefined) {
      setSelectedPrescriptionId(params.prescriptionId);
      prescriptionSelection.set(params.prescriptionId);
    } else {
      setSelectedPrescriptionId(null);
      prescriptionSelection.clear();
    }
    if (page === PAGES.CONSULTATION && params.consultationId === undefined) {
      setSelectedConsultationId(null);
    } else if (params.consultationId !== undefined) {
      setSelectedConsultationId(params.consultationId);
    }
  }, []);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem("ml_token");
      if (!token) {
        const target = pendingDeepLinkRef.current;
        if (
          target?.page === PAGES.PRESCRIPTION ||
          target?.page === PAGES.PRESCRIPTION_VERIFY ||
          target?.page === PAGES.NOT_FOUND
        ) {
          applyNavigationTarget(target.page, target.params || {});
        }
        setLoading(false);
        return;
      }

      const saved = authApi.getSavedUser();
      if (saved) {
        const target = pendingDeepLinkRef.current;
        setUser(saved);
        setIsAuthenticated(true);
        applyNavigationTarget(
          target?.page || getHomePage(saved.role),
          target?.params || {},
        );
        setLoading(false);
        connectSocket(token);
      }

      try {
        const res = await authApi.getMe();
        const target = pendingDeepLinkRef.current;
        setUser(res.data.user);
        setProfile(res.data.profile);
        localStorage.setItem("ml_user", JSON.stringify(res.data.user));
        setIsAuthenticated(true);
        if (!saved || target) {
          applyNavigationTarget(
            target?.page || getHomePage(res.data.user.role),
            target?.params || {},
          );
        }
        pendingDeepLinkRef.current = null;
        connectSocket(token);
      } catch {
        const target = pendingDeepLinkRef.current;
        setIsAuthenticated(false);
        setUser(null);
        clearTokens();
        if (
          target?.page === PAGES.PRESCRIPTION ||
          target?.page === PAGES.PRESCRIPTION_VERIFY ||
          target?.page === PAGES.NOT_FOUND
        ) {
          applyNavigationTarget(target.page, target.params || {});
        } else {
          routerNavigate("/", { replace: true });
        }
      } finally {
        if (!saved) setLoading(false);
      }
    })();
    return () => disconnectSocket();
  }, [applyNavigationTarget, routerNavigate]);

  useEffect(() => {
    if (loading) return;
    const target = getDeepLinkTarget();
    if (!target) return;

    if (
      !isAuthenticated &&
      target.page !== PAGES.PRESCRIPTION &&
      target.page !== PAGES.PRESCRIPTION_VERIFY &&
      target.page !== PAGES.NOT_FOUND
    ) {
      return;
    }

    applyNavigationTarget(target.page, target.params || {});
  }, [
    applyNavigationTarget,
    isAuthenticated,
    loading,
    location.hash,
    location.pathname,
    location.search,
  ]);

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "success") => {
      const normalizedType =
        ["success", "error", "warning", "info", "loading"].includes(type)
          ? type
          : "info";
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const duration = normalizedType === "error" ? 5200 : 3800;
      const item = { id, message, type: normalizedType };

      setToasts((items) => [item, ...items].slice(0, 4));
      const timer = setTimeout(() => dismissToast(id), duration);
      toastTimers.current.set(id, timer);
      return id;
    },
    [dismissToast],
  );

  const clearAllToasts = useCallback(() => {
    toastTimers.current.forEach((timer) => clearTimeout(timer));
    toastTimers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => clearTimeout(timer));
      toastTimers.current.clear();
    };
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      showToast("Browser notifications are not supported here", "warning");
      return "unsupported";
    }
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      showToast(
        permission === "granted"
          ? "Notifications enabled"
          : "Notifications will stay inside the app",
        permission === "granted" ? "success" : "warning",
      );
      return permission;
    }
    setNotificationPermission(Notification.permission);
    showToast(
      Notification.permission === "granted"
        ? "Notifications are already enabled"
        : "Notifications are blocked in browser settings",
      Notification.permission === "granted" ? "success" : "warning",
    );
    return Notification.permission;
  }, [showToast]);

  const loadNotifications = useCallback(async () => {
    if (!localStorage.getItem("ml_token")) return;
    try {
      const response = await notificationsApi.getAll({ limit: 30 });
      const items = (response.data?.items || []).map(normalizeNotification);
      setNotificationItems(items);
      setNotifications(response.data?.unread ?? items.filter((item) => !item.readAt).length);
    } catch {}
  }, []);

  const clearNotifications = useCallback(async () => {
    setNotifications(0);
    setNotificationItems([]);
    try {
      await notificationsApi.clear();
    } catch {}
  }, []);

  const dismissNotification = useCallback(async (id) => {
    setNotificationItems((items) => items.filter((item) => item.id !== id));
    setNotifications((count) => Math.max(0, count - 1));
    if (id && !String(id).includes("-")) {
      try {
        await notificationsApi.remove(id);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) loadNotifications();
  }, [isAuthenticated, loadNotifications]);

  const onSocketConnectError = useCallback(
    (error) => {
      if (!error) return;
      const message = String(error.message || error);
      if (message.toLowerCase().includes("unauthorized")) {
        disconnectSocket();
        showToast(
          "Realtime connection failed. Please check realtime server JWT settings.",
          "warning",
        );
      }
    },
    [showToast],
  );

  const syncSession = useCallback((nextUser, nextProfile) => {
    if (nextUser) {
      setUser(nextUser);
      localStorage.setItem("ml_user", JSON.stringify(nextUser));
    }
    if (nextProfile !== undefined) {
      setProfile(nextProfile);
    }
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await authApi.login(email, password);
      // Connect socket right after login
      const token = localStorage.getItem("ml_token");
      const target = pendingDeepLinkRef.current;
      const nextPage = target?.page || getHomePage(data.user.role);
      const nextParams = target?.params || {};
      connectSocket(token);
      setUser(data.user);
      setIsAuthenticated(true);
      applyNavigationTarget(nextPage, nextParams);
      routerNavigate("/", { replace: true });
      pendingDeepLinkRef.current = null;
      loadNotifications();
      showToast(`Welcome back, ${data.user.name.split(" ")[0]}!`);
      return data;
    },
    [applyNavigationTarget, loadNotifications, routerNavigate, showToast],
  );

  const logout = useCallback(async () => {
    disconnectSocket();
    await authApi.logout();
    pendingDeepLinkRef.current = null;
    prescriptionSelection.clear();
    setUser(null);
    setProfile(null);
    setIsAuthenticated(false);
    setActivePage(null);
    setPageParams({});
    setSelectedDoctor(null);
    setSelectedPrescriptionId(null);
    setSelectedConsultationId(null);
    setNotifications(0);
    setNotificationItems([]);
    routerNavigate("/", { replace: true });
    showToast("Logged out successfully");
  }, [routerNavigate, showToast]);

  const navigate = useCallback(
    (page, params = {}, options = {}) => {
      if (typeof page === "number") {
        routerNavigate(page);
        return;
      }
      pendingDeepLinkRef.current = null;
      applyNavigationTarget(page, params);
      if (!shouldSyncUrl(page, params, options)) return;

      const nextPath = getPathForPage(page, params);
      if (nextPath && `${location.pathname}${location.search}` !== nextPath) {
        routerNavigate(nextPath, { replace: Boolean(options.replace) });
      }
    },
    [applyNavigationTarget, location.pathname, location.search, routerNavigate],
  );

  const acceptIncomingCall = useCallback(() => {
    if (!incomingCall?.consultationId) return;
    const consultationId = incomingCall.consultationId;
    setIncomingCall(null);
    navigate(PAGES.CONSULTATION, {
      consultationId,
      mode: "call",
      autoAcceptCall: true,
    });
  }, [incomingCall, navigate]);

  const openIncomingCallChat = useCallback(() => {
    if (!incomingCall?.consultationId) return;
    const consultationId = incomingCall.consultationId;
    declineVideoCall(consultationId);
    setIncomingCall(null);
    navigate(PAGES.CONSULTATION, {
      consultationId,
      mode: "chat",
    });
  }, [incomingCall, navigate]);

  const dismissIncomingCall = useCallback(() => {
    if (incomingCall?.consultationId) {
      declineVideoCall(incomingCall.consultationId);
    }
    setIncomingCall(null);
  }, [incomingCall]);

  useEffect(() => {
    if (!isAuthenticated || !userRef.current) return;

    const token = localStorage.getItem("ml_token");
    const sock = getSocket() || (token ? connectSocket(token) : null);
    if (!sock) return;

    const showBrowserNotification = ({
      title,
      body,
      type = "general",
      page,
      params,
    }) => {
      if (
        typeof Notification === "undefined" ||
        Notification.permission !== "granted"
      )
        return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      )
        return;
      try {
        const notification = new Notification(title, {
          body,
          icon: notificationIcon,
          badge: notificationIcon,
          tag: params?.consultationId
            ? `medilink-${type}-${params.consultationId}`
            : `medilink-${type}`,
          requireInteraction:
            type === "video_call" || type === "consultation_request",
        });
        notification.onclick = () => {
          window.focus();
          if (page) navigate(page, params || {});
          notification.close();
        };
      } catch {}
    };

    const pushNotification = ({
      title,
      body,
      type = "general",
      page,
      params,
    }) => {
      const item = {
        id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        body,
        type,
        page,
        params,
        createdAt: new Date().toISOString(),
      };
      setNotifications((n) => n + 1);
      setNotificationItems((items) => [item, ...items].slice(0, 20));
      showToast(title, getToastTypeForNotification(type));
      if (type === "message") {
        playIncomingMessageTone();
      } else {
        playNotificationSound();
      }
      showBrowserNotification({ title, body, type, page, params });
      return item;
    };

    const onMessage = (msg = {}) => {
      const currentUser = userRef.current;
      const senderId = msg.sender?._id || msg.sender;
      const fromMe = senderId
        ? String(senderId) === String(currentUser?._id)
        : msg.senderRole === currentUser?.role;
      const consultationId =
        msg.consultationId?._id || msg.consultationId || msg.consultation?._id;
      const viewingSameConsultation =
        activePageRef.current === PAGES.CONSULTATION &&
        (!consultationId ||
          (selectedConsultationIdRef.current &&
            String(consultationId) ===
              String(selectedConsultationIdRef.current)));

      if (fromMe || viewingSameConsultation) return;

      const senderName =
        msg.sender?.name ||
        (msg.senderRole === "doctor" ? "Doctor" : "Patient");
      pushNotification({
        title: `New message from ${senderName}`,
        body: msg.text || "Open MediLink to view the update.",
        type: "message",
        page: PAGES.CONSULTATION,
        params: consultationId ? { consultationId } : undefined,
      });
    };

    const onGenericNotification = (payload = {}) => {
      const consultationId =
        payload.consultationId || payload.consultation?._id;
      pushNotification({
        title: payload.title || payload.message || "New MediLink notification",
        body: payload.body || payload.message || "Open MediLink for details.",
        type: payload.type || "general",
        page: payload.page || (consultationId ? PAGES.CONSULTATION : undefined),
        params:
          payload.params || (consultationId ? { consultationId } : undefined),
      });
    };

    const onConsultationRequest = (payload = {}) => {
      const currentUser = userRef.current;
      const message = payload.reason
        ? `${payload.patient?.name || "A patient"} requested a consultation: ${payload.reason}`
        : `${payload.patient?.name || "A patient"} requested a consultation.`;

      pushNotification({
        title: "New consultation request",
        body: message,
        type: "consultation_request",
        page: PAGES.CONSULTATION,
        params: payload.consultationId
          ? { consultationId: payload.consultationId }
          : undefined,
      });

      if (currentUser?.role === "doctor" && payload.consultationId) {
        if (activePageRef.current !== PAGES.DOCTOR_DASHBOARD) {
          navigate(PAGES.CONSULTATION, {
            consultationId: payload.consultationId,
          });
        }
      }
    };

    const onConsultationAccepted = (payload = {}) => {
      pushNotification({
        title: "Consultation accepted",
        body: payload.doctorName
          ? `${payload.doctorName} accepted your consultation request.`
          : "Your consultation request has been accepted.",
        type: "consultation_accepted",
        page: PAGES.CONSULTATION,
        params: payload.consultationId
          ? { consultationId: payload.consultationId }
          : undefined,
      });
    };

    const onConsultationEnded = (payload = {}) => {
      pushNotification({
        title: "Consultation ended",
        body: "Your live consultation has been closed.",
        type: "consultation_ended",
        page: PAGES.CONSULTATION_LIST,
        params: payload.consultationId
          ? { consultationId: payload.consultationId }
          : undefined,
      });
    };

    const onIncomingVideoCall = (payload = {}) => {
      const callerName =
        payload.from?.name ||
        (payload.from?.role === "doctor" ? "Doctor" : "Patient");
      setIncomingCall(payload);
      pushNotification({
        title: "Incoming video call",
        body: `${callerName} is calling you now.`,
        type: "video_call",
        page: PAGES.CONSULTATION,
        params: payload.consultationId
          ? {
              consultationId: payload.consultationId,
              mode: "call",
              autoAcceptCall: true,
            }
          : undefined,
      });
    };

    const onVideoCallDeclined = (payload = {}) => {
      setIncomingCall((current) =>
        current?.consultationId &&
        String(current.consultationId) === String(payload.consultationId)
          ? null
          : current,
      );
      showToast(
        payload.from?.name
          ? `${payload.from.name} declined the video call.`
          : "The video call was declined.",
        "warning",
      );
    };

    sock.on(EVENTS.RECEIVE_MESSAGE, onMessage);
    sock.on("connect_error", onSocketConnectError);
    sock.on("consultationRequest", onConsultationRequest);
    sock.on("consultationAccepted", onConsultationAccepted);
    sock.on("notification", onGenericNotification);
    sock.on("newNotification", onGenericNotification);
    sock.on("consultationUpdated", onGenericNotification);
    sock.on(EVENTS.CONSULTATION_ENDED, onConsultationEnded);
    sock.on(EVENTS.VIDEO_CALL_INCOMING, onIncomingVideoCall);
    sock.on(EVENTS.VIDEO_CALL_DECLINED, onVideoCallDeclined);

    return () => {
      sock.off(EVENTS.RECEIVE_MESSAGE, onMessage);
      sock.off("consultationRequest", onConsultationRequest);
      sock.off("consultationAccepted", onConsultationAccepted);
      sock.off("notification", onGenericNotification);
      sock.off("newNotification", onGenericNotification);
      sock.off("consultationUpdated", onGenericNotification);
      sock.off(EVENTS.CONSULTATION_ENDED, onConsultationEnded);
      sock.off(EVENTS.VIDEO_CALL_INCOMING, onIncomingVideoCall);
      sock.off(EVENTS.VIDEO_CALL_DECLINED, onVideoCallDeclined);
      sock.off("connect_error", onSocketConnectError);
    };
  }, [isAuthenticated, navigate, onSocketConnectError, showToast]);

  const value = useMemo(
    () => ({
      user,
      profile,
      isAuthenticated,
      loading,
      activePage,
      pageParams,
      selectedDoctor,
      selectedPrescriptionId,
      selectedConsultationId,
      notifications,
      notificationItems,
      notificationPermission,
      incomingCall,
      toasts,
      login,
      logout,
      navigate,
      showToast,
      dismissToast,
      clearAllToasts,
      syncSession,
      setNotifications,
      requestNotificationPermission,
      acceptIncomingCall,
      openIncomingCallChat,
      dismissIncomingCall,
      clearNotifications,
      dismissNotification,
      setSelectedDoctor,
      setSelectedPrescriptionId,
      setSelectedConsultationId,
    }),
    [
      acceptIncomingCall,
      activePage,
      clearNotifications,
      clearAllToasts,
      dismissIncomingCall,
      dismissNotification,
      dismissToast,
      incomingCall,
      isAuthenticated,
      loading,
      login,
      logout,
      navigate,
      notificationItems,
      notificationPermission,
      notifications,
      openIncomingCallChat,
      pageParams,
      profile,
      requestNotificationPermission,
      selectedConsultationId,
      selectedDoctor,
      selectedPrescriptionId,
      showToast,
      syncSession,
      toasts,
      user,
    ],
  );

  return (
    <Ctx.Provider value={value}>{children}</Ctx.Provider>
  );
}

export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside AppProvider");
  return c;
};
