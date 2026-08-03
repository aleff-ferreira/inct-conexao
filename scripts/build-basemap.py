#!/usr/bin/env python3
"""
build-basemap.py — gera a base "3D satelite" do Mapa Interativo.

Diferente de tintas hipsometricas, aqui o RELEVO 3D vem de um SOMBREAMENTO
CALCULADO a partir de um MODELO DIGITAL DE ELEVACAO real (DEM), com exagero
vertical e iluminacao multidirecional (estilo cartografia suica). Esse
sombreamento e entao composto sobre a imagem TRUE-COLOR de satelite (NASA
Blue Marble), produzindo montanhas, escarpas e vales que "saltam" da pagina.

Fontes de dados (uso livre, sem token):
  - Elevacao: Terrarium terrain tiles (AWS Open Data / Mapzen), decodificadas
    para metros:  h = (R*256 + G + B/256) - 32768
  - Cor: NASA GIBS "BlueMarble_NextGeneration" (WMS EPSG:3857)

Saidas em public/assets/maps/ (EPSG:3857, alinhadas a malha vetorial) em WEBP
(~metade do peso do JPEG equivalente; suportado por todos os navegadores atuais):
  - brasil-relevo.webp   : Brasil, cor + relevo 3D calculado (recortado no navegador)
  - brasil-vizinhos.webp : America do Sul ao redor, esmaecida (moldura "flutuante")

Requer: Python + Pillow + numpy + curl.  Rodar:  python3 scripts/build-basemap.py
"""
import os, sys, math, subprocess, io
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageChops, ImageEnhance, ImageFilter
import numpy as np

Image.MAX_IMAGE_PIXELS = None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, "public", "assets", "maps")
TMP = os.path.join(ROOT, "tmp")
os.makedirs(OUTDIR, exist_ok=True); os.makedirs(TMP, exist_ok=True)

# ----------------------------------------------------------------------------
# bbox do Brasil em Web Mercator (metros) — mesmo extent da malha vetorial
BR = (-8236529.1, -3994479.1, -3607642.1, 587706.2)
PAD = 0.18                         # moldura de vizinhos = 18% do span/lado
ORIGIN = math.pi * 6378137.0       # 20037508.34 — meia-largura do mundo Mercator

Z_BR = 7      # zoom das tiles DEM p/ o Brasil (7 = ~1.2km/px, detalhe forte)
Z_NB = 6      # zoom das tiles DEM p/ a moldura de vizinhos (area maior)

# iluminacao do relevo -------------------------------------------------------
SUN_ALT   = 42                     # altitude do sol (graus)
AZIMUTHS  = [(315, 0.55), (285, 0.22), (345, 0.15), (255, 0.08)]  # multidirecional
ZFACTOR   = 9.0                    # EXAGERO VERTICAL — controla o "3D"
RELIEF_STRENGTH = 1.15             # quanto o relevo escurece/clareia a cor

TERRARIUM = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
GIBS = "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi"


# ---- helpers de projecao / tiles -------------------------------------------
def merc_to_globalpx(x, y, z):
    """metros Web Mercator -> pixel global (tile 256) no zoom z."""
    n = 256 * (2 ** z)
    gx = (x + ORIGIN) / (2 * ORIGIN) * n
    gy = (ORIGIN - y) / (2 * ORIGIN) * n
    return gx, gy


