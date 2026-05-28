import { getCloudflareContext } from "@opennextjs/cloudflare";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Params): Promise<Response> {
  const upgrade = req.headers.get("Upgrade");
  if (upgrade !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 426 });
  }
  const { id } = await ctx.params;
  if (!/^[a-z0-9-]{4,32}$/i.test(id)) {
    return new Response("invalid room id", { status: 400 });
  }
  const { env } = getCloudflareContext();
  const stub = env.ROOM_DO.get(env.ROOM_DO.idFromName(id));
  return stub.fetch(req);
}
