import React, { useState } from "react";
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
  type = "text",
  ...props
}) => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isPassword = type === "password";

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

      <div style={{ position: "relative", width: "100%" }}>
        <input
          id={id}
          type={isPassword && passwordVisible ? "text" : type}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`cc-input ${error ? "has-error" : ""}`}
          style={{ ...style, ...(isPassword ? { paddingRight: "48px" } : {}) }}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setPasswordVisible((visible) => !visible)}
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-pressed={passwordVisible}
            title={passwordVisible ? "Hide password" : "Show password"}
            style={{
              position: "absolute",
              top: "50%",
              right: "10px",
              transform: "translateY(-50%)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              border: 0,
              borderRadius: "var(--radius-sm)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              cursor: "pointer",
            }}
          >
            <Icon name={passwordVisible ? "visibility_off" : "visibility"} size={20} />
          </button>
        )}
      </div>

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
