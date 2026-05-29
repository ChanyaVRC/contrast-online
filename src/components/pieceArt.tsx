import type { Player } from "@game/types";
import { CARDINAL, DIAGONAL } from "@game/types";

/**
 * Shared inner SVG markup for a Contrast piece, in a 100×100 viewBox
 * centered at (50, 50). Used by the live <Piece /> on the board AND by
 * the mini-pieces inside the rules diagram so they stay visually
 * identical (same arched body, same black-cardinal + white-diagonal
 * arrow pattern, same owner-colored fill + center dot).
 *
 * Wrap this in an <svg> or <g transform="..."> of your choice — it does
 * not own its outer container.
 */
export function PieceArt({
  owner,
  flip,
  selected,
}: {
  owner: Player;
  flip?: boolean;
  selected?: boolean;
}) {
  const ownerStroke = owner === 1 ? "#0284c7" : "#e11d48";
  const ownerFill =
    owner === 1 ? "rgba(2,132,199,0.10)" : "rgba(225,29,72,0.10)";

  return (
    <>
      {/* Arched piece body, optionally rotated 180° so its peak points
          toward this piece's own goal row. */}
      <path
        d="M 8 92 L 8 29 Q 50 -13 92 29 L 92 92 Z"
        fill={ownerFill}
        stroke={ownerStroke}
        strokeWidth={selected ? 4 : 2.5}
        strokeOpacity={0.9}
        strokeLinejoin="round"
        transform={flip ? "rotate(180 50 50)" : undefined}
      />

      {/* Black cardinal arrows — visible on white & gray backgrounds */}
      {CARDINAL.map(([dr, dc], i) => (
        <PieceArrow key={`c${i}`} dr={dr} dc={dc} color="#0f172a" />
      ))}

      {/* White diagonal arrows — visible on black & gray backgrounds */}
      {DIAGONAL.map(([dr, dc], i) => (
        <PieceArrow key={`d${i}`} dr={dr} dc={dc} color="#f8fafc" />
      ))}

      {/* Owner indicator dot in center */}
      <circle cx="50" cy="50" r="5.5" fill={ownerStroke} opacity="0.9" />
    </>
  );
}

function PieceArrow({
  dr,
  dc,
  color,
}: {
  dr: number;
  dc: number;
  color: string;
}) {
  const cx = 50;
  const cy = 50;
  const len = 30;
  const norm = Math.hypot(dr, dc) || 1;
  const ux = dc / norm;
  const uy = dr / norm;
  const tx = cx + ux * len;
  const ty = cy + uy * len;
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
