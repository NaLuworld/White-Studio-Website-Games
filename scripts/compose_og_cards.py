#!/usr/bin/env python3
"""
Compose Open Graph / Twitter Card images (1200×630) for the hub and each game.

Convention
----------
- Game logo/icon (square): assets/images/games/<game-id>/icon.png
  Temporary placeholder OK (e.g. cabinet art). Swap later without changing meta paths.
- Card output: assets/images/og/<id>.png  (+ .jpg fallback)
- Titles / paths: assets/images/og/manifest.json

Usage
-----
  python scripts/compose_og_cards.py
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets" / "images" / "og" / "manifest.json"
OUT_DIR = ROOT / "assets" / "images" / "og"
ZPIX = ROOT / "assets" / "fonts" / "zpix.ttf"
WS_LOGO = ROOT / "assets" / "images" / "white-studio-logo.png"

W, H = 1200, 630
ICON_BOX = 360
MARGIN = 56


def load_font(size: int, prefer_zpix: bool = True) -> ImageFont.ImageFont:
    if prefer_zpix and ZPIX.exists():
        try:
            return ImageFont.truetype(str(ZPIX), size=size)
        except OSError:
            pass
    for name in (
        "C:/Windows/Fonts/seguiemj.ttf",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/arial.ttf",
    ):
        p = Path(name)
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def paint_backdrop() -> Image.Image:
    img = Image.new("RGB", (W, H), (7, 6, 12))
    draw = ImageDraw.Draw(img, "RGBA")
    # Purple neon washes
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-120, -180, 520, 420), fill=(138, 43, 226, 70))
    od.ellipse((700, -80, 1400, 480), fill=(180, 109, 255, 46))
    od.ellipse((200, 360, 980, 820), fill=(91, 33, 182, 40))
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")

    # Soft scanline grid
    grid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grid)
    for x in range(0, W, 40):
        gd.line([(x, 0), (x, H)], fill=(180, 109, 255, 18), width=1)
    for y in range(0, H, 40):
        gd.line([(0, y), (W, y)], fill=(180, 109, 255, 14), width=1)
    img = Image.alpha_composite(img.convert("RGBA"), grid).convert("RGB")
    return img


def fit_icon(path: Path, box: int) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    panel = Image.new("RGBA", (box, box), (18, 14, 28, 255))
    draw = ImageDraw.Draw(panel)
    draw.rounded_rectangle(
        (0, 0, box - 1, box - 1),
        radius=28,
        fill=(18, 14, 28, 255),
        outline=(180, 109, 255, 180),
        width=3,
    )

    pad = 36
    inner = box - pad * 2
    sw, sh = src.size
    scale = min(inner / sw, inner / sh)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    ox = (box - nw) // 2
    oy = (box - nh) // 2
    panel.alpha_composite(resized, (ox, oy))
    return panel


def draw_text_block(
    draw: ImageDraw.ImageDraw,
    *,
    x: int,
    y: int,
    max_width: int,
    title: str,
    subtitle: str | None,
    description: str,
    site_line: str,
) -> None:
    title_font = load_font(54)
    sub_font = load_font(28)
    body_font = load_font(22)
    site_font = load_font(18)

    draw.text((x, y), title, font=title_font, fill=(244, 243, 251))
    cursor = y + 70
    if subtitle:
        draw.text((x, cursor), subtitle, font=sub_font, fill=(192, 132, 255))
        cursor += 44

    # Wrap description
    words = description.split()
    lines: list[str] = []
    line = ""
    for word in words:
        trial = (line + " " + word).strip()
        if draw.textlength(trial, font=body_font) <= max_width:
            line = trial
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    for i, ln in enumerate(lines[:4]):
        draw.text((x, cursor + i * 30), ln, font=body_font, fill=(185, 182, 206))

    draw.text((x, H - MARGIN - 28), site_line, font=site_font, fill=(180, 109, 255))


def compose_card(
    *,
    card_id: str,
    title: str,
    subtitle: str | None,
    description: str,
    icon_path: Path,
    site_name: str,
    origin: str,
    path: str,
) -> Path:
    img = paint_backdrop().convert("RGBA")
    draw = ImageDraw.Draw(img)

    # Brand chip
    if WS_LOGO.exists():
        logo = Image.open(WS_LOGO).convert("RGBA")
        logo = logo.resize((44, 44), Image.Resampling.LANCZOS)
        img.alpha_composite(logo, (MARGIN, MARGIN - 4))
    brand_font = load_font(22)
    draw.text((MARGIN + 56, MARGIN + 4), site_name, font=brand_font, fill=(244, 243, 251))

    # Icon slot (reserved for game logo / icon)
    icon = fit_icon(icon_path, ICON_BOX)
    icon_x = MARGIN
    icon_y = (H - ICON_BOX) // 2 + 18
    # Drop shadow
    shadow = Image.new("RGBA", (ICON_BOX + 24, ICON_BOX + 24), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((8, 12, ICON_BOX + 8, ICON_BOX + 16), radius=32, fill=(0, 0, 0, 110))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    img.alpha_composite(shadow, (icon_x - 8, icon_y - 4))
    img.alpha_composite(icon, (icon_x, icon_y))

    text_x = icon_x + ICON_BOX + 48
    max_w = W - text_x - MARGIN
    draw_text_block(
        ImageDraw.Draw(img),
        x=text_x,
        y=icon_y + 24,
        max_width=max_w,
        title=title,
        subtitle=subtitle,
        description=description,
        site_line=origin.replace("https://", "") + ("" if path == "/" else path.rstrip("/")),
    )

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    png_path = OUT_DIR / f"{card_id}.png"
    jpg_path = OUT_DIR / f"{card_id}.jpg"
    rgb = img.convert("RGB")
    rgb.save(png_path, "PNG", optimize=True)
    rgb.save(jpg_path, "JPEG", quality=88, optimize=True)
    print(f"wrote {png_path.relative_to(ROOT)} ({png_path.stat().st_size // 1024} KB)")
    return png_path


def main() -> None:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    site_name = data["site_name"]
    origin = data["site_origin"]

    hub = data["hub"]
    compose_card(
        card_id="hub",
        title=hub["title"],
        subtitle=hub.get("subtitle"),
        description=hub["description"],
        icon_path=ROOT / hub["icon"],
        site_name=site_name,
        origin=origin,
        path=hub["path"],
    )

    for game in data.get("games", []):
        title = game["title"]
        subtitle = game.get("title_en")
        compose_card(
            card_id=game["id"],
            title=title,
            subtitle=subtitle,
            description=game["description"],
            icon_path=ROOT / game["icon"],
            site_name=site_name,
            origin=origin,
            path=game["path"],
        )


if __name__ == "__main__":
    main()
