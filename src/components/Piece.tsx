import type { CellTile, Player } from "@game/types";
import { directionsForTile } from "@game/types";

/**
 * Rendered transparent piece. Arrows are visible according to the underlying cell:
 *   - White cell  → black arrows in the 4 cardinal directions
 *   - Black tile  → white arrows in the 4 diagonal directions
 *   - Gray tile   → both sets visible
 */
export function Piece({
  owner,
  tile,
  selected,
  movable,
}: {
  owner: Player;
  tile: CellTile;
  selected?: boolean;
  movable?: boolean;
}) {
  const ring =
    owner === 1
      ? "ring-sky-500/80"
      : "ring-rose-500/80";
  const rim =
    owner === 1
      ? "border-sky-300/90"
      : "border-rose-300/90";

  const dirs = directionsForTile(tile);
  // Arrow color: on black tile show white arrows; otherwise black; on gray show mixed (both sets).
  const arrowColor = tile === "black" ? "#f3f4f6" : "#0f172a";

  return (
    <div
      className={[
        "relative aspect-square w-[78%] rounded-full border-2",
        "bg-white/30 backdrop-blur-[1px]",
        "shadow-[0_2px_6px_rgba(0,0,0,0.15),inset_0_-2px_4px_rgba(255,255,255,0.4)]",
        rim,
        selected ? `ring-4 ${ring}` : "",
        movable ? "cursor-pointer hover:scale-105 transition-transform" : "",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full pointer-events-none"
        aria-hidden
      >
        {dirs.map(([dr, dc], i) => (
          <Arrow key={i} dr={dr} dc={dc} color={arrowColor} />
        ))}
        {tile === "gray" && (
          // On gray, also overlay the white-arrow set so the user can see both visible sets at once.
          <>
            {dirs.map(([dr, dc], i) => (
              <Arrow key={`w-${i}`} dr={dr} dc={dc} color="#f8fafc" subtle />
            ))}
          </>
        )}
      </svg>
      {/* Owner dot in the middle so even a glance reveals ownership */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div
          className={[
            "h-3 w-3 rounded-full",
            owner === 1 ? "bg-sky-600" : "bg-rose-600",
          ].join(" ")}
        />
      </div>
    </div>
  );
}

function Arrow({
  dr,
  dc,
  color,
  subtle,
}: {
  dr: number;
  dc: number;
  color: string;
  subtle?: boolean;
}) {
  // Place arrow head 40% from center along the direction.
  const cx = 50;
  const cy = 50;
  const len = 30;
  const tx = cx + dc * len;
  const ty = cy + dr * len;
  return (
    <g
      style={{
        opacity: subtle ? 0.45 : 0.85,
      }}
    >
      <line
        x1={cx}
        y1={cy}
        x2={tx}
        y2={ty}
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <polygon
        points={trianglePoints(tx, ty, dr, dc)}
        fill={color}
      />
    </g>
  );
}

function trianglePoints(tx: number, ty: number, dr: number, dc: number) {
  // Build a small triangle perpendicular to (dr, dc).
  const size = 9;
  const px = -dr; // perpendicular x
  const py = dc;
  const ax = tx + dc * size;
  const ay = ty + dr * size;
  const bx = tx + px * size * 0.7;
  const by = ty + py * size * 0.7;
  const cx2 = tx - px * size * 0.7;
  const cy2 = ty - py * size * 0.7;
  return `${ax},${ay} ${bx},${by} ${cx2},${cy2}`;
}
