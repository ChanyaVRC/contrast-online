// Tiny smoke test: open a WS to a room as two players, play one move, exit.
import WebSocket from "ws";

const ROOM = process.argv[2] ?? "smoke1";
const URL = `ws://127.0.0.1:8787/api/room/${ROOM}`;

function open(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL);
    ws.on("open", () => {
      ws.send(JSON.stringify({ t: "hello", token }));
    });
    const inbox = [];
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      inbox.push(msg);
      if (msg.t === "welcome") resolve({ ws, slot: msg.you, state: msg.state, inbox });
    });
    ws.on("error", reject);
    setTimeout(() => reject(new Error("welcome timeout")), 4000);
  });
}

const p1 = await open("tok-p1");
console.log("P1 connected as", p1.slot, "ply=", p1.state.ply, "turn=", p1.state.turn);
const p2 = await open("tok-p2");
console.log("P2 connected as", p2.slot);

// P1 makes a move: piece id 2 (at row 0 col 2) → forward to (1,2).
p1.ws.send(
  JSON.stringify({
    t: "move",
    gameId: p1.state.gameId,
    action: { kind: "move", pieceId: 2, to: [1, 2], tilePlace: null },
    clientSeq: 1,
  }),
);

await new Promise((r) => setTimeout(r, 500));

const lastP2 = p2.inbox[p2.inbox.length - 1];
console.log("P2 latest msg:", lastP2?.t, "turn=", lastP2?.state?.turn, "ply=", lastP2?.state?.ply);

if (lastP2?.t === "state" && lastP2.state.turn === 2 && lastP2.state.ply === 1) {
  console.log("OK: state broadcast worked");
  process.exit(0);
} else {
  console.error("FAIL: expected state with turn=2 ply=1");
  process.exit(1);
}
