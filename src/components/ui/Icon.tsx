import React from "react";

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number | string;
  color?: string;
  filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 20,
  color,
  filled = false,
  style,
  className = "",
  ...props
}) => {
  const parsedSize = typeof size === "number" ? `${size}px` : size;

  return (
    <span
      className={`material-symbols-outlined ${className}`.trim()}
      aria-hidden="true"
      style={{
        fontSize: parsedSize,
        width: parsedSize,
        height: parsedSize,
        color: color || "currentColor",
        fontVariationSettings: filled ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
};
