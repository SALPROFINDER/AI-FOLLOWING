import json
import sys
import time

def print_result(provider, username, followers_count=None, following_count=None, posts_count=None, status="success", error_message=None, raw=None):
    result = {
        "provider": provider,
        "platform": "instagram",
        "username": username,
        "followersCount": followers_count,
        "followingCount": following_count,
        "postsCount": posts_count,
        "status": status,
        "errorMessage": error_message,
        "raw": raw or {}
    }
    print(json.dumps(result))
    sys.exit(0)

def print_error(provider, username, status, error_message, raw=None):
    print_result(
        provider=provider,
        username=username,
        status=status,
        error_message=str(error_message),
        raw=raw
    )
