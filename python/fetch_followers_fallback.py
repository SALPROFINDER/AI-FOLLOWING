#!/usr/bin/env python3
"""
fetch_followers_fallback.py — Fallback script using Instagrapi to fetch followers & following.
Use this if Instaloader encounters "JSON Query to graphql/query: HTTP error code 401"
"""

import os
import sys
import csv
import time
import json
import random
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

from instagrapi import Client
from instagrapi.exceptions import (
    ClientError, LoginRequired, ChallengeRequired,
    RateLimitError, UserNotFound
)

def log(msg: str):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr)

def save_to_csv(entries: list, filepath: str, list_type: str, target: str):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["username", "full_name", "is_private", "is_verified"])
        writer.writeheader()
        writer.writerows(entries)
    log(f"💾 Saved {len(entries)} {list_type} of @{target} to {filepath}")

def save_to_json(entries: list, filepath: str):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(entries, f, indent=2, ensure_ascii=False)
    log(f"💾 Saved JSON to {filepath}")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Fetch Instagram followers/following list via Instagrapi")
    parser.add_argument("target", help="Target Instagram username")
    parser.add_argument("--mode", choices=["followers", "following", "both"], default="both")
    parser.add_argument("--limit", type=int, default=0, help="Max to fetch (0 for all)")
    args = parser.parse_args()

    target = args.target.strip().lstrip("@").lower()
    ig_user = os.environ.get("IG_USERNAME", "").strip()
    ig_pass = os.environ.get("IG_PASSWORD", "").strip()

    if not ig_user or not ig_pass:
        log("❌ Missing IG_USERNAME or IG_PASSWORD in environment / .env file")
        sys.exit(1)

    cl = Client()
    
    # Optional delay to avoid spamming login
    time.sleep(1.0)
    
    log(f"🔑 Logging in as @{ig_user} via Instagrapi...")
    try:
        cl.login(ig_user, ig_pass)
        log("✅ Login successful!")
    except Exception as e:
        log(f"❌ Login failed: {e}")
        sys.exit(1)

    log(f"🔍 Getting target user ID for @{target}...")
    try:
        target_id = cl.user_id_from_username(target)
    except Exception as e:
        log(f"❌ User not found or cannot fetch user ID: {e}")
        sys.exit(1)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    exports_dir = Path(__file__).resolve().parent.parent / "exports"

    modes = []
    if args.mode == "both":
        modes = ["followers", "following"]
    else:
        modes = [args.mode]

    for mode in modes:
        log(f"\nFetching {mode} for @{target}...")
        collected = []
        
        try:
            if mode == "followers":
                # Fetch followers. Instagrapi returns dict: {user_id: SimpleUser}
                raw_users = cl.user_followers(target_id, amount=args.limit)
            else:
                # Fetch following
                raw_users = cl.user_following(target_id, amount=args.limit)

            for uid, user in raw_users.items():
                collected.append({
                    "username": user.username,
                    "full_name": user.full_name or "",
                    "is_private": bool(user.is_private),
                    "is_verified": bool(user.is_verified)
                })

            log(f"✅ Fetched {len(collected)} {mode}.")
            
            if collected:
                csv_path = exports_dir / f"{target}_{mode}_instagrapi_{timestamp}.csv"
                json_path = exports_dir / f"{target}_{mode}_instagrapi_{timestamp}.json"
                save_to_csv(collected, str(csv_path), mode, target)
                save_to_json(collected, str(json_path))

        except Exception as e:
            log(f"❌ Error fetching {mode}: {e}")

        if mode != modes[-1]:
            pause = 5 + random.random() * 5
            log(f"⏳ Pausing {pause:.1f}s before next operation...")
            time.sleep(pause)

    log("\n🏁 Done!")

if __name__ == "__main__":
    main()
