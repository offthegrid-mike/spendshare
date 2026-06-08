"""M3 Invites — two-account functional verification against the Firebase emulator.

Acceptance (from the plan): A invites B's email; B signs in, sees the pending
invite, accepts, and can then read A's group.

Run prerequisites (already running): emulators (Auth 9099, Firestore 8080) and
`npm run dev:emulator` on http://localhost:5173.
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
AUTH = "http://127.0.0.1:9099/emulator/v1/projects/demo-spendshare"
TS = int(time.time())
USER_A = {"email": f"alice+{TS}@test.com", "password": "Test1234!"}
USER_B = {"email": f"bob+{TS}@test.com", "password": "Test1234!"}
GROUP_NAME = "Trip Fund"


def log(msg: str) -> None:
    line = f"{msg}\n"
    LOG.open("a").write(line)
    print(line, end="")


def verify_email_via_oob(email: str) -> bool:
    """Fetch the latest VERIFY_EMAIL oob code for `email` and apply it."""
    with urllib.request.urlopen(f"{AUTH}/oobCodes") as r:
        codes = json.load(r)["oobCodes"]
    matches = [c for c in codes if c["email"] == email and c["requestType"] == "VERIFY_EMAIL"]
    if not matches:
        return False
    link = matches[-1]["oobLink"]  # most recent
    with urllib.request.urlopen(link) as r:  # GETting the link applies verification
        return r.status == 200


async def fill_credentials(page, email, password):
    await page.get_by_role("textbox").nth(0).fill(email)
    await page.get_by_role("textbox").nth(1).fill(password)


async def create_account(page, email, password):
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await asyncio.sleep(1)
    await fill_credentials(page, email, password)
    await page.get_by_role("button", name="Create account").click()
    await asyncio.sleep(2.5)


async def sign_in(page, email, password):
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await asyncio.sleep(1)
    await fill_credentials(page, email, password)
    await page.get_by_role("button", name="Sign in").click()
    await asyncio.sleep(2.5)


async def sign_out(page):
    btn = page.get_by_role("button", name="Sign out")
    if await btn.count() > 0:
        await btn.click()
        await asyncio.sleep(2)
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await asyncio.sleep(1)


async def wait_no_loading(page, timeout=15000):
    try:
        await page.wait_for_function(
            "() => !document.body.innerText.includes('Loading')", timeout=timeout
        )
    except Exception:
        pass


async def main():
    errors = []
    async with async_playwright() as pw:
        browser = await pw.firefox.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ── CP1: A creates account + first group ────────────────────────────
        log(f"CP1: Account A ({USER_A['email']}) creates account")
        await create_account(page, USER_A["email"], USER_A["password"])
        await wait_no_loading(page)
        body = await page.locator("body").inner_text()
        assert "Create your first group" in body, f"A: expected create-group, got: {body[:200]}"
        await page.screenshot(path=str(SHOTS / "01_A_create_group_screen.png"))

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
        assert "Create your first group" not in body, f"A: still on create-group: {body[:200]}"
        # Group name lives in the GroupSwitcher <select>; option text is not in inner_text().
        switcher_a = page.get_by_role("combobox").first
        sel_a = await switcher_a.evaluate("el => el.options[el.selectedIndex]?.text || ''")
        assert GROUP_NAME in sel_a, f"A: GroupSwitcher missing '{GROUP_NAME}': {sel_a!r}"
        log(f"CP1 PASS: A created group '{GROUP_NAME}' (switcher: {sel_a!r})")
        await page.screenshot(path=str(SHOTS / "02_A_group_created.png"))

        # ── CP2: A sends an invite to B's email ─────────────────────────────
        log("CP2: A opens Invite page and invites B")
        await page.get_by_role("link", name="Invite").click()
        await asyncio.sleep(1)
        await page.get_by_label("Email", exact=False).fill(USER_B["email"])
        # Submit the invite (button label matches /invite|send/i)
        await page.get_by_role("button", name="Invite", exact=False).first.click()
        await asyncio.sleep(2)
        body = await page.locator("body").inner_text()
        assert USER_B["email"] in body, f"A: invited email not listed: {body[:300]}"
        assert "pending" in body.lower(), f"A: outgoing invite not 'pending': {body[:300]}"
        log("CP2 PASS: outgoing invite to B shows 'pending'")
        await page.screenshot(path=str(SHOTS / "03_A_invite_pending.png"))

        await sign_out(page)
        log("A signed out")

        # ── CP3: B creates account, verifies email, sees pending invite ─────
        log(f"CP3: Account B ({USER_B['email']}) creates account")
        await create_account(page, USER_B["email"], USER_B["password"])
        await wait_no_loading(page)
        # B has no groups -> create-group screen, and (fix) the pending-invite banner
        body = await page.locator("body").inner_text()
        assert "Create your first group" in body, f"B: expected create-group screen: {body[:200]}"
        await page.screenshot(path=str(SHOTS / "04_B_initial_screen.png"))

        # Verify B's email server-side. B's cached ID token still says unverified,
        # and the create-group screen has no Sign-out control, so we mint a fresh
        # token by signing in inside a NEW browser context (clears persisted auth).
        # The accept security rule requires email_verified == true.
        assert verify_email_via_oob(USER_B["email"]), "B: could not apply email verification oob code"
        log("B email verified via emulator oob endpoint")
        await ctx.close()
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        await sign_in(page, USER_B["email"], USER_B["password"])
        await wait_no_loading(page)
        await asyncio.sleep(1)

        body = await page.locator("body").inner_text()
        assert GROUP_NAME in body, f"B: pending invite for '{GROUP_NAME}' not shown: {body[:400]}"
        accept_btn = page.get_by_role("button", name="Accept", exact=False)
        assert await accept_btn.count() > 0, "B: no Accept button on pending invite"
        log(f"CP3 PASS: B sees pending invite for '{GROUP_NAME}' with an Accept button")
        await page.screenshot(path=str(SHOTS / "05_B_sees_pending_invite.png"))

        # ── CP4: B accepts; can now read A's group ──────────────────────────
        log("CP4: B clicks Accept")
        await accept_btn.first.click()
        # After accept, the group snapshot fires -> app renders Layout with the group
        try:
            await page.wait_for_function(
                "() => !document.body.innerText.includes('Create your first group')",
                timeout=15000,
            )
        except Exception:
            pass
        await asyncio.sleep(2)
        body = await page.locator("body").inner_text()
        assert "Create your first group" not in body, f"B: still on create-group after accept: {body[:300]}"
        # GroupSwitcher should now list the group (option text not in inner_text)
        switcher = page.get_by_role("combobox").first
        sel = await switcher.evaluate("el => el.options[el.selectedIndex]?.text || ''")
        assert GROUP_NAME in sel or GROUP_NAME in await switcher.inner_text(), \
            f"B: GroupSwitcher missing '{GROUP_NAME}': {sel!r}"
        log(f"CP4 PASS: B accepted and now reads A's group '{GROUP_NAME}' (switcher: {sel!r})")
        await page.screenshot(path=str(SHOTS / "06_B_accepted_in_group.png"))

        await browser.close()

    log("")
    if errors:
        log(f"CONSOLE/PAGE ERRORS observed ({len(errors)}):")
        for e in errors:
            log(f"  - {e}")
    else:
        log("No console or page errors observed.")
    log("")
    log("FINAL STATUS: PASS — all 4 checkpoints passed (A invites, B verifies, sees, accepts, reads group).")


asyncio.run(main())
