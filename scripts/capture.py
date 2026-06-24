# -*- coding: utf-8 -*-
"""ถ่าย screenshot ทุกฟังก์ชันจากแอปจริงสำหรับคู่มือ -> docs/img/*.png"""
import re, traceback
from playwright.sync_api import sync_playwright

URL = "https://ropa-nextjs.vercel.app/"
EMAIL = "Chaloemkwanl@bts.co.th"; PWD = "123"
IMG = "docs/img/"
ok, fail = [], []

def main():
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        pg = b.new_page(viewport={"width":1440,"height":900}, device_scale_factor=1.5)
        pg.on("dialog", lambda d: d.accept())  # auto-accept confirm() เพื่อไม่ค้าง
        pg.set_default_timeout(15000)

        def shot(name):
            pg.wait_for_timeout(700)
            pg.screenshot(path=IMG+name+".png"); ok.append(name)
        def step(label):  # คลิกขั้นใน sidebar (goStep ไม่ validate)
            pg.locator(".steps .step", has_text=label).first.click(); pg.wait_for_timeout(500)
        def pick(text):   # คลิก radio/checkbox label ใน panel
            pg.locator(".panel").get_by_text(text, exact=True).first.click(); pg.wait_for_timeout(400)
        def block(fn, tag):
            try: fn()
            except Exception as e:
                fail.append(tag+": "+str(e)[:120]);
                try: pg.keyboard.press("Escape")
                except: pass

        # 1 login
        pg.goto(URL, wait_until="networkidle", timeout=60000); pg.wait_for_timeout(1200)
        shot("01-login")
        pg.fill("input[type=password]", PWD); pg.click("text=Sign In")
        pg.wait_for_selector("text=เพิ่มรายการใหม่", timeout=60000); pg.wait_for_timeout(1500)
        shot("02-list")

        # 3 grouped
        def g():
            pg.get_by_role("button", name=re.compile("จัดกลุ่ม")).click(); pg.wait_for_timeout(800); shot("03-list-grouped")
            pg.get_by_role("button", name=re.compile("จัดกลุ่ม")).click(); pg.wait_for_timeout(500)
        block(g, "grouped")
        # 4 search
        def s():
            inp = pg.locator(".toolbar .search input")
            inp.fill("การให้บริการ"); pg.wait_for_timeout(800); shot("04-search"); inp.fill("")
        block(s, "search")

        # 5 recorder modal
        def rec():
            pg.get_by_role("button", name=re.compile("เพิ่มรายการใหม่")).click()
            pg.wait_for_selector("text=รายละเอียดผู้บันทึก", timeout=15000); pg.wait_for_timeout(500); shot("05-recorder")
            tx = pg.locator(".overlay input[type=text]")
            tx.nth(0).fill("สมชาย"); tx.nth(1).fill("ใจดี")
            pg.get_by_role("button", name="ยืนยัน").click()
            pg.wait_for_selector(".wizard", timeout=15000); pg.wait_for_timeout(900)
        block(rec, "recorder")

        # 6 wizard s1
        block(lambda: shot("06-wizard-s1"), "s1")
        # 7 s2
        block(lambda:(step("การเก็บรวบรวม"), shot("07-wizard-s2")), "s2")
        # 8-9 s3 + editor
        def s3():
            step("การใช้ภายใน"); pick("มีการแบ่งปัน"); shot("08-wizard-s3")
            pg.get_by_role("button", name=re.compile("เพิ่มฝ่ายงานที่แบ่งปัน")).click()
            pg.wait_for_timeout(700); shot("09-s3-editor")
            pg.get_by_role("button", name="ยกเลิก").last.click(); pg.wait_for_timeout(400)
        block(s3, "s3")
        # 10-11 s4 + editor
        def s4():
            step("การเปิดเผย"); pick("มีการเปิดเผย"); shot("10-wizard-s4")
            pg.get_by_role("button", name=re.compile("เพิ่มผู้รับข้อมูล")).click()
            pg.wait_for_timeout(700); shot("11-s4-editor")
            pg.get_by_role("button", name="ยกเลิก").last.click(); pg.wait_for_timeout(400)
        block(s4, "s4")
        # 12 s5
        def s5():
            step("โอนต่างประเทศ"); pick("มีการส่งออกนอกประเทศ"); shot("12-wizard-s5")
        block(s5, "s5")
        # 13-14 s6 + editor
        def s6():
            step("การเก็บรักษา"); pick("มีการจัดเก็บ"); shot("13-wizard-s6")
            pg.get_by_role("button", name=re.compile("เพิ่มประเภทการเก็บรักษา")).click()
            pg.wait_for_timeout(700); shot("14-s6-editor")
            pg.get_by_role("button", name="ยกเลิก").last.click(); pg.wait_for_timeout(400)
        block(s6, "s6")
        # 15 s7
        block(lambda:(step("การเข้าถึง"), shot("15-wizard-s7")), "s7")
        # 24 reject modal (admin)
        def rej():
            pg.get_by_role("button", name=re.compile("Reject")).click()
            pg.wait_for_timeout(700); shot("24-reject")
            pg.get_by_role("button", name="ยกเลิก").last.click(); pg.wait_for_timeout(400)
        block(rej, "reject")

        # exit wizard -> list
        block(lambda: pg.get_by_role("button", name=re.compile("กลับสู่รายการ")).first.click(), "exit")
        pg.wait_for_selector("text=เพิ่มรายการใหม่", timeout=20000); pg.wait_for_timeout(800)

        # 16 data map
        def dm():
            pg.locator("button[title='Data Mapping Diagram']").first.click()
            pg.wait_for_selector(".map-canvas", timeout=20000); pg.wait_for_timeout(1500); shot("16-datamap")
            pg.get_by_role("button", name=re.compile("ปิด")).first.click(); pg.wait_for_timeout(400)
        block(dm, "datamap")
        # 17 excel
        def xl():
            pg.get_by_role("button", name=re.compile("Export Excel")).click()
            pg.wait_for_timeout(800); shot("17-excel")
            pg.get_by_role("button", name="ยกเลิก").last.click(); pg.wait_for_timeout(400)
        block(xl, "excel")

        # 18-22 dashboard
        def dash():
            pg.get_by_role("button", name=re.compile("Dashboard")).click()
            pg.wait_for_selector("text=ภาพรวมผู้บริหาร", timeout=30000); pg.wait_for_timeout(2000)
            shot("18-dashboard-top")
            for tag, txt in [("19-dashboard-risk","ความเสี่ยง & Compliance"),
                             ("20-dashboard-coverage","ความครอบคลุม (Coverage)"),
                             ("21-dashboard-quality","ความครบถ้วน & คุณภาพข้อมูล"),
                             ("22-dashboard-tracking","การติดตามงาน & เฝ้าระวัง")]:
                try:
                    pg.get_by_text(txt, exact=False).first.scroll_into_view_if_needed(); pg.wait_for_timeout(900); shot(tag)
                except Exception as e: fail.append(tag+": "+str(e)[:80])
            pg.get_by_role("button", name=re.compile("กลับสู่รายการ")).first.click(); pg.wait_for_timeout(800)
        block(dash, "dashboard")

        # 23 users
        def usr():
            pg.get_by_role("button", name=re.compile("จัดการผู้ใช้")).click()
            pg.wait_for_selector("text=จัดการผู้ใช้", timeout=20000); pg.wait_for_timeout(1200); shot("23-users")
        block(usr, "users")

        b.close()

main()
print("OK:", len(ok), ok)
print("FAIL:", len(fail), fail)
