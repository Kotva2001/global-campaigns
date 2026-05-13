import React from "react";

interface CrateIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export const CrateIcon = ({ className, style }: CrateIconProps) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    {/* Box body (base — stays static) */}
    <path d="M4 10 L4 20 L20 20 L20 10" className="crate-base" />
    {/* Vertical center brace */}
    <path d="M12 10 L12 20" className="crate-base" />
    {/* Horizontal center brace */}
    <path d="M4 15 L20 15" className="crate-base" />
    {/* Lid (top flap — animates on hover) */}
    <path d="M3 10 L21 10" className="crate-lid" />
  </svg>
);
