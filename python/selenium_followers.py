#!/usr/bin/env python3
"""
selenium_followers.py — Log into Instagram with Selenium, then use
Instagram's internal REST API (same approach as IG Exporter extension)
to paginate through followers/following lists via fetch() in the browser.

No DOM scrolling needed — we call the API directly from the logged-in session.
"""

import os
import sys
import csv
import json
import time
import random
from datetime import datetime
from pathlib import Path

# Load .env
def load_dotenv():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = value

load_dotenv()

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)

def save_to_csv(entries, filepath, list_type, target):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["username", "full_name", "is_verified", "is_private", "profile_pic_url"])
        writer.writeheader()
        writer.writerows(entries)
    log(f"💾 Saved {len(entries)} {list_type} of @{target} to {filepath}")

def save_to_json(entries, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    log(f"💾 Saved JSON to {filepath}")


def login_instagram(driver, username, password):
    log(f"🔑 Navigating to Instagram login...")
    driver.get("https://www.instagram.com/accounts/login/")
    time.sleep(4)

    # Handle cookie consent (French + English)
    try:
        cookie_xpaths = [
            "//button[contains(text(),'Autoriser tous les cookies')]",
            "//button[contains(text(),'Refuser les cookies optionnels')]",
            "//button[contains(text(),'Allow all cookies')]",
            "//button[contains(text(),'Allow essential')]",
            "//button[contains(text(),'Accept')]",
            "//button[contains(text(),'Accepter')]",
        ]
        for xpath in cookie_xpaths:
            buttons = driver.find_elements(By.XPATH, xpath)
            if buttons:
                log(f"  🍪 Closing cookie consent dialog...")
                buttons[0].click()
                time.sleep(2)
                break
    except Exception:
        pass

    log(f"🔑 Entering credentials for @{username}...")
    try:
        # Find username field (name varies: 'username', 'email', or just text input)
        username_input = None
        for selector in ["input[name='username']", "input[name='email']", "input[type='text']"]:
            try:
                username_input = WebDriverWait(driver, 5).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                )
                if username_input:
                    break
            except Exception:
                continue

        if not username_input:
            raise Exception("Could not find username input field")

        # Find password field
        password_input = None
        for selector in ["input[name='password']", "input[name='pass']", "input[type='password']"]:
            try:
                password_input = driver.find_element(By.CSS_SELECTOR, selector)
                if password_input:
                    break
            except Exception:
                continue

        if not password_input:
            raise Exception("Could not find password input field")

    # Type credentials gradually to avoid flaky form events.
        username_input.clear()
        for char in username:
            username_input.send_keys(char)
            time.sleep(0.03 + random.random() * 0.07)

        time.sleep(0.5)

        password_input.clear()
        for char in password:
            password_input.send_keys(char)
            time.sleep(0.03 + random.random() * 0.07)

        time.sleep(1)

        # Submit — try div[role='button'] first, then fallbacks
        password_input.send_keys(Keys.RETURN)
        time.sleep(2)

        submit_selectors = [
            "//div[@role='button'][contains(., 'Se connecter') or contains(., 'Log In') or contains(., 'Log in')]",
            "button[type='submit']",
            "input[type='submit']",
        ]
        for sel in submit_selectors:
            try:
                if sel.startswith("//"):
                    btn = driver.find_element(By.XPATH, sel)
                else:
                    btn = driver.find_element(By.CSS_SELECTOR, sel)
                if btn and btn.is_displayed() and btn.is_enabled():
                    btn.click()
                    break
            except Exception:
                continue

        log("⏳ Waiting for login to complete...")
        time.sleep(8)

    except Exception as e:
        log(f"❌ Login failed: {e}")
        raise

    # Dismiss "Save Login Info?" and "Notifications?" popups
    for _ in range(2):
        try:
            not_now = WebDriverWait(driver, 4).until(
                EC.element_to_be_clickable((By.XPATH,
                    "//button[contains(text(),'Not Now')]|//button[contains(text(),'Plus tard')]"
                    "|//div[contains(text(),'Not Now')]|//div[contains(text(),'Plus tard')]"))
            )
            not_now.click()
            time.sleep(2)
        except Exception:
            pass

    # Verify login succeeded
    if "login" in driver.current_url.lower():
        ss_path = str(Path(__file__).resolve().parent.parent / "exports" / "login_debug.png")
        os.makedirs(os.path.dirname(ss_path), exist_ok=True)
        driver.save_screenshot(ss_path)
        log(f"❌ Login failed — still on login page. Screenshot: {ss_path}")
        raise Exception("Login appears to have failed")

    log("✅ Login successful!")


