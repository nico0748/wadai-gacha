import { expect, test, type Page } from "@playwright/test";

// CardStage names the button either way while its wording changes.
const DRAW_BUTTON = /^(次の)?カードを(めくる|引く)$/;
// Held lists are polled every 1.5s, then the countdown runs for 5s.
const REVEAL_TIMEOUT = 15_000;

async function createRoom(page: Page, opts: { named?: boolean } = {}) {
  await page.goto("/room/new");
  if (opts.named) {
    await page.getByText("終了後に名前を公開する").click();
    await page.getByLabel("あなたのニックネーム").fill("ニコ");
  }
  await page.getByRole("button", { name: "ルームを作ってQRを出す" }).click();
  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}\/host$/);
  return page.url().match(/room\/([A-Z0-9]{6})/)![1];
}

async function joinAs(page: Page, code: string, nickname: string) {
  await page.goto(`/room/${code}`);
  await page.getByLabel("ニックネーム").fill(nickname);
  await page.getByRole("button", { name: "参加する" }).click();
  await expect(page.getByRole("heading", { name: "話題を投稿しよう" })).toBeVisible();
}

async function post(page: Page, label: string, texts: string[]) {
  for (const t of texts) {
    await page.getByLabel(label).fill(t);
    await page.getByRole("button", { name: "投稿", exact: true }).click();
    await expect(page.getByText(t)).toBeVisible();
  }
}

test("host collects topics by QR, draws them, and everyone opens the list together", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "ルームを作る" }).click();
  await expect(page.getByRole("heading", { name: "ルームを作る" })).toBeVisible();
  await page.getByRole("button", { name: "ルームを作ってQRを出す" }).click();

  await expect(page).toHaveURL(/\/room\/[A-Z0-9]{6}\/host$/);
  const code = page.url().match(/room\/([A-Z0-9]{6})/)![1];
  await expect(page.getByRole("img", { name: /参加用QRコード/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "締め切ってめくり始める" })).toBeDisabled();

  // A participant joins on another phone.
  const guestCtx = await browser.newContext({ ...test.info().project.use });
  const guest = await guestCtx.newPage();
  await joinAs(guest, code, "ケン");
  await post(guest, "みんなに聞いてみたいことは？", ["最近ハマっているゲームは？", "推しのエディタ", "地元の自慢"]);
  await guest.getByRole("button", { name: "「地元の自慢」を取り消す" }).click();
  await expect(guest.getByText("地元の自慢")).toHaveCount(0);

  // The host sees the count in the bottom bar (but not the texts) and adds one of their own.
  const count = page.getByText("件の話題", { exact: true }).locator("..");
  await expect(count).toContainText("2");
  await expect(page.getByText("推しのエディタ")).toHaveCount(0);
  await page.getByRole("button", { name: "自分も話題を出す" }).click();
  await post(page, "あなたも話題を出す", ["子どもの頃の夢"]);
  await expect(count).toContainText("3");

  await page.getByRole("button", { name: "締め切ってめくり始める" }).click();
  await page.getByRole("button", { name: "始める", exact: true }).click();

  await expect(guest.getByRole("heading", { name: "ホストのスマホに注目！" })).toBeVisible({ timeout: 10_000 });

  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: DRAW_BUTTON }).click();
    await expect(page.getByText(`No.${i + 1}`).first()).toBeVisible();
  }
  await expect(page.getByText("これが最後の1枚です")).toBeVisible();

  // The list is held for the host's signal, also after a reload of the host page.
  await expect(guest.getByRole("heading", { name: "ホストの合図で公開します" })).toBeVisible({ timeout: 10_000 });
  await expect(guest.getByText("推しのエディタ")).toHaveCount(1); // only in their own list
  await expect(guest.getByText("引かれた！")).toHaveCount(2);
  await expect(guest.getByText("子どもの頃の夢")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("これが最後の1枚です")).toBeVisible();

  // せーの: both phones count down, then open the list at the same moment.
  await page.getByRole("button", { name: "せーので公開" }).click();
  await expect(guest.getByText("みんなで一緒に公開します")).toBeVisible({ timeout: REVEAL_TIMEOUT });
  await expect(guest.getByRole("heading", { name: "ぜんぶオープン！" })).toBeVisible({ timeout: REVEAL_TIMEOUT });
  await expect(guest.getByText("子どもの頃の夢")).toBeVisible();
  await expect(guest.getByText("あなたの投稿")).toHaveCount(2);
  await expect(guest.getByRole("button", { name: "一覧を送る" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "ぜんぶオープン！" })).toBeVisible({ timeout: REVEAL_TIMEOUT });
  await expect(page.getByRole("button", { name: "この話題でデッキを作る" })).toBeVisible();
  await guestCtx.close();

  // Someone who opens the QR link only after the end still gets the list.
  const lateCtx = await browser.newContext({ ...test.info().project.use });
  const late = await lateCtx.newPage();
  await late.goto(`/room/${code}`);
  await expect(late.getByRole("heading", { name: "ぜんぶオープン！" })).toBeVisible();
  await expect(late.getByText("推しのエディタ")).toBeVisible();
  await expect(late.getByRole("link", { name: "自分もルームを作る" })).toBeVisible();
  await lateCtx.close();
});

