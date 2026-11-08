import { z } from "zod";
import { LIMITS } from "../limits";

const trimmed = (max: number, label: string) =>
  z
    .string({ error: `${label}を入力してください` })
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(
      z
        .string()
        .min(1, `${label}を入力してください`)
        .max(max, `${label}は${max}文字以内で入力してください`),
    );

export const nicknameSchema = trimmed(LIMITS.nicknameMax, "ニックネーム");
export const topicTextSchema = trimmed(LIMITS.topicMax, "トピック");

export const createRoomSchema = z
  .object({
    endMode: z.enum(["all", "count"]).default("all"),
    drawLimit: z
      .number()
      .int("回数は整数で指定してください")
      .min(1, "回数は1回以上にしてください")
      .max(LIMITS.drawLimitMax, `回数は${LIMITS.drawLimitMax}回以下にしてください`)
      .nullish(),
    nameMode: z.enum(["anonymous", "named", "none"]).default("anonymous"),
    hostNickname: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.endMode === "count" && v.drawLimit == null) {
      ctx.addIssue({ code: "custom", path: ["drawLimit"], message: "引く回数を指定してください" });
    }
  });

export type CreateRoomInput = z.input<typeof createRoomSchema>;

export const joinRoomSchema = z.object({ nickname: z.string().optional() });
export const addTopicSchema = z.object({ text: topicTextSchema });
