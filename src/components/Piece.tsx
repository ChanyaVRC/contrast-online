import type { CellTile, Player } from "@game/types";
import { PieceArt } from "./pieceArt";

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
  flip,
}: {
  owner: Player;
  tile: CellTile;
  selected?: boolean;
  movable?: boolean;
  /** If true, the piece body is rotated 180° so its arched top points
   *  toward the opposite side of the screen (used when rendering the
   *  opponent's pieces — their goal row is on the viewer's side). */
  flip?: boolean;
}) {
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
        <PieceArt owner={owner} flip={flip} selected={selected} />
      </svg>
    </div>
  );
}
