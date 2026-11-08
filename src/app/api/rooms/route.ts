import { getDb } from "@/lib/db";
import { handle, json, readJson } from "@/lib/api";
import { createRoom } from "@/lib/rooms/service";
import type { CreateRoomInput } from "@/lib/rooms/schemas";

export const POST = handle(async (req: Request) => {
  const body = (await readJson(req)) as CreateRoomInput;
  const session = await createRoom(await getDb(), body);
  return json(session, { status: 201 });
});
