import type { CellTile } from "@game/types";

export function Cell({
  tile,
  isDestination,
  isTileTarget,
  onClick,
  children,
}: {
  tile: CellTile;
  isDestination?: boolean;
  isTileTarget?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  const bg =
    tile === "black"
      ? "bg-slate-900"
      : tile === "gray"
        ? "bg-slate-400"
        : "bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative aspect-square border border-slate-300 flex items-center justify-center dark:border-slate-700",
        bg,
        isDestination ? "ring-4 ring-emerald-400/80 ring-inset" : "",
        isTileTarget ? "ring-4 ring-amber-400/80 ring-inset" : "",
        onClick ? "cursor-pointer" : "cursor-default",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
