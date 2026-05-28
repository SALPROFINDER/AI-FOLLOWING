#!/usr/bin/env python3
import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from bs4 import BeautifulSoup

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
        print("Logging in...")
        driver.get("https://www.instagram.com/accounts/login/")
        time.sleep(5)
        
        # Cookie consent
        cookie_xpaths = ["//button[contains(text(),'Autoriser tous les cookies')]", "//button[contains(text(),'Allow all cookies')]"]
        for xpath in cookie_xpaths:
            buttons = driver.find_elements(By.XPATH, xpath)
            if buttons:
                buttons[0].click()
                time.sleep(2)
                break
                
        # Enter credentials
        usr_input = driver.find_element(By.CSS_SELECTOR, "input[name='email']")
        pwd_input = driver.find_element(By.CSS_SELECTOR, "input[name='pass']")
        usr_input.send_keys(username)
        pwd_input.send_keys(password)
        time.sleep(1)
        
        # Submit
        submit = driver.find_element(By.XPATH, "//div[@role='button'][contains(., 'Se connecter') or contains(., 'Log In')]")
        submit.click()
        time.sleep(10)
        
        print("Navigating to profile...")
        driver.get("https://www.instagram.com/profilefinder.ai/")
        time.sleep(5)
        
        # Inspect DOM around profile elements
        html = driver.page_source
        soup = BeautifulSoup(html, "html.parser")
        
        # Find elements containing followers/following counts/texts
        # For instance: "3 329 followers", "256 suivi(e)s"
        # We can look for links/headers/spans with specific class names or parents
        print("\nSearching for links containing 'follower' or 'suivi' or 'following'...")
        links = soup.find_all("a")
        for i, a in enumerate(links):
            href = a.get("href", "")
            text = a.text.strip()
            print(f"Link {i}: href={href}, text='{text}', classes={a.get('class')}")
            
    except Exception as e:
        print("Error:", e)
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
