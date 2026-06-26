from playwright.sync_api import sync_playwright
import pathlib
out = pathlib.Path(r"D:\Kwan\ropa-nextjs")
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page(viewport={"width": 1500, "height": 950}, device_scale_factor=2)
    pg.on("dialog", lambda d: d.accept())
    pg.goto("https://ropa-nextjs.vercel.app/", wait_until="domcontentloaded")
    pg.wait_for_selector("input[type=password]", timeout=30000)
    pg.fill("input[type=password]", "123"); pg.click("text=Sign In")
    pg.wait_for_selector("text=เพิ่มรายการใหม่", timeout=40000); pg.wait_for_timeout(1000)

    groups = pg.query_selector_all(".tb-group")
    labels = [g.get_attribute("data-label") for g in groups]
    print("toolbar groups:", labels)
    pg.query_selector(".toolbar").screenshot(path=str(out / "_toolbar.png"))

    # drilldown: ตามบริษัท → ขยายบริษัท → คลิกฝ่าย → ต้องเห็น record (grec>0)
    pg.click("button:has-text('ตามบริษัท')"); pg.wait_for_timeout(500)
    pg.query_selector_all("tr.group-head")[0].click(); pg.wait_for_timeout(400)
    g0 = len(pg.query_selector_all("tr.grec"))
    pg.query_selector_all("tr.group-sub")[0].click(); pg.wait_for_timeout(400)
    g1 = len(pg.query_selector_all("tr.grec"))
    print(f"grec หลังขยายบริษัท={g0} (ควร 0) · หลังคลิกฝ่าย={g1} (ควร >0 = คลิกขยาย record ได้)")
    b.close()
