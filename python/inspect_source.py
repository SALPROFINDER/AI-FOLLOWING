#!/usr/bin/env python3
from bs4 import BeautifulSoup

def main():
    try:
        with open("exports/login_page_source.html", "r", encoding="utf-8") as f:
            html = f.read()
        
        soup = BeautifulSoup(html, "html.parser")
        print("Page Title:", soup.title.text if soup.title else "No title")
        
        # Check for forms
        forms = soup.find_all("form")
        print(f"\nFound {len(forms)} form(s):")
        for i, form in enumerate(forms):
            print(f"Form {i}: action={form.get('action')}, id={form.get('id')}, class={form.get('class')}")
            # print inputs in this form
            inputs = form.find_all("input")
            for inp in inputs:
                print(f"  Input: name={inp.get('name')}, type={inp.get('type')}, id={inp.get('id')}, placeholder={inp.get('placeholder')}")
                
        # Check for iframes
        iframes = soup.find_all("iframe")
        print(f"\nFound {len(iframes)} iframe(s):")
        for i, iframe in enumerate(iframes):
            print(f"Iframe {i}: src={iframe.get('src')}, name={iframe.get('name')}, id={iframe.get('id')}")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
