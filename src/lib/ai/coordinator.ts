"use client";

import { generateActions } from "./search";
import {
  canonicalize,
  compactMoveToAction,
  transformCompactMove,
  type CompactMove,
} from "./symmetry";
import type { GameState, MoveAction, Player } from "@game/types";
import type { AiRequest, AiResponse } from "./worker";

export interface CoordinatorSearchOptions {
  timeBudgetMs?: number;
  maxDepth?: number;
}

export interface CoordinatorSearchResult {
  action: MoveAction | null;
  /** Max search depth reached across workers; -1 for an opening-book hit. */
  depth: number;
  /** Sum of nodes visited across all dispatched workers. */
  nodes: number;
  workerCount: number;
  fromBook: boolean;
}

type OpeningBook = Record<string, CompactMove>;

interface Pending {
  resolve: (response: AiResponse) => void;
}

/**
 * Spawns N Web Workers, splits the root moves across them on each
 * search() call, and reports back the best answer.
 *
 * Book lookup runs on the main thread (via the symmetry helpers) so a
 * book hit short-circuits without dispatching anything to the workers.
 *
 * Each worker keeps its own persistent transposition table, cleared
 * when the gameId changes.
 */
export class AiCoordinator {
  private workers: Worker[] = [];
  private pendingByReq = new Map<number, Pending>();
  private expectedReplies = new Map<number, number>();
  private collectedByReq = new Map<number, AiResponse[]>();
  private seq = 0;

  private book: OpeningBook = {};
  private bookReady = false;
  private bookPromise: Promise<void> | null = null;

  constructor(numWorkers?: number) {
    const cores =
      typeof navigator !== "undefined"
        ? (navigator.hardwareConcurrency ?? 2)
        : 2;
    const n = Math.max(1, Math.min(4, numWorkers ?? Math.max(1, cores - 1)));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      w.onmessage = (e: MessageEvent<AiResponse>) => this.onMessage(e.data);
      this.workers.push(w);
    }
    this.loadBook();
  }

  get workerCount(): number {
    return this.workers.length;
  }

  private loadBook(): Promise<void> {
    if (this.bookPromise) return this.bookPromise;
    this.bookPromise = (async () => {
      try {
        const res = await fetch("/opening-book.json", { cache: "force-cache" });
        if (res.ok) this.book = (await res.json()) as OpeningBook;
      } catch {
        /* non-fatal */
      } finally {
        this.bookReady = true;
      }
    })();
    return this.bookPromise;
  }

  destroy() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.pendingByReq.clear();
    this.expectedReplies.clear();
    this.collectedByReq.clear();
  }

  private onMessage(msg: AiResponse) {
    const bucket = this.collectedByReq.get(msg.reqId) ?? [];
    bucket.push(msg);
    this.collectedByReq.set(msg.reqId, bucket);
    const expected = this.expectedReplies.get(msg.reqId) ?? 0;
    if (bucket.length >= expected) {
      const pending = this.pendingByReq.get(msg.reqId);
      this.pendingByReq.delete(msg.reqId);
      this.expectedReplies.delete(msg.reqId);
      this.collectedByReq.delete(msg.reqId);
      pending?.resolve(this.pickBest(bucket));
    }
  }

  private pickBest(responses: AiResponse[]): AiResponse {
    const valid = responses.filter((r) => r.action !== null);
    if (valid.length === 0) return responses[0];
    return valid.reduce((a, b) => {
      if (b.score > a.score) return b;
      if (b.score === a.score && b.depth > a.depth) return b;
      return a;
    });
  }

  private lookupBook(state: GameState): MoveAction | null {
    if (!this.bookReady) return null;
    const { key, transform } = canonicalize(state);
    const entry = this.book[key];
    if (!entry) return null;
    const inOurs = transformCompactMove(entry, transform);
    return compactMoveToAction(state, inOurs);
  }

  async search(
    state: GameState,
    me: Player,
    opts: CoordinatorSearchOptions = {},
  ): Promise<CoordinatorSearchResult> {
    if (this.workers.length === 0) {
      return {
        action: null,
        depth: 0,
        nodes: 0,
        workerCount: 0,
        fromBook: false,
      };
    }

    // Make sure the book finished loading before the first search call.
    if (!this.bookReady) await this.loadBook();

    const bookMove = this.lookupBook(state);
    if (bookMove) {
      return {
        action: bookMove,
        depth: -1,
        nodes: 0,
        workerCount: 0,
        fromBook: true,
      };
    }

    // Single-worker path: avoid root enumeration on the main thread.
    if (this.workers.length === 1) {
      const reqId = ++this.seq;
      const promise = new Promise<AiResponse>((resolve) => {
        this.pendingByReq.set(reqId, { resolve });
        this.expectedReplies.set(reqId, 1);
      });
      const req: AiRequest = {
        type: "search",
        state,
        me,
        timeBudgetMs: opts.timeBudgetMs,
        maxDepth: opts.maxDepth,
        reqId,
      };
      this.workers[0].postMessage(req);
      const res = await promise;
      return {
        action: res.action,
        depth: res.depth,
        nodes: res.nodes,
        workerCount: 1,
        fromBook: false,
      };
    }

    // Multi-worker path: split root actions, dispatch in parallel.
    const rootActions = generateActions(state, me);
    if (rootActions.length === 0) {
      return {
        action: null,
        depth: 0,
        nodes: 0,
        workerCount: 0,
        fromBook: false,
      };
    }

    const chunks: MoveAction[][] = Array.from(
      { length: this.workers.length },
      () => [],
    );
    for (let i = 0; i < rootActions.length; i++) {
      chunks[i % this.workers.length].push(rootActions[i]);
    }
    const live = chunks.filter((c) => c.length > 0);

    const reqId = ++this.seq;
    const promise = new Promise<AiResponse>((resolve) => {
      this.pendingByReq.set(reqId, { resolve });
      this.expectedReplies.set(reqId, live.length);
    });

    for (let i = 0; i < live.length; i++) {
      const req: AiRequest = {
        type: "search",
        state,
        me,
        timeBudgetMs: opts.timeBudgetMs,
        maxDepth: opts.maxDepth,
        reqId,
        rootActions: live[i],
      };
      this.workers[i].postMessage(req);
    }

    const best = await promise;
    const totalNodes = (this.collectedByReq.get(reqId) ?? []).reduce(
      (s, r) => s + r.nodes,
      0,
    );
    return {
      action: best.action,
      depth: best.depth,
      nodes: totalNodes,
      workerCount: live.length,
      fromBook: false,
    };
  }
}
