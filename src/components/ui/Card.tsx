import React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  interactive = false,
  className = "",
  style,
  ...props
}) => {
  return (
    <div
      className={`${interactive ? "card-interactive" : ""} ${className}`.trim()}
      style={{
        backgroundColor: "var(--bg-surface)",
        border: "1px solid rgba(20, 45, 37, 0.08)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div
    style={{
      padding: "var(--space-5) var(--space-6)",
      borderBottom: "1px solid var(--border-default)",
      backgroundColor: "var(--color-white)",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div style={{ padding: "var(--space-6)", ...style }} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, style, ...props }) => (
  <div
    style={{
      padding: "var(--space-4) var(--space-6)",
      borderTop: "1px solid var(--border-default)",
      backgroundColor: "var(--color-ivory-subtle)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      ...style,
    }}
    {...props}
  >
    {children}
  </div>
);
