# Genera le icone della Super Dashboard (stile pulito: sfondo nero, "a" bianca, faccina nera, occhi azzurri).
# Parte dal simbolo Lia in public/brand/favicon-512.png, ne ricostruisce le forme ad alta risoluzione e disegna a 2048px.
# Uso: python3 scripts/make-admin-icon.py   (scrive in public/admin/icons/)
import numpy as np, os, sys
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

SRC = "public/brand/favicon-512.png"
OUT = sys.argv[1] if len(sys.argv) > 1 else "public/admin/icons"
src = Image.open(SRC).convert("RGBA")
bb = src.getbbox()
a = np.asarray(src.crop(bb)).astype(np.float32)
alpha_raw = a[..., 3] / 255
# il file originale ha minuscoli buchi trasparenti intorno al viso: li richiudo, cosi' non si vede lo sfondo a puntini
alpha = ndi.gaussian_filter(ndi.binary_closing(ndi.binary_fill_holes(alpha_raw > 0.5), iterations=3).astype(np.float32), 0.8)
lum = (0.3 * a[..., 0] + 0.59 * a[..., 1] + 0.11 * a[..., 2]) / 255
dark = (lum < 0.16) & (alpha > 0.8)
face = ndi.binary_fill_holes(ndi.binary_closing(dark, iterations=3))
lab, n = ndi.label(face)
face = lab == (1 + int(np.argmax(ndi.sum(face, lab, range(1, n + 1)))))
eyes = face & (lum > 0.3) & (a[..., 2] > 150)
# il viso e' un'ellisse: tolgo la "coda" scura verso il nastro e la ricostruisco come ellisse perfetta (momenti della forma)
core = ndi.binary_opening(face, iterations=14)
ys, xs = np.nonzero(core)
cx, cy = xs.mean(), ys.mean()
cov = np.cov(np.vstack([xs - cx, ys - cy]))
ev, evec = np.linalg.eigh(cov)
semi = 2.0 * np.sqrt(ev)                       # semiassi (minore, maggiore)
face = ((((np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]][1] - cx) * evec[0, 1] + (np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]][0] - cy) * evec[1, 1]) / semi[1]) ** 2
        + (((np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]][1] - cx) * evec[0, 0] + (np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]][0] - cy) * evec[1, 0]) / semi[0]) ** 2) <= 1.0
eyes = (ndi.gaussian_filter(ndi.binary_closing(eyes & face, iterations=1).astype(np.float32), 1.2) > 0.5) & face
# luminosita' del corpo della "a" senza il viso (e senza il suo bordo sporco), riempita con la media vicina
bodymask = ((alpha > 0.8) & ~ndi.binary_dilation(face, iterations=7)).astype(np.float32)
lum_s = ndi.gaussian_filter(lum * bodymask, 5) / np.maximum(ndi.gaussian_filter(bodymask, 5), 1e-3)

def up(arr, w, h):
    return np.asarray(Image.fromarray(arr.astype(np.float32), "F").resize((w, h), Image.BICUBIC))

def crisp(m, sigma):
    """maschera 0..1 ingrandita -> bordo netto e pulito (leggermente sfumato per l'anti-aliasing)"""
    g = ndi.gaussian_filter(m, sigma)
    return np.clip((g - 0.5) / 0.22 + 0.5, 0, 1)

def render_mark(w):
    h = int(a.shape[0] * w / a.shape[1])
    k = w / a.shape[1]
    sg = max(1.0, 0.9 * k)
    A = crisp(up(alpha, w, h), sg)
    gy, gx = np.mgrid[0:h, 0:w].astype(np.float32)
    px, py = gx / k - cx, gy / k - cy
    u = (px * evec[0, 1] + py * evec[1, 1]) / semi[1]
    v = (px * evec[0, 0] + py * evec[1, 0]) / semi[0]
    dist = (np.sqrt(u * u + v * v) - 1.0) * min(semi) * k          # distanza in pixel dal bordo dell'ellisse
    F = np.clip(0.5 - dist, 0, 1)
    E = crisp(up(eyes.astype(np.float32), w, h), sg * 0.8) * F
    L = np.clip((up(lum_s, w, h) - 0.35) / 0.6, 0, 1)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    diag = np.clip((xx / w) * 0.45 + (yy / h) * 0.75, 0, 1)
    t = np.clip(0.55 * (1 - diag) + 0.45 * L, 0, 1)[..., None]
    body = np.array([206, 209, 215]) / 255 * (1 - t) + np.array([247, 248, 250]) / 255 * t
    face_c = np.array([9, 9, 11]) / 255
    et = np.clip((yy / h - 0.35) / 0.3, 0, 1)[..., None]
    eye_c = np.array([120, 236, 244]) / 255 * (1 - et) + np.array([40, 190, 215]) / 255 * et
    col = body * (1 - F[..., None]) + face_c * F[..., None]
    col = col * (1 - E[..., None]) + eye_c * E[..., None]
    return Image.fromarray((np.clip(np.dstack([col, A]), 0, 1) * 255).astype(np.uint8), "RGBA")

def build(ratio, S=2048, top=(12, 12, 14), bot=(12, 12, 14)):
    y = np.linspace(0, 1, S, dtype=np.float32)[:, None, None]
    bg = np.array(top, np.float32) * (1 - y) + np.array(bot, np.float32) * y
    img = Image.fromarray(np.broadcast_to(bg, (S, S, 3)).astype(np.uint8), "RGB").convert("RGBA")
    m = render_mark(int(S * ratio))
    w, h = m.size
    ox, oy = (S - w) // 2, (S - h) // 2 + int(S * 0.01)
    sh = Image.new("L", (S, S), 0)
    sh.paste(m.split()[-1], (ox, oy + int(S * 0.014)))
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.016)).point(lambda p: int(p * 0.0))
    sl = Image.new("RGBA", (S, S), (0, 0, 0, 0)); sl.putalpha(sh)
    img = Image.alpha_composite(img, sl)
    layer = Image.new("RGBA", (S, S), (0, 0, 0, 0)); layer.paste(m, (ox, oy), m)
    return Image.alpha_composite(img, layer).convert("RGB")

os.makedirs(OUT, exist_ok=True)
big = build(0.70)       # icona normale
safe = build(0.58)      # icona "maskable": il simbolo resta nella zona sicura quando Android ritaglia a cerchio
def save(img, name, px):
    img.resize((px, px), Image.LANCZOS).save(f"{OUT}/{name}", optimize=True)
save(big, "admin-1024.png", 1024); save(big, "admin-512.png", 512); save(big, "admin-192.png", 192)
save(big, "admin-apple-180.png", 180); save(big, "admin-64.png", 64)
save(safe, "admin-maskable-1024.png", 1024); save(safe, "admin-maskable-512.png", 512)
print("ok")
