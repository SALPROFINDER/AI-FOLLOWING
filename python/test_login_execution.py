#!/usr/bin/env python3
import os
import sys
import time
import random
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def log(msg: str):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")

def main():
    username = os.environ.get("IG_USERNAME", "")
    password = os.environ.get("IG_PASSWORD", "")
    if not username or not password:
        raise RuntimeError("Missing IG_USERNAME or IG_PASSWORD")
    
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1280,900")
    chrome_options.add_argument("--lang=en-US")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        log("1. Navigating to Instagram login...")
        driver.get("https://www.instagram.com/accounts/login/")
        time.sleep(5)
        driver.save_screenshot("exports/step1_initial.png")
        
        # Cookie consent
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
                log(f"Closing cookie dialog via: {xpath}")
                buttons[0].click()
                time.sleep(3)
                driver.save_screenshot("exports/step2_cookies_closed.png")
                break
                
        # Find username field
        username_input = None
        for sel in ["input[name='username']", "input[name='email']", "input[type='text']"]:
            try:
                username_input = driver.find_element(By.CSS_SELECTOR, sel)
                log(f"Found username input with: {sel}")
                break
            except Exception:
                continue
                
        password_input = None
        for sel in ["input[name='password']", "input[name='pass']", "input[type='password']"]:
            try:
                password_input = driver.find_element(By.CSS_SELECTOR, sel)
                log(f"Found password input with: {sel}")
                break
            except Exception:
                continue
                
        if not username_input or not password_input:
            log("Error: Inputs not found!")
            return
            
        # Enter username
        username_input.clear()
        for char in username:
            username_input.send_keys(char)
            time.sleep(0.05)
            
        # Enter password
        password_input.clear()
        for char in password:
            password_input.send_keys(char)
            time.sleep(0.05)
            
        driver.save_screenshot("exports/step3_credentials_entered.png")
        
        # Click login button
        submit_btn = None
        
        # Try to find the div[role='button'] first since it's the visible one
        submit_selectors = [
            "//div[@role='button'][contains(., 'Se connecter') or contains(., 'Log In') or contains(., 'Log in')]",
            "div[role='button']",
            "button[type='submit']",
            "input[type='submit']"
        ]
        
        for sel in submit_selectors:
            try:
                if sel.startswith("//"):
                    submit_btn = driver.find_element(By.XPATH, sel)
                else:
                    submit_btn = driver.find_element(By.CSS_SELECTOR, sel)
                
                # Check if it is displayed
                if submit_btn.is_displayed():
                    log(f"Found visible submit button with: {sel}")
                    break
                else:
                    log(f"Found submit button with {sel} but it is hidden.")
                    submit_btn = None
            except Exception:
                continue
                
        if submit_btn:
            log("Clicking submit button...")
            try:
                # Wait for it to be active (aria-disabled should not be true, or just try to click)
                aria_disabled = submit_btn.get_attribute("aria-disabled")
                log(f"Button aria-disabled attribute: {aria_disabled}")
                submit_btn.click()
                log("Button click executed via Selenium.")
            except Exception as click_err:
                log(f"Selenium click failed: {click_err}, trying JS click fallback...")
                driver.execute_script("arguments[0].click();", submit_btn)
                log("Button click executed via JavaScript.")
        else:
            log("Submit button not found, pressing ENTER on password field...")
            password_input.send_keys(Keys.RETURN)
            
        # Wait and capture screenshots over next 15 seconds
        for sec in range(1, 16):
            time.sleep(1)
            if sec % 3 == 0 or sec == 15:
                url = driver.current_url
                log(f"Wait {sec}s: URL is {url}")
                driver.save_screenshot(f"exports/step4_login_wait_{sec}s.png")
                
        # Try to go to target profile
        log("Attempting to go to profile finder...")
        driver.get("https://www.instagram.com/profilefinder.ai/")
        time.sleep(5)
        log(f"Profile URL: {driver.current_url}")
        driver.save_screenshot("exports/step5_profile_page.png")
        
    except Exception as e:
        log(f"Error occurred: {e}")
    finally:
        driver.quit()
        log("Browser closed.")

if __name__ == "__main__":
    main()
