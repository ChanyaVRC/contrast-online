/// <reference lib="WebWorker" />
import {
  chooseMove,
  createTT,
  type TranspositionTable,
} from "./search";
import type { GameState, MoveAction, Player } from "@game/types";

export interface AiRequest {
  type: "search";
  state: GameState;
  me: Player;
  timeBudgetMs?: number;
  maxDepth?: number;
  reqId: number;
  /** Optional subset of root actions to search. If omitted, the worker
   *  enumerates the full set itself. Used by the parallel coordinator. */
  rootActions?: MoveAction[];
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

// Transposition table persists across requests within the same game.
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
    rootActions: req.rootActions,
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
