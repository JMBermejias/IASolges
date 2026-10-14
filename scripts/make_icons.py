#!/usr/bin/env python3
"""
Genera los iconos PNG de IASolges en varios tamanos.
    python3 scripts/make_icons.py [destino]
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

SIZES = [16, 24, 32, 48, 64, 128, 256, 512]
BRAND = (11, 60, 93)      # #0B3C5D
BRAND2 = (29, 111, 165)   # #1D6FA5
ACCENT = (125, 211, 252)  # #7DD3FC  azul claro
RADIUS = 0.235            # proportion del lado


def font(size):
    for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
              "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, int(size * 0.52))
            except OSError:
                continue
    return ImageFont.load_default()


def make(n):
    ss = 4                       # supermuestreo para bordes limpios
    S = n * ss

    # Fondo: degradado diagonal construido con un gradiente vertical escalado.
    grad = Image.new("RGB", (1, S))
    gp = grad.load()
    for y in range(S):
        t = y / max(S - 1, 1)
        gp[0, y] = tuple(int(BRAND[k] + (BRAND2[k] - BRAND[k]) * t) for k in range(3))
    bg = grad.resize((S, S), Image.BILINEAR)

    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1],
                                           radius=int(S * RADIUS), fill=255)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    img.paste(bg, (0, 0), mask)
    d = ImageDraw.Draw(img)

    if n >= 24:
        # marca de agua: circulo de acento arriba a la derecha
        d.ellipse([S * 0.70, S * 0.07, S * 0.92, S * 0.29], fill=ACCENT + (255,))

    # texto "IA" centrado
    f = font(S)
    txt = "IA"
    try:
        d.text((S / 2, S / 2 + S * 0.01), txt, font=f, fill=(255, 255, 255, 255),
               anchor="mm")
    except (ValueError, TypeError):
        box = d.textbbox((0, 0), txt, font=f)
        tw, th = box[2] - box[0], box[3] - box[1]
        d.text(((S - tw) / 2 - box[0], (S - th) / 2 - box[1]), txt,
               font=f, fill=(255, 255, 255, 255))

    return img.resize((n, n), Image.LANCZOS)


def main():
    dest = sys.argv[1] if len(sys.argv) > 1 else "packaging/icons"
    base = os.path.join(dest, "hicolor")
    for n in SIZES:
        sub = ("scalable" if False else
               ("%dx%d" % (n, n)) if n not in (16, 24, 32, 48, 64, 128, 256, 512)
               else "%dx%d/apps" % (n, n))
        d = os.path.join(base, sub)
        os.makedirs(d, exist_ok=True)
        p = os.path.join(d, "iasolges.png")
        make(n).save(p)
        print("  %-46s %dpx" % (p, n))
    # icono grande en la raiz (para el postinst)
    os.makedirs(dest, exist_ok=True)
    make(512).save(os.path.join(dest, "iasolges.png"))
    print("  %-46s 512px (raiz)" % os.path.join(dest, "iasolges.png"))


if __name__ == "__main__":
    main()