test("named room: the host ends early with せーの, then runs 答え合わせ", async ({ page, browser }) => {
  const code = await createRoom(page, { named: true });

  const guestCtx = await browser.newContext({ ...test.info().project.use });
  const guest = await guestCtx.newPage();
  await joinAs(guest, code, "ケン");
  await post(guest, "みんなに聞いてみたいことは？", ["休日の過ごし方", "最近の失敗談"]);
  await page.getByRole("button", { name: "自分も話題を出す" }).click();
  await post(page, "あなたも話題を出す", ["好きな駅弁"]);
  await expect(page.getByText("件の話題", { exact: true }).locator("..")).toContainText("3");

  await page.getByRole("button", { name: "締め切ってめくり始める" }).click();
  await page.getByRole("button", { name: "始める", exact: true }).click();
  await page.getByRole("button", { name: DRAW_BUTTON }).click();
  await expect(page.getByText("No.1").first()).toBeVisible();

  // Ending is one tap from the bottom bar, and starts the countdown right away.
  await page.getByRole("button", { name: "ここで終わりにする" }).click();
  await page.getByRole("button", { name: "終了してせーので公開" }).click();
  await expect(guest.getByRole("heading", { name: "ぜんぶオープン！" })).toBeVisible({ timeout: REVEAL_TIMEOUT });
  await expect(guest.getByText("好きな駅弁")).toBeVisible();
  // Authors wait for the 答え合わせ.
  await expect(guest.getByText("ニコ")).toHaveCount(0);
  await expect(guest.getByText("？")).toHaveCount(3);

  // Guess mode on the host's phone: one topic at a time.
  await expect(page.getByRole("heading", { name: "ぜんぶオープン！" })).toBeVisible({ timeout: REVEAL_TIMEOUT });
  await page.getByRole("button", { name: "誰が書いたか当てる" }).click();
  await expect(page.getByText("（1 / 3）")).toBeVisible();
  await expect(page.getByText("？", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "答え", exact: true }).click();
  await expect(page.getByText(/^(ケン|ニコ)$/)).toBeVisible();
  await expect(guest.getByText("？")).toHaveCount(2, { timeout: 10_000 });
  await page.getByRole("button", { name: "次へ" }).click();
  await expect(page.getByText("（2 / 3）")).toBeVisible();

  // A reload picks up at the next hidden author.
  await page.reload();
  await expect(page.getByText("（2 / 3）")).toBeVisible();
  await page.getByRole("button", { name: "残りを全部見せる" }).click();
  await expect(page.getByRole("heading", { name: "めくった話題" })).toBeVisible();
  await expect(guest.getByText("ニコ")).toBeVisible({ timeout: 10_000 });
  await expect(guest.getByText("？")).toHaveCount(0);

  // The host can keep the topics as a deck, without names; nothing is saved yet.
  await page.getByRole("button", { name: "この話題でデッキを作る" }).click();
  await expect(page).toHaveURL(/\/decks\/new$/);
  await expect(page.getByLabel("デッキ名")).toHaveValue(/^\d{1,2}\/\d{1,2}のみんなの話題$/);
  const cards = page.getByRole("textbox", { name: /カード/ });
  await expect(cards).toHaveValue(/休日の過ごし方/);
  await expect(cards).not.toHaveValue(/ケン|ニコ/);
  await guestCtx.close();
});

test("the host can recover the room on another phone with the host link", async ({ page, browser }) => {
  await createRoom(page);
  await page.getByText("このスマホが使えなくなったら").click();
  const hostLink = await page.getByLabel("ホスト用リンク").inputValue();
  expect(hostLink).toMatch(/\/host#k=/);

  const otherCtx = await browser.newContext({ ...test.info().project.use });
  const other = await otherCtx.newPage();
  await other.goto(hostLink);
  await expect(other.getByRole("button", { name: "締め切ってめくり始める" })).toBeVisible();
  await expect(other).not.toHaveURL(/#k=/);
  await otherCtx.close();
});

test("a host link with a participant's token does not grant host rights", async ({ page, browser }) => {
  const code = await createRoom(page);
  const res = await page.request.post(`/api/rooms/${code}/participants`, { data: { nickname: "ゲスト" } });
  const { token } = await res.json();

  const otherCtx = await browser.newContext({ ...test.info().project.use });
  const other = await otherCtx.newPage();
  await other.goto(`/room/${code}/host#k=${token}`);
  await expect(other.getByRole("heading", { name: "ホスト用リンクを使えませんでした" })).toBeVisible();
  await expect(other.getByRole("button", { name: "締め切ってめくり始める" })).toHaveCount(0);
  await otherCtx.close();
});

test("an unknown room offers the room code field", async ({ page }) => {
  await page.goto("/room/ZZZZZZ");
  await expect(page.getByRole("heading", { name: "ルームが見つかりません" })).toBeVisible();
  await expect(page.getByLabel("QRが読めないときは、ルームコードで参加")).toBeVisible();
});
