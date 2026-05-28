// Smoke test:
//   1. P1 alone: move is rejected with reason "waiting-for-opponent"
//   2. P2 joins, presence updates everyone
//   3. P1 moves, P2 receives broadcast with turn=2 ply=1
import WebSocket from "ws";

const ROOM = process.argv[2] ?? `smoke-${Date.now()}`;
const URL = `ws://127.0.0.1:8787/api/room/${ROOM}`;

function open(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    const inbox = [];
    let resolved = false;
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", token }));
    });
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      inbox.push(msg);
      if (!resolved && msg.t === "welcome") {
        resolved = true;
        resolve({ ws, slot: msg.you, state: msg.state, presence: msg.presence, inbox });
      }
    });
    ws.on("error", reject);
    setTimeout(() => {
      if (!resolved) reject(new Error("welcome timeout"));
    }, 4000);
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fail(msg) {
  console.error("FAIL:", msg);
  process.exit(1);
}

const p1 = await open("tok-p1");
console.log("P1 connected as", p1.slot, "presence=", p1.presence);
if (p1.presence.p1 !== true || p1.presence.p2 !== false) {
  fail(`P1 welcome should report {p1:true, p2:false}, got ${JSON.stringify(p1.presence)}`);
}

// 1. P1 tries to move while alone — should be rejected.
p1.inbox.length = 0;
p1.ws.send(
  JSON.stringify({
    t: "move",
    gameId: p1.state.gameId,
    action: { kind: "move", pieceId: 2, to: [1, 2], tilePlace: null },
    clientSeq: 1,
  }),
);
await wait(300);
const reject = p1.inbox.find((m) => m.t === "reject");
if (!reject || reject.reason !== "waiting-for-opponent") {
  fail(`expected reject waiting-for-opponent, got ${JSON.stringify(p1.inbox)}`);
}
console.log("OK: move blocked while alone");

// 2. P2 joins
const p2 = await open("tok-p2");
console.log("P2 connected as", p2.slot, "presence=", p2.presence);
if (!p2.presence.p1 || !p2.presence.p2) {
  fail(`P2 welcome should report both present, got ${JSON.stringify(p2.presence)}`);
}

// P1 should have received a presence broadcast saying both true now.
await wait(150);
const presenceMsgs = p1.inbox.filter((m) => m.t === "presence");
const lastPresence = presenceMsgs[presenceMsgs.length - 1];
if (!lastPresence || !lastPresence.presence.p1 || !lastPresence.presence.p2) {
  fail(`P1 did not receive presence update, got ${JSON.stringify(presenceMsgs)}`);
}
console.log("OK: presence broadcast worked");

// 3. P1 moves now that both are present
p2.inbox.length = 0;
p1.ws.send(
  JSON.stringify({
    t: "move",
    gameId: p1.state.gameId,
    action: { kind: "move", pieceId: 2, to: [1, 2], tilePlace: null },
    clientSeq: 2,
  }),
);
await wait(300);
const state2 = p2.inbox.find((m) => m.t === "state");
if (!state2 || state2.state.turn !== 2 || state2.state.ply !== 1) {
  fail(`expected state turn=2 ply=1, got ${JSON.stringify(p2.inbox)}`);
}
console.log("OK: move broadcast turn=2 ply=1");

// 4. P2 disconnects → P1 should get presence p2:false
p1.inbox.length = 0;
p2.ws.close();
await wait(300);
const after = p1.inbox.filter((m) => m.t === "presence").pop();
if (!after || after.presence.p2 !== false) {
  fail(`P1 did not learn that P2 left, got ${JSON.stringify(p1.inbox)}`);
}
console.log("OK: P1 learned P2 disconnected");

p1.ws.close();
console.log("\nALL OK");
process.exit(0);
