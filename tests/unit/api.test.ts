import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, handle, json, readJson } from "@/lib/api";
import { deckInputSchema } from "@/lib/decks/service";
import { LIMITS } from "@/lib/limits";

const ENDPOINT = "http://localhost/api/decks";
const JSON_TYPE = { "content-type": "application/json" };

function streamOf(text: string, chunkSize = 4096): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + chunkSize));
      offset += chunkSize;
    },
  });
}

/** A body sent without Content-Length, as with chunked transfer encoding. */
const streamed = (text: string) =>
  new Request(ENDPOINT, { method: "POST", headers: JSON_TYPE, body: streamOf(text), duplex: "half" } as RequestInit);

/** A JSON object of exactly `bytes` bytes. */
const bodyOf = (bytes: number) => JSON.stringify({ pad: "x".repeat(bytes - 10) });

describe("readJson", () => {
  it("reads a JSON object", async () => {
    const req = new Request(ENDPOINT, { method: "POST", headers: JSON_TYPE, body: JSON.stringify({ title: "推し活" }) });
    expect(await readJson(req)).toEqual({ title: "推し活" });
    expect(await readJson(streamed(bodyOf(MAX_BODY_BYTES)))).toHaveProperty("pad");
  });

  it("rejects other content types and non-objects", async () => {
    const form = new Request(ENDPOINT, { method: "POST", body: "a=1", headers: { "content-type": "text/plain" } });
    await expect(readJson(form)).rejects.toMatchObject({ code: "bad_request" });
    await expect(readJson(streamed("[1,2]"))).rejects.toMatchObject({ code: "bad_request" });
    await expect(readJson(streamed("{"))).rejects.toMatchObject({ code: "bad_request" });
  });

  it("refuses bodies over 64KB by Content-Length or by what actually arrives", async () => {
    const declared = new Request(ENDPOINT, {
      method: "POST",
      headers: { ...JSON_TYPE, "content-length": String(MAX_BODY_BYTES + 1) },
      body: streamOf("{}"),
      duplex: "half",
    } as RequestInit);
    await expect(readJson(declared)).rejects.toMatchObject({ code: "payload_too_large", status: 413 });
    await expect(readJson(streamed(bodyOf(MAX_BODY_BYTES + 1)))).rejects.toMatchObject({
      code: "payload_too_large",
    });
    // Multi-byte text counts in bytes, not characters.
    const japanese = JSON.stringify({ t: "あ".repeat(Math.ceil(MAX_BODY_BYTES / 3)) });
    await expect(readJson(streamed(japanese))).rejects.toMatchObject({ code: "payload_too_large" });
  });

  it("answers 413 through handle()", async () => {
    const route = handle(async (req: Request) => json(await readJson(req)));
    const res = await route(streamed(bodyOf(MAX_BODY_BYTES * 2)));
    expect(res.status).toBe(413);
    expect(res.headers.get("Retry-After")).toBeNull();
    expect(await res.json()).toMatchObject({ error: { code: "payload_too_large" } });
  });
});

describe("deck input", () => {
  const input = { title: "推し活", theme: "rose" };

  it("rejects an over-long card array before reading its entries", () => {
    // Entries that are not strings would each be an issue if they were read.
    const result = deckInputSchema.safeParse({ ...input, cards: Array(LIMITS.deckCardsMax * 2 + 1).fill(0) });
    expect(result.success).toBe(false);
    expect(result.error?.issues).toHaveLength(1);
    expect(result.error?.issues[0].message).toBe(`カードは${LIMITS.deckCardsMax}枚までです`);
  });

  it("still ignores blank lines in a full deck", () => {
    const cards = [...Array(LIMITS.deckCardsMax).fill("話題"), "", "  "];
    expect(deckInputSchema.parse({ ...input, cards }).cards).toHaveLength(LIMITS.deckCardsMax);
  });
});
