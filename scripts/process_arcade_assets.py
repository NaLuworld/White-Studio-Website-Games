from PIL import Image
import numpy as np
from pathlib import Path

root = Path(r"D:\Projects\White-Studio-Website-Games\assets\images\arcade")
raw = root / "_raw"
out = root

cab_src = Image.open(raw / "arcade-cabinet-key-1536x2048.png").convert("RGBA")
arr = np.asarray(cab_src).astype(np.float32)
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
out_arr = np.stack([r, g2, b, alpha], axis=-1).astype(np.uint8)
cab = Image.fromarray(out_arr, "RGBA")
bbox = cab.getbbox()
if bbox:
    pad = 12
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(cab.width, x1 + pad)
    y1 = min(cab.height, y1 + pad)
    cab = cab.crop((x0, y0, x1, y1))
cab.save(out / "cabinet-snake.png", optimize=True)
cab.save(out / "cabinet-snake.webp", "WEBP", quality=82, method=6)

desk = Image.open(raw / "arcade-lobby-desktop-3840x2160.png").convert("RGB")
desk_hi = desk.resize((2560, 1440), Image.Resampling.LANCZOS)
desk_hi.save(out / "lobby-desktop.webp", "WEBP", quality=80, method=6)
desk_hi.save(out / "lobby-desktop.jpg", "JPEG", quality=82, optimize=True)

mob = Image.open(raw / "arcade-lobby-mobile-2160x3840.png").convert("RGB")
mob_hi = mob.resize((1440, 2560), Image.Resampling.LANCZOS)
mob_hi.save(out / "lobby-mobile.webp", "WEBP", quality=78, method=6)
mob_hi.save(out / "lobby-mobile.jpg", "JPEG", quality=80, optimize=True)

Image.open(raw / "arcade-style-anchor-2048.png").convert("RGB").save(
    out / "style-anchor.webp", "WEBP", quality=85, method=6
)

for p in sorted(out.glob("*")):
    if p.is_file():
        im = Image.open(p)
        print(f"{p.name:28} {p.stat().st_size / 1024:.1f} KB  {im.size}")
