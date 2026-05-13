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

const GRID_W = 12;
const GRID_H = 16;

type Cell = [number, number];
type Cells = Cell[];

// Side-view silhouette facing right (no front arm — added per pose)
const HEAD: Cells = [
  [2, 0], [3, 0], [4, 0], [5, 0],
  [2, 1], [3, 1], [4, 1], [5, 1],
  [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], // nose bump at x=6
  [2, 3], [3, 3], [4, 3], [5, 3],
];
const NECK: Cells = [[3, 4], [4, 4]];
const TORSO: Cells = [
  [2, 5], [3, 5], [4, 5],
  [2, 6], [3, 6], [4, 6],
  [2, 7], [3, 7], [4, 7],
  [2, 8], [3, 8], [4, 8],
];
const WAIST: Cells = [[2, 9], [3, 9], [4, 9]];
const LEGS_STAND: Cells = [
  [2, 10], [2, 11], [2, 12], [2, 13],
  [4, 10], [4, 11], [4, 12], [4, 13],
  [1, 14], [2, 14], [3, 14], [4, 14], [5, 14],
];
const LEGS_STEP: Cells = [
  [2, 10], [2, 11], [3, 12], [3, 13],
  [4, 10], [4, 11], [4, 12], [5, 13],
  [1, 14], [2, 14], [3, 14], [4, 14], [5, 14], [6, 14],
];

const BASE_A: Cells = [...HEAD, ...NECK, ...TORSO, ...WAIST, ...LEGS_STAND];
const BASE_B: Cells = [...HEAD, ...NECK, ...TORSO, ...WAIST, ...LEGS_STEP];

// Arms (front arm only — back arm hidden behind torso for side view).
// Shoulder pivot is around (5,5).
const armDownLow: Cells = [[5, 6], [5, 7], [5, 8], [5, 9]];     // hand at hip
const armChest: Cells = [[5, 6], [6, 6], [7, 7], [7, 8]];        // hand forward at chest
const armChestHigh: Cells = [[5, 5], [6, 5], [7, 6], [7, 7]];    // hand forward, raised
const armForward: Cells = [[5, 6], [6, 6], [7, 6], [8, 6]];      // straight out
const armForwardFar: Cells = [[5, 6], [6, 6], [7, 6], [8, 6], [9, 6]]; // extended
const armUpHigh: Cells = [[5, 5], [5, 4], [5, 3], [6, 2]];       // hand way up
const armChin: Cells = [[5, 6], [6, 5], [6, 4]];                 // bent up to chin
const armPointUp: Cells = [[5, 5], [6, 4], [7, 3], [8, 2]];      // diagonal point
const armSweepNear: Cells = [[5, 6], [6, 7], [7, 8]];            // sweep near body
const armSweepFar: Cells = [[5, 6], [6, 6], [7, 6], [8, 7], [9, 8]]; // sweep extended
const armWrenchA: Cells = [[5, 6], [6, 5], [7, 5]];              // wrench up-right
const armWrenchB: Cells = [[5, 6], [6, 7], [7, 7]];              // wrench down-right

// Tiny props (same color, monochrome)
const propClipboardChest: Cells = [
  [8, 7], [9, 7], [10, 7],
  [8, 8], [9, 8], [10, 8],
  [8, 9], [9, 9], [10, 9],
];
const propPenHigh: Cells = [[8, 6]];
const propPenLow: Cells = [[8, 9]];
const propBoxItem: Cells = [[6, 1], [7, 1], [8, 1]];             // item held high
const propBoxItemTilt: Cells = [[7, 2], [8, 2], [9, 2]];
const propMagSmall: Cells = [
  [9, 7], [10, 7],
  [9, 8], [10, 8],
];
const propMagBig: Cells = [
  [9, 6], [10, 6], [11, 6],
  [9, 7], [10, 7], [11, 7],
  [9, 8], [10, 8], [11, 8],
];
const propMagFar: Cells = [
  [10, 7], [11, 7],
  [10, 8], [11, 8],
];
const propWrenchA: Cells = [[8, 5], [8, 4]];                     // wrench pointing up
const propWrenchB: Cells = [[8, 7], [8, 8]];                     // wrench pointing down

