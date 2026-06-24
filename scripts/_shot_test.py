# -*- coding: utf-8 -*-
from playwright.sync_api import sync_playwright
URL="https://ropa-nextjs.vercel.app/"
def run(ch):
    with sync_playwright() as p:
        b=p.chromium.launch(channel=ch, headless=True)
        pg=b.new_page(viewport={"width":1440,"height":900}, device_scale_factor=2)
        pg.goto(URL, wait_until="networkidle", timeout=60000)
        pg.wait_for_timeout(1200)
        pg.screenshot(path="docs/img/_t_login.png")
        # login
        pg.fill("input[type=password]","123")
        pg.click("text=Sign In")
        pg.wait_for_selector("text=เพิ่มรายการใหม่", timeout=60000)
        pg.wait_for_timeout(1500)
        pg.screenshot(path="docs/img/_t_list.png")
        b.close()
        print("OK with channel", ch)
try: run("chrome")
except Exception as e:
    print("chrome failed:", str(e)[:200]); run("msedge")
