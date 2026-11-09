import { expect, test } from "@playwright/test";

const MISSING = [
  "/decks/no-such-deck",
  // Shaped like an admin deck id, so it is looked up in the database.
  "/decks/00000000-0000-4000-8000-000000000000",
  "/d/nosuchdeck",
  "/d/nosuchdeck/edit/nosuchkey",
];

test("a built-in deck answers 200", async ({ page }) => {
  const res = await page.goto("/decks/game");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "ゲーム" })).toBeVisible();
});

// Link previews and other HTML-only crawlers get a full dynamic render, so the
// lookup before any Suspense boundary decides the status code.
test("missing decks answer 404 when rendered dynamically", async ({ request }) => {
  for (const path of MISSING) {
    const res = await request.get(path, { headers: { "user-agent": "Twitterbot/1.0" } });
    expect(res.status(), path).toBe(404);
    expect(await res.text(), path).toContain("<title>見つかりません | めくトーク</title>");
  }
  const found = await request.get("/decks/game", { headers: { "user-agent": "Twitterbot/1.0" } });
  expect(found.status()).toBe(200);
});

// Browsers are served the prerendered shell first, which commits a 200 under
// `next start`; they still get the not-found screen and a noindex tag.
test("missing decks show the not-found screen in a browser", async ({ page }) => {
  for (const path of MISSING) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "このカードは山札にありません" }), path).toBeVisible();
    await expect(page.locator('meta[name="robots"]').first(), path).toHaveAttribute("content", /noindex/);
  }
});
