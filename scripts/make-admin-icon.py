# Genera l'icona nera lucida della Super Dashboard (la "a" di Lia su fondo nero con riflesso).
# Uso: python3 scripts/make-admin-icon.py   (scrive in public/admin/icons/)
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import numpy as np, os

S = 1024
mark_src = Image.open("public/brand/favicon-512.png").convert("RGBA")
bb = mark_src.getbbox()
mark_src = mark_src.crop(bb)

def build(mark_ratio):
    # fondo: nero profondo con una leggera luce in alto a sinistra
    y, x = np.mgrid[0:S, 0:S].astype(np.float32)
    t = y / S
    base = 38 * (1 - t) ** 1.6                      # da grigio scurissimo a nero
    glow = 26 * np.exp(-(((x - S * 0.30) ** 2 + (y - S * 0.12) ** 2) / (2 * (S * 0.45) ** 2)))
    v = np.clip(base + glow, 0, 255)
    rgb = np.stack([v, v, v * 1.04], axis=-1)       # grigio appena freddo
    img = Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")

    # riflesso lucido: velo bianco nella meta' alta, col bordo inferiore curvo
    gloss_mask = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(gloss_mask)
    d.ellipse([-S * 0.35, -S * 1.05, S * 1.35, S * 0.52], fill=255)   # grande ellisse che sporge sopra
    gloss_mask = gloss_mask.filter(ImageFilter.GaussianBlur(S * 0.004))
    grad = np.tile(np.linspace(1.0, 0.0, S, dtype=np.float32)[:, None], (1, S))
    alpha = (np.asarray(gloss_mask, dtype=np.float32) / 255.0) * (0.04 + 0.15 * grad ** 1.3) * 255
    gloss = Image.new("RGBA", (S, S), (255, 255, 255, 0)); gloss.putalpha(Image.fromarray(alpha.astype(np.uint8), "L"))
    img = Image.alpha_composite(img, gloss)

    # filo di luce sul bordo alto
    rim = Image.new("L", (S, S), 0)
    ImageDraw.Draw(rim).rectangle([0, 0, S, int(S * 0.012)], fill=70)
    rim = ImageChops.multiply(rim, Image.fromarray((np.tile(np.linspace(1, 0, S, dtype=np.float32)[:, None] ** 6, (1, S)) * 255).astype(np.uint8), "L"))
    rim_l = Image.new("RGBA", (S, S), (255, 255, 255, 0)); rim_l.putalpha(rim)
    img = Image.alpha_composite(img, rim_l)
    # simbolo con ombra e un'aura azzurra morbida
    w = int(S * mark_ratio)
    h = int(mark_src.height * w / mark_src.width)
    m = mark_src.resize((w, h), Image.LANCZOS)
    ox, oy = (S - w) // 2, (S - h) // 2 + int(S * 0.012)
    aura = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    a_mask = Image.new("L", (S, S), 0); a_mask.paste(m.split()[-1], (ox, oy))
    aura_col = Image.new("RGBA", (S, S), (30, 190, 235, 0))
    aura_col.putalpha(a_mask.filter(ImageFilter.GaussianBlur(S * 0.05)).point(lambda p: int(p * 0.38)))
    img = Image.alpha_composite(img, aura_col)
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    sh_mask = Image.new("L", (S, S), 0); sh_mask.paste(m.split()[-1], (ox, oy + int(S * 0.02)))
    shadow.putalpha(sh_mask.filter(ImageFilter.GaussianBlur(S * 0.018)).point(lambda p: int(p * 0.7)))
    img = Image.alpha_composite(img, shadow)
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0)); layer.paste(m, (ox, oy), m)
    img = Image.alpha_composite(img, layer)

    return img.convert("RGB")

out = "public/admin/icons"
os.makedirs(out, exist_ok=True)
anyi = build(0.66)
anyi.resize((512, 512), Image.LANCZOS).save(f"{out}/admin-512.png", optimize=True)
anyi.resize((192, 192), Image.LANCZOS).save(f"{out}/admin-192.png", optimize=True)
anyi.resize((180, 180), Image.LANCZOS).save(f"{out}/admin-apple-180.png", optimize=True)
anyi.resize((64, 64), Image.LANCZOS).save(f"{out}/admin-64.png", optimize=True)
mk = build(0.52)  # piu' piccolo: resta nella zona sicura quando Android taglia l'icona a cerchio o squircle
mk.resize((512, 512), Image.LANCZOS).save(f"{out}/admin-maskable-512.png", optimize=True)
print("ok")
