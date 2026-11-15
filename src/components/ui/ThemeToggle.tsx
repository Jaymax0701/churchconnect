import React from "react";
import { Icon } from "./Icon";
import { useTheme } from "../../contexts/ThemeContext";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { themePreference, resolvedTheme, cycleTheme } = useTheme();
  const label = themePreference === "system" ? "System" : themePreference === "dark" ? "Dark" : "Light";

  return (
    <button
      type="button"
      className={`cc-theme-toggle ${className}`.trim()}
      onClick={cycleTheme}
      aria-label={`Theme preference: ${label}. Change theme`}
      title={`Theme: ${label} — click to change`}
    >
      <Icon name={resolvedTheme === "dark" ? "dark_mode" : "light_mode"} size={18} />
      <span>{label}</span>
    </button>
  );
};
