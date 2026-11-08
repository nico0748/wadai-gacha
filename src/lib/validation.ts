import type { z } from "zod";
import { AppError } from "./errors";

/** Parses with zod and turns the first issue into a readable AppError. */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AppError("bad_request", issue?.message ?? "入力内容を確認してください");
  }
  return result.data;
}
