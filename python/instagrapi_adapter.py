import os
import sys
from shared import print_result, print_error

def main():
    if len(sys.argv) < 2:
        print_error("instagrapi_experimental", "unknown", "error", "Missing username argument")
        return

    target_username = sys.argv[1]

    enable_risky = os.environ.get("ENABLE_RISKY_PROVIDERS", "false").lower() == "true"
    ig_username = os.environ.get("IG_USERNAME", "").strip()
    ig_password = os.environ.get("IG_PASSWORD", "").strip()

    if not enable_risky:
        print_result(
            provider="instagrapi_experimental",
            username=target_username,
            status="skipped",
            error_message="ENABLE_RISKY_PROVIDERS is not set to true"
        )
        return

    if not ig_username or not ig_password:
        print_result(
            provider="instagrapi_experimental",
            username=target_username,
            status="skipped",
            error_message="Missing IG_USERNAME or IG_PASSWORD environment variables"
        )
        return

    try:
        from instagrapi import Client
        from instagrapi.exceptions import (
            ClientError, LoginRequired, ChallengeRequired,
            RateLimitError, UserNotFound
        )
    except ImportError as e:
        print_error("instagrapi_experimental", target_username, "error", f"instagrapi package not installed: {e}")
        return

    cl = Client()
    
    try:
        # Note: instagrapi login will try to perform auth
        cl.login(ig_username, ig_password)
    except ChallengeRequired as e:
        print_error("instagrapi_experimental", target_username, "auth_required", f"Challenge/verification required: {e}")
        return
    except LoginRequired as e:
        print_error("instagrapi_experimental", target_username, "auth_required", f"Login failed: {e}")
        return
    except RateLimitError as e:
        print_error("instagrapi_experimental", target_username, "rate_limited", f"Rate limit on login: {e}")
        return
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "rate" in err_msg.lower():
            print_error("instagrapi_experimental", target_username, "rate_limited", f"Rate limit on login: {e}")
        elif "login" in err_msg.lower():
            print_error("instagrapi_experimental", target_username, "auth_required", f"Auth failed on login: {e}")
        else:
            print_error("instagrapi_experimental", target_username, "error", f"Auth error: {e}")
        return

    try:
        user_info = cl.user_info_by_username(target_username)
        raw_data = {
            "pk": user_info.pk,
            "is_private": user_info.is_private,
            "is_verified": user_info.is_verified,
            "biography": user_info.biography
        }
        
        status = "success"
        if user_info.is_private:
            status = "private"

        print_result(
            provider="instagrapi_experimental",
            username=target_username,
            followers_count=user_info.follower_count,
            following_count=user_info.following_count,
            posts_count=user_info.media_count,
            status=status,
            raw=raw_data
        )
    except UserNotFound as e:
        print_error("instagrapi_experimental", target_username, "not_found", f"User not found: {e}")
    except RateLimitError as e:
        print_error("instagrapi_experimental", target_username, "rate_limited", f"Rate limited during fetch: {e}")
    except Exception as e:
        err_msg = str(e)
        if "429" in err_msg or "rate" in err_msg.lower():
            print_error("instagrapi_experimental", target_username, "rate_limited", f"Rate limited: {e}")
        elif "private" in err_msg.lower():
            print_error("instagrapi_experimental", target_username, "private", f"Profile is private: {e}")
        else:
            print_error("instagrapi_experimental", target_username, "error", f"Fetch error: {e}")

if __name__ == "__main__":
    main()
