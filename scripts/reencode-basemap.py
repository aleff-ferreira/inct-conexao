#!/usr/bin/env python3
"""
reencode-basemap.py — reencoda o relevo em AVIF, em duas resoluções.

POR QUE
    `brasil-relevo.webp` tem 2.065.194 B e NÃO comprime (gzip economiza 3 kB):
    é 87% do peso da rota do mapa, entregue a todo mundo, inclusive a quem abre
    o site num pacote de dados quase no fim.

    Medido nesta máquina, sobre a mesma imagem:

        3200px  WebP q72  1.600.594 B   erro 1.2      <- comparável ao atual
        3200px  AVIF q50    946.309 B   erro 1.5
        2200px  AVIF q60    718.090 B   erro 1.5
        1600px  AVIF q60    401.909 B   erro 1.9
        1600px  AVIF q50    275.721 B   erro 2.3

    AVIF entrega a mesma fidelidade em pouco mais da metade dos bytes. Isso
    permite fazer as duas coisas ao mesmo tempo: aliviar a primeira pintura e
    MELHORAR o zoom — porque o arquivo grande, que hoje é WebP, passa a ser um
    AVIF de qualidade mais alta pelo mesmo orçamento.

ESTRATÉGIA
    base  (1600px, sempre)  — o que quase todo mundo vê; o mapa é exibido com
                              ~860px de largura, então 1600 já é 2x.
    alta  (3200px, sob demanda) — entra quando a pessoa aproxima de verdade.
    webp  (1600px)          — resguardo para navegador sem AVIF (Safari < 16.4).

USO
    python3 scripts/reencode-basemap.py

    Lê os artefatos que `build-basemap.py` já gerou. Não refaz o download do
    relevo nem do satélite: reencoda o que existe.
"""
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow não encontrado. pip install --user Pillow")

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAPAS = os.path.join(RAIZ, "public", "assets", "maps")

# (origem, base, largura_base, qualidade_base, largura_alta, qualidade_alta)
ALVOS = [
    ("brasil-relevo.webp", "brasil-relevo", 1600, 62, 3200, 58),
    # Os vizinhos são moldura esmaecida: não precisam de versão alta nem de
    # fidelidade. São 171 kB hoje; em AVIF caem para poucas dezenas.
    ("brasil-vizinhos.webp", "brasil-vizinhos", 1500, 55, None, None),
]


def salvar(img, caminho, **kw):
    img.save(caminho, **kw)
    return os.path.getsize(caminho)


def main():
    if not os.path.isdir(MAPAS):
        sys.exit("pasta não encontrada: %s" % MAPAS)

    total_antes = total_depois = 0

    for origem, base, larg, qual, larg_alta, qual_alta in ALVOS:
        p = os.path.join(MAPAS, origem)
        if not os.path.exists(p):
            print("  %s ausente — pulando" % origem)
            continue

        antes = os.path.getsize(p)
        total_antes += antes
        im = Image.open(p).convert("RGB")
        print("\n%s  (%dx%d, %.0f kB)" % (origem, im.width, im.height, antes / 1024))

        def redim(w):
            if w >= im.width:
                return im
            return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)

        # 1. base em AVIF — é o que todo mundo baixa
        alvo = os.path.join(MAPAS, base + ".avif")
        n = salvar(redim(larg), alvo, format="AVIF", quality=qual, speed=4)
        total_depois += n
        print("  %-30s %8.0f kB   (%dpx, AVIF q%d)" % (base + ".avif", n / 1024, larg, qual))

        # 2. resguardo em WebP, mesma resolução da base
        alvo = os.path.join(MAPAS, base + "-fallback.webp")
        n = salvar(redim(larg), alvo, format="WEBP", quality=74, method=6)
        print("  %-30s %8.0f kB   (sem AVIF: Safari < 16.4)" % (base + "-fallback.webp", n / 1024))

        # 3. versão de zoom, só para o relevo
        if larg_alta:
            alvo = os.path.join(MAPAS, base + "-alta.avif")
            n = salvar(redim(larg_alta), alvo, format="AVIF", quality=qual_alta, speed=4)
            print("  %-30s %8.0f kB   (%dpx, sob demanda ao aproximar)" % (base + "-alta.avif", n / 1024, larg_alta))

    print("\n%s" % ("-" * 62))
    print("  primeira pintura: %.0f kB  ->  %.0f kB   (%.0f%% menos)"
          % (total_antes / 1024, total_depois / 1024, 100 * (1 - total_depois / total_antes)))
    print("  os arquivos .webp originais ficam no lugar; apague-os quando o")
    print("  BrazilMap já não os referenciar.")


if __name__ == "__main__":
    main()
