import { expect, test } from "@playwright/test";

test("host collects topics by QR, draws them, and everyone sees the reveal", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "ルームを作る" }).click();
  await expect(page.getByRole("heading", { name: "ルームを作る" })).toBeVisible();
  await page.getByText("終了後に名前を公開する").click();
  await page.getByLabel("あなたのニックネーム").fill("ニコ");
  await page.getByRole("button", { name: "ルームを作ってQRを出す" }).click();

  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}\/host$/);
  const code = page.url().match(/room\/([A-Z0-9]{6})/)![1];
  await expect(page.getByRole("img", { name: /参加用QRコード/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "締め切ってガチャを始める" })).toBeDisabled();

  // A participant joins on another phone.
  const guestCtx = await browser.newContext({ ...test.info().project.use });
  const guest = await guestCtx.newPage();
  await guest.goto(`/room/${code}`);
  await guest.getByLabel("ニックネーム").fill("ケン");
  await guest.getByRole("button", { name: "参加する" }).click();
  await expect(guest.getByRole("heading", { name: "話題を投稿しよう" })).toBeVisible();

  const input = guest.getByLabel("みんなに聞いてみたいことは？");
  for (const t of ["最近ハマっているゲームは？", "推しのエディタ", "地元の自慢"]) {
    await input.fill(t);
    await guest.getByRole("button", { name: "投稿", exact: true }).click();
    await expect(guest.getByText(t)).toBeVisible();
  }
  await guest.getByRole("button", { name: "「地元の自慢」を取り消す" }).click();
  await expect(guest.getByText("地元の自慢")).toHaveCount(0);

  // The host sees the count (but not the texts) and adds one of their own.
  const count = page.getByText("件の話題が集まりました").locator("..");
  await expect(count).toContainText("2");
  await expect(page.getByText("推しのエディタ")).toHaveCount(0);
  await page.getByRole("button", { name: "自分も話題を出す" }).click();
  await page.getByLabel("あなたも話題を出す").fill("子どもの頃の夢");
  await page.getByRole("button", { name: "投稿", exact: true }).click();
  await expect(count).toContainText("3");

  await page.getByRole("button", { name: "締め切ってガチャを始める" }).click();
  await page.getByRole("button", { name: "始める", exact: true }).click();

  await expect(guest.getByRole("heading", { name: "ホストのスマホに注目！" })).toBeVisible({ timeout: 10_000 });

  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /^(次の)?カードを引く$/ }).click();
    await expect(page.getByText(`No.${i + 1}`).first()).toBeVisible();
  }
  await expect(page.getByText("これが最後の1枚です")).toBeVisible();

  // Every phone gets the full list, with names because the host chose to show them.
  await expect(guest.getByRole("heading", { name: "ガチャ終了！" })).toBeVisible({ timeout: 10_000 });
  await expect(guest.getByText("推しのエディタ")).toBeVisible();
  await expect(guest.getByText("子どもの頃の夢")).toBeVisible();
  await expect(guest.getByText("ニコ")).toBeVisible();
  await expect(guest.getByText("あなたの投稿")).toHaveCount(2);

  await page.getByRole("button", { name: "結果を見る" }).click();
  await expect(page.getByRole("heading", { name: "ガチャ終了！" })).toBeVisible();
  await guestCtx.close();

  // Someone who opens the QR link only after the end still gets the list.
  const lateCtx = await browser.newContext({ ...test.info().project.use });
  const late = await lateCtx.newPage();
  await late.goto(`/room/${code}`);
  await expect(late.getByRole("heading", { name: "ガチャ終了！" })).toBeVisible();
  await expect(late.getByText("推しのエディタ")).toBeVisible();
  await expect(late.getByRole("link", { name: "自分もルームを作る" })).toBeVisible();
  await lateCtx.close();
});

test("the host can recover the room on another phone with the host link", async ({ page, browser }) => {
  await page.goto("/room/new");
  await page.getByRole("button", { name: "ルームを作ってQRを出す" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}\/host$/);
  await page.getByText("このスマホが使えなくなったら").click();
  const hostLink = await page.getByLabel("ホスト用リンク").inputValue();
  expect(hostLink).toMatch(/\/host#k=/);

  const otherCtx = await browser.newContext({ ...test.info().project.use });
  const other = await otherCtx.newPage();
  await other.goto(hostLink);
  await expect(other.getByRole("button", { name: "締め切ってガチャを始める" })).toBeVisible();
  await expect(other).not.toHaveURL(/#k=/);
  await otherCtx.close();
});

test("a host link with a participant's token does not grant host rights", async ({ page, browser }) => {
  await page.goto("/room/new");
  await page.getByRole("button", { name: "ルームを作ってQRを出す" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}\/host$/);
  const code = page.url().match(/room\/([A-Z0-9]{6})/)![1];
  const res = await page.request.post(`/api/rooms/${code}/participants`, { data: { nickname: "ゲスト" } });
  const { token } = await res.json();

  const otherCtx = await browser.newContext({ ...test.info().project.use });
  const other = await otherCtx.newPage();
  await other.goto(`/room/${code}/host#k=${token}`);
  await expect(other.getByRole("heading", { name: "ホスト用リンクを使えませんでした" })).toBeVisible();
  await expect(other.getByRole("button", { name: "締め切ってガチャを始める" })).toHaveCount(0);
  await otherCtx.close();
});
