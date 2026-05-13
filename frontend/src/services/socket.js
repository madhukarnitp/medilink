import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_REALTIME_URL ||
  (import.meta.env.DEV ? "http://localhost:5002" : window.location.origin);
const SOCKET_TRANSPORTS = (
  import.meta.env.VITE_SOCKET_TRANSPORTS || "websocket"
)
  .split(",")
  .map((transport) => transport.trim())
  .filter(Boolean);

let socket = null;
let socketToken = null;
let disconnectTimer = null;

export const getSocket = () => socket;

export const isSocketConnected = () => Boolean(socket?.connected);

export const connectSocket = (token) => {
  if (!token) return null;

  if (disconnectTimer) {
    clearTimeout(disconnectTimer);
    disconnectTimer = null;
  }

  if (socket && socketToken === token) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }
  socketToken = token;

  socket = io(SOCKET_URL, {
    path: "/socket.io",
    auth: { token },
    transports: SOCKET_TRANSPORTS,
    upgrade: SOCKET_TRANSPORTS.length > 1,
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 6000,
    timeout: 15000,
    closeOnBeforeunload: true,
  });

  socket.on("connect", () => console.log("[Socket] ✓ connected", socket.id));
  socket.on("connect_error", (e) =>
    console.warn("[Socket] connect_error:", e.message),
  );
  socket.on("disconnect", (r) => console.log("[Socket] disconnected:", r));
  socket.on("error", (e) => {
    if (e?.message === "Consultation is not active") return;
    console.warn("[Socket] error:", e?.message || e, e);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;

  if (disconnectTimer) clearTimeout(disconnectTimer);
  disconnectTimer = window.setTimeout(() => {
    if (!socket) return;
    socket.disconnect();
    socket = null;
    socketToken = null;
    disconnectTimer = null;
  }, 250);
};

export const waitForSocketConnection = (timeoutMs = 8000) =>
  new Promise((resolve) => {
    if (socket?.connected) {
      resolve(true);
      return;
    }

    if (!socket) {
      resolve(false);
      return;
    }

    let done = false;
    const finish = (connected) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      socket?.off("connect", onConnect);
      socket?.off("connect_error", onError);
      resolve(connected);
    };
    const onConnect = () => finish(true);
    const onError = () => finish(false);
    const timer = setTimeout(() => finish(Boolean(socket?.connected)), timeoutMs);

    socket.once("connect", onConnect);
    socket.once("connect_error", onError);
    socket.connect();
  });

export const joinConsultation = (consultationId, callback) => {
  if (!socket?.connected || !consultationId) return false;
  socket.emit("joinConsultation", { consultationId }, callback);
  return true;
};

export const joinConsultationAsync = (consultationId, timeoutMs = 8000) =>
  new Promise((resolve) => {
    if (!socket?.connected || !consultationId) {
      resolve({ ok: false, message: "Socket is not connected" });
      return;
    }

    let done = false;
    const finish = (response) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(response || { ok: false, message: "Join failed" });
    };
    const timer = setTimeout(
      () => finish({ ok: false, message: "Join consultation timed out" }),
      timeoutMs,
    );

    socket.emit("joinConsultation", { consultationId }, finish);
  });

export const sendSocketMessage = (consultationId, text) => {
  if (!socket?.connected) return false;
  socket.emit("sendMessage", { consultationId, text });
  return true;
};

export const sendTyping = (consultationId, isTyping) => {
  if (!socket?.connected || !consultationId) return;
  socket.emit(isTyping ? "typing" : "stopTyping", { consultationId });
};

export const requestVideoCall = (consultationId) => {
  if (!socket?.connected || !consultationId) return false;
  socket.emit("videoCall:request", { consultationId });
  return true;
};

export const declineVideoCall = (consultationId) => {
  if (!socket?.connected || !consultationId) return false;
  socket.emit("videoCall:decline", { consultationId });
  return true;
};

export const acceptVideoCall = (consultationId) => {
  if (!socket?.connected || !consultationId) return false;
  socket.emit("videoCall:accept", { consultationId });
  return true;
};

export const EVENTS = {
  RECEIVE_MESSAGE: "receiveMessage",
  TYPING: "typing",
  STOP_TYPING: "stopTyping",
  JOINED: "joinedConsultation",
  ERROR: "error",
  DOCTOR_ONLINE: "doctorOnline",
  DOCTOR_OFFLINE: "doctorOffline",
  CONSULTATION_ENDED: "consultationEnded",
  VIDEO_CALL_INCOMING: "videoCall:incoming",
  VIDEO_CALL_REQUESTED: "videoCall:requested",
  VIDEO_CALL_ACCEPTED: "videoCall:accepted",
  VIDEO_CALL_DECLINED: "videoCall:declined",
  VIDEO_CALL_TIMEOUT: "videoCall:timeout",
  VIDEO_CALL_RESET: "videoCall:reset",
};
