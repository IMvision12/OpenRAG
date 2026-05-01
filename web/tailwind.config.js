/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0a0d14",
        surface: "#141824",
        "surface-2": "#1a1f2d",
        accent: "#7c8aff",
        "accent-soft": "rgba(124, 138, 255, 0.14)",
        "accent-border": "rgba(124, 138, 255, 0.35)",
        border: "rgba(255, 255, 255, 0.08)",
        muted: "rgba(230, 231, 238, 0.62)",
        text: "#e6e7ee",
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      keyframes: {
        "typing-dot": {
          "0%, 60%, 100%": { opacity: "0.25", transform: "translateY(0)" },
          "30%": { opacity: "1", transform: "translateY(-3px)" },
        },
      },
      animation: {
        // ChatGPT-style three-dot bouncing while the model thinks.
        "typing-dot": "typing-dot 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
