import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialPreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem("churchconnect-theme");
    return saved === "dark" || saved === "system" ? saved : "light";
  } catch {
    return "light";
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themePreference, setThemePreference] = useState<ThemePreference>(getInitialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const nextTheme: ResolvedTheme = themePreference === "system"
        ? (media.matches ? "dark" : "light")
        : themePreference;
      setResolvedTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    try {
      window.localStorage.setItem("churchconnect-theme", themePreference);
    } catch {
      // Theme remains available for the current session if storage is unavailable.
    }

    applyTheme();
    if (themePreference === "system") {
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }
  }, [themePreference]);

  const cycleTheme = () => {
    setThemePreference((current) =>
      current === "light" ? "dark" : current === "dark" ? "system" : "light"
    );
  };

  return <ThemeContext.Provider value={{ themePreference, resolvedTheme, cycleTheme }}>{children}</ThemeContext.Provider>;
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
