#!/usr/bin/env python3
"""
extension_graphql_export.py — Export Instagram followers/following using the
same GraphQL pagination pattern observed in the local IG Exporter extension.

It logs into a normal browser session, resolves the profile user id, then asks
Instagram's GraphQL endpoint for pages of 50 profiles until has_next_page is
false or an error occurs. No DOM scrolling is needed.
"""

import argparse
import csv
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service

from selenium_followers import load_dotenv, log, login_instagram

load_dotenv()

QUERY = {
    "followers": {
        "hash": "37479f2b8209594dde7facb0d904896a",
        "edge": "edge_followed_by",
        "label": "Followers",
    },
    "following": {
        "hash": "58712303d941c6855d4e888c5f0cd22f",
        "edge": "edge_follow",
        "label": "Following",
    },
}

CSV_FIELDS = [
    "id",
    "username",
    "full_name",
    "profile_pic_url",
    "is_verified",
    "followed_by_viewer",
    "requested_by_viewer",
]


def normalize_target(value):
    return value.strip().lstrip("@").rstrip("/").split("/")[-1].lower()


def load_targets(args):
    targets = []
    if args.target:
        targets.append(normalize_target(args.target))

    if args.targets_file:
        with open(args.targets_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                targets.append(normalize_target(line.split(",")[0]))

    deduped = []
    seen = set()
    for target in targets:
        if target and target not in seen:
            seen.add(target)
            deduped.append(target)
    return deduped


def save_csv(entries, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(entries)
    log(f"Saved CSV: {filepath}")


def save_json(payload, filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    log(f"Saved JSON: {filepath}")


def load_checkpoint(filepath):
    if not filepath or not os.path.exists(filepath):
        return None
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def save_checkpoint(filepath, payload):
    if not filepath:
        return
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    temp_path = f"{filepath}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    os.replace(temp_path, filepath)


def latest_checkpoint(exports_dir, target, mode):
    pattern = f"{target}_{mode}_graphql_"
    candidates = []
    if not exports_dir.exists():
      return None
    for item in exports_dir.iterdir():
        if item.is_file() and item.name.startswith(pattern) and item.name.endswith(".partial.json"):
            candidates.append(item)
    if not candidates:
        return None
    return max(candidates, key=lambda item: item.stat().st_mtime)


def get_profile_user_id(driver, target):
    profile_url = f"https://www.instagram.com/{target}/"
    log(f"Opening profile page: {profile_url}")
    driver.get(profile_url)
    time.sleep(4)

    html = driver.page_source
    patterns = [
        r'"page_id"\s*:\s*"profilePage_(\d+)"',
        r"profilePage_(\d+)",
        r'"user_id"\s*:\s*"(\d+)"',
        r'"profile_id"\s*:\s*"(\d+)"',
    ]
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            user_id = match.group(1)
            log(f"Resolved @{target} to user id {user_id}")
            return user_id

    log("Profile id not found in page source; trying web_profile_info fallback...")
    result = driver.execute_async_script(
        """
        const username = arguments[0];
        const done = arguments[arguments.length - 1];
        (async () => {
          try {
            const resp = await fetch('/api/v1/users/web_profile_info/?username=' + encodeURIComponent(username), {
              headers: {
                'X-IG-App-ID': '936619743392459',
                'X-Requested-With': 'XMLHttpRequest'
              },
              credentials: 'include'
            });
            const data = await resp.json();
            done({ ok: resp.ok, status: resp.status, id: data?.data?.user?.id || null });
          } catch (err) {
            done({ ok: false, error: String(err) });
          }
        })();
        """,
        target,
    )

    if result and result.get("id"):
        user_id = str(result["id"])
        log(f"Resolved @{target} to user id {user_id}")
        return user_id

    raise RuntimeError(f"Could not resolve user id for @{target}")


def fetch_graphql_page(driver, query_hash, user_id, cursor):
    return driver.execute_async_script(
        """
        const queryHash = arguments[0];
        const userId = arguments[1];
        const cursor = arguments[2] || "";
        const done = arguments[arguments.length - 1];
        (async () => {
          const variables = { id: userId, after: cursor, first: 50 };
          const url = 'https://www.instagram.com/graphql/query/?query_hash='
            + encodeURIComponent(queryHash)
            + '&variables='
            + encodeURIComponent(JSON.stringify(variables));
          try {
            const resp = await fetch(url, { credentials: 'include' });
            const text = await resp.text();
            done({ ok: resp.ok, status: resp.status, text });
          } catch (err) {
            done({ ok: false, error: String(err) });
          }
        })();
        """,
        query_hash,
        user_id,
        cursor,
    )


def fetch_list(
    driver,
    user_id,
    target,
    list_type,
    delay_seconds,
    max_pages=None,
    limit_items=None,
    checkpoint_path=None,
    resume=False,
):
    query = QUERY[list_type]
    edge_name = query["edge"]
    cursor = ""
    page = 0
    total = None
    users_by_username = {}
    started = time.time()

    checkpoint = load_checkpoint(checkpoint_path) if resume else None
    if checkpoint:
        cursor = checkpoint.get("next_cursor") or ""
        page = int(checkpoint.get("pages", 0))
        total = checkpoint.get("total_reported")
        for item in checkpoint.get("items", []):
            username = str(item.get("username", "")).strip().lower()
            if username:
                users_by_username[username] = item
        log(f"Resuming {query['label']} from page {page}, found={len(users_by_username)}, cursor={'yes' if cursor else 'no'}")

    log(f"Starting {query['label']} export for @{target} with {delay_seconds}s delay")

    while True:
        page += 1
        if max_pages and page > max_pages:
            log(f"Reached --max-pages={max_pages}; stopping early.")
            break

        result = fetch_graphql_page(driver, query["hash"], user_id, cursor)
        if not result or not result.get("ok"):
            status = result.get("status") if result else "unknown"
            error = result.get("error") if result else "empty response"
            raise RuntimeError(f"GraphQL page {page} failed: status={status} error={error}")

        try:
            payload = json.loads(result["text"])
            edge = payload["data"]["user"][edge_name]
        except Exception as exc:
            preview = (result.get("text") or "")[:500]
            raise RuntimeError(f"Could not parse GraphQL page {page}: {exc}. Preview: {preview}")

        page_info = edge.get("page_info", {})
        total = edge.get("count", total)
        edges = edge.get("edges", [])

        added = 0
        for entry in edges:
            if limit_items and len(users_by_username) >= limit_items:
                break
            node = entry.get("node", {})
            username = str(node.get("username", "")).strip().lower()
            if username and username not in users_by_username:
                users_by_username[username] = {
                    "id": node.get("id", ""),
                    "username": username,
                    "full_name": node.get("full_name", ""),
                    "profile_pic_url": node.get("profile_pic_url", ""),
                    "is_verified": str(bool(node.get("is_verified", False))).lower(),
                    "followed_by_viewer": str(bool(node.get("followed_by_viewer", False))).lower(),
                    "requested_by_viewer": str(bool(node.get("requested_by_viewer", False))).lower(),
                }
                added += 1

        found = len(users_by_username)
        elapsed = max(time.time() - started, 1)
        log(f"Page {page}: +{added}, found={found}, total={total or '?'} ({found / elapsed * 60:.1f}/min)")

        if limit_items and found >= limit_items:
            log(f"Reached --limit-items={limit_items}; preview export completed.")
            save_checkpoint(checkpoint_path, {
                "target": target,
                "type": list_type,
                "status": "preview_complete",
                "total_reported": total,
                "total_collected": len(users_by_username),
                "pages": page,
                "next_cursor": page_info.get("end_cursor"),
                "updated_at": datetime.now().isoformat(),
                "items": list(users_by_username.values()),
                "is_preview": True,
                "limit_items": limit_items,
            })
            break

        if not page_info.get("has_next_page"):
            log("No next page; export completed.")
            save_checkpoint(checkpoint_path, {
                "target": target,
                "type": list_type,
                "status": "complete",
                "total_reported": total,
                "total_collected": len(users_by_username),
                "pages": page,
                "next_cursor": None,
                "updated_at": datetime.now().isoformat(),
                "items": list(users_by_username.values()),
            })
            break

        cursor = page_info.get("end_cursor")
        if not cursor:
            log("Missing end_cursor; stopping.")
            break

        save_checkpoint(checkpoint_path, {
            "target": target,
            "type": list_type,
            "status": "in_progress",
            "total_reported": total,
            "total_collected": len(users_by_username),
            "pages": page,
            "next_cursor": cursor,
            "updated_at": datetime.now().isoformat(),
            "items": list(users_by_username.values()),
        })

        time.sleep(delay_seconds)

    return {
        "target": target,
        "type": list_type,
        "total_reported": total,
        "total_collected": len(users_by_username),
        "pages": page,
        "delay_seconds": delay_seconds,
        "is_preview": bool(limit_items and len(users_by_username) >= limit_items),
        "limit_items": limit_items,
        "items": list(users_by_username.values()),
    }


def build_driver(headless):
    chrome_options = Options()
    if headless:
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1280,900")
    chrome_options.add_argument("--lang=en-US")

    try:
        return webdriver.Chrome(options=chrome_options)
    except Exception:
        from webdriver_manager.chrome import ChromeDriverManager

        service = Service(ChromeDriverManager().install())
        return webdriver.Chrome(service=service, options=chrome_options)


def main():
    parser = argparse.ArgumentParser(description="Export Instagram followers/following using IG Exporter-style GraphQL pagination")
    parser.add_argument("target", nargs="?", help="Target Instagram username")
    parser.add_argument("--targets-file", help="Optional file containing one target username per line")
    parser.add_argument("--mode", choices=["followers", "following", "both"], default="both")
    parser.add_argument("--delay", type=int, default=15, help="Delay between GraphQL pages, in seconds")
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--max-pages", type=int, default=None, help="Optional safety stop for testing")
    parser.add_argument("--limit-items", type=int, default=None, help="Stop after collecting N unique users per list")
    parser.add_argument("--resume", action="store_true", help="Resume from per-target checkpoint files when present")
    parser.add_argument("--output-dir", default=None, help="Output directory; defaults to ./exports")
    args = parser.parse_args()

    targets = load_targets(args)
    if not targets:
        log("Missing target or --targets-file")
        sys.exit(1)

    ig_user = os.environ.get("IG_USERNAME", "").strip()
    ig_pass = os.environ.get("IG_PASSWORD", "").strip()

    if not ig_user or not ig_pass:
        log("Missing IG_USERNAME or IG_PASSWORD")
        sys.exit(1)

    driver = build_driver(args.headless)

    try:
        login_instagram(driver, ig_user, ig_pass)

        exports_dir = Path(args.output_dir).resolve() if args.output_dir else Path(__file__).resolve().parent.parent / "exports"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        modes = ["followers", "following"] if args.mode == "both" else [args.mode]

        for target_index, target in enumerate(targets):
            log(f"=== Target {target_index + 1}/{len(targets)}: @{target} ===")
            user_id = get_profile_user_id(driver, target)

            for mode_index, mode in enumerate(modes):
                base = exports_dir / f"{target}_{mode}_graphql_{timestamp}"
                checkpoint_path = f"{base}.partial.json"
                if args.resume:
                    existing_checkpoint = latest_checkpoint(exports_dir, target, mode)
                    if existing_checkpoint:
                        checkpoint_path = str(existing_checkpoint)
                        checkpoint_name = existing_checkpoint.name.removesuffix(".partial.json")
                        base = existing_checkpoint.parent / checkpoint_name
                payload = fetch_list(
                    driver,
                    user_id,
                    target,
                    mode,
                    args.delay,
                    args.max_pages,
                    limit_items=args.limit_items,
                    checkpoint_path=checkpoint_path,
                    resume=args.resume,
                )
                save_csv(payload["items"], f"{base}.csv")
                save_json(payload, f"{base}.json")

                if (
                    not payload.get("is_preview")
                    and payload["total_reported"] is not None
                    and payload["total_collected"] != payload["total_reported"]
                ):
                    log(
                        f"Warning: collected {payload['total_collected']} unique users, "
                        f"public total reports {payload['total_reported']}"
                    )

                if mode_index != len(modes) - 1 or target_index != len(targets) - 1:
                    time.sleep(args.delay)

        log("Done. Import the generated CSV files with npm run import:ig-export.")
    finally:
        driver.quit()


if __name__ == "__main__":
    main()
