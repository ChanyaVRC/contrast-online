/// <reference types="@cloudflare/workers-types" />
import { DurableObject } from "cloudflare:workers";
import { initialState } from "@game/initial";
import { applyAction, validateAction } from "@game/rules";
import type { GameState } from "@game/types";
import {
  ClientMsg,
  PlayerSlot,
  ServerMsg,
  decode,
  encode,
} from "@/lib/net/protocol";

interface PlayerSession {
  token: string;
  slot: PlayerSlot;
  /** When the player left; cleared on reconnect. */
  leftAt?: number;
}

const RECONNECT_GRACE_MS = 30_000;

interface PersistedRoom {
  state: GameState;
  /** Map of token → assigned slot, so we can restore on reconnect. */
  assignments: Record<string, "P1" | "P2">;
}

export class RoomDO extends DurableObject {
  private state: GameState;
  private assignments: Map<string, "P1" | "P2">;
  private leftAt: Map<string, number>;
  private ready: Promise<void>;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env as Record<string, unknown>);
    this.state = initialState();
    this.assignments = new Map();
    this.leftAt = new Map();
    this.ready = this.load();
  }

  private async load(): Promise<void> {
    const stored = await this.ctx.storage.get<PersistedRoom>("room");
    if (stored) {
      this.state = stored.state;
      this.assignments = new Map(Object.entries(stored.assignments));
    }
  }

  private async persist(): Promise<void> {
    const data: PersistedRoom = {
      state: this.state,
      assignments: Object.fromEntries(this.assignments),
    };
    await this.ctx.storage.put("room", data);
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready;
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket upgrade", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ---- Hibernatable WebSocket handlers ----

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.ready;
    let msg: ClientMsg;
    try {
      msg = decode<ClientMsg>(raw);
    } catch {
      this.send(ws, {
        t: "reject",
        clientSeq: -1,
        reason: "bad-json",
      });
      return;
    }

    switch (msg.t) {
      case "hello":
        await this.handleHello(ws, msg);
        return;
      case "move":
        await this.handleMove(ws, msg);
        return;
      case "rematch":
        await this.handleRematch(ws, msg);
        return;
      case "ping":
        this.send(ws, { t: "pong" });
        return;
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const session = this.sessionOf(ws);
    if (!session) return;
    this.leftAt.set(session.token, Date.now());
    this.broadcast({ t: "peer", event: "left", slot: session.slot }, ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    return this.webSocketClose(ws);
  }

  // ---- Logic ----

  private async handleHello(ws: WebSocket, msg: Extract<ClientMsg, { t: "hello" }>) {
    let slot = this.assignments.get(msg.token);
    if (!slot) {
      const taken = new Set(this.assignments.values());
      // Reclaim a slot vacated > RECONNECT_GRACE_MS ago.
      this.reclaimStaleSlots(taken);
      if (!taken.has("P1")) {
        slot = "P1";
        this.assignments.set(msg.token, slot);
      } else if (!taken.has("P2")) {
        slot = "P2";
        this.assignments.set(msg.token, slot);
      }
    }
    const playerSlot: PlayerSlot = slot ?? "spectator";
    const session: PlayerSession = { token: msg.token, slot: playerSlot };
    this.setSession(ws, session);
    this.leftAt.delete(msg.token);

    this.send(ws, { t: "welcome", you: playerSlot, state: this.state });
    this.broadcast(
      { t: "peer", event: "joined", slot: playerSlot },
      ws,
    );
    await this.persist();
  }

  private reclaimStaleSlots(taken: Set<string>) {
    const now = Date.now();
    for (const [token, slot] of [...this.assignments]) {
      const left = this.leftAt.get(token);
      if (left && now - left > RECONNECT_GRACE_MS) {
        this.assignments.delete(token);
        this.leftAt.delete(token);
        taken.delete(slot);
      }
    }
  }

  private async handleMove(ws: WebSocket, msg: Extract<ClientMsg, { t: "move" }>) {
    const session = this.sessionOf(ws);
    if (!session || session.slot === "spectator") {
      this.send(ws, { t: "reject", clientSeq: msg.clientSeq, reason: "not-a-player" });
      return;
    }
    if (msg.gameId !== this.state.gameId) {
      this.send(ws, { t: "reject", clientSeq: msg.clientSeq, reason: "stale-game" });
      return;
    }
    const expectedTurnSlot = this.state.turn === 1 ? "P1" : "P2";
    if (session.slot !== expectedTurnSlot) {
      this.send(ws, { t: "reject", clientSeq: msg.clientSeq, reason: "not-your-turn" });
      return;
    }
    const validation = validateAction(this.state, msg.action);
    if (!validation.ok) {
      this.send(ws, { t: "reject", clientSeq: msg.clientSeq, reason: validation.reason });
      return;
    }
    this.state = applyAction(this.state, msg.action);
    await this.persist();
    this.broadcastAll({ t: "state", state: this.state, lastClientSeq: msg.clientSeq });
    if (this.state.winner !== null) {
      this.broadcastAll({ t: "end", winner: this.state.winner, reason: "win" });
    }
  }

  private async handleRematch(ws: WebSocket, msg: Extract<ClientMsg, { t: "rematch" }>) {
    if (msg.gameId !== this.state.gameId) return;
    const next = initialState(crypto.randomUUID());
    // Swap who goes first between rematches so both sides start as P1.
    const startingPlayer = this.state.turn === 1 ? 2 : 1;
    next.turn = startingPlayer;
    this.state = next;
    await this.persist();
    this.broadcastAll({ t: "state", state: this.state });
  }

  // ---- Session storage on WebSocket ----

  private setSession(ws: WebSocket, session: PlayerSession) {
    ws.serializeAttachment(session);
  }
  private sessionOf(ws: WebSocket): PlayerSession | undefined {
    return ws.deserializeAttachment() as PlayerSession | undefined;
  }

  // ---- Send helpers ----

  private send(ws: WebSocket, msg: ServerMsg) {
    try {
      ws.send(encode(msg));
    } catch {
      // socket already closed
    }
  }
  private broadcast(msg: ServerMsg, except?: WebSocket) {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      this.send(ws, msg);
    }
  }
  private broadcastAll(msg: ServerMsg) {
    this.broadcast(msg);
  }
}
