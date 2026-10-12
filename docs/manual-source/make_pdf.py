import sys, pathlib
from playwright.sync_api import sync_playwright
src = pathlib.Path(sys.argv[1]).resolve()
out = sys.argv[2]
FOOTER = """<div style="width:100%;font:7.5pt Inter,Segoe UI,Arial,sans-serif;color:#5B5F7A;padding:0 16mm;display:flex;justify-content:space-between">
<span>Solar Talent Registry · User manual</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>"""
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge")
    pg = b.new_page()
    pg.goto(src.as_uri()); pg.wait_for_load_state("networkidle"); pg.evaluate("document.fonts.ready")
    pg.wait_for_timeout(800)
    pg.pdf(path=out, format="A4", print_background=True, prefer_css_page_size=True,
           display_header_footer=True, header_template="<span></span>", footer_template=FOOTER)
    b.close()
print("ok")
