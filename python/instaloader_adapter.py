import sys
import instaloader
from shared import print_result, print_error

def main():
    if len(sys.argv) < 2:
        print_error("instaloader", "unknown", "error", "Missing username argument")
        return

    username = sys.argv[1]
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False
    )
    
    try:
        profile = instaloader.Profile.from_username(L.context, username)
        
        raw_data = {
            "is_private": profile.is_private,
            "is_verified": profile.is_verified,
            "biography": profile.biography,
            "external_url": profile.external_url
        }
        
        status = "success"
        if profile.is_private:
            status = "private"

        print_result(
            provider="instaloader",
            username=username,
            followers_count=profile.followers,
            following_count=profile.followees,
            posts_count=profile.mediacount,
            status=status,
            raw=raw_data
        )

    except instaloader.exceptions.ProfileNotExistsException as e:
        print_error("instaloader", username, "not_found", f"Profile does not exist: {e}")
    except instaloader.exceptions.ConnectionException as e:
        err_msg = str(e)
        if "429" in err_msg or "Too Many Requests" in err_msg:
            print_error("instaloader", username, "rate_limited", f"Rate limited: {e}")
        elif "login" in err_msg.lower() or "login_required" in err_msg.lower():
            print_error("instaloader", username, "auth_required", f"Authentication required: {e}")
        else:
            print_error("instaloader", username, "error", f"Connection error: {e}")
    except instaloader.exceptions.LoginRequiredException as e:
        print_error("instaloader", username, "auth_required", f"Login required to view profile: {e}")
    except instaloader.exceptions.PrivateProfileNotViewableException as e:
        # Profile is private and not followed
        print_error("instaloader", username, "private", f"Private profile: {e}")
    except Exception as e:
        print_error("instaloader", username, "error", f"Unexpected error: {e}")

if __name__ == "__main__":
    main()
