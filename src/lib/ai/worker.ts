/// <reference lib="WebWorker" />
import {
  chooseMove,
  createTT,
  stateKey,
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
}

export interface AiResponse {
  type: "result";
  reqId: number;
  action: ReturnType<typeof chooseMove>["action"];
  /** Search depth reached, or -1 when answered from the opening book. */
  depth: number;
  score: number;
  nodes: number;
  ttSize: number;
  fromBook: boolean;
}

// Persistent state across requests:
//   - transposition table (per game)
//   - opening book (fetched once, immutable)
let tt: TranspositionTable = createTT();
let lastGameId: string | null = null;

type OpeningBook = Record<string, MoveAction>;
let openingBook: OpeningBook = {};
let bookReady = false;

async function loadBook() {
  try {
    const res = await fetch("/opening-book.json", { cache: "force-cache" });
    if (res.ok) {
      openingBook = (await res.json()) as OpeningBook;
    }
  } catch {
    /* missing book is non-fatal */
  } finally {
    bookReady = true;
  }
}
loadBook();

self.onmessage = (e: MessageEvent<AiRequest>) => {
  const req = e.data;
  if (req.type !== "search") return;

  if (req.state.gameId !== lastGameId) {
    tt = createTT();
    lastGameId = req.state.gameId;
  }

  // Book lookup (free / instant): if the position is known, return its
  // stored move. The book is keyed by the same stateKey used in the TT,
  // so deduplication is automatic.
  if (bookReady) {
    const key = stateKey(req.state);
    const bookMove = openingBook[key];
    if (bookMove) {
      const res: AiResponse = {
        type: "result",
        reqId: req.reqId,
        action: bookMove,
        depth: -1,
        score: 0,
        nodes: 0,
        ttSize: tt.size,
        fromBook: true,
      };
      (self as unknown as Worker).postMessage(res);
      return;
    }
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
    fromBook: false,
  };
  (self as unknown as Worker).postMessage(res);
};
