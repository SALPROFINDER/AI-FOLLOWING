#!/usr/bin/env python3
import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
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
        log("Logging in...")
        driver.get("https://www.instagram.com/accounts/login/")
        time.sleep(5)
        
        cookie_xpaths = ["//button[contains(text(),'Autoriser tous les cookies')]", "//button[contains(text(),'Allow all cookies')]"]
        for xpath in cookie_xpaths:
            buttons = driver.find_elements(By.XPATH, xpath)
            if buttons:
                buttons[0].click()
                time.sleep(2)
                break
                
        usr_input = driver.find_element(By.CSS_SELECTOR, "input[name='email']")
        pwd_input = driver.find_element(By.CSS_SELECTOR, "input[name='pass']")
        usr_input.send_keys(username)
        pwd_input.send_keys(password)
        time.sleep(1)
        
        submit = driver.find_element(By.XPATH, "//div[@role='button'][contains(., 'Se connecter') or contains(., 'Log In')]")
        submit.click()
        time.sleep(8)
        
        log("Navigating to profile...")
        driver.get("https://www.instagram.com/profilefinder.ai/")
        time.sleep(5)
        
        log("Clicking followers link...")
        link = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.XPATH, "//a[contains(translate(., 'FOLLOWER', 'follower'), 'follower')]"))
        )
        link.click()
        time.sleep(3)
        
        driver.save_screenshot("exports/modal_opened.png")
        
        # Analyze dialog and list tags/classes inside it
        log("Analyzing elements inside div[role='dialog']...")
        dialog_info = driver.execute_script("""
            const dialogs = document.querySelectorAll('div[role="dialog"]');
            if (dialogs.length === 0) return "No dialog found!";
            
            const d = dialogs[0];
            const info = [];
            info.push("Dialog tag: " + d.tagName + ", class: " + d.className);
            
            // Look for divs with style containing overflow, scrollHeight, clientHeight
            const divs = d.querySelectorAll('div');
            let idx = 0;
            for (const div of divs) {
                const style = div.getAttribute('style') || '';
                if (div.scrollHeight > div.clientHeight || style.includes('overflow')) {
                    info.push(`Div ${idx}: id=${div.id}, class=${div.className}, style=${style}, scrollHeight=${div.scrollHeight}, clientHeight=${div.clientHeight}, scrollTop=${div.scrollTop}`);
                }
                idx++;
            }
            return info.join('\\n');
        """)
        print(dialog_info)
        
    except Exception as e:
        log(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
