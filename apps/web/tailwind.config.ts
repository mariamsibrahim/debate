import type { Config } from "tailwindcss";

const config: Config = {
  // Dark mode is driven by CSS variables (see globals.css: prefers-color-scheme
  // + [data-theme] overrides), not Tailwind's `dark:` variant — "media" here
  // is just documentation, no `dark:` classes are used anywhere in the app.
  darkMode: "media",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // `rounded` / `rounded-md` both track the single --radius token in
      // globals.css, so changing corner roundness anywhere is one edit.
      borderRadius: {
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "calc(var(--radius) + 4px)",
      },
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        rule: "var(--rule)",
        brass: "var(--brass)",
        "brass-soft": "var(--brass-soft)",
        teal: "var(--teal)",
        "teal-soft": "var(--teal-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
      },
      fontFamily: {
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
