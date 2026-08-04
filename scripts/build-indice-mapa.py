#!/usr/bin/env python3
"""
build-indice-mapa.py — índice enxuto das fichas estaduais.

POR QUE
    `content.ts` lia as fichas com `import.meta.glob(..., { eager: true })`, e
    por isso os 135.008 B de JSON editorial entravam INTEIROS no bundle. Isso
    pesava 296.885 B crus / 85.566 B gzip — 36% da rota do mapa — e descia
    também na HOME, porque o teaser importa o mesmo módulo.

    Só que a home e a lente de doenças não precisam da ficha: precisam saber
    quais estados têm ficha e quantas notificações cada um tem. Isso cabe em
    poucos centenas de bytes.

    Este script pré-computa esse índice. As fichas passam a ser carregadas sob
    demanda, quando alguém abre um estado.

O QUE ENTRA NO ÍNDICE
    Só o que a interface precisa ANTES de abrir a ficha. Nada de texto, nada de
    imagem, nada de fonte — isso viaja com a ficha, no momento em que é lida.

USO
    python3 scripts/build-indice-mapa.py
"""
import glob
import io
import json
import os
import re

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FICHAS = os.path.join(RAIZ, "src", "content", "mapa", "estados")
DESTINO = os.path.join(RAIZ, "src", "content", "mapa", "indice-estados.json")


def ano_inicial(periodo):
    """Menor ano citado no período; None se não houver."""
    m = re.search(r"(\d{4})", periodo or "")
    return int(m.group(1)) if m else None


def resumir(ficha):
    """O mesmo cálculo de `resumoNotificacoes`, feito aqui uma vez só.

    Números marcados `representativo: false` (malária no SINAN, acompanhada
    pelo SIVEP-Malária) ficam fora do total — senão a soma deixa de ser
    comparável entre estados.
    """
    soma, desde, tem = 0, None, False
    for d in ficha.get("doencas", []):
        if d.get("publicado") is False:
            continue
        n = d.get("notificacoes")
        if not n or n.get("representativo") is False:
            continue
        soma += n["valor"]
        tem = True
        a = ano_inicial(n.get("periodo"))
        if a and (desde is None or a < desde):
            desde = a
    return {"valor": soma, "desde": desde} if tem else None


def publicados(lista):
    return [x for x in (lista or []) if x.get("publicado") is not False]


def main():
    entradas = {}
    for caminho in sorted(glob.glob(os.path.join(FICHAS, "*.json"))):
        d = json.load(io.open(caminho, encoding="utf-8"))
        if d.get("publicado") is False:
            continue
        uf = d["uf"].upper()
        entradas[uf] = {
            "nome": d.get("nome"),
            "demonstracao": bool(d.get("demonstracao")),
            # contagens: alimentam as abas e o gráfico de perfil sem abrir a ficha
            "contagens": {
                "animais": len(publicados(d.get("animais"))),
                "doencas": len(publicados(d.get("doencas"))),
                "servicos": len(d.get("servicos") or []),
                "inct": len(d.get("atividadesInct") or []),
                "ambiente": 1 if d.get("ambiente") else 0,
                "resumo": 1 if d.get("resumo") else 0,
            },
            "notificacoes": resumir(d),
        }

    saida = {
        "_nota": (
            "GERADO por scripts/build-indice-mapa.py — não editar à mão. "
            "Índice enxuto para a interface saber o que existe sem baixar as "
            "fichas inteiras. tests/mapa.test.ts reprova se divergir delas."
        ),
        "estados": entradas,
    }

    with io.open(DESTINO, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write("\n")

    fichas_b = sum(os.path.getsize(p) for p in glob.glob(os.path.join(FICHAS, "*.json")))
    indice_b = os.path.getsize(DESTINO)
    print("índice: %s" % os.path.relpath(DESTINO, RAIZ))
    print("  estados          : %d" % len(entradas))
    print("  fichas em disco  : %7d B" % fichas_b)
    print("  índice           : %7d B   (%.1f%% do total)" % (indice_b, 100 * indice_b / fichas_b))
    com_notif = [uf for uf, e in entradas.items() if e["notificacoes"]]
    print("  com notificação  : %s" % ", ".join(sorted(com_notif)))


if __name__ == "__main__":
    main()
