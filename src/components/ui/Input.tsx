import React from "react";
import { Icon } from "./Icon";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  error?: string;
  hint?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  id,
  error,
  hint,
  required,
  style,
  ...props
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", width: "100%" }}>
      <label
        htmlFor={id}
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          color: "var(--color-text-primary)",
        }}
      >
        {label}
        {required && <span style={{ color: "var(--color-danger-text)", marginLeft: "4px" }}>*</span>}
      </label>

      {hint && (
        <span id={`${id}-hint`} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
          {hint}
        </span>
      )}

      <input
        id={id}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`cc-input ${error ? "has-error" : ""}`}
        style={style}
        {...props}
      />

      {error && (
        <span
          id={`${id}-error`}
          role="alert"
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--color-danger-text)",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <Icon name="error" size={14} color="var(--color-danger-text)" /> {error}
        </span>
      )}
    </div>
  );
};
