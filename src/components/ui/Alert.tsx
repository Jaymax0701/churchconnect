import React from "react";
import { Icon } from "./Icon";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  children,
  style,
  ...props
}) => {
  const getStyles = (): { bg: string; border: string; text: string; icon: string } => {
    switch (variant) {
      case "success":
        return {
          bg: "var(--color-success-bg)",
          border: "var(--color-success-border)",
          text: "var(--color-success-text)",
          icon: "check_circle",
        };
      case "warning":
        return {
          bg: "var(--color-warning-bg)",
          border: "var(--color-warning-border)",
          text: "var(--color-warning-text)",
          icon: "warning",
        };
      case "danger":
        return {
          bg: "var(--color-danger-bg)",
          border: "var(--color-danger-border)",
          text: "var(--color-danger-text)",
          icon: "error",
        };
      case "info":
      default:
        return {
          bg: "var(--color-info-bg)",
          border: "var(--color-info-border)",
          text: "var(--color-info-text)",
          icon: "info",
        };
    }
  };

  const { bg, border, text, icon } = getStyles();

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        gap: "var(--space-3)",
        padding: "var(--space-4)",
        borderRadius: "var(--radius-md)",
        backgroundColor: bg,
        border: `1px solid ${border}`,
        color: text,
        fontSize: "var(--text-sm)",
        lineHeight: 1.5,
        ...style,
      }}
      {...props}
    >
      <Icon name={icon} size={20} color={text} style={{ marginTop: "1px" }} />
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: "2px" }}>{title}</div>}
        <div>{children}</div>
      </div>
    </div>
  );
};
