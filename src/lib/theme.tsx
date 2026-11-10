import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: ThemeMode;
  resolved: "light" | "dark";
  setTheme: (theme: ThemeMode) => void;
  glassEnabled: boolean;
  setGlassEnabled: (enabled: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "xgram.theme";
const GLASS_KEY = "xgram.liquid-glass";
const LEGACY_VISUAL_STYLE_KEY = "xgram.visual-style";

function applyTheme(mode: ThemeMode): "light" | "dark" {
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

function applyGlass(enabled: boolean) {
  const root = document.documentElement;
  root.dataset.visualStyle = enabled ? "liquid-glass" : "classic";
  root.dataset.liquidGlass = enabled ? "on" : "off";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  const [glassEnabled, setGlassEnabledState] = useState(true);

  useEffect(() => {
    const storedTheme = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const safeTheme: ThemeMode = ["light", "dark", "system"].includes(storedTheme ?? "")
      ? (storedTheme as ThemeMode)
      : "system";
    setThemeState(safeTheme);
    setResolved(applyTheme(safeTheme));

    // Migrate the previous three-choice appearance setting without losing the user's choice.
    const storedGlass = localStorage.getItem(GLASS_KEY);
    const legacyStyle = localStorage.getItem(LEGACY_VISUAL_STYLE_KEY);
    const enabled = storedGlass === null ? legacyStyle !== "classic" : storedGlass === "true";
    setGlassEnabledState(enabled);
    applyGlass(enabled);
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

  const setGlassEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem(GLASS_KEY, String(enabled));
    setGlassEnabledState(enabled);
    applyGlass(enabled);
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme, glassEnabled, setGlassEnabled }),
    [theme, resolved, setTheme, glassEnabled, setGlassEnabled],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
