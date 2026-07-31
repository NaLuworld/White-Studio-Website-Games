"""Chroma-key Naru sprite sheets. Preserves exact atlas dimensions (no crop on sheets)."""
from PIL import Image
import numpy as np
from pathlib import Path

ROOT = Path(r"D:\Projects\White-Studio-Website-Games\assets\images\naru")
RAW = ROOT / "_raw" / "catgirl"
OUT = ROOT


def chroma_key(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).astype(np.float32)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    greenness = g - np.maximum(r, b)
    alpha = np.ones_like(g) * 255.0
    mask_hard = (greenness > 40) & (g > 90) & (g > r + 25) & (g > b + 25)
    mask_soft = (greenness > 18) & (g > 70) & (g > r + 10) & (g > b + 10)
    alpha[mask_soft] = np.clip(255 - (greenness[mask_soft] - 18) * 8, 0, 255)
    alpha[mask_hard] = 0
    spill = mask_soft & ~mask_hard
    g2 = g.copy()
    g2[spill] = np.minimum(g2[spill], np.maximum(r[spill], b[spill]) + 8)
    out = np.stack([r, g2, b, alpha], axis=-1).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def process_sheet(name: str, quality: int = 90) -> None:
    src = RAW / name
    keyed = chroma_key(Image.open(src))
    stem = Path(name).stem
    # Keep full atlas size for CSS background-position clipping.
    png_path = OUT / f"{stem}.png"
    webp_path = OUT / f"{stem}.webp"
    keyed.save(png_path, optimize=True)
    keyed.save(webp_path, "WEBP", quality=quality, method=6)
    print(f"{stem:32} {keyed.size}  png={png_path.stat().st_size/1024:.0f}KB webp={webp_path.stat().st_size/1024:.0f}KB")


def process_anchor() -> None:
    src = RAW / "naru-style-anchor-512.png"
    keyed = chroma_key(Image.open(src))
    bbox = keyed.getbbox()
    if bbox:
        pad = 8
        x0, y0, x1, y1 = bbox
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(keyed.width, x1 + pad)
        y1 = min(keyed.height, y1 + pad)
        keyed = keyed.crop((x0, y0, x1, y1))
    keyed.save(OUT / "naru-style-anchor.png", optimize=True)
    keyed.save(OUT / "naru-style-anchor.webp", "WEBP", quality=90, method=6)
    print(f"{'naru-style-anchor':32} {keyed.size}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    process_anchor()
    process_sheet("naru-core-c8r4-96.png")
    process_sheet("naru-guide-c8r4-96.png")
    process_sheet("naru-react-c8r3-96.png")


if __name__ == "__main__":
    main()