def get_user_id(driver, target):
    """Get the numeric user ID for a profile by fetching the profile page data."""
    log(f"🔍 Fetching user ID for @{target}...")

    # Navigate to profile to ensure cookies are set for this domain
    driver.get(f"https://www.instagram.com/{target}/")
    time.sleep(3)

    # Extract user ID from the page's embedded data via JS
    user_id = driver.execute_script("""
        // Method 1: Try window._sharedData
        try {
            const sd = window._sharedData;
            if (sd && sd.entry_data && sd.entry_data.ProfilePage) {
                return sd.entry_data.ProfilePage[0].graphql.user.id;
            }
        } catch(e) {}

        // Method 2: Try __additionalData
        try {
            for (const key of Object.keys(window.__additionalData || {})) {
                const data = window.__additionalData[key]?.data;
                if (data?.user?.id) return data.user.id;
            }
        } catch(e) {}

        // Method 3: Search for user_id in page source
        try {
            const html = document.documentElement.innerHTML;
            // Pattern: "user_id":"12345678"
            const match = html.match(/"user_id"\s*:\s*"(\d+)"/);
            if (match) return match[1];
            // Pattern: profilePage_12345678
            const match2 = html.match(/profilePage_(\d+)/);
            if (match2) return match2[1];
        } catch(e) {}

        // Method 4: Look in meta tags or scripts
        try {
            const scripts = document.querySelectorAll('script[type="application/json"]');
            for (const script of scripts) {
                const text = script.textContent;
                if (text.includes('"user_id"')) {
                    const m = text.match(/"user_id"\s*:\s*"(\d+)"/);
                    if (m) return m[1];
                }
                // Also look for "id":"DIGITS" near the username
                const pattern = new RegExp('"username"\s*:\s*"' + arguments[0] + '"[^}]*?"id"\s*:\s*"(\\d+)"');
                const m2 = text.match(pattern);
                if (m2) return m2[1];
            }
        } catch(e) {}

        return null;
    """, target)

    if not user_id:
        # Fallback: use the web profile info API
        log("  Trying /api/v1/users/web_profile_info/ fallback...")
        user_id = driver.execute_script("""
            try {
                const resp = await fetch('/api/v1/users/web_profile_info/?username=' + arguments[0], {
                    headers: {
                        'X-IG-App-ID': '936619743392459',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
                const data = await resp.json();
                return data.data?.user?.id || null;
            } catch(e) {
                return null;
            }
        """, target)

    if user_id:
        log(f"✅ User ID for @{target}: {user_id}")
    else:
        log(f"❌ Could not find user ID for @{target}")

    return user_id


def polite_delay(base_min=3.0, base_max=8.0):
    """Return a conservative delay between browser requests."""
    return base_min + random.random() * (base_max - base_min)


