import { useEffect, useMemo, useState } from "react";

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
  creators: "#ff2d78",
  products: "#ff4757",
  analytics: "#a855f7",
  alerts: "#f59e0b",
  scanner: "#10b981",
  settings: "#94a3b8",
  login: "#ffffff",
  "login-go": "#ffffff",
};

interface Props {
  section: PixelSection;
  width?: number;
}

const GRID_W = 18;
const GRID_H = 24;

// Base humanoid silhouette: head, neck, torso, legs, feet (no arms).
// Arms + props are layered per pose so each section can articulate them.
const BASE: Array<[number, number]> = (() => {
  const p: Array<[number, number]> = [];
  // head 4x3
  for (let x = 7; x <= 10; x++) for (let y = 2; y <= 4; y++) p.push([x, y]);
  // neck
  p.push([8, 5], [9, 5]);
  // torso 6x7
  for (let x = 6; x <= 11; x++) for (let y = 6; y <= 12; y++) p.push([x, y]);
  // legs
  for (let y = 13; y <= 18; y++) {
    p.push([7, y], [8, y], [9, y], [10, y]);
  }
  // feet
  p.push([6, 19], [7, 19], [10, 19], [11, 19]);
  return p;
})();

// Arm helpers (relative to torso)
const armDown = (side: "L" | "R"): Array<[number, number]> => {
  const x = side === "L" ? 5 : 12;
  return [
    [x, 6],
    [x, 7],
    [x, 8],
    [x, 9],
    [x, 10],
  ];
};
const armOut = (side: "L" | "R"): Array<[number, number]> => {
  const baseX = side === "L" ? 5 : 12;
  const tipX = side === "L" ? 4 : 13;
  return [
    [baseX, 6],
    [baseX, 7],
    [tipX, 7],
    [tipX, 8],
  ];
};
const armUp = (side: "L" | "R"): Array<[number, number]> => {
  const x = side === "L" ? 5 : 12;
  return [
    [x, 6],
    [x, 5],
    [x, 4],
    [x, 3],
  ];
};
const armForward = (side: "L" | "R"): Array<[number, number]> => {
  const baseX = side === "L" ? 5 : 12;
  const midX = side === "L" ? 4 : 13;
  return [
    [baseX, 6],
    [baseX, 7],
    [midX, 8],
    [midX, 9],
  ];
};
const armChin = (side: "R"): Array<[number, number]> => {
  // arm bent up to chin (under head)
  return [
    [12, 6],
    [12, 5],
    [11, 5],
    [10, 5],
  ];
};

// Small props (same color, monochrome)
const propClipboard = (): Array<[number, number]> => [
  [3, 8], [4, 8],
  [3, 9], [4, 9],
  [3, 10], [4, 10],
];
const propPen = (): Array<[number, number]> => [
  [14, 9], [14, 10],
];
const propBoxItem = (): Array<[number, number]> => [
  [3, 7], [4, 7],
  [3, 8], [4, 8],
];
const propMag = (): Array<[number, number]> => [
  // small circle
  [14, 7], [15, 7],
  [13, 8], [16, 8],
  [13, 9], [16, 9],
  [14, 10], [15, 10],
];
const propWrench = (): Array<[number, number]> => [
  [14, 9],
  [13, 10], [14, 10],
];

// Translate pose by (dx, dy)
const shift = (cells: Array<[number, number]>, dx: number, dy: number): Array<[number, number]> =>
  cells.map(([x, y]) => [x + dx, y + dy]);

const merge = (...layers: Array<Array<[number, number]>>): Array<[number, number]> => {
  const seen = new Set<string>();
  const out: Array<[number, number]> = [];
  for (const layer of layers) {
    for (const [x, y] of layer) {
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push([x, y]);
    }
  }
  return out;
};

type Frame = Array<[number, number]>;
type Pose = { start: Frame; idleA: Frame; idleB: Frame };

