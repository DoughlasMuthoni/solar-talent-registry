"""Generate Waterlift Solar SVG logos with all text converted to paths (no font dependency).
Usage: python make_logo.py <fonts_dir> <out_dir>
"""
import io, math, sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb

FONTS, OUT = sys.argv[1], sys.argv[2]

NAVY, SKY, ORANGE, WHITE = "#2E2A65", "#2CACE1", "#EF7F22", "#FFFFFF"


class Face:
    def __init__(self, path, wght):
        inst = instantiateVariableFont(TTFont(path), {"wght": wght})
        buf = io.BytesIO(); inst.save(buf); data = buf.getvalue()
        self.tt = TTFont(io.BytesIO(data))
        self.gs = self.tt.getGlyphSet()
        self.hb = hb.Font(hb.Face(data))
        self.cap = self.tt["OS/2"].sCapHeight

    def run(self, text, x, baseline, cap_px, tracking=0.0):
        """Return (svg_path_d, ink_bbox, advance_end_x) for text whose cap height is cap_px."""
        s = cap_px / self.cap
        buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
        hb.shape(self.hb, buf, {"kern": True})
        pen = SVGPathPen(self.gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        bp = BoundsPen(self.gs)
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            name = self.tt.getGlyphName(info.codepoint)
            t = (s, 0, 0, -s, x + pos.x_offset * s, baseline - pos.y_offset * s)
            self.gs[name].draw(TransformPen(pen, t))
            self.gs[name].draw(TransformPen(bp, t))
            x += pos.x_advance * s + tracking * cap_px
        return pen.getCommands(), bp.bounds, x


def fmt(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def drop_path(cx, base, w, cap):
    tip, bottom = base - 1.48 * cap, base + 0.10 * cap
    belly = base - 0.34 * cap
    r = w / 2
    pts = (f"M{fmt(cx)} {fmt(tip)}"
           f"C{fmt(cx + 0.10 * r)} {fmt(tip + 0.32 * cap)} {fmt(cx + r)} {fmt(belly - 0.55 * cap)} {fmt(cx + r)} {fmt(belly)}"
           f"C{fmt(cx + r)} {fmt(belly + 0.30 * cap)} {fmt(cx + 0.55 * r)} {fmt(bottom)} {fmt(cx)} {fmt(bottom)}"
           f"C{fmt(cx - 0.55 * r)} {fmt(bottom)} {fmt(cx - r)} {fmt(belly + 0.30 * cap)} {fmt(cx - r)} {fmt(belly)}"
           f"C{fmt(cx - r)} {fmt(belly - 0.55 * cap)} {fmt(cx - 0.10 * r)} {fmt(tip + 0.32 * cap)} {fmt(cx)} {fmt(tip)}Z")
    return pts, (cx - r, tip, cx + r, bottom)


def bolt_path(x, base, cap):
    p = [(0.56, -1.20), (0.12, -0.46), (0.34, -0.46), (0.04, 0.03), (0.62, -0.70), (0.39, -0.70)]
    pts = [(x + a * cap, base + b * cap) for a, b in p]
    d = "M" + "L".join(f"{fmt(a)} {fmt(b)}" for a, b in pts) + "Z"
    xs, ys = [a for a, _ in pts], [b for _, b in pts]
    return d, (min(xs), min(ys), max(xs), max(ys))


def cubic(p, u):
    return tuple((1 - u) ** 3 * p[0][i] + 3 * (1 - u) ** 2 * u * p[1][i] + 3 * (1 - u) * u ** 2 * p[2][i] + u ** 3 * p[3][i] for i in (0, 1))


def wave_path(ctrl, thick, n=56):
    top, bot = [], []
    for k in range(n + 1):
        u = k / n
        x, y = cubic(ctrl, u)
        x2, y2 = cubic(ctrl, min(1, u + 1e-3)) if u < 1 else cubic(ctrl, u)
        x1, y1 = cubic(ctrl, max(0, u - 1e-3))
        dx, dy = x2 - x1, y2 - y1
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        h = thick / 2 * math.sin(math.pi * u) ** 0.55
        top.append((x + nx * h, y + ny * h)); bot.append((x - nx * h, y - ny * h))
    pts = top + bot[::-1]
    return "M" + "L".join(f"{fmt(a)} {fmt(b)}" for a, b in pts) + "Z"


def union(bbs):
    bbs = [b for b in bbs if b]
    return (min(b[0] for b in bbs), min(b[1] for b in bbs), max(b[2] for b in bbs), max(b[3] for b in bbs))


black = Face(os.path.join(FONTS, "Montserrat.ttf"), 900)
italic = Face(os.path.join(FONTS, "Montserrat-Italic.ttf"), 800)

CAP = 120.0
B1 = 0.0
gap = 0.05 * CAP

# ---------- Row 1: W [drop-A] TER L [bolt] FT ----------
parts = []  # (role, d)
x = 0.0
d, bb_w, x = black.run("W", x, B1, CAP); parts.append(("ink", d)); bbs = [bb_w]
# drop with white A
a_cap = 0.80 * CAP
_, a_bb, _ = black.run("A", 0, B1, a_cap)
a_w = a_bb[2] - a_bb[0]
drop_w = a_w * 1.38
x += gap
cx = x + drop_w / 2
dd, d_bb = drop_path(cx, B1, drop_w, CAP); parts.append(("sky", dd)); bbs.append(d_bb)
ad, _, _ = black.run("A", cx - a_w / 2 - a_bb[0], B1 - 0.07 * CAP, a_cap); parts.append(("knock", ad))
x = cx + drop_w / 2 + gap
d, bb, x = black.run("TER", x, B1, CAP); parts.append(("ink", d)); bbs.append(bb)
d, bb, x = black.run("L", x, B1, CAP); parts.append(("sky", d)); bbs.append(bb)
x -= 0.02 * CAP
bd, b_bb = bolt_path(x, B1, CAP); parts.append(("sun", bd)); bbs.append(b_bb)
x = b_bb[2] + 0.04 * CAP
d, bb, x = black.run("FT", x, B1, CAP); parts.append(("sky", d)); bbs.append(bb)
row1 = union(bbs)
L0, R0 = bb_w[0], row1[2]
W0 = R0 - L0

# ---------- Row 2: SOLAR ----------
CAP2 = 0.93 * CAP
B2 = B1 + 0.27 * CAP + CAP2
_, s_bb, _ = black.run("SOLAR", 0, B2, CAP2)
s_track = max(0.0, min(0.08, (0.62 * W0 - (s_bb[2] - s_bb[0])) / (4 * CAP2)))
_, s_bb, _ = black.run("SOLAR", 0, B2, CAP2, tracking=s_track)
sw = s_bb[2] - s_bb[0]
sx = L0 + (W0 - sw) / 2 - s_bb[0]
solar_d, solar_bb, _ = black.run("SOLAR", sx, B2, CAP2, tracking=s_track)

# ---------- Row 3: tagline, fitted to row-1 width ----------
TAG = "Equitable access to solar energy and borehole drilling"
_, t_bb, _ = italic.run(TAG, 0, 0, 100)
t_cap = 100 * (W0 * 0.985) / (t_bb[2] - t_bb[0])
B3 = B2 + 0.30 * CAP + t_cap
_, t_bb, _ = italic.run(TAG, 0, B3, t_cap)
tx = L0 + (W0 - (t_bb[2] - t_bb[0])) / 2 - t_bb[0]
tag_d, tag_bb, _ = italic.run(TAG, tx, B3, t_cap)

# ---------- Row 4: waves ----------
Y0 = tag_bb[3] + 0.12 * CAP
def P(u, v): return (L0 + u * W0, Y0 + v * CAP)
waves = [
    ("sky", wave_path([P(0.005, 0.00), P(0.14, 0.16), P(0.30, 0.15), P(0.44, 0.07)], 0.10 * CAP)),
    ("sun", wave_path([P(0.04, 0.24), P(0.24, 0.34), P(0.46, 0.10), P(0.68, 0.06)], 0.10 * CAP)),
    ("sky", wave_path([P(0.40, 0.38), P(0.62, 0.16), P(0.80, 0.28), P(0.995, 0.02)], 0.10 * CAP)),
]
wave_bb = (L0, Y0 - 0.06 * CAP, R0, Y0 + 0.42 * CAP)

full_bb = union([row1, solar_bb, tag_bb, wave_bb])
word_bb = union([row1, solar_bb])

THEMES = {"light": {"ink": NAVY, "tag": NAVY}, "dark": {"ink": WHITE, "tag": WHITE}}


def svg(bbox, layers, title, pad):
    x0, y0, x1, y1 = bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad
    w, h = x1 - x0, y1 - y0
    body = "\n".join(f'  <path fill="{fill}" d="{d}"/>' for fill, d in layers)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{fmt(x0)} {fmt(y0)} {fmt(w)} {fmt(h)}" '
            f'width="{round(w)}" height="{round(h)}" role="img" aria-labelledby="t">\n'
            f'  <title id="t">{title}</title>\n{body}\n</svg>\n')


def colour(role, theme):
    return {"ink": THEMES[theme]["ink"], "tag": THEMES[theme]["tag"], "sky": SKY, "sun": ORANGE, "knock": WHITE}[role]


os.makedirs(OUT, exist_ok=True)
for theme in ("light", "dark"):
    suffix = "" if theme == "light" else "-dark"
    row = [(colour(r, theme), d) for r, d in parts]
    solar = [(ORANGE, solar_d)]
    full = row + solar + [(colour("tag", theme), tag_d)] + [(colour(r, theme), d) for r, d in waves]
    open(os.path.join(OUT, f"waterlift-logo{suffix}.svg"), "w", encoding="utf-8").write(
        svg(full_bb, full, "Waterlift Solar — Equitable access to solar energy and borehole drilling", 0.12 * CAP))
    open(os.path.join(OUT, f"waterlift-wordmark{suffix}.svg"), "w", encoding="utf-8").write(
        svg(word_bb, row + solar, "Waterlift Solar", 0.08 * CAP))

# ---------- Mark: drop + A (favicon / collapsed sidebar), square ----------
mx0, my0, mx1, my1 = d_bb
side = max(mx1 - mx0, my1 - my0) * 1.12
mcx, mcy = (mx0 + mx1) / 2, (my0 + my1) / 2
mark_bb = (mcx - side / 2, mcy - side / 2, mcx + side / 2, mcy + side / 2)
open(os.path.join(OUT, "waterlift-mark.svg"), "w", encoding="utf-8").write(
    svg(mark_bb, [(SKY, dd), (WHITE, ad)], "Waterlift Solar", 0))
print("solar tracking", round(s_track, 3), "row1 width", round(W0), "full bbox", [round(v) for v in full_bb], "tagline cap", round(t_cap, 1))
