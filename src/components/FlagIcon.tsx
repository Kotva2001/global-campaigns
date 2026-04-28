import React from "react";
import { CZ, SK, HU, DE, AT, NL, RO, SI, IT, GR, ES } from "country-flag-icons/react/3x2";

export const FLAG_COMPONENTS: Record<string, React.ComponentType<any>> = {
  CZ, SK, HU, DE, AT, NL, RO, SI, IT, GR, ES,
};

interface Props {
  code: string;
  width?: number;
  height?: number;
  className?: string;
}

export const FlagIcon = ({ code, width = 16, height = 11, className }: Props) => {
  const Comp = FLAG_COMPONENTS[code];
  if (!Comp) return null;
  return (
    <Comp
      title={code}
      style={{ width, height, borderRadius: 4, display: "block", objectFit: "cover", flexShrink: 0 }}
      className={className}
    />
  );
};

export const hasFlag = (code: string) => Boolean(FLAG_COMPONENTS[code]);