def fetch_dem(bbox, z):
    """Baixa e costura tiles Terrarium cobrindo bbox; devolve (elev_m, cellsize)
    ja recortado exatamente ao bbox (array float32 de metros)."""
    minx, miny, maxx, maxy = bbox
    lpx, tpy = merc_to_globalpx(minx, maxy, z)   # canto sup-esq
    rpx, bpy = merc_to_globalpx(maxx, miny, z)   # canto inf-dir
    tx0, tx1 = int(lpx // 256), int((rpx - 1e-6) // 256)
    ty0, ty1 = int(tpy // 256), int((bpy - 1e-6) // 256)
    ntx, nty = tx1 - tx0 + 1, ty1 - ty0 + 1
    print(f"  DEM z{z}: {ntx}x{nty} = {ntx*nty} tiles")
    mosaic = np.zeros((nty * 256, ntx * 256, 3), dtype=np.uint8)

    def one(tp):
        tx, ty = tp
        url = TERRARIUM.format(z=z, x=tx, y=ty)
        p = os.path.join(TMP, f"_dem_{z}_{tx}_{ty}.png")
        for _ in range(3):
            subprocess.run(["curl", "-s", "--max-time", "40", "-o", p, url])
            try:
                im = Image.open(p).convert("RGB")
                return tp, np.asarray(im)
            except Exception:
                continue
        return tp, None

    tiles = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]
    got = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        for (tx, ty), arr in ex.map(one, tiles):
            if arr is None:
                sys.exit(f"ERRO: tile DEM {z}/{tx}/{ty} falhou")
            r0 = (ty - ty0) * 256; c0 = (tx - tx0) * 256
            mosaic[r0:r0+256, c0:c0+256] = arr
            got += 1
    print(f"  DEM ok ({got} tiles)")

    a = mosaic.astype(np.float64)
    elev = (a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256) - 32768
    # recorta o mosaico exatamente ao bbox
    x0 = int(round(lpx - tx0 * 256)); y0 = int(round(tpy - ty0 * 256))
    x1 = int(round(rpx - tx0 * 256)); y1 = int(round(bpy - ty0 * 256))
    elev = elev[y0:y1, x0:x1]
    cellsize = (2 * ORIGIN) / (256 * (2 ** z))   # metros mercator / pixel
    return elev.astype(np.float32), cellsize


def _smooth(a, passes=2):
    """Blur gaussiano separavel (3-tap) em numpy — funciona com float."""
    k = np.array([0.25, 0.5, 0.25])
    for _ in range(passes):
        p = np.pad(a, ((0, 0), (1, 1)), mode="edge")
        a = k[0]*p[:, :-2] + k[1]*p[:, 1:-1] + k[2]*p[:, 2:]
        p = np.pad(a, ((1, 1), (0, 0)), mode="edge")
        a = k[0]*p[:-2, :] + k[1]*p[1:-1, :] + k[2]*p[2:, :]
    return a


def hillshade(elev, cellsize):
    """Sombreamento multidirecional com exagero vertical -> relevo 3D (0..1)."""
    elev = np.maximum(elev.astype(np.float64), 0.0)   # oceano/nodata = plano
    # suaviza levemente o DEM p/ tirar degraus de quantizacao das tiles
    elevf = _smooth(elev, passes=2)
    gy, gx = np.gradient(elevf, cellsize, cellsize)   # dz/dy, dz/dx (m/m)
    gx *= ZFACTOR; gy *= ZFACTOR
    slope = np.arctan(np.hypot(gx, gy))
    aspect = np.arctan2(gy, -gx)
    zen = math.radians(90 - SUN_ALT)
    acc = np.zeros_like(elevf); wsum = 0.0
    for az_deg, w in AZIMUTHS:
        az = math.radians(360 - az_deg + 90)
        hs = (math.cos(zen) * np.cos(slope) +
              math.sin(zen) * np.sin(slope) * np.cos(az - aspect))
        acc += w * np.clip(hs, 0, 1); wsum += w
    hs = acc / wsum
    # esticao por percentis -> usa toda a faixa tonal (mais contraste de relevo)
    lo, hi = np.percentile(hs, 2), np.percentile(hs, 98)
    hs = np.clip((hs - lo) / max(hi - lo, 1e-6), 0, 1)
    return hs


def composite(color_img, hs, strength=RELIEF_STRENGTH, desat=0.92, warmth=1.0):
    """true-color * relevo -> sombras reais + micro-contraste (relevo 3D)."""
    color = np.asarray(color_img.convert("RGB"), dtype=np.float64) / 255.0
    hsr = np.asarray(Image.fromarray((hs * 255).astype(np.uint8))
                     .resize(color_img.size, Image.LANCZOS), dtype=np.float64) / 255.0
    hsr = hsr[..., None]
    # modula luminancia: sombras ~0.4x, cristas iluminadas ~1.6x
    out = color * (1.0 + (hsr - 0.5) * (2 * strength))
    # leve overlay do relevo p/ nitidez das cristas
    ov = np.where(color < 0.5, 2 * color * hsr, 1 - 2 * (1 - color) * (1 - hsr))
    out = out * 0.82 + ov * 0.18
    out = np.clip(out, 0, 1)
    img = Image.fromarray((out * 255).astype(np.uint8), "RGB")
    if desat != 1.0:
        img = ImageEnhance.Color(img).enhance(desat)
    img = img.filter(ImageFilter.UnsharpMask(radius=2.4, percent=85, threshold=2))
    return img


# ---- cor GIBS --------------------------------------------------------------
def fetch_color(bbox, w, out):
    minx, miny, maxx, maxy = bbox
    h = round(w / ((maxx - minx) / (maxy - miny)))
    url = (f"{GIBS}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image/jpeg"
           f"&LAYERS=BlueMarble_NextGeneration&CRS=EPSG:3857"
           f"&BBOX={minx:.1f},{miny:.1f},{maxx:.1f},{maxy:.1f}"
           f"&WIDTH={w}&HEIGHT={h}&STYLES=&TIME=2004-08-01")
    subprocess.run(["curl", "-s", "--max-time", "180", "-o", out, url], check=True)
    with open(out, "rb") as f:
        if f.read(2) != b"\xff\xd8":
            sys.exit("ERRO: GIBS nao retornou JPEG")
    return Image.open(out).convert("RGB"), (w, h)


# ============================================================================
# BRASIL — cor plena + relevo 3D calculado
print("Brasil: DEM + true-color…")
elev, cs = fetch_dem(BR, Z_BR)
print(f"  elev min/max/mean m: {elev.min():.0f}/{elev.max():.0f}/{elev.mean():.0f}")
hs = hillshade(elev, cs)
color, _ = fetch_color(BR, 3200, os.path.join(TMP, "_br_color.jpg"))
br = composite(color, hs, strength=RELIEF_STRENGTH, desat=0.95)
br = ImageEnhance.Brightness(br).enhance(1.02)
br.save(os.path.join(OUTDIR, "brasil-relevo.webp"), quality=82, method=6)
print(f"  -> brasil-relevo.webp {br.size} "
      f"({os.path.getsize(os.path.join(OUTDIR,'brasil-relevo.webp'))//1024} kB)")

# ============================================================================
# VIZINHOS — mesma tecnica, porem esmaecida (moldura flutuante)
BG = (242, 238, 231)   # == fundo do mapa (.map-svg): creme quente
sx, sy = (BR[2] - BR[0]) * PAD, (BR[3] - BR[1]) * PAD
PADDED = (BR[0] - sx, BR[1] - sy, BR[2] + sx, BR[3] + sy)
print("Vizinhos: DEM + true-color (moldura)…")
elev2, cs2 = fetch_dem(PADDED, Z_NB)
hs2 = hillshade(elev2, cs2)
color2, _ = fetch_color(PADDED, 2300, os.path.join(TMP, "_nb_color.jpg"))
comp2 = composite(color2, hs2, strength=0.9, desat=0.6)
# esmaece a terra (fantasma quase branco, so um sussurro de relevo)
ghost = ImageEnhance.Color(comp2).enhance(0.15)
ghost = Image.blend(ghost, Image.new("RGB", ghost.size, BG), 0.8)
# mascara de TERRA a partir do true-color (oceano do Blue Marble = azul escuro)
col = color2.resize(comp2.size, Image.LANCZOS)
a = np.asarray(col).astype("int16")
r, g, b = a[..., 0], a[..., 1], a[..., 2]
lum = (r + g + b) / 3
ocean = (b >= g - 4) & (b >= r - 4) & (lum < 70)
mask = Image.fromarray(np.where(ocean, 0, 255).astype("uint8"), "L")
mask = mask.filter(ImageFilter.GaussianBlur(1.4))
out = Image.new("RGB", comp2.size, BG)
out.paste(ghost, (0, 0), mask)
out.save(os.path.join(OUTDIR, "brasil-vizinhos.webp"), quality=80, method=6)
print(f"  -> brasil-vizinhos.webp {out.size} "
      f"({os.path.getsize(os.path.join(OUTDIR,'brasil-vizinhos.webp'))//1024} kB)")

# limpa tiles DEM temporarias
for f in os.listdir(TMP):
    if f.startswith("_dem_"):
        try: os.remove(os.path.join(TMP, f))
        except OSError: pass
print("ok")
