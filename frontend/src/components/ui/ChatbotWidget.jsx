import { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { medibot } from "../../services/api";
import { chatbotStyles as styles } from "../../styles/tailwindStyles";

const SUGGESTIONS = [
  "What are common cold symptoms?",
  "How to lower blood pressure?",
  "When should I see a doctor?",
  "What is a normal heart rate?",
];

export default function ChatbotWidget() {
  const { user } = useApp();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    {
      id: 1,
      role: "bot",
      text: `Hi ${user?.name?.split(" ")[0] || "there"}! I'm MediBot. Ask health questions, medicine questions, or how to use MediLink.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const getLocalFallback = (q) => {
    const lower = q.toLowerCase();
    if (/chest pain|can't breathe|cannot breathe|stroke|seizure|unconscious|severe bleeding/i.test(lower)) {
      return "This may be urgent. Please use SOS Emergency or call local emergency services now.";
    }
    if (lower.includes("blood pressure") || lower.includes("bp")) {
      return "Track BP at rest, reduce salt, stay active, and sleep well. If readings stay high or symptoms are severe, consult a doctor.";
    }
    if (lower.includes("medicine") || lower.includes("dose")) {
      return "I can share general medicine information, but dosage and changes should be confirmed with a doctor or pharmacist.";
    }
    return "I can help with general health information. For personal diagnosis or treatment, please book a MediLink doctor consultation.";
  };

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || typing) return;
    setInput("");
    const userMessage = { id: Date.now(), role: "user", text: q };
    const nextMessages = [...msgs, userMessage];
    setMsgs(nextMessages);
    setTyping(true);
    try {
      const response = await medibot.chat({
        message: q,
        history: nextMessages
          .slice(-8)
          .filter((item) => item.role === "user" || item.role === "bot")
          .map((item) => ({ role: item.role, text: item.text })),
      });
      setMsgs((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: response.data?.answer || getLocalFallback(q),
        },
      ]);
    } catch (err) {
      setMsgs((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          text: `${getLocalFallback(q)} MediBot AI is temporarily unavailable.`,
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <>
      <button
        className={styles.chatToggle}
        onClick={() => setOpen((o) => !o)}
        type="button"
        aria-label={open ? "Close MediBot" : "Open MediBot"}
      >
        {open ? "✕" : "💬"}
      </button>
      {open && (
        <div className={styles.chatPanel}>
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>🤖 MediBot</div>
            <div className={styles.chatSub}>
              AI health guide · Not a replacement for a doctor
            </div>
          </div>
          <div className={styles.chatMessages}>
            {msgs.map((m) => (
              <div
                className={`${styles.messageWrap} ${
                  m.role === "user"
                    ? styles.messageWrapUser
                    : styles.messageWrapBot
                }`}
                key={m.id}
              >
                <div
                  className={`${styles.message} ${
                    m.role === "user" ? styles.messageUser : styles.messageBot
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {typing && <div className={styles.typing}>Typing…</div>}
            <div ref={bottomRef} />
          </div>
          <div className={styles.suggestions}>
            {SUGGESTIONS.slice(0, 2).map((s) => (
              <button
                className={styles.suggestionBtn}
                key={s}
                onClick={() => send(s)}
                type="button"
              >
                {s}
              </button>
            ))}
          </div>
          <div className={styles.inputRow}>
            <input
              className={styles.chatInput}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Ask a health question…"
              disabled={typing}
            />
            <button
              className={styles.sendBtn}
              onClick={() => send()}
              disabled={typing}
              type="button"
            >
              {typing ? "..." : "Send"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
