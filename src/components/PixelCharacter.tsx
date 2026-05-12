import { useEffect, useState } from "react";

export type PixelSection =
  | "dashboard"
  | "creators"
  | "products"
  | "analytics"
  | "alerts"
  | "scanner"
  | "settings"
  | "login"
  | "login-go";

const SECTION_COLORS: Record<PixelSection, string> = {
  dashboard: "#00f0ff",
  creators: "#ff2d95",
  products: "#ff6b2b",
  analytics: "#b44dff",
  alerts: "#ffae00",
  scanner: "#39ff14",
  settings: "#cfd2ff",
  login: "#00f0ff",
  "login-go": "#39ff14",
};

interface Props {
  section: PixelSection;
  width?: number;
}

/**
 * Tiny pixel-art companion. Pure inline SVG + CSS keyframes.
 * Body color follows the active section's accent. Each section
 * plays a START animation (~1.2s) then loops an IDLE animation.
 */
export const PixelCharacter = ({ section, width = 88 }: Props) => {
  const [phase, setPhase] = useState<"start" | "idle">("start");
  const [dissolveKey, setDissolveKey] = useState(0);
  const [renderedSection, setRenderedSection] = useState<PixelSection>(section);

  // When section changes: dissolve, then swap, then play start, then idle
  useEffect(() => {
    if (section === renderedSection) return;
    setPhase("start");
    setDissolveKey((k) => k + 1);
    const t1 = window.setTimeout(() => setRenderedSection(section), 320);
    return () => window.clearTimeout(t1);
  }, [section, renderedSection]);

  // After start animation, switch to idle loop
  useEffect(() => {
    setPhase("start");
    const t = window.setTimeout(() => setPhase("idle"), 1300);
    return () => window.clearTimeout(t);
  }, [renderedSection]);

  const accent = SECTION_COLORS[renderedSection];

  return (
    <div
      className="pxc-wrap"
      style={
        {
          width,
          height: width,
          ["--pxc-accent" as any]: accent,
        } as React.CSSProperties
      }
      data-section={renderedSection}
      data-phase={phase}
      aria-hidden
    >
      {/* Neon glow halo */}
      <div className="pxc-glow" />
      {/* Floor reflection */}
      <div className="pxc-floor" />

      <div key={dissolveKey} className="pxc-dissolve">
        <Sprite section={renderedSection} />
      </div>
    </div>
  );
};

/** A 16x16 grid of "pixels". Scaled up via container width. */
const Sprite = ({ section }: { section: PixelSection }) => {
  return (
    <svg
      className="pxc-svg"
      viewBox="0 0 16 20"
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head */}
      <g className="pxc-head">
        {/* skin */}
        <rect x="6" y="2" width="4" height="3" fill="#f5c8a1" />
        {/* hair */}
        <rect x="5" y="1" width="6" height="2" fill="#3a2a1a" />
        <rect x="5" y="2" width="1" height="1" fill="#3a2a1a" />
        <rect x="10" y="2" width="1" height="1" fill="#3a2a1a" />
        {/* eyes */}
        <rect className="pxc-eye pxc-eye-l" x="6" y="3" width="1" height="1" fill="#0a0a1a" />
        <rect className="pxc-eye pxc-eye-r" x="9" y="3" width="1" height="1" fill="#0a0a1a" />
        {/* mouth */}
        <rect x="7" y="4" width="2" height="1" fill="#7a3a3a" />
      </g>

      {/* Body (accent color) */}
      <g className="pxc-body">
        <rect x="5" y="5" width="6" height="5" fill="var(--pxc-accent)" />
        {/* shading */}
        <rect x="5" y="9" width="6" height="1" fill="rgba(0,0,0,0.25)" />
        {/* belt */}
        <rect x="5" y="10" width="6" height="1" fill="#1a1a2a" />
      </g>

      {/* Legs */}
      <g className="pxc-legs">
        <rect x="5" y="11" width="2" height="3" fill="#1a1a3a" />
        <rect x="9" y="11" width="2" height="3" fill="#1a1a3a" />
        <rect x="5" y="14" width="2" height="1" fill="#0a0a1a" />
        <rect x="9" y="14" width="2" height="1" fill="#0a0a1a" />
      </g>

      {/* Arms */}
      <g className="pxc-arm pxc-arm-l">
        <rect x="3" y="6" width="2" height="3" fill="var(--pxc-accent)" />
        <rect x="3" y="9" width="2" height="1" fill="#f5c8a1" />
      </g>
      <g className="pxc-arm pxc-arm-r">
        <rect x="11" y="6" width="2" height="3" fill="var(--pxc-accent)" />
        <rect x="11" y="9" width="2" height="1" fill="#f5c8a1" />
      </g>

      {/* Section-specific prop */}
      <Prop section={section} />
    </svg>
  );
};

