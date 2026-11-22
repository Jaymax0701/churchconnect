import React from "react";

const SPECIAL_CHARACTERS = "!@#$%^&*()_+-=[]{};':"\\|<>?,./\`~";

export const PASSWORD_REQUIREMENTS = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter (a–z)", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number (0–9)", test: (value: string) => /[0-9]/.test(value) },
  { label: "One special character (e.g. !@#$%)", test: (value: string) => [...value].some((character) => SPECIAL_CHARACTERS.includes(character)) },
] as const;

export function isPasswordStrong(value: string): boolean {
  return PASSWORD_REQUIREMENTS.every((requirement) => requirement.test(value));
}

export const PasswordRequirements: React.FC<{ password: string }> = ({ password }) => (
  <div aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: -8 }}>
    <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", fontWeight: 600 }}>
      Your password must contain:
    </p>
    {PASSWORD_REQUIREMENTS.map((requirement) => {
      const satisfied = requirement.test(password);
      return (
        <div key={requirement.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "var(--text-xs)", color: satisfied ? "var(--color-success, #16803c)" : "var(--color-text-secondary)" }}>
          <span aria-hidden="true" style={{ width: 16, textAlign: "center", fontWeight: 700 }}>{satisfied ? "✓" : "○"}</span>
          <span>{requirement.label}</span>
        </div>
      );
    })}
  </div>
);
