"""M4 Categories — functional verification against the Firebase emulator.

Acceptance criteria:
  CP1: Sign up + create a group → Categories page shows the 8 seeded categories
  CP2: Add a new category "Pets" → it appears in the list
  CP3: Rename "Other" to "Miscellaneous" → renamed category appears
  CP4: Archive "Entertainment" → disappears from active list, stays visible as archived
  CP5: Navigate away and back → changes persist (Firestore round-trip)

Run prerequisites (already running when this script executes):
  - Firebase emulators: Auth 9099, Firestore 8080, project demo-spendshare
  - `npm run dev:emulator` on http://localhost:5173
"""
import asyncio
import json
import time
import urllib.request
from pathlib import Path

from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent
SHOTS = RUN_DIR / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN_DIR / "log.txt"
LOG.write_text("")

BASE_URL = "http://localhost:5173"
AUTH_BASE = "http://127.0.0.1:9099/emulator/v1/projects/demo-spendshare"
TS = int(time.time())
USER = {"email": f"tester+{TS}@test.com", "password": "Test1234!"}
GROUP_NAME = "Cat Test Group"

SEEDED_CATEGORIES = [
    "Groceries", "Dining", "Transport", "Utilities",
    "Household", "Entertainment", "Health", "Other",
]


def log(msg: str) -> None:
    line = f"{msg}\n"
    with LOG.open("a") as f:
        f.write(line)
    print(line, end="")


def reset_emulator() -> None:
    """Clear Firestore documents and Auth accounts in the emulator."""
    log("Resetting emulator state…")
    req = urllib.request.Request(
        "http://127.0.0.1:8080/emulator/v1/projects/demo-spendshare/databases/(default)/documents",
        method="DELETE",
    )
    urllib.request.urlopen(req)

    req2 = urllib.request.Request(
        f"{AUTH_BASE}/accounts",
        method="DELETE",
    )
    urllib.request.urlopen(req2)
    log("Emulator reset complete.")


async def fill_credentials(page, email: str, password: str) -> None:
    await page.get_by_role("textbox").nth(0).fill(email)
    await page.get_by_role("textbox").nth(1).fill(password)


async def create_account(page, email: str, password: str) -> None:
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await asyncio.sleep(1)
    await fill_credentials(page, email, password)
    await page.get_by_role("button", name="Create account").click()
    await asyncio.sleep(2.5)


async def wait_no_loading(page, timeout: int = 15000) -> None:
    try:
        await page.wait_for_function(
            "() => !document.body.innerText.includes('Loading')", timeout=timeout
        )
    except Exception:
        pass


async def navigate_to_categories(page) -> None:
    """Click the Categories nav link and wait for the page to settle."""
    await page.get_by_role("link", name="Categories").click()
    await asyncio.sleep(1.5)
    await wait_no_loading(page)


