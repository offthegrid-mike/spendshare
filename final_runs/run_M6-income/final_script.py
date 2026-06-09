"""
SpendShare M6 Income — Acceptance Test Script
Verifies per-month income persistence for group members.
"""

import asyncio
import time
import os
from playwright.async_api import async_playwright

RUN_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOTS_DIR = os.path.join(RUN_DIR, "screenshots")
LOG_PATH = os.path.join(RUN_DIR, "final_script_log.txt")
BASE_URL = "http://localhost:5173"
TIMESTAMP = int(time.time())
EMAIL = f"income-test-{TIMESTAMP}@test.com"
PASSWORD = "Test1234!"


def log(step: int, action: str):
    line = f"step {step} action: {action}"
    print(line)
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")


def ss(step: int, name: str) -> str:
    path = os.path.join(SCREENSHOTS_DIR, f"final_execution_{step:02d}_{name}.png")
    return path


async def main():
    # Reset log
    with open(LOG_PATH, "w") as f:
        f.write(f"SpendShare M6 Income acceptance test — {TIMESTAMP}\n")

    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    async with async_playwright() as p:
        browser = await p.firefox.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 1800})

        # ── Step 1: Navigate to app ──────────────────────────────────────────
        log(1, f"Navigate to {BASE_URL}")
        await page.goto(BASE_URL)
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.screenshot(path=ss(1, "app_loaded"))
        log(1, f"App loaded at URL={page.url}")

        # ── Step 2: Sign up ──────────────────────────────────────────────────
        log(2, f"Sign up as {EMAIL}")
        # Fill email field (id="email")
        await page.fill("#email", EMAIL)
        # Fill password field (id="password")
        await page.fill("#password", PASSWORD)
        await page.screenshot(path=ss(2, "signup_fields_filled"))
        # Click "Create account" button (type="button")
        await page.click('button:has-text("Create account")')
        # After signup the SPA stays at '/' but renders CreateGroup form
        # Wait for group creation form to appear (h1 "Create your first group")
        await page.wait_for_selector('h1:has-text("Create your first group")', timeout=20000)
        await page.wait_for_timeout(500)
        await page.screenshot(path=ss(2, "after_signup"))
        log(2, f"Signed up, URL={page.url}")

        # ── Step 3: Create group ─────────────────────────────────────────────
        log(3, "Create group 'Income Test Group' with AUD currency")
        await page.wait_for_timeout(500)
        await page.screenshot(path=ss(3, "post_signup_page"))

        # Group name input has placeholder "e.g. Our Household"
        await page.fill('input[placeholder="e.g. Our Household"]', "Income Test Group")
        # Currency select — default is AUD, but ensure it's set
        await page.select_option("select", "AUD")
        await page.screenshot(path=ss(3, "group_form_filled"))

        # Submit via "Create group" button
        await page.click('button:has-text("Create group")')
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path=ss(3, "group_created"))
        log(3, f"Group created, URL={page.url}")

        # ── Step 4: Navigate to Income page ─────────────────────────────────
        log(4, "Navigate to Income page via nav link")
        await page.click('a:has-text("Income")')
        await page.wait_for_load_state("networkidle", timeout=10000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=ss(4, "income_page_loaded"))
        log(4, f"Income page loaded, URL={page.url}")

        # ── Step 5: Verify 1 member row ──────────────────────────────────────
        log(5, "Verify 1 income row for the single group member")
        income_inputs = page.locator('form input[type="number"]')
        count = await income_inputs.count()
        log(5, f"Found {count} income input row(s)")
        await page.screenshot(path=ss(5, "income_rows_visible"))
        assert count >= 1, f"Expected at least 1 income row, got {count}"

        # ── Step 6: Enter 5000 for current month ────────────────────────────
        log(6, "Enter 5000 in the income field for current month")
        first_input = income_inputs.first
        await first_input.click(click_count=3)
        await first_input.fill("5000")
        await page.screenshot(path=ss(6, "income_5000_entered"))
        log(6, "Entered 5000")

        # ── Step 7: Click Save ───────────────────────────────────────────────
        log(7, "Click Save button")
        await page.click('button[type="submit"]:has-text("Save")')
        await page.wait_for_load_state("networkidle", timeout=10000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=ss(7, "after_save_current_month"))
        log(7, "Saved current month 5000")

        # Record current month label for later verification
        month_label_el = page.locator(".flex.items-center.gap-2 span").first
        current_month_label = await month_label_el.text_content()
        log(7, f"Current month label: '{current_month_label}'")

        # ── Step 8: Switch to previous month ────────────────────────────────
        log(8, "Click Previous month button (aria-label='Previous')")
        await page.click('button[aria-label="Previous"]')
        await page.wait_for_load_state("networkidle", timeout=10000)
        # Wait for remounted component + Firestore snapshot for previous month
        await page.wait_for_timeout(3000)
        await page.screenshot(path=ss(8, "prev_month_loaded"))
        prev_month_label = await month_label_el.text_content()
        log(8, f"Switched to previous month: '{prev_month_label}', URL={page.url}")

        # ── Step 9: Verify previous month shows blank/0 ─────────────────────
        log(9, "Verify previous month income shows blank or 0")
        prev_inputs = page.locator('form input[type="number"]')
        prev_value = await prev_inputs.first.input_value()
        log(9, f"Previous month income value: '{prev_value}'")
        await page.screenshot(path=ss(9, "prev_month_income_value"))
        is_blank_or_zero = (prev_value == "" or prev_value == "0" or prev_value == "0.00")
        assert is_blank_or_zero, \
            f"Expected blank/0 for previous month, got '{prev_value}'"
        log(9, "PASS: Previous month shows blank/0 as expected")

        # ── Step 10: Enter 3000 for previous month ───────────────────────────
        log(10, "Enter 3000 for previous month")
        await prev_inputs.first.click(click_count=3)
        await prev_inputs.first.fill("3000")
        await page.screenshot(path=ss(10, "income_3000_entered"))
        log(10, "Entered 3000 for previous month")

        # ── Step 11: Click Save for previous month ───────────────────────────
        log(11, "Click Save for previous month")
        await page.click('button[type="submit"]:has-text("Save")')
        await page.wait_for_load_state("networkidle", timeout=10000)
        await page.wait_for_timeout(1500)
        await page.screenshot(path=ss(11, "after_save_prev_month"))
        log(11, "Saved previous month 3000")

        # ── Step 12: Switch back to current month ────────────────────────────
        log(12, "Click Next month button (aria-label='Next') to go back to current month")
        await page.click('button[aria-label="Next"]')
        await page.wait_for_load_state("networkidle", timeout=10000)
        # Wait for Firestore onSnapshot to deliver June 2026 data to the remounted component
        await page.wait_for_timeout(4000)
        await page.screenshot(path=ss(12, "back_to_current_month"))
        back_to_month_label = await month_label_el.text_content()
        log(12, f"Back to month: '{back_to_month_label}'")
        assert back_to_month_label == current_month_label, \
            f"Expected to be back to '{current_month_label}', got '{back_to_month_label}'"

        # ── Step 13: Verify current month still shows 5000 ───────────────────
        log(13, "Verify current month still shows 5000 (per-month persistence)")
        curr_inputs = page.locator('form input[type="number"]')
        curr_value = await curr_inputs.first.input_value()
        log(13, f"Current month income value after round-trip: '{curr_value}'")
        await page.screenshot(path=ss(13, "current_month_persisted"))

        numeric_value = float(curr_value) if curr_value else 0.0
        assert numeric_value == 5000.0, \
            f"Expected 5000.00 for current month after round-trip, got '{curr_value}'"
        log(13, "PASS: Per-month persistence confirmed — current month still shows 5000")

        # ── Done ──────────────────────────────────────────────────────────────
        await browser.close()

    with open(LOG_PATH, "a") as f:
        f.write("\nFINAL RESULT: PASS — all acceptance criteria met\n")
    print("\nFINAL RESULT: PASS — all acceptance criteria met")


asyncio.run(main())
