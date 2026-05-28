#!/usr/bin/env python3
"""
fetch_followers.py — Fetch followers and/or following list for a public Instagram profile.

Usage:
    python fetch_followers.py <target_username> [--mode followers|following|both] [--limit N]

Requires IG_USERNAME and IG_PASSWORD in environment or ../.env file.
Uses Instaloader with authenticated session (required by Instagram to access follower lists).

Outputs CSV files to ../exports/ directory.

Rate limiting: ~3-5 seconds between each batch to stay under Instagram's radar.
If a checkpoint/challenge is triggered, the script stops immediately.
"""

import os
import sys
import csv
import time
import json
import random
import itertools
from datetime import datetime
from pathlib import Path

# Load .env from project root
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

import instaloader
from instaloader.exceptions import (
    ConnectionException,
    LoginRequiredException,
    TwoFactorAuthRequiredException,
    InvalidArgumentException,
    ProfileNotExistsException,
)


def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr)


def random_delay(min_sec=2.0, max_sec=5.0):
    """Sleep a random amount to mimic human behavior."""
    delay = min_sec + random.random() * (max_sec - min_sec)
    log(f"  ⏳ Waiting {delay:.1f}s...")
    time.sleep(delay)


def fetch_user_list(profile, list_type: str, limit = None):
    """
    Fetch followers or followees from a profile.
    Yields (username, full_name, is_private, is_verified) tuples.
    Uses instaloader's built-in generator which handles pagination internally.
    """
    if list_type == "followers":
        generator = profile.get_followers()
        total = profile.followers
    elif list_type == "following":
        generator = profile.get_followees()
        total = profile.followees
    else:
        raise ValueError(f"Unknown list_type: {list_type}")

    log(f"📋 Starting extraction of {list_type} (total reported: {total})")
    if limit:
        log(f"   Limit set to {limit} accounts")
    
    collected = []
    count = 0

    try:
        for follower in generator:
            count += 1
            entry = {
                "username": follower.username,
                "full_name": follower.full_name or "",
                "is_private": follower.is_private,
                "is_verified": follower.is_verified,
            }
            collected.append(entry)

            if count % 10 == 0:
                log(f"  ✅ Collected {count}/{total} {list_type}...")

            # Every 30-50 entries, take a longer pause
            if count % 40 == 0:
                pause = 8.0 + random.random() * 7.0  # 8-15 sec
                log(f"  🛑 Longer pause ({pause:.1f}s) after {count} entries to avoid rate limiting...")
                time.sleep(pause)
            elif count % 5 == 0:
                random_delay(1.5, 3.5)

            if limit and count >= limit:
                log(f"  🛑 Reached limit of {limit}, stopping.")
                break

    except LoginRequiredException as e:
        log(f"  ❌ Login required during pagination: {e}")
        log(f"     Saving {len(collected)} entries collected so far.")
    except ConnectionException as e:
        err = str(e)
        if "429" in err or "Too Many" in err:
            log(f"  ❌ Rate limited (429) after {count} entries. Saving what we have.")
        elif "checkpoint" in err.lower() or "challenge" in err.lower():
            log(f"  ❌ Challenge/checkpoint required. Stopping immediately.")
            log(f"     ⚠️  Your account may need manual verification on instagram.com")
        else:
            log(f"  ❌ Connection error after {count} entries: {e}")
        log(f"     Saving {len(collected)} entries collected so far.")
    except Exception as e:
        log(f"  ❌ Unexpected error after {count} entries: {e}")
        log(f"     Saving {len(collected)} entries collected so far.")

    return collected