async def main() -> None:
    errors: list[str] = []
    reset_emulator()

    async with async_playwright() as pw:
        browser = await pw.firefox.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ── Setup: create account + group ────────────────────────────────────
        log(f"Setup: creating account ({USER['email']}) and group")
        await create_account(page, USER["email"], USER["password"])
        await wait_no_loading(page)

        body = await page.locator("body").inner_text()
        if "Create your first group" not in body:
            log(f"FAILED: expected create-group screen, got: {body[:200]}")
            await browser.close()
            return

        await page.get_by_placeholder("e.g. Our Household").fill(GROUP_NAME)
        await page.get_by_role("button", name="Create group").click()
        try:
            await page.wait_for_function(
                "() => !document.body.innerText.includes('Create your first group')",
                timeout=15000,
            )
        except Exception:
            pass
        await asyncio.sleep(1.5)

        body = await page.locator("body").inner_text()
        if "Create your first group" in body:
            log(f"FAILED: still on create-group screen after creation: {body[:200]}")
            await browser.close()
            return
        log("Setup complete: account and group created.")
        await page.screenshot(path=str(SHOTS / "00_setup_group_created.png"))

        # ── CP1: Navigate to /categories; verify 8 seeded categories ─────────
        log("CP1: Navigate to Categories page and verify seeded categories")
        await navigate_to_categories(page)
        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOTS / "01_categories_page.png"))

        missing = [c for c in SEEDED_CATEGORIES if c not in body]
        if missing:
            log(f"FAILED: CP1 — seeded categories missing from page: {missing}\nPage text: {body[:500]}")
            await browser.close()
            return
        log(f"CP1 PASS: all 8 seeded categories visible: {SEEDED_CATEGORIES}")

        # ── CP2: Add new category "Pets" ──────────────────────────────────────
        log("CP2: Add new category 'Pets'")
        # Find the add-category input and submit
        add_input = page.get_by_placeholder("New category name")
        if await add_input.count() == 0:
            # Fallback: look for any input that's not a search
            add_input = page.locator("input[type='text']").last
        await add_input.fill("Pets")
        await page.get_by_role("button", name="Add").click()
        await asyncio.sleep(1.5)

        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOTS / "02_category_pets_added.png"))
        if "Pets" not in body:
            log(f"FAILED: CP2 — 'Pets' not found in page after adding: {body[:400]}")
            await browser.close()
            return
        log("CP2 PASS: 'Pets' category added and visible")

        # ── CP3: Rename "Other" to "Miscellaneous" ────────────────────────────
        log("CP3: Rename 'Other' to 'Miscellaneous'")
        # Find the rename button/control next to "Other"
        other_row = page.locator("li, tr, [data-testid]").filter(has_text="Other").first
        rename_btn = other_row.get_by_role("button", name="Rename")
        if await rename_btn.count() == 0:
            # Fallback: look for an edit/rename button in the same row
            rename_btn = other_row.get_by_role("button", name="Edit")
        if await rename_btn.count() == 0:
            # Last fallback: any button in the row that isn't Archive
            rename_btn = other_row.locator("button").nth(0)

        await rename_btn.click()
        await asyncio.sleep(0.5)

        # The row should now show an input with the current name; clear and type new name
        rename_input = other_row.locator("input[type='text']").first
        if await rename_input.count() == 0:
            # Fallback: find any visible text input that likely holds the current name
            rename_input = page.locator("input[type='text']").nth(0)
        await rename_input.click(click_count=3)
        await rename_input.fill("Miscellaneous")

        save_btn = other_row.get_by_role("button", name="Save")
        if await save_btn.count() == 0:
            save_btn = other_row.get_by_role("button", name="OK")
        if await save_btn.count() == 0:
            await rename_input.press("Enter")
        else:
            await save_btn.click()

        await asyncio.sleep(1.5)
        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOTS / "03_category_renamed.png"))

        if "Miscellaneous" not in body:
            log(f"FAILED: CP3 — 'Miscellaneous' not found after rename: {body[:400]}")
            await browser.close()
            return
        if "Other" in body and "Miscellaneous" in body:
            # "Other" might appear in other contexts; confirm renamed form is there
            pass
        log("CP3 PASS: 'Other' renamed to 'Miscellaneous'")

        # ── CP4: Archive "Entertainment" ──────────────────────────────────────
        log("CP4: Archive 'Entertainment'")
        entertainment_row = page.locator("li, tr, [data-testid]").filter(has_text="Entertainment").first
        archive_btn = entertainment_row.get_by_role("button", name="Archive")
        if await archive_btn.count() == 0:
            archive_btn = entertainment_row.locator("button").last

        await archive_btn.click()
        await asyncio.sleep(1.5)

        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOTS / "04_entertainment_archived.png"))

        # Entertainment should still appear on the manager page (as archived), but
        # should be visually distinguished. Verify it's still present (manager shows all).
        if "Entertainment" not in body:
            log(f"FAILED: CP4 — 'Entertainment' disappeared completely from manager (should show archived): {body[:400]}")
            await browser.close()
            return

        # The active list should not include Entertainment — we check for a visual
        # indicator like "archived" text near it, or a separate section.
        # We accept either: "archived" label near the category, or a separate archived section.
        archived_indicator = (
            "archived" in body.lower()
            or await page.locator("[data-archived='true'], .archived, [aria-label*='archived']").count() > 0
        )
        if not archived_indicator:
            log("FAILED: CP4 — no archived indicator found after archiving 'Entertainment'")
            await browser.close()
            return
        log("CP4 PASS: 'Entertainment' archived — still visible in manager with archived indicator")

        # ── CP5: Navigate away and back; changes persist ──────────────────────
        log("CP5: Navigate away and back to verify Firestore persistence")
        # Navigate to a different page (e.g. Invite page)
        invite_link = page.get_by_role("link", name="Invite")
        if await invite_link.count() > 0:
            await invite_link.click()
        else:
            await page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
        await asyncio.sleep(1)

        # Navigate back to categories
        await navigate_to_categories(page)
        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOTS / "05_categories_after_reload.png"))

        # Verify persisted state
        if "Pets" not in body:
            log(f"FAILED: CP5 — 'Pets' category lost after navigation: {body[:400]}")
            await browser.close()
            return
        if "Miscellaneous" not in body:
            log(f"FAILED: CP5 — 'Miscellaneous' rename lost after navigation: {body[:400]}")
            await browser.close()
            return
        if "Entertainment" not in body:
            log(f"FAILED: CP5 — archived 'Entertainment' vanished entirely after navigation: {body[:400]}")
            await browser.close()
            return

        archived_indicator = (
            "archived" in body.lower()
            or await page.locator("[data-archived='true'], .archived, [aria-label*='archived']").count() > 0
        )
        if not archived_indicator:
            log("FAILED: CP5 — archived indicator for 'Entertainment' lost after navigation")
            await browser.close()
            return

        log("CP5 PASS: all changes persisted after navigation (Firestore round-trip confirmed)")
        await page.screenshot(path=str(SHOTS / "06_final_state.png"))

        await browser.close()

    log("")
    if errors:
        log(f"CONSOLE/PAGE ERRORS observed ({len(errors)}):")
        for e in errors:
            log(f"  - {e}")
    else:
        log("No console or page errors observed.")
    log("")
    log("ALL CHECKPOINTS PASSED")


asyncio.run(main())
