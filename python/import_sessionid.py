#!/usr/bin/env python3
"""
import_sessionid.py — Manually create an Instaloader session using browser cookies.
Use only with your own Instagram account when you want Instaloader to reuse an
already authenticated browser session.

Usage:
    python import_sessionid.py <username> <sessionid> [ds_user_id] [csrftoken]
"""

import sys
import instaloader

def main():
    if len(sys.argv) < 3:
        print("Usage: python import_sessionid.py <username> <sessionid> [ds_user_id] [csrftoken]")
        sys.exit(1)

    username = sys.argv[1].strip().lstrip("@").lower()
    sessionid = sys.argv[2].strip()
    
    # Extract ds_user_id from sessionid if not explicitly provided
    # The sessionid cookie often starts with the user ID, e.g. "5948301%..."
    if len(sys.argv) > 3:
        ds_user_id = sys.argv[3].strip()
    else:
        if "%" in sessionid:
            ds_user_id = sessionid.split("%")[0]
        elif ":" in sessionid:
            ds_user_id = sessionid.split(":")[0]
        else:
            ds_user_id = ""
            print("⚠️ Warning: Could not auto-detect ds_user_id. Please pass it as the 3rd argument.")

    csrftoken = sys.argv[4].strip() if len(sys.argv) > 4 else "missing"

    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )

    # Set cookies on the session
    L.context._session.cookies.set("sessionid", sessionid, domain=".instagram.com")
    if ds_user_id:
        L.context._session.cookies.set("ds_user_id", ds_user_id, domain=".instagram.com")
    if csrftoken != "missing":
        L.context._session.cookies.set("csrftoken", csrftoken, domain=".instagram.com")

    # Also set common headers to match a real browser request
    L.context._session.headers.update({
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "referer": "https://www.instagram.com/"
    })

    print(f"🔑 Generating session file for @{username} using provided sessionid...")
    try:
        # Test if the session is valid
        profile = instaloader.Profile.from_username(L.context, username)
        print(f"✅ Success! Connected as @{username} (Profile: {profile.followers} followers).")
        
        # Save session
        L.save_session_to_file(username)
        print(f"💾 Session file saved to Instaloader config directory.")
        print(f"🚀 You can now run the scraper with: ")
        print(f"   .venv/bin/python python/fetch_followers.py profilefinder.ai")
    except Exception as e:
        print(f"❌ Connection test failed with these cookies: {e}")
        print("Please check that your sessionid is correct and has not expired.")
        sys.exit(1)

if __name__ == "__main__":
    main()
