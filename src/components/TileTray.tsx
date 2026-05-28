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
  const tone =
    player === 1
      ? { border: "border-sky-300", label: "text-sky-800", bg: "bg-sky-50" }
      : { border: "border-rose-300", label: "text-rose-800", bg: "bg-rose-50" };

  return (
    <div
      className={[
        "flex items-center gap-3 px-3 py-2 rounded-lg border",
        tone.border,
        tone.bg,
        active ? "ring-2 ring-amber-400 shadow-sm" : "",
      ].join(" ")}
    >
      <span className={["text-xs font-bold", tone.label].join(" ")}>
        P{player}
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
      {active && (
        <span className="ml-auto text-[10px] font-medium text-amber-700 uppercase tracking-wider">
          手番
        </span>
      )}
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
  const empty = count === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "relative h-10 w-10 rounded-md border-2 flex items-center justify-center transition",
        color === "black"
          ? "bg-slate-900 border-slate-700"
          : "bg-slate-400 border-slate-500",
        empty ? "opacity-25" : disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer hover:scale-105",
        selected ? "ring-4 ring-amber-400" : "",
      ].join(" ")}
      aria-label={`${color === "black" ? "黒" : "灰"}タイル 残り${count}`}
    >
      <span
        className={[
          "absolute -top-1.5 -right-1.5 h-5 min-w-[1.25rem] px-1 rounded-full text-[11px] font-bold flex items-center justify-center",
          count > 0
            ? "bg-white text-slate-900 border border-slate-400 shadow-sm"
            : "bg-slate-200 text-slate-500 border border-slate-300",
        ].join(" ")}
      >
        {count}
      </span>
    </button>
  );
}
