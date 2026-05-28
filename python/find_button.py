#!/usr/bin/env python3
from bs4 import BeautifulSoup

def main():
    try:
        with open("exports/login_page_source.html", "r", encoding="utf-8") as f:
            html = f.read()
        
        soup = BeautifulSoup(html, "html.parser")
        
        # Find elements containing 'Se connecter' or with class/id related to submit
        buttons = soup.find_all(text=lambda t: t and "Se connecter" in t)
        print(f"Elements containing 'Se connecter': {len(buttons)}")
        for idx, btn in enumerate(buttons):
            parent = btn.parent
            print(f"Match {idx}: text='{btn.strip()}', parent tag={parent.name}, parent attrs={parent.attrs}")
            # print grandparent if useful
            if parent.parent:
                print(f"  Grandparent tag={parent.parent.name}, attrs={parent.parent.attrs}")
                
        # Also print all buttons
        all_btns = soup.find_all("button")
        print(f"\nAll <button> elements: {len(all_btns)}")
        for idx, btn in enumerate(all_btns):
            print(f"Button {idx}: text='{btn.text.strip()}', attrs={btn.attrs}")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
