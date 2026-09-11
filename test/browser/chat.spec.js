import { test, expect } from "@playwright/test";

const open = (page) => page.goto("/mini-algochat/");
const send = async (page, message) => {
  await page.getByRole("textbox", { name: "Message", exact: true }).fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
};

test("browser → Express → SDK → local simulated provider, history persists", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page);
  await expect(page.getByRole("status")).toHaveText("Provider configured · not verified");
  await send(page, "Hello from the browser");
  await expect(page.getByText("Received 1 conversation messages.")).toBeVisible();
  await expect(page.locator("pre code")).toHaveText('console.log("hello");');
  await expect(page.getByRole("status")).toHaveText("AI reply verified this session");
  await page.getByRole("button", { name: "Copy reply", exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('console.log("hello");');
  await send(page, "Follow-up question");
  await expect(page.getByText("Received 3 conversation messages.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Received 3 conversation messages.")).toBeVisible();
  await page.getByRole("button", { name: "New Chat", exact: true }).click();
  await page.getByRole("textbox", { name: "Search" }).fill("Hello from");
  await expect(page.locator(".chat-title")).toHaveCount(1);
  await page.locator(".chat-title").click();
  await expect(page.getByText("Received 3 conversation messages.")).toBeVisible();
  await page.getByRole("button", { name: "Delete Hello from the browser", exact: true }).click();
  await expect(page.getByText("Received 3 conversation messages.")).toHaveCount(0);
});

test("retry does not duplicate messages or send errors as conversation history", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/chat", async (route) => {
    calls++;
    expect(route.request().postDataJSON().messages).toEqual([{ sender: "user", text: "Retry me" }]);
    if (calls === 1) await route.fulfill({ status: 503, json: { error: "Test: provider temporarily unavailable" } });
    else await route.continue();
  });
  await open(page);
  await send(page, "Retry me");
  await expect(page.getByRole("alert")).toContainText("temporarily unavailable");
  await page.getByRole("button", { name: "Retry last message" }).click();
  await expect(page.getByText("Received 1 conversation messages.")).toBeVisible();
  await expect(page.locator(".message-row.user")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("corrupt storage is preserved and the app remains usable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mini-algochats", "{broken"));
  await open(page);
  await expect(page.getByRole("alert")).toContainText("left untouched");
  await send(page, "Still usable");
  await expect(page.getByText("Received 1 conversation messages.")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mini-algochats"))).toBe("{broken");
});

test("existing numeric-ID history is preserved and can receive a follow-up", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("mini-algochats", JSON.stringify([
    { id: 123, title: "Existing chat", messages: [
      { sender: "bot", text: "Old welcome" },
      { sender: "user", text: "Original question" },
      { sender: "bot", text: "Original reply" },
    ] },
  ])));
  await open(page);
  await expect(page.getByRole("heading", { name: "Existing chat" })).toBeVisible();
  await expect(page.getByText("Original reply", { exact: true })).toBeVisible();
  await send(page, "Continue");
  await expect(page.getByText("Received 3 conversation messages.")).toBeVisible();
});

test("storage write failure is visible without crashing chat", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Storage full", "QuotaExceededError"); };
  });
  await open(page);
  await expect(page.getByRole("alert")).toContainText("could not save");
  await send(page, "Still works in memory");
  await expect(page.getByText("Received 1 conversation messages.")).toBeVisible();
});

test("HTML backend errors are readable and model HTML is not executed", async ({ page }) => {
  await open(page);
  await page.route("**/api/chat", (route) => route.fulfill({ status: 502, contentType: "text/html", body: "<h1>Bad gateway</h1>" }));
  await send(page, "Check errors");
  await expect(page.getByRole("alert")).toContainText("Backend not reachable");
  await page.unroute("**/api/chat");
  await page.route("**/api/chat", (route) => route.fulfill({ json: {
    mode: "openai", reply: '<script>window.unsafe = true</script>\n\n[Unsafe](javascript:alert(1))\n\n![image](https://third-party.invalid/track.png)',
  } }));
  await page.getByRole("button", { name: "Retry last message" }).click();
  await expect(page.getByText("[Image: image]", { exact: true })).toBeVisible();
  await expect(page.locator(".markdown-content script, .markdown-content img")).toHaveCount(0);
  expect(await page.evaluate(() => window.unsafe)).toBeUndefined();
  await expect(page.getByRole("link", { name: "Unsafe" })).not.toHaveAttribute("href", /javascript:/);
});

test("switching chats during a pending reply keeps the reply in its original chat", async ({ page }) => {
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  await page.route("**/api/chat", async (route) => { await wait; await route.continue(); });
  await open(page);
  await send(page, "Original chat");
  await page.getByRole("button", { name: "New Chat", exact: true }).click();
  await expect(page.getByText("Mini AlgoChat is thinking")).toHaveCount(0);
  release();
  await expect(page.getByRole("status")).toHaveText("AI reply verified this session");
  await expect(page.getByText("Received 1 conversation messages.")).toHaveCount(0);
  await page.locator(".chat-title").filter({ hasText: "Original chat" }).click();
  await expect(page.getByText("Received 1 conversation messages.")).toBeVisible();
});

for (const width of [320, 390, 768, 1280]) {
  test(`layout at ${width}px keeps composer accessible without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    await send(page, "A".repeat(200));
    await expect(page.getByText("Received 1 conversation messages.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const composer = await page.getByRole("textbox", { name: "Message", exact: true }).boundingBox();
    expect(composer.y + composer.height).toBeLessThanOrEqual(844);
    if (width <= 820) {
      await page.getByRole("button", { name: /Conversations \(/ }).click();
      await expect(page.getByRole("button", { name: "New Chat", exact: true })).toBeVisible();
      await page.getByRole("button", { name: "New Chat", exact: true }).click();
      await expect(page.getByRole("button", { name: /Conversations \(/ })).toHaveAttribute("aria-expanded", "false");
    }
    await page.screenshot({ path: test.info().outputPath(`layout-${width}.png`) });
  });
}
