/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        med: {
          primary: "var(--primary)",
          accent: "var(--accent)",
          text: "var(--text)",
          muted: "var(--muted)",
          card: "var(--card)",
          card2: "var(--card2)",
          border: "var(--border)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        heading: ["Poppins", "Inter", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        med: "8px",
      },
      keyframes: {
        "grid-scroll": {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "44px 44px, 44px 44px" },
        },
        "grid-scroll-slow": {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "88px 88px, 88px 88px" },
        },
        "cyber-grid": {
          "0%": { backgroundPosition: "0 0, 0 0" },
          "100%": { backgroundPosition: "48px 48px, 48px 48px" },
        },
        scanner: {
          "0%": { transform: "translateX(-130%)" },
          "100%": { transform: "translateX(230%)" },
        },
        "scan-line": {
          "0%": { transform: "translateX(-140%)", opacity: "0.25" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateX(240%)", opacity: "0.25" },
        },
        "wake-progress": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(220%)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-110%)" },
          "100%": { transform: "translateX(170%)" },
        },
        "fade-rise": {
          "0%": { opacity: "0", transform: "translateY(14px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(18px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        "terminal-line": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        typewriter: {
          "0%": { clipPath: "inset(0 100% 0 0)" },
          "100%": { clipPath: "inset(0 0 0 0)" },
        },
        "cursor-blink": {
          "0%, 45%": { opacity: "1" },
          "46%, 100%": { opacity: "0" },
        },
        "ring-pulse": {
          "0%, 100%": {
            boxShadow: "0 0 0 0 rgba(34, 211, 238, 0.32), 0 0 30px rgba(34, 211, 238, 0.22)",
          },
          "50%": {
            boxShadow: "0 0 0 12px rgba(34, 211, 238, 0), 0 0 46px rgba(34, 197, 94, 0.24)",
          },
        },
        "pulse-ring": {
          "0%, 100%": {
            transform: "scale(1)",
            boxShadow: "0 0 0 0 rgba(34, 211, 238, 0.34), 0 0 42px rgba(34, 211, 238, 0.28)",
          },
          "50%": {
            transform: "scale(1.035)",
            boxShadow: "0 0 0 14px rgba(34, 211, 238, 0), 0 0 58px rgba(34, 197, 94, 0.26)",
          },
        },
        "inner-glow": {
          "0%, 100%": { opacity: "0.45", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(0.9)" },
        },
        "ping-slow": {
          "0%": { transform: "scale(1)", opacity: "0.8" },
          "75%, 100%": { transform: "scale(2.4)", opacity: "0" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "bob-slow": {
          "0%, 100%": { transform: "translate3d(0, 0, 0)" },
          "50%": { transform: "translate3d(0, -18px, 0)" },
        },
        "orb-float": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(18px, -22px, 0) scale(1.08)" },
        },
        "orb-float-reverse": {
          "0%, 100%": { transform: "translate3d(0, 0, 0) scale(1)" },
          "50%": { transform: "translate3d(-18px, 20px, 0) scale(1.06)" },
        },
        "glow-breathe": {
          "0%, 100%": { opacity: "0.55", transform: "translateX(-50%) scale(1)" },
          "50%": { opacity: "0.95", transform: "translateX(-50%) scale(1.14)" },
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "spin-reverse-slow": {
          "0%": { transform: "rotate(360deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
        "data-sweep": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "20%, 80%": { opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
        "heartbeat": {
          "0%, 100%": { transform: "scale(1)" },
          "14%": { transform: "scale(1.12)" },
          "28%": { transform: "scale(1)" },
          "42%": { transform: "scale(1.08)" },
          "70%": { transform: "scale(1)" },
        },
        "soft-flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.72" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.94)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in-left": {
          "0%": { opacity: "0", transform: "translateX(-16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "grid-scroll": "grid-scroll 20s linear infinite",
        "grid-scroll-slow": "grid-scroll-slow 34s linear infinite",
        "cyber-grid": "cyber-grid 18s linear infinite",
        scanner: "scanner 2.8s ease-in-out infinite",
        "scan-line": "scan-line 2.8s ease-in-out infinite",
        "wake-progress": "wake-progress 1.65s ease-in-out infinite",
        shimmer: "shimmer 1.7s ease-in-out infinite",
        "fade-rise": "fade-rise 600ms ease-out both",
        "fade-in-up": "fade-in-up 650ms ease-out both",
        "fade-in": "fade-in 450ms ease-out both",
        "fade-out": "fade-out 300ms ease-in both",
        "terminal-line": "terminal-line 700ms ease-out both",
        typewriter: "typewriter 1.4s steps(36, end) both",
        "cursor-blink": "cursor-blink 900ms steps(1, end) infinite",
        "ring-pulse": "ring-pulse 2.2s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2.35s ease-in-out infinite",
        "inner-glow": "inner-glow 1.9s ease-in-out infinite",
        "ping-slow": "ping-slow 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
        bob: "bob 4s ease-in-out infinite",
        "bob-slow": "bob-slow 7s ease-in-out infinite",
        "orb-float": "orb-float 8s ease-in-out infinite",
        "orb-float-reverse": "orb-float-reverse 9s ease-in-out infinite",
        "glow-breathe": "glow-breathe 5.5s ease-in-out infinite",
        "spin-slow": "spin-slow 8s linear infinite",
        "spin-reverse-slow": "spin-reverse-slow 10s linear infinite",
        "data-sweep": "data-sweep 6s ease-in-out infinite",
        heartbeat: "heartbeat 1.6s ease-in-out infinite",
        "soft-flicker": "soft-flicker 2.4s ease-in-out infinite",
        "scale-in": "scale-in 360ms ease-out both",
        "slide-in-left": "slide-in-left 420ms ease-out both",
        "slide-in-right": "slide-in-right 420ms ease-out both",
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
};
