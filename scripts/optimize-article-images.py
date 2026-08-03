#!/usr/bin/env python3
"""
optimize-article-images.py — prepara as imagens de uma materia para o site.

Uso:
    python3 scripts/optimize-article-images.py <pasta-de-origem> <slug-da-materia>

Exemplo:
    python3 scripts/optimize-article-images.py \
        expedicao-resex-rio-ouro-preto/img expedicao-resex-rio-ouro-preto

O que faz:
  - converte cada imagem para WEBP (metade do peso de um JPEG equivalente) e
    grava em public/assets/noticias/<slug>/;
  - reduz o lado maior para MAX_LADO px (nao adianta servir 4000 px);
  - MANTEM em JPEG qualquer arquivo cujo nome comece com "og-": os robos de
    redes sociais (WhatsApp, Facebook) ainda tratam WEBP de forma irregular,
    entao a imagem de compartilhamento continua .jpg.

Depois de rodar, use os nomes de arquivo gerados no JSON da materia
(src/content/noticias/<slug>.json). Requer Python + Pillow.
"""
import os
import sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX_LADO = 1600          # px no maior lado (suficiente para telas retina)
QUALIDADE_WEBP = 82
QUALIDADE_JPEG = 84


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    origem, slug = sys.argv[1], sys.argv[2]
    if not os.path.isdir(origem):
        raise SystemExit(f"pasta de origem nao encontrada: {origem}")

    destino = os.path.join(ROOT, "public", "assets", "noticias", slug)
    os.makedirs(destino, exist_ok=True)

    entradas = sorted(
        f for f in os.listdir(origem)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
    )
    if not entradas:
        raise SystemExit(f"nenhuma imagem em {origem}")

    total_antes = total_depois = 0
    for nome in entradas:
        caminho = os.path.join(origem, nome)
        base, _ext = os.path.splitext(nome)
        im = Image.open(caminho).convert("RGB")

        # reduz o lado maior, preservando proporcao
        w, h = im.size
        if max(w, h) > MAX_LADO:
            escala = MAX_LADO / max(w, h)
            im = im.resize((round(w * escala), round(h * escala)), Image.LANCZOS)

        # imagem de compartilhamento continua JPEG (compatibilidade com robos)
        if base.startswith("og-"):
            saida = os.path.join(destino, base + ".jpg")
            im.save(saida, "JPEG", quality=QUALIDADE_JPEG, optimize=True, progressive=True)
        else:
            saida = os.path.join(destino, base + ".webp")
            im.save(saida, "WEBP", quality=QUALIDADE_WEBP, method=6)

        antes, depois = os.path.getsize(caminho), os.path.getsize(saida)
        total_antes += antes
        total_depois += depois
        print(f"  {nome:44s} {antes//1024:5d} kB -> {os.path.basename(saida):44s} {depois//1024:5d} kB  ({im.size[0]}x{im.size[1]})")

    economia = 100 - (total_depois / total_antes * 100) if total_antes else 0
    print(f"\n{len(entradas)} imagens em public/assets/noticias/{slug}/")
    print(f"{total_antes//1024} kB -> {total_depois//1024} kB  (-{economia:.0f}%)")


if __name__ == "__main__":
    main()
