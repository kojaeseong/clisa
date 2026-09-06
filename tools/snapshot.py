#!/usr/bin/env python3
"""Bake the current ledger numbers into index.html and the share card.

The page fetches the ledger with JavaScript, which readers see but crawlers and
link-preview bots usually do not. This runs after the 07:00 KST calculation and
writes the same numbers into the HTML as plain text, so a machine that only
reads the source sees what a person sees. JavaScript still overwrites them on
load, so nothing about the live page changes.

Nothing here widens what is public: only the figures the public feed already
serves (return, days, open/closed counts) are written.
"""
import csv, io, os, re, urllib.request
from datetime import datetime, timedelta, timezone

FEED = "https://kaqltuwwnegyidbygmdh.supabase.co/functions/v1/public"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KST = timezone(timedelta(hours=9))

def feed():
    req = urllib.request.Request(FEED, headers={"User-Agent": "clisa-snapshot"})
    rows = list(csv.DictReader(io.StringIO(urllib.request.urlopen(req, timeout=30).read().decode())))
    meta = {r["key"]: r["ko"] for r in rows if r["type"] == "meta"}
    hist = [(r["key"], float(r["ko"])) for r in rows if r["type"] == "history" and r["ko"]]
    return {
        "ret": hist[-1][1] if hist else None,
        "as_of": meta.get("asOf", hist[-1][0] if hist else ""),
        "public_since": meta.get("publicSince", ""),
        "open": sum(1 for r in rows if r["type"] == "open"),
        "closed": sum(1 for r in rows if r["type"] == "closed"),
    }

def pct(v):
    return "—" if v is None else f"{'+' if v > 0 else ''}{v:.2f}%"

def days_since(iso):
    if not iso:
        return 0
    start = datetime.strptime(iso, "%Y-%m-%d").replace(tzinfo=KST)
    return max(0, (datetime.now(KST) - start).days)

def patch(html, d):
    def span(sid, text):
        return (rf'(<span[^>]*id="{sid}"[^>]*>)[^<]*(</span>)', lambda m: m.group(1) + text + m.group(2))
    edits = [
        span("s-days", str(days_since(d["public_since"]))),
        span("s-hold", str(d["open"])),
        span("s-closed", str(d["closed"])),
        span("asof", f"as of {d['as_of']}"),
        (r'(<div class="big" id="c-val">).*?(</div>)', lambda m: m.group(1) + pct(d["ret"]) + m.group(2)),
        (r'(<meta property="og:description" content=")[^"]*(">)',
         lambda m: m.group(1) + (
             f"{pct(d['ret'])} since {d['public_since']} · {days_since(d['public_since'])} days on the record · "
             f"{d['open']} open, {d['closed']} closed. Real account, real judgments."
         ) + m.group(2)),
    ]
    for pattern, repl in edits:
        html, n = re.subn(pattern, repl, html, count=1, flags=re.S)
        if n != 1:
            raise SystemExit(f"snapshot: pattern not found -> {pattern}")
    return html

def card(d, path):
    from PIL import Image, ImageDraw, ImageFont
    W, H = 1200, 630
    bg, ink, muted, accent, ink_on = "#0F0D0B", "#F4EDE1", "#A89C8C", "#E5533B", "#FFF7F2"
    fp = "/usr/share/fonts/truetype/dejavu/DejaVuSans%s.ttf"
    bold, book = fp % "-Bold", fp % ""
    f = lambda p, s: ImageFont.truetype(p, s)
    im = Image.new("RGB", (W, H), bg)
    dr = ImageDraw.Draw(im)
    for i in range(H):                                   # ember wash toward the horizon
        t = max(0.0, (i / H - 0.45) / 0.55)
        dr.line([(0, i), (W, i)], fill=(int(15 + 32 * t), int(13 + 10 * t), int(11 + 8 * t)))
    dr.rectangle([80, 84, 176, 180], fill=accent)
    dr.text((110, 96), "C", font=f(bold, 74), fill=ink_on)
    dr.text((200, 100), "CLISA", font=f(bold, 60), fill=ink)
    dr.text((203, 168), "PUBLIC LEDGER", font=f(book, 22), fill=muted)
    dr.text((80, 268), pct(d["ret"]), font=f(bold, 132), fill=accent if (d["ret"] or 0) >= 0 else ink)
    dr.text((86, 424), f"since {d['public_since']}  ·  {days_since(d['public_since'])} days on the record", font=f(book, 30), fill=ink)
    dr.text((86, 474), f"{d['open']} open  ·  {d['closed']} closed  ·  as of {d['as_of']}", font=f(book, 26), fill=muted)
    dr.line([(80, 548), (W - 80, 548)], fill="#2C2621", width=2)
    dr.text((80, 566), "Real account, real judgments — clisa.ai", font=f(book, 24), fill=muted)
    im.save(path, "PNG", optimize=True)

if __name__ == "__main__":
    d = feed()
    p = os.path.join(ROOT, "index.html")
    out = patch(open(p, encoding="utf-8").read(), d)   # patch first: never truncate before it succeeds
    open(p, "w", encoding="utf-8").write(out)
    card(d, os.path.join(ROOT, "og.png"))
    print("snapshot:", pct(d["ret"]), d["as_of"], f"open {d['open']} closed {d['closed']}")
