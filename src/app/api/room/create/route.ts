export const runtime = "edge";

function makeCode(): string {
  // 6-char human-friendly room code: no 0/O/1/I confusion.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function POST(): Promise<Response> {
  const code = makeCode();
  return Response.json({ code, path: `/play/${code}` });
}
