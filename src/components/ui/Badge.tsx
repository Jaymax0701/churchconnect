import React from "react";
import { Icon } from "./Icon";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "approved" | "pending" | "admin" | "superadmin" | "neutral" | "sage";
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  children,
  style,
  ...props
}) => {
  const getStyles = (): React.CSSProperties => {
    switch (variant) {
      case "approved":
        return {
          backgroundColor: "var(--color-success-bg)",
          color: "var(--color-success-text)",
          border: "1px solid var(--color-success-border)",
        };
      case "pending":
        return {
          backgroundColor: "var(--color-warning-bg)",
          color: "var(--color-warning-text)",
          border: "1px solid var(--color-warning-border)",
        };
      case "admin":
        return {
          backgroundColor: "var(--color-soft-sage)",
          color: "var(--color-forest-green)",
          border: "1px solid var(--color-sage-green)",
        };
      case "superadmin":
        return {
          backgroundColor: "var(--color-deep-forest)",
          color: "var(--color-white)",
          border: "1px solid var(--color-deep-forest)",
        };
      case "sage":
        return {
          backgroundColor: "var(--color-soft-sage)",
          color: "var(--color-deep-forest)",
          border: "1px solid var(--color-border)",
        };
      case "neutral":
      default:
        return {
          backgroundColor: "var(--color-ivory-subtle)",
          color: "var(--color-text-secondary)",
          border: "1px solid var(--color-border)",
        };
    }
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        borderRadius: "var(--radius-full)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        whiteSpace: "nowrap",
        ...getStyles(),
        ...style,
      }}
      {...props}
    >
      {variant === "superadmin" && (
        <Icon name="lock" size={13} color="currentColor" />
      )}
      {children}
    </span>
  );
};
