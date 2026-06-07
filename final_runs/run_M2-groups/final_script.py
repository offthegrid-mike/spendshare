import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

RUN_DIR = Path(__file__).parent
SCREENSHOTS = RUN_DIR / "screenshots"
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
LOG = RUN_DIR / "final_script_log.txt"
LOG.write_text("")  # reset


def log(step: int, msg: str) -> None:
    line = f"step {step} action: {msg}\n"
    LOG.open("a").write(line)
    print(line, end="")


BASE_URL = "http://localhost:5173"
USER_A = {"email": "a@test.com", "password": "Test1234!"}
USER_B = {"email": "b@test.com", "password": "Test1234!"}


async def sign_up_or_in(page, email: str, password: str) -> None:
    """Fill sign-in form; attempt create account first, fall back to sign-in if already exists."""
    await page.goto(BASE_URL, wait_until="domcontentloaded")
    await asyncio.sleep(1)

    await page.get_by_role("textbox").nth(0).fill(email)
    await page.get_by_role("textbox").nth(1).fill(password)

    await page.get_by_role("button", name="Create account").click()
    await asyncio.sleep(2)

    # If an alert appeared (e.g. already-in-use), try sign-in instead
    alert = page.get_by_role("alert")
    if await alert.count() > 0:
        alert_text = await alert.first.inner_text()
        if "already-in-use" in alert_text or "already in use" in alert_text.lower():
            await page.get_by_role("textbox").nth(0).fill(email)
            await page.get_by_role("textbox").nth(1).fill(password)
            await page.get_by_role("button", name="Sign in").click()
            await asyncio.sleep(2)

    # Wait for loading state to clear
    try:
        await page.wait_for_function(
            "() => !document.body.innerText.includes('Loading')",
            timeout=15000
        )
    except Exception:
        pass  # timeout; will check body text in caller


async def sign_out(page) -> None:
    sign_out_btn = page.get_by_role("button", name="Sign out")
    if await sign_out_btn.count() > 0:
        await sign_out_btn.click()
        await asyncio.sleep(3)
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(1)


async def main():
    async with async_playwright() as playwright:
        browser = await playwright.firefox.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # ── CP1: Account A signs up and sees "Create your first group" ──────
        log(1, "navigating to app as Account A (a@test.com)")
        await sign_up_or_in(page, USER_A["email"], USER_A["password"])
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_1_accountA_after_signin.png"))
        log(1, "Account A signed in; checking for 'Create your first group' screen")

        body_text = await page.locator("body").inner_text()
        assert "Create your first group" in body_text, f"Expected create-group screen, got: {body_text[:200]}"
        log(1, "CP1 PASS: 'Create your first group' screen visible for Account A")

        # ── CP2: Create group + GroupSwitcher shows group name ───────────────
        log(2, "filling CreateGroup form: name='Test Household', currency=AUD")
        name_input = page.get_by_placeholder("e.g. Our Household")
        await name_input.fill("Test Household")

        currency_select = page.get_by_role("combobox").first
        await currency_select.select_option("AUD")

        await page.get_by_role("button", name="Create group").click()

        # Wait for app to navigate away from CreateGroup → main app with GroupSwitcher
        try:
            await page.wait_for_function(
                "() => !document.body.innerText.includes('Create your first group')",
                timeout=15000
            )
        except Exception:
            pass
        await asyncio.sleep(1)

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_2_group_created.png"))
        log(2, "group created; checking GroupSwitcher in header")

        # GroupSwitcher is a <select> (combobox) in the header
        switcher = page.get_by_role("combobox").first
        switcher_value = await switcher.input_value()
        # Get the text of the selected option
        selected_option_text = await switcher.evaluate(
            "el => el.options[el.selectedIndex]?.text || ''"
        )
        assert "Test Household" in selected_option_text or "Test Household" in await switcher.inner_text(), \
            f"Switcher selected: {selected_option_text!r}, inner: {await switcher.inner_text()!r}"
        log(2, f"CP2 PASS: GroupSwitcher shows 'Test Household' — selected: {selected_option_text!r}")

        # ── CP3: Settings page — change currency AUD → USD ────────────────────
        log(3, "clicking Settings link to navigate to /group/settings")
        settings_link = page.get_by_role("link", name="Settings")
        await settings_link.click()
        await asyncio.sleep(1)

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_3_settings_page.png"))
        log(3, "on settings page; changing currency from AUD to USD")

        # nth(0) = GroupSwitcher in header; nth(1) = currency in settings form
        currency_select_settings = page.get_by_role("combobox").nth(1)
        await currency_select_settings.select_option("USD")

        await page.get_by_role("button", name="Save changes").click()

        # Wait up to 10s for "Saved!" to appear (it shows for 2s after updateDoc resolves)
        try:
            await page.wait_for_function(
                "() => document.body.innerText.includes('Saved!')",
                timeout=10000
            )
        except Exception:
            pass

        await page.screenshot(path=str(SCREENSHOTS / "final_execution_4_settings_saved.png"))
        log(3, "clicked Save; checking for 'Saved!' confirmation")

        page_text = await page.locator("body").inner_text()
        assert "Saved!" in page_text, f"'Saved!' not found in page: {page_text[:300]}"
        log(3, "CP3 PASS: 'Saved!' confirmation visible after currency change to USD")

        # ── CP4: Account B cannot see Account A's groups ─────────────────────
        log(4, "signing out Account A")
        await sign_out(page)
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_5_accountA_signed_out.png"))
        log(4, "Account A signed out; signing in as Account B (b@test.com)")

        await sign_up_or_in(page, USER_B["email"], USER_B["password"])
        await asyncio.sleep(2)
        await page.screenshot(path=str(SCREENSHOTS / "final_execution_6_accountB_after_signin.png"))

        body_text_b = await page.locator("body").inner_text()
        assert "Create your first group" in body_text_b, (
            f"Account B should see create-group screen, got: {body_text_b[:200]}"
        )
        # Confirm Account A's group name is NOT visible
        assert "Test Household" not in body_text_b, (
            f"Account B should NOT see Account A's group, but found 'Test Household' in: {body_text_b[:300]}"
        )
        log(4, "CP4 PASS: Account B sees 'Create your first group' — Account A's data is NOT visible (isolation confirmed)")

        with LOG.open("a") as f:
            f.write("\nFINAL_RESPONSE: All 4 acceptance criteria passed. M2 functional verification COMPLETE.\n")

        await browser.close()

asyncio.run(main())
