import type { Player, TileColor, TileInventory } from "@game/types";

export function TileTray({
  player,
  inventory,
  active,
  selected,
  onSelect,
}: {
  player: Player;
  inventory: TileInventory;
  active: boolean;
  selected: TileColor | null;
  onSelect: (color: TileColor | null) => void;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 px-3 py-2 rounded-lg",
        active ? "bg-white/80 ring-1 ring-slate-300" : "bg-white/30",
      ].join(" ")}
    >
      <span className="text-xs font-medium text-slate-600">
        P{player} タイル
      </span>
      <TileButton
        color="black"
        count={inventory.black}
        disabled={!active || inventory.black === 0}
        selected={selected === "black"}
        onClick={() => onSelect(selected === "black" ? null : "black")}
      />
      <TileButton
        color="gray"
        count={inventory.gray}
        disabled={!active || inventory.gray === 0}
        selected={selected === "gray"}
        onClick={() => onSelect(selected === "gray" ? null : "gray")}
      />
    </div>
  );
}

function TileButton({
  color,
  count,
  disabled,
  selected,
  onClick,
}: {
  color: TileColor;
  count: number;
  disabled: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative h-10 w-10 rounded border-2 flex items-center justify-center",
        color === "black" ? "bg-slate-900 border-slate-700" : "bg-slate-400 border-slate-500",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        selected ? "ring-4 ring-amber-400" : "",
      ].join(" ")}
    >
      <span
        className={[
          "absolute -top-1 -right-1 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center",
          "bg-white text-slate-800 border border-slate-300",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
