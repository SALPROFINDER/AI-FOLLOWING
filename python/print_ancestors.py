#!/usr/bin/env python3
from bs4 import BeautifulSoup

def main():
    try:
        with open("exports/login_page_source.html", "r", encoding="utf-8") as f:
            html = f.read()
        
        soup = BeautifulSoup(html, "html.parser")
        
        # Find Match 1: text='Se connecter' (exactly)
        spans = soup.find_all("span")
        target_span = None
        for span in spans:
            if span.text.strip() == "Se connecter":
                target_span = span
                break
                
        if not target_span:
            print("Target span not found")
            return
            
        print("Tracing ancestors of 'Se connecter' span:")
        curr = target_span
        depth = 0
        while curr:
            print(f"{'  ' * depth}Tag: {curr.name}, attrs: {curr.attrs}")
            curr = curr.parent
            depth += 1
            if depth > 10:
                break
                
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