const shift = (cells: Cells, dx: number, dy: number): Cells =>
  cells.map(([x, y]) => [x + dx, y + dy]);

const merge = (...layers: Cells[]): Cells => {
  const seen = new Set<string>();
  const out: Cells = [];
  for (const layer of layers) {
    for (const [x, y] of layer) {
      const k = `${x},${y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([x, y]);
    }
  }
  return out;
};

type Pose = { start: Cells; idleA: Cells; idleB: Cells };

const POSES: Record<PixelSection, Pose> = {
  dashboard: {
    // arm comes up from hip, then bobs head down to read
    start: merge(BASE_A, armDownLow),
    idleA: merge(BASE_A, armChest, propClipboardChest),
    idleB: merge(shift(HEAD, 0, 2), shift(NECK, 0, 2), TORSO, WAIST, LEGS_STAND, armChest, propClipboardChest),
  },
  creators: {
    // both arms up wave then big scribble (hand high vs low) + head tilt
    start: merge(BASE_A, armUpHigh),
    idleA: merge(BASE_A, armChestHigh, propPenHigh, propClipboardChest),
    idleB: merge(shift(HEAD, 0, 1), shift(NECK, 0, 1), TORSO, WAIST, LEGS_STAND, armChest, propPenLow, propClipboardChest),
  },
  products: {
    // arms wide, then item raised; head tilts side to side
    start: merge(BASE_A, armForward),
    idleA: merge(BASE_A, armUpHigh, propBoxItem),
    idleB: merge(shift(HEAD, 1, 0), NECK, TORSO, WAIST, LEGS_STAND, armUpHigh, propBoxItemTilt),
  },
  analytics: {
    // hand to chin, then point upward at chart
    start: merge(BASE_A, armChin),
    idleA: merge(BASE_A, armChin),
    idleB: merge(BASE_A, armPointUp),
  },
  alerts: {
    // big jump on start; idle: whole body shifts left then right
    start: merge(shift(BASE_A, 0, -6), armDownLow),
    idleA: merge(shift(BASE_A, -1, 0), shift(armDownLow, -1, 0)),
    idleB: merge(shift(BASE_B, 1, 0), shift(armDownLow, 1, 0)),
  },
  scanner: {
    // mag sweeps near -> far AND occasionally zooms big
    start: merge(BASE_A, armSweepNear, propMagSmall),
    idleA: merge(BASE_A, armSweepNear, propMagSmall),
    idleB: merge(BASE_A, armSweepFar, propMagBig),
  },
  settings: {
    // wrench rotates: up-right then down-right (with prop flipping)
    start: merge(BASE_A, armForward, propWrenchA),
    idleA: merge(BASE_A, armWrenchA, propWrenchA),
    idleB: merge(BASE_A, armWrenchB, propWrenchB),
  },
  login: {
    start: merge(BASE_A, armUpHigh),
    idleA: merge(BASE_A, armUpHigh),
    idleB: merge(BASE_B, armDownLow),
  },
  "login-go": {
    start: merge(shift(BASE_A, 0, -6), armUpHigh),
    idleA: merge(BASE_B, armForward),
    idleB: merge(BASE_B, armForward),
  },
};

const cellsToShadow = (cells: Cells, px: number, color: string): string =>
  cells.map(([x, y]) => `${x * px}px ${y * px}px 0 0 ${color}`).join(", ");

export const PixelCharacter = ({ section, width = 32 }: Props) => {
  const [phase, setPhase] = useState<"start" | "idle">("start");
  const [renderedSection, setRenderedSection] = useState<PixelSection>(section);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (section === renderedSection) return;
    setTransitioning(true);
    const t = window.setTimeout(() => {
      setRenderedSection(section);
      setPhase("start");
      setTransitioning(false);
    }, 150);
    return () => window.clearTimeout(t);
  }, [section, renderedSection]);

  useEffect(() => {
    setPhase("start");
    const t = window.setTimeout(() => setPhase("idle"), 1100);
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
