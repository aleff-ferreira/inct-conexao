#!/usr/bin/env python3
"""Empacota o conteúdo de dist/ para o deploy no Netlify.
index.html fica na raiz do zip; assets em assets/... (sempre com barra '/')."""
import os
import zipfile

SRC = "dist"
# Zip neutro de host: o conteúdo de dist/ (index.html na raiz). Funciona em
# qualquer hospedagem estática; o site está no Hostinger (ver HOSTING.md).
OUT = "inct-conexao-deploy.zip"


def main() -> None:
    if not os.path.isdir(SRC):
        raise SystemExit(f"diretório '{SRC}' não encontrado — rode o build antes.")

    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(SRC):
            for name in files:
                # ignora metadados do Windows (alternate data streams)
                if "Zone.Identifier" in name or ":" in name or name == ".DS_Store":
                    continue
                full = os.path.join(root, name)
                arc = os.path.relpath(full, SRC).replace(os.sep, "/")
                zf.write(full, arc)
                count += 1

    size = os.path.getsize(OUT)
    print(f"OK: {OUT} ({count} arquivos, {size / 1024 / 1024:.1f} MB)")

    # validação: index.html na raiz e nada começando com 'dist/' ou usando '\\'
    with zipfile.ZipFile(OUT) as zf:
        names = zf.namelist()
    assert "index.html" in names, "index.html não está na raiz do zip!"
    bad = [n for n in names if n.startswith("dist/") or "\\" in n]
    assert not bad, f"caminhos inválidos no zip: {bad[:5]}"
    sample = sorted(n for n in names if n.startswith("assets/"))[:3]
    print("raiz contém index.html: OK")
    print("exemplos de assets:", sample)


if __name__ == "__main__":
    main()
