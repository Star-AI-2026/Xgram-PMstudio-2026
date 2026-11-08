import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type VisualStyle = "classic" | "blur" | "liquid-glass";

type ThemeContextValue = {
  theme: ThemeMode;
  resolved: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  visualStyle: VisualStyle;
  setVisualStyle: (style: VisualStyle) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "xgram.theme";
const VISUAL_STYLE_KEY = "xgram.visual-style";

function applyTheme(mode: ThemeMode): "light" | "dark" {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [visualStyle, setVisualStyleState] = useState<VisualStyle>("liquid-glass");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
    setThemeState(stored);
    setResolved(applyTheme(stored));
    const storedStyle = (localStorage.getItem(VISUAL_STYLE_KEY) as VisualStyle | null) ?? "liquid-glass";
    const safeStyle: VisualStyle = ["classic", "blur", "liquid-glass"].includes(storedStyle) ? storedStyle : "classic";
    setVisualStyleState(safeStyle);
    document.documentElement.dataset.visualStyle = safeStyle;
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if (theme === "system") setResolved(applyTheme("system"));
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    setResolved(applyTheme(next));
  }, []);

  const setVisualStyle = useCallback((next: VisualStyle) => {
    localStorage.setItem(VISUAL_STYLE_KEY, next);
    document.documentElement.dataset.visualStyle = next;
    setVisualStyleState(next);
  }, []);

  const value = useMemo(() => ({ theme, resolved, setTheme, visualStyle, setVisualStyle }), [theme, resolved, setTheme, visualStyle, setVisualStyle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