def fetch_list_via_api(driver, user_id, target, list_type, batch_size=50):
    """
    Use Instagram's internal REST API to paginate through followers/following.
    Legacy helper that uses conservative request pacing and stops on repeated
    errors instead of trying to bypass Instagram protections.
    """
    log(f"\n{'='*60}")
    log(f"📡 Fetching {list_type} for @{target} (ID: {user_id}) via API...")
    log(f"{'='*60}")

    all_users = {}
    max_id = ""
    page = 0
    consecutive_errors = 0
    session_start = time.time()
    requests_this_minute = 0
    minute_start = time.time()

    while True:
        page += 1

        # ── Per-minute budget: max ~8 requests/min ──
        now = time.time()
        if now - minute_start >= 60:
            requests_this_minute = 0
            minute_start = now
        if requests_this_minute >= 8:
            wait = 60 - (now - minute_start) + random.random() * 5
            if wait > 0:
                log(f"  🛡️ Budget: {requests_this_minute} req/min reached, cooling {wait:.0f}s...")
                time.sleep(wait)
            requests_this_minute = 0
            minute_start = time.time()

        current_batch = min(batch_size, 50)

        # Build the API URL
        if list_type == "followers":
            url_path = f"/api/v1/friendships/{user_id}/followers/?count={current_batch}"
        else:
            url_path = f"/api/v1/friendships/{user_id}/following/?count={current_batch}"

        if max_id:
            url_path += f"&max_id={max_id}"

        # Execute fetch() inside the browser
        result = driver.execute_script("""
            try {
                const resp = await fetch(arguments[0], {
                    headers: {
                        'X-IG-App-ID': '936619743392459',
                        'X-Requested-With': 'XMLHttpRequest',
                        'X-IG-WWW-Claim': '0'
                    },
                    credentials: 'include'
                });
                
                if (!resp.ok) {
                    return {error: 'HTTP ' + resp.status, status: resp.status};
                }
                
                const data = await resp.json();
                return {
                    users: data.users || [],
                    next_max_id: data.next_max_id || null,
                    big_list: data.big_list || false,
                    page_size: data.page_size || 0,
                    status: data.status
                };
            } catch(e) {
                return {error: e.toString()};
            }
        """, url_path)

        requests_this_minute += 1

        # ── Error handling with exponential backoff ──
        if not result or result.get("error"):
            error_msg = result.get("error", "unknown") if result else "null response"
            status = result.get("status", "") if result else ""
            log(f"  ❌ Page {page} error: {error_msg}")
            consecutive_errors += 1

            if status == 401:
                log("  🔒 Session expired or unauthorized. Stopping.")
                break
            elif status == 429:
                backoff = min(30 * (2 ** (consecutive_errors - 1)), 300)  # 30s → 60s → 120s → max 300s
                backoff += random.random() * 15
                log(f"  ⏳ Rate limited! Exponential backoff: {backoff:.0f}s...")
                time.sleep(backoff)
                continue
            elif consecutive_errors >= 5:
                log(f"  🛑 Too many consecutive errors ({consecutive_errors}). Stopping.")
                break
            else:
                backoff = 5 * consecutive_errors + random.random() * 5
                time.sleep(backoff)
                continue

        consecutive_errors = 0
        users = result.get("users", [])
        next_max_id = result.get("next_max_id")

        for user in users:
            uname = user.get("username", "").strip().lower()
            if uname and uname not in all_users:
                all_users[uname] = {
                    "username": uname,
                    "full_name": user.get("full_name", ""),
                    "is_verified": user.get("is_verified", False),
                    "is_private": user.get("is_private", False),
                    "profile_pic_url": user.get("profile_pic_url", "")
                }

        elapsed = time.time() - session_start
        rate = len(all_users) / elapsed * 60 if elapsed > 0 else 0
        log(f"  📄 Page {page}: +{len(users)} (batch={current_batch}), total: {len(all_users)} [{rate:.0f}/min]")

        if not next_max_id:
            log(f"  ✅ No more pages — reached the end.")
            break

        max_id = str(next_max_id)

        time.sleep(polite_delay())

    elapsed_total = time.time() - session_start
    log(f"✅ Total unique {list_type}: {len(all_users)} (scraped in {elapsed_total:.0f}s)")
    return list(all_users.values())


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Scrape Instagram followers/following via internal API")
    parser.add_argument("target", help="Target Instagram username")
    parser.add_argument("--mode", choices=["followers", "following", "both"], default="both")
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode")
    parser.add_argument("--batch-size", type=int, default=50, help="Users per API page (max 100)")
    args = parser.parse_args()

    target = args.target.strip().lstrip("@").lower()
    ig_user = os.environ.get("IG_USERNAME", "").strip()
    ig_pass = os.environ.get("IG_PASSWORD", "").strip()

    if not ig_user or not ig_pass:
        log("❌ Missing IG_USERNAME or IG_PASSWORD")
        sys.exit(1)

    # Setup Chrome
    chrome_options = Options()
    if args.headless:
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1280,900")
    chrome_options.add_argument("--lang=en-US")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

    log("🚀 Starting Chrome browser...")
    try:
        driver = webdriver.Chrome(options=chrome_options)
    except Exception:
        from webdriver_manager.chrome import ChromeDriverManager
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=chrome_options)

    try:
        login_instagram(driver, ig_user, ig_pass)

        # Get the user ID for the target profile
        user_id = get_user_id(driver, target)
        if not user_id:
            log("❌ Cannot proceed without user ID. Exiting.")
            sys.exit(1)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        exports_dir = Path(__file__).resolve().parent.parent / "exports"

        modes = ["followers", "following"] if args.mode == "both" else [args.mode]

        for mode in modes:
            entries = fetch_list_via_api(driver, user_id, target, mode, args.batch_size)

            if entries:
                csv_path = exports_dir / f"{target}_{mode}_{timestamp}.csv"
                json_path = exports_dir / f"{target}_{mode}_{timestamp}.json"
                save_to_csv(entries, str(csv_path), mode, target)
                save_to_json(entries, str(json_path))
            else:
                log(f"⚠️ No {mode} collected for @{target}")

            if mode != modes[-1]:
                pause = 3 + random.random() * 3
                log(f"⏳ Pausing {pause:.1f}s before next list...")
                time.sleep(pause)

        log("\n🏁 Done! Check the exports/ directory for results.")

    except Exception as e:
        log(f"❌ Fatal error: {e}")
        ss_path = str(Path(__file__).resolve().parent.parent / "exports" / "error_debug.png")
        os.makedirs(os.path.dirname(ss_path), exist_ok=True)
        try:
            driver.save_screenshot(ss_path)
            log(f"📸 Debug screenshot saved to {ss_path}")
        except Exception:
            pass
        sys.exit(1)
    finally:
        driver.quit()
        log("🔒 Browser closed.")


if __name__ == "__main__":
    main()
