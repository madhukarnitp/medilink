import { API_BASE_URL } from "./api";

let stream = null;
let streamToken = null;

const parseEvent = (handler) => (event) => {
  if (!handler) return;
  try {
    handler(event.data ? JSON.parse(event.data) : {});
  } catch {
    handler({});
  }
};

export const connectNotificationStream = (token, handlers = {}) => {
  if (!token || typeof EventSource === "undefined") return null;

  if (stream && streamToken === token) return stream;

  disconnectNotificationStream();
  streamToken = token;

  const base = API_BASE_URL.replace(/\/$/, "");
  const origin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  const url = new URL(`${base}/notifications/stream`, origin);
  url.searchParams.set("token", token);
  stream = new EventSource(url.toString());

  const eventHandlers = {
    notification: handlers.notification,
    consultationRequest: handlers.consultationRequest,
    consultationAccepted: handlers.consultationAccepted,
    consultationEnded: handlers.consultationEnded,
    doctorOnline: handlers.doctorOnline,
    doctorOffline: handlers.doctorOffline,
  };

  Object.entries(eventHandlers).forEach(([eventName, handler]) => {
    if (handler) stream.addEventListener(eventName, parseEvent(handler));
  });

  stream.onerror = (event) => {
    handlers.error?.(event);
  };

  return stream;
};

export const disconnectNotificationStream = () => {
  if (!stream) return;
  stream.close();
  stream = null;
  streamToken = null;
};
