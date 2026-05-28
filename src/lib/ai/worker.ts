/// <reference lib="WebWorker" />
import { chooseMove } from "./search";
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
}

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const req = e.data;
  if (req.type !== "search") return;
  const result = chooseMove(req.state, req.me, {
    timeBudgetMs: req.timeBudgetMs,
    maxDepth: req.maxDepth,
  });
  const res: AiResponse = {
    type: "result",
    reqId: req.reqId,
    action: result.action,
    depth: result.depth,
    score: result.score,
    nodes: result.nodes,
  };
  (self as unknown as Worker).postMessage(res);
};
