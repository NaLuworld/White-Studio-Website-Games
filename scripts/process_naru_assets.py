"""Publish Naru atlases from pre-keyed (alpha) sources under images/naru/catgirl/."""
from PIL import Image
from pathlib import Path

ROOT = Path(r"D:\Projects\White-Studio-Website-Games\assets\images\naru")
SRC = ROOT / "catgirl"
OUT = ROOT
RAW_CANON = ROOT / "_raw" / "catgirl"


def save_sheet(src_name: str, out_stem: str) -> None:
    src = SRC / src_name
    im = Image.open(src).convert("RGBA")
    png = OUT / f"{out_stem}.png"
    webp = OUT / f"{out_stem}.webp"
    im.save(png, optimize=True)
    im.save(webp, "WEBP", quality=90, method=6)
    # Keep canonical raw copy (already alpha — no green)
    RAW_CANON.mkdir(parents=True, exist_ok=True)
    im.save(RAW_CANON / src_name, optimize=True)
    print(f"{out_stem:28} {im.size} png={png.stat().st_size/1024:.0f}KB webp={webp.stat().st_size/1024:.0f}KB")


def save_anchor() -> None:
    src = SRC / "naru-style-anchor-512.png"
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if bbox:
        pad = 8
        x0, y0, x1, y1 = bbox
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(im.width, x1 + pad)
        y1 = min(im.height, y1 + pad)
        cropped = im.crop((x0, y0, x1, y1))
    else:
        cropped = im
    cropped.save(OUT / "naru-style-anchor.png", optimize=True)
    cropped.save(OUT / "naru-style-anchor.webp", "WEBP", quality=90, method=6)
    RAW_CANON.mkdir(parents=True, exist_ok=True)
    im.save(RAW_CANON / "naru-style-anchor-512.png", optimize=True)
    print(f"{'naru-style-anchor':28} {cropped.size}")


def main() -> None:
    if not SRC.is_dir():
        raise SystemExit(f"Missing source folder: {SRC}")
    save_anchor()
    save_sheet("naru-core-c8r4-96.png", "naru-core-c8r4-96")
    save_sheet("naru-guide-c8r4-96.png", "naru-guide-c8r4-96")
    save_sheet("naru-react-c8r3-96.png", "naru-react-c8r3-96")


if __name__ == "__main__":
    main()
