import type { CellTile, Player } from "@game/types";
import { CARDINAL, DIAGONAL } from "@game/types";

/**
 * Transparent square piece, modeled on the physical product:
 *   - Black cardinal arrows (visible against white & gray backgrounds)
 *   - White diagonal arrows (visible against black & gray backgrounds)
 * Both sets are always printed; the underlying tile color naturally
 * hides the ones that match it, which is exactly how the rules render
 * the legal directions to the player.
 */
export function Piece({
  owner,
  tile: _tile,
  selected,
  movable,
}: {
  owner: Player;
  tile: CellTile;
  selected?: boolean;
  movable?: boolean;
}) {
  const ownerStroke = owner === 1 ? "#0284c7" : "#e11d48";
  const ownerFill =
    owner === 1 ? "rgba(2,132,199,0.10)" : "rgba(225,29,72,0.10)";

  return (
    <div
      className={[
        "relative aspect-square w-[86%]",
        movable ? "cursor-pointer hover:scale-[1.04] transition-transform" : "",
        selected ? "scale-105 drop-shadow-[0_0_6px_rgba(245,158,11,0.85)]" : "",
      ].join(" ")}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full pointer-events-none"
        aria-hidden
      >
        {/* Rounded-square piece body, semi-transparent */}
        <rect
          x="6"
          y="6"
          width="88"
          height="88"
          rx="14"
          fill={ownerFill}
          stroke={ownerStroke}
          strokeWidth={selected ? 4 : 2.5}
          strokeOpacity={0.9}
        />

        {/* Black cardinal arrows — visible on white & gray backgrounds */}
        {CARDINAL.map(([dr, dc], i) => (
          <Arrow key={`c${i}`} dr={dr} dc={dc} color="#0f172a" />
        ))}

        {/* White diagonal arrows — visible on black & gray backgrounds */}
        {DIAGONAL.map(([dr, dc], i) => (
          <Arrow key={`d${i}`} dr={dr} dc={dc} color="#f8fafc" />
        ))}

        {/* Owner indicator dot in center */}
        <circle cx="50" cy="50" r="5.5" fill={ownerStroke} opacity="0.9" />
      </svg>
    </div>
  );
}

function Arrow({ dr, dc, color }: { dr: number; dc: number; color: string }) {
  const cx = 50;
  const cy = 50;
  const len = 30;
  // Normalize direction so diagonals don't extend farther than cardinals.
  const norm = Math.hypot(dr, dc) || 1;
  const ux = dc / norm;
  const uy = dr / norm;
  const tx = cx + ux * len;
  const ty = cy + uy * len;
  // Perpendicular for triangle base.
  const px = -uy;
  const py = ux;
  const headSize = 8;
  const ax = tx + ux * headSize;
  const ay = ty + uy * headSize;
  const bx = tx + px * headSize * 0.7;
  const by = ty + py * headSize * 0.7;
  const cx2 = tx - px * headSize * 0.7;
  const cy2 = ty - py * headSize * 0.7;
  return (
    <g style={{ opacity: 0.95 }}>
      <line
        x1={cx + ux * 10}
        y1={cy + uy * 10}
        x2={tx}
        y2={ty}
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <polygon points={`${ax},${ay} ${bx},${by} ${cx2},${cy2}`} fill={color} />
    </g>
  );
}