const POSES: Record<PixelSection, Pose> = {
  dashboard: {
    // arm extends with clipboard
    start: merge(BASE, armDown("L"), armForward("R"), propClipboard()),
    idleA: merge(BASE, armDown("L"), armDown("R"), propClipboard()),
    idleB: merge(shift(BASE, 0, -1), armDown("L"), armDown("R"), shift(propClipboard(), 0, -1)),
  },
  creators: {
    // both arms up
    start: merge(BASE, armUp("L"), armUp("R")),
    idleA: merge(BASE, armDown("L"), armOut("R"), propPen()),
    idleB: merge(BASE, armDown("L"), armUp("R"), shift(propPen(), -1, -2)),
  },
  products: {
    // arms forward (opening box)
    start: merge(BASE, armForward("L"), armForward("R")),
    idleA: merge(BASE, armForward("L"), armUp("R"), propBoxItem()),
    idleB: merge(shift(BASE, 1, 0), armForward("L"), armUp("R"), shift(propBoxItem(), 1, 0)),
  },
  analytics: {
    // hand to chin
    start: merge(BASE, armDown("L"), armChin("R")),
    idleA: merge(BASE, armDown("L"), armChin("R")),
    idleB: merge(BASE, armDown("L"), armUp("R")),
  },
  alerts: {
    // jump up
    start: merge(shift(BASE, 0, -3), armOut("L"), armOut("R")),
    idleA: merge(BASE, armDown("L"), armDown("R")),
    idleB: merge(BASE, armDown("L"), armDown("R")), // head turn implied by tiny shift
  },
  scanner: {
    // arm with magnifier extended
    start: merge(BASE, armDown("L"), armForward("R"), propMag()),
    idleA: merge(BASE, armDown("L"), armForward("R"), propMag()),
    idleB: merge(BASE, armDown("L"), armForward("R"), shift(propMag(), -2, 0)),
  },
  settings: {
    // wrench
    start: merge(BASE, armDown("L"), armForward("R"), propWrench()),
    idleA: merge(BASE, armDown("L"), armForward("R"), propWrench()),
    idleB: merge(BASE, armDown("L"), armOut("R"), shift(propWrench(), 0, -2)),
  },
  login: {
    // waving
    start: merge(BASE, armUp("L"), armDown("R")),
    idleA: merge(BASE, armUp("L"), armDown("R")),
    idleB: merge(BASE, armOut("L"), armDown("R")),
  },
  "login-go": {
    start: merge(shift(BASE, 0, -4), armOut("L"), armOut("R")),
    idleA: merge(shift(BASE, 6, 0), armForward("L"), armForward("R")),
    idleB: merge(shift(BASE, 6, 0), armForward("L"), armForward("R")),
  },
};

const cellsToShadow = (cells: Frame, px: number, color: string): string => {
  return cells
    .map(([x, y]) => `${x * px}px ${y * px}px 0 0 ${color}`)
    .join(", ");
};

export const PixelCharacter = ({ section, width = 88 }: Props) => {
  const [phase, setPhase] = useState<"start" | "idle">("start");
  const [renderedSection, setRenderedSection] = useState<PixelSection>(section);
  const [transitioning, setTransitioning] = useState(false);

  // On section change: fade out, swap, fade in, play start, then idle
  useEffect(() => {
    if (section === renderedSection) return;
    setTransitioning(true);
    const t1 = window.setTimeout(() => {
      setRenderedSection(section);
      setPhase("start");
      setTransitioning(false);
    }, 150);
    return () => window.clearTimeout(t1);
  }, [section, renderedSection]);

  useEffect(() => {
    setPhase("start");
    const t = window.setTimeout(() => setPhase("idle"), 1200);
    return () => window.clearTimeout(t);
  }, [renderedSection]);

  const px = Math.max(2, Math.floor(width / GRID_W));
  const color = SECTION_COLORS[renderedSection];
  const pose = POSES[renderedSection];

  const shadows = useMemo(
    () => ({
      start: cellsToShadow(pose.start, px, color),
      idleA: cellsToShadow(pose.idleA, px, color),
      idleB: cellsToShadow(pose.idleB, px, color),
    }),
    [pose, px, color],
  );

  const stageW = GRID_W * px;
  const stageH = GRID_H * px;

  return (
    <div
      className="pxc-stage"
      style={
        {
          width: stageW,
          height: stageH,
          ["--pxc-accent" as any]: color,
          opacity: transitioning ? 0 : 1,
          transition: "opacity 0.15s ease-out",
        } as React.CSSProperties
      }
      data-section={renderedSection}
      data-phase={phase}
      aria-hidden
    >
      <div className="pxc-glow" />
      <div className="pxc-floor" />
      {/* Each layer is one 1x1 px element painted entirely with box-shadows */}
      <div
        className="pxc-pixel pxc-layer-start"
        style={{ width: px, height: px, boxShadow: shadows.start }}
      />
      <div
        className="pxc-pixel pxc-layer-a"
        style={{ width: px, height: px, boxShadow: shadows.idleA }}
      />
      <div
        className="pxc-pixel pxc-layer-b"
        style={{ width: px, height: px, boxShadow: shadows.idleB }}
      />
    </div>
  );
};

export default PixelCharacter;
