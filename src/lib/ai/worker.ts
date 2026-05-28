/// <reference lib="WebWorker" />
import { chooseMove, createTT, type TranspositionTable } from "./search";
import type { GameState, Player } from "@game/types";

export interface AiRequest {
  type: "search";
  state: GameState;
  me: Player;
  timeBudgetMs?: number;
  maxDepth?: number;
  reqId: number;
}

export interface AiResponse {
  type: "result";
  reqId: number;
  action: ReturnType<typeof chooseMove>["action"];
  depth: number;
  score: number;
  nodes: number;
  ttSize: number;
}

// Transposition table persists across `search` requests so successive
// turns within the same game reuse computed evaluations. Cleared when
// the gameId changes (= new game starts).
let tt: TranspositionTable = createTT();
let lastGameId: string | null = null;

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const req = e.data;
  if (req.type !== "search") return;

  if (req.state.gameId !== lastGameId) {
    tt = createTT();
    lastGameId = req.state.gameId;
  }

  const result = chooseMove(req.state, req.me, {
    timeBudgetMs: req.timeBudgetMs,
    maxDepth: req.maxDepth,
    tt,
  });

  const res: AiResponse = {
    type: "result",
    reqId: req.reqId,
    action: result.action,
    depth: result.depth,
    score: result.score,
    nodes: result.nodes,
    ttSize: result.ttSize,
  };
  (self as unknown as Worker).postMessage(res);
};