def save_to_csv(entries: list[dict], filepath: str, list_type: str, target: str):
    """Save collected entries to a CSV file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["username", "full_name", "is_private", "is_verified"])
        writer.writeheader()
        writer.writerows(entries)
    
    log(f"💾 Saved {len(entries)} {list_type} of @{target} to {filepath}")


def save_to_json(entries: list[dict], filepath: str):
    """Save collected entries to a JSON file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    log(f"💾 Saved JSON to {filepath}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Fetch Instagram followers/following list")
    parser.add_argument("target", help="Target Instagram username")
    parser.add_argument("--mode", choices=["followers", "following", "both"], default="both",
                        help="What to fetch (default: both)")
    parser.add_argument("--limit", type=int, default=None,
                        help="Max number of accounts to fetch per list (default: no limit)")
    args = parser.parse_args()

    target = args.target.strip().lstrip("@").lower()

    # Get credentials
    ig_user = os.environ.get("IG_USERNAME", "").strip()
    ig_pass = os.environ.get("IG_PASSWORD", "").strip()

    if not ig_user or not ig_pass:
        log("❌ Missing IG_USERNAME or IG_PASSWORD in environment / .env file")
        log("   Set them in .env at the project root:")
        log("     IG_USERNAME=your_instagram_username")
        log("     IG_PASSWORD=your_instagram_password")
        sys.exit(1)

    # Setup Instaloader
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )

    # Login
    try:
        log(f"🔑 Loading session for @{ig_user}...")
        L.load_session_from_file(ig_user)
        log("✅ Session loaded successfully!")
    except FileNotFoundError:
        log(f"🔑 Session file not found. Logging in with password as @{ig_user}...")
        try:
            L.login(ig_user, ig_pass)
            L.save_session_to_file()
            log("✅ Login successful and session saved!")
        except TwoFactorAuthRequiredException:
            log("❌ Two-factor authentication is enabled on this account.")
            log("   Instaloader cannot handle 2FA in non-interactive mode.")
            log("   Tip: Disable 2FA temporarily or use a test account without 2FA.")
            sys.exit(1)
        except ConnectionException as e:
            err = str(e)
            if "checkpoint" in err.lower() or "challenge" in err.lower():
                log(f"❌ Instagram is requiring a challenge/checkpoint verification.")
                log(f"   Please log in manually at instagram.com, verify your identity, then try again.")
            else:
                log(f"❌ Login failed: {e}")
            sys.exit(1)
        except Exception as e:
            log(f"❌ Login error: {e}")
            sys.exit(1)
    except Exception as e:
        log(f"⚠️ Error loading session: {e}. Logging in with password...")
        try:
            L.login(ig_user, ig_pass)
            L.save_session_to_file()
            log("✅ Login successful and session saved!")
        except Exception as login_err:
            log(f"❌ Login failed: {login_err}")
            sys.exit(1)

    # Fetch target profile
    log(f"🔍 Loading profile @{target}...")
    try:
        profile = instaloader.Profile.from_username(L.context, target)
    except ProfileNotExistsException:
        log(f"❌ Profile @{target} does not exist")
        sys.exit(1)
    except Exception as e:
        log(f"❌ Failed to load profile: {e}")
        sys.exit(1)

    log(f"📊 Profile @{target}: {profile.followers} followers, {profile.followees} following, {profile.mediacount} posts")

    if profile.is_private:
        log(f"🔒 Profile @{target} is private.")
        log(f"   You can only fetch lists if @{ig_user} follows @{target}.")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    exports_dir = Path(__file__).resolve().parent.parent / "exports"

    modes = []
    if args.mode == "both":
        modes = ["followers", "following"]
    else:
        modes = [args.mode]

    for mode in modes:
        log(f"\n{'='*60}")
        log(f"Fetching {mode} for @{target}...")
        log(f"{'='*60}")

        entries = fetch_user_list(profile, mode, limit=args.limit)

        if entries:
            csv_path = exports_dir / f"{target}_{mode}_{timestamp}.csv"
            json_path = exports_dir / f"{target}_{mode}_{timestamp}.json"
            save_to_csv(entries, str(csv_path), mode, target)
            save_to_json(entries, str(json_path))
        else:
            log(f"⚠️  No {mode} collected for @{target}")

        # Pause between followers and following fetches
        if mode != modes[-1]:
            pause = 10 + random.random() * 10
            log(f"\n⏳ Pausing {pause:.0f}s before fetching next list...")
            time.sleep(pause)

    log(f"\n🏁 Done! Check the exports/ directory for results.")


if __name__ == "__main__":
    main()
