import type { GameState, MoveAction, Player } from "@game/types";

export type PlayerSlot = "P1" | "P2" | "spectator";

export type ClientMsg =
  | { t: "hello"; token: string; lastSeenPly?: number }
  | { t: "move"; gameId: string; action: MoveAction; clientSeq: number }
  | { t: "rematch"; gameId: string }
  | { t: "ping" };

export type ServerMsg =
  | { t: "welcome"; you: PlayerSlot; state: GameState }
  | { t: "state"; state: GameState; lastClientSeq?: number }
  | { t: "reject"; clientSeq: number; reason: string }
  | { t: "peer"; event: "joined" | "left" | "reconnected"; slot: PlayerSlot }
  | { t: "end"; winner: Player | null; reason: "win" | "resign" | "abandoned" }
  | { t: "pong" };

export function encode(msg: ServerMsg | ClientMsg): string {
  return JSON.stringify(msg);
}

export function decode<T extends ServerMsg | ClientMsg>(raw: string | ArrayBuffer): T {
  const text = typeof raw === "string" ? raw : new TextDecoder().decode(raw);
  return JSON.parse(text) as T;
}
