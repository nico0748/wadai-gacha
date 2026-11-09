import { expect, test } from "@playwright/test";

test("draws from a built-in deck until it runs out, then reshuffles", async ({ page }) => {
  await page.goto("/decks");
  await page.getByRole("link", { name: /エンジニア/ }).first().click();
  await expect(page.getByRole("heading", { name: "エンジニア" })).toBeVisible();
  await expect(page.getByText("残り30枚", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "カードをめくる", exact: true }).click();
  await expect(page.getByText("No.1").first()).toBeVisible();
  await expect(page.getByText("残り29枚", { exact: true })).toBeVisible();
});

test("creates a private deck, plays it by share link, and edits it", async ({ page }) => {
  await page.goto("/decks/new");
  await page.getByLabel("デッキ名").fill("同期会");
  await page.getByLabel("カード（1行に1枚）").fill("入社初日の思い出\n最近の休日");
  await page.getByRole("button", { name: "デッキを作る" }).click();
  await expect(page.getByRole("heading", { name: "デッキができました" })).toBeVisible();
  const shareUrl = await page.getByLabel("共有用URL（遊ぶ人に送る）").inputValue();

  await page.goto(shareUrl);
  await expect(page.getByRole("heading", { name: "同期会" })).toBeVisible();
  await page.getByRole("button", { name: "カードをめくる", exact: true }).click();
  await page.getByRole("button", { name: "次のカードをめくる", exact: true }).click();
  await expect(page.getByText("全2枚、引き終わりました")).toBeVisible();

  // Listed under 自分のデッキ on this device only.
  await page.goto("/decks");
  await expect(page.getByRole("heading", { name: "自分のデッキ" })).toBeVisible();
  await page.getByRole("link", { name: "編集する" }).click();
  await page.getByLabel("デッキ名").fill("同期会2026");
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page.getByText("保存しました")).toBeVisible();
});

test("admin adds an official deck that appears in the deck list", async ({ page }) => {
  await page.goto("/admin");
  await page.getByLabel("管理用パスワード").fill("e2e-admin-pass");
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.getByRole("link", { name: "デッキを追加" }).click();
  const title = `公式テスト${Date.now() % 10000}`;
  await page.getByLabel("デッキ名").fill(title);
  await page.getByLabel("カード（1行に1枚）").fill("公式の話題1\n公式の話題2\n公式の話題3");
  await page.getByRole("button", { name: "デッキを追加" }).click();
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();

  await page.goto("/decks");
  await page.getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByText("残り3枚", { exact: true })).toBeVisible();
});