const Prop = ({ section }: { section: PixelSection }) => {
  switch (section) {
    case "dashboard":
      return (
        <g className="pxc-prop pxc-prop-clipboard">
          <rect x="1" y="9" width="3" height="4" fill="#d8a55a" />
          <rect x="1" y="9" width="3" height="1" fill="#5a3a1a" />
          <rect x="2" y="10" width="1" height="1" fill="#fff" />
          <rect x="2" y="11" width="1" height="1" fill="#fff" />
        </g>
      );
    case "creators":
      return (
        <g className="pxc-prop pxc-prop-pen">
          <rect x="1" y="9" width="3" height="4" fill="#d8a55a" />
          <rect x="2" y="10" width="1" height="1" fill="#fff" />
          <rect x="2" y="11" width="1" height="1" fill="#fff" />
          <rect className="pxc-pen" x="12" y="8" width="1" height="2" fill="#ff2d95" />
          <rect className="pxc-pen" x="12" y="10" width="1" height="1" fill="#1a1a2a" />
        </g>
      );
    case "products":
      return (
        <g className="pxc-prop pxc-prop-box">
          <rect className="pxc-box-lid" x="1" y="9" width="3" height="1" fill="#7a4a2a" />
          <rect x="1" y="10" width="3" height="3" fill="#a86a3a" />
          <rect x="2" y="11" width="1" height="1" fill="#ffe06a" />
        </g>
      );
    case "analytics":
      return (
        <g className="pxc-prop pxc-prop-glasses">
          <rect x="6" y="3" width="1" height="1" fill="#b44dff" />
          <rect x="9" y="3" width="1" height="1" fill="#b44dff" />
          <rect x="7" y="3" width="2" height="1" fill="#b44dff" opacity="0.6" />
        </g>
      );
    case "alerts":
      return (
        <g className="pxc-prop pxc-prop-bang">
          <rect className="pxc-bang" x="13" y="2" width="1" height="3" fill="#ffae00" />
          <rect className="pxc-bang" x="13" y="6" width="1" height="1" fill="#ffae00" />
        </g>
      );
    case "scanner":
      return (
        <g className="pxc-prop pxc-prop-mag">
          <rect x="12" y="8" width="2" height="2" fill="none" stroke="#39ff14" strokeWidth="0.5" />
          <rect x="13" y="9" width="1" height="1" fill="#39ff14" opacity="0.4" />
          <rect x="14" y="10" width="1" height="2" fill="#39ff14" />
        </g>
      );
    case "settings":
      return (
        <g className="pxc-prop pxc-prop-wrench">
          <rect x="12" y="8" width="1" height="3" fill="#cfd2ff" />
          <rect x="11" y="7" width="3" height="1" fill="#cfd2ff" />
        </g>
      );
    case "login":
      return (
        <g className="pxc-prop pxc-prop-wave">
          {/* watch on left arm */}
          <rect x="3" y="10" width="2" height="1" fill="#cfd2ff" />
        </g>
      );
    case "login-go":
      return (
        <g className="pxc-prop pxc-prop-dust">
          <rect x="2" y="13" width="1" height="1" fill="#fff" opacity="0.7" />
          <rect x="13" y="13" width="1" height="1" fill="#fff" opacity="0.7" />
        </g>
      );
    default:
      return null;
  }
};

export default PixelCharacter;