export const colors = {
  bg: "#0B1220",
  surface: "#0F1A2B",
  border: "rgba(255,255,255,0.08)",
  text: {
    primary: "#F6F8FF",
    secondary: "rgba(246,248,255,0.72)",
    muted: "rgba(246,248,255,0.55)",
  },
  accent: {
    DEFAULT: "#3B82F6",
    hover: "#2563EB",
  },
  success: "#22C55E",
  danger: "#EF4444",
} as const;

export const spacing = {
  maxContentWidth: "1200px",
  pagePaddingDesktop: "24px",
  pagePaddingMobile: "16px",
  sectionPaddingDesktop: "96px",
  sectionPaddingMobile: "64px",
  navHeight: "72px",
} as const;

export const typography = {
  h1Desktop: "56px",
  h1Mobile: "38px",
  h2: "32px",
  h3: "20px",
  body: "16px",
  small: "13px",
  buttonHeight: "44px",
} as const;
