import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  href?: string; // Optional link URL; when provided Button renders as an anchor element
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  children,
  className = "",
  style,
  href,
  ...props
}) => {
  const isDisabled = Boolean(disabled || isLoading);
  const buttonClasses = `cc-btn cc-btn-${variant} cc-btn-${size} ${isDisabled ? "is-disabled" : ""} ${className}`.trim();

  const spinner = (
    <svg
      style={{
        width: size === "sm" ? "14px" : "16px",
        height: size === "sm" ? "14px" : "16px",
        animation: "spin 0.8s linear infinite",
        flexShrink: 0,
      }}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" fill="currentColor" />
    </svg>
  );

  // Render as an anchor element when href is provided, otherwise as a button
  if (href) {
    const anchorProps = props as unknown as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses}
        aria-busy={isLoading}
        aria-disabled={isDisabled}
        style={style}
        onClick={(e) => {
          if (isDisabled) {
            e.preventDefault();
            return;
          }
          anchorProps.onClick?.(e);
        }}
        {...anchorProps}
      >
        {isLoading && spinner}
        {children}
      </a>
    );
  }

  return (
    <button
      disabled={isDisabled}
      aria-busy={isLoading}
      className={buttonClasses}
      style={style}
      {...props}
    >
      {isLoading && spinner}
      {children}
    </button>
  );
};

