import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { clientIp, limitBy } from "@/lib/rateLimit";
import { createRoom } from "@/lib/rooms/service";
import type { CreateRoomInput } from "@/lib/rooms/schemas";

export const POST = handle(async (req: Request) => {
  const db = await getDb();
  await limitBy(db, "roomCreate", clientIp(req));
  const body = (await readJson(req)) as CreateRoomInput;
  const session = await createRoom(db, body);
  return json(session, { status: 201 });
});
