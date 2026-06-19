import { test, expect } from "@playwright/test";

const ANIMATION_MS = 550;

async function slideTitle(page: import("@playwright/test").Page) {
  return page.locator(".slide.active").getAttribute("data-title");
}

async function activeHeading(page: import("@playwright/test").Page) {
  return page.locator(".slide.active h1").first().textContent();
}

async function slideCount(page: import("@playwright/test").Page) {
  return page.locator(".slide").count();
}

async function waitForSlideTransition(page: import("@playwright/test").Page) {
  await page.waitForTimeout(ANIMATION_MS);
}

test.describe("demo presentation slides", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/demo");
    const total = await slideCount(page);
    await expect(page.locator("#counter")).toHaveText(`1 / ${total}`);
    await expect(page.locator(".slide.active")).toHaveAttribute("data-title", "Welcome");
  });

  test("right arrow and next zone advance slides", async ({ page }) => {
    const total = await slideCount(page);

    await expect(await activeHeading(page)).toBe("Howzzat");

    await page.keyboard.press("ArrowRight");
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`2 / ${total}`);
    await expect(await slideTitle(page)).toBe("Overview");
    await expect(await activeHeading(page)).toBe("What you'll see today");

    await page.locator("#nextZone").click({ position: { x: 10, y: 200 } });
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`3 / ${total}`);
    await expect(await slideTitle(page)).toBe("Auth");
    await expect(await activeHeading(page)).toBe("Sign in — three ways");
  });

  test("slide content changes across the deck", async ({ page }) => {
    const total = await slideCount(page);
    await expect(await activeHeading(page)).toBe("Howzzat");

    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowRight");
      await waitForSlideTransition(page);
    }

    await expect(page.locator("#counter")).toHaveText(`5 / ${total}`);
    await expect(await slideTitle(page)).toBe("Scheduling");
    await expect(await activeHeading(page)).toBe("Schedule a match");
  });

  test("left arrow and prev zone go to prior slide", async ({ page }) => {
    const total = await slideCount(page);

    await page.keyboard.press("ArrowRight");
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`2 / ${total}`);

    await page.keyboard.press("ArrowLeft");
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`1 / ${total}`);
    await expect(await slideTitle(page)).toBe("Welcome");

    await page.keyboard.press("ArrowRight");
    await waitForSlideTransition(page);
    await page.keyboard.press("ArrowRight");
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`3 / ${total}`);

    await page.locator("#prevZone").click({ position: { x: 10, y: 200 } });
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`2 / ${total}`);
    await expect(await slideTitle(page)).toBe("Overview");
  });

  test("cannot go before first or after last slide", async ({ page }) => {
    const total = await slideCount(page);

    await page.keyboard.press("ArrowLeft");
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`1 / ${total}`);
    await expect(await slideTitle(page)).toBe("Welcome");

    await page.locator("#prevZone").click({ position: { x: 10, y: 200 } });
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`1 / ${total}`);

    for (let i = 0; i < total - 1; i++) {
      await page.keyboard.press("ArrowRight");
      await waitForSlideTransition(page);
    }
    await expect(page.locator("#counter")).toHaveText(`${total} / ${total}`);
    await expect(await slideTitle(page)).toBe("Invites");

    await page.keyboard.press("ArrowRight");
    await page.locator("#nextZone").click({ position: { x: 10, y: 200 } });
    await waitForSlideTransition(page);
    await expect(page.locator("#counter")).toHaveText(`${total} / ${total}`);
    await expect(await slideTitle(page)).toBe("Invites");
  });

  test("renders on mobile viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/demo");

    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 1;
    });
    expect(overflow).toBe(false);

    await expect(page.locator(".progress-dots")).toBeVisible();
    await expect(page.locator(".mobile-hint")).toBeVisible();
  });
});
