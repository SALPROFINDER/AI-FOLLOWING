#!/usr/bin/env python3
import os
import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

def main():
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1280,900")
    chrome_options.add_argument("--lang=en-US")
    chrome_options.add_argument("user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
    
    driver = webdriver.Chrome(options=chrome_options)
    try:
        print("Navigating to login page...")
        driver.get("https://www.instagram.com/accounts/login/")
        time.sleep(5)
        
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
                print(f"Closing cookie dialog via: {xpath}")
                buttons[0].click()
                time.sleep(3)
                break
                
        # Find inputs
        inputs = driver.find_elements(By.TAG_NAME, "input")
        print(f"Found {len(inputs)} input elements:")
        for idx, inp in enumerate(inputs):
            name = inp.get_attribute("name")
            type_attr = inp.get_attribute("type")
            placeholder = inp.get_attribute("placeholder")
            class_attr = inp.get_attribute("class")
            id_attr = inp.get_attribute("id")
            print(f"Input {idx}: id={id_attr}, name={name}, type={type_attr}, placeholder={placeholder}, class={class_attr}")
            
        # Write page source
        with open("exports/login_page_source.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
        print("Page source written to exports/login_page_source.html")
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    main()
