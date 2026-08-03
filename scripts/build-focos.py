#!/usr/bin/env python3
"""
build-focos.py — série anual de focos de queimada por unidade federativa.

POR QUE ESTE SCRIPT EXISTE
    Até ele, o site não tinha NENHUMA série temporal numérica. O maior conjunto
    publicado tinha 18 pontos (vagas de IC por UF) e o único objeto com eixo de
    tempo era uma tabela de 60 booleanos de chuva, sem ano e sem fonte citável.
    Sem série não existe gráfico de linha, e sem isso não há observatório.

    Esta é a primeira série real do projeto: 27 UFs, 2003 em diante, origem
    oficial e licença pública.

DE ONDE VEM
    Programa Queimadas do INPE, focos detectados pelo satélite de referência,
    agregados por ano e por estado. O satélite de referência é a série que o
    próprio INPE recomenda para comparação histórica, justamente porque mantém
    o mesmo sensor e o mesmo horário de passagem ao longo do tempo. Misturar
    todos os satélites daria números maiores e NÃO comparáveis entre anos.

    https://terrabrasilis.dpi.inpe.br/queimadas/portal/dados-abertos/

COMO USAR
    python3 scripts/build-focos.py                # todas as 27 UFs
    python3 scripts/build-focos.py --amazonia     # só a Amazônia Legal
    python3 scripts/build-focos.py --desde 2015   # recorta o período

    Os ZIP baixados ficam em tmp/focos-inpe/ (pasta já ignorada pelo git), então
    rodar de novo é barato: só baixa o que falta e o ano corrente, que muda.

SAÍDA
    src/content/dados/focos-por-uf-ano.json
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request
import zipfile
from collections import defaultdict
from datetime import date, datetime, timezone

BASE = "https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/anual/EstadosBr_sat_ref/"
PORTAL = "https://terrabrasilis.dpi.inpe.br/queimadas/portal/dados-abertos/"
UA = {"User-Agent": "inct-conexao-build/1.0 (+https://inct-conexao.com.br)"}

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, "tmp", "focos-inpe")
DESTINO = os.path.join(RAIZ, "src", "content", "dados", "focos-por-uf-ano.json")

# Lei Complementar nº 124/2007. Mesma lista de src/content/rede.ts.
AMAZONIA_LEGAL = ["AC", "AP", "AM", "MA", "MT", "PA", "RO", "RR", "TO"]


def buscar(url, tentativas=3):
    ultimo = None
    for _ in range(tentativas):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None  # combinação UF/ano que não existe: não é erro
            ultimo = e
        except Exception as e:
            ultimo = e
    raise RuntimeError("falha ao buscar %s: %s" % (url, ultimo))


def listar_ufs():
    html = buscar(BASE).decode("utf-8", "ignore")
    ufs = [h.rstrip("/") for h in re.findall(r'href="([A-Z]{2}/)"', html)]
    return sorted(set(ufs))


def listar_anos(uf):
    """Anos disponíveis para a UF, SEM repetição.

    O índice do servidor escreve cada arquivo duas vezes na mesma linha, no
    `href` e no texto do link, então a expressão casa duas vezes por ano. Sem o
    `set` cada ZIP é baixado e contado em dobro; a série por UF sobrevive porque
    a chave do dicionário sobrescreve, mas qualquer acumulador (bioma, total)
    sai com o dobro do valor. Foi exatamente o que aconteceu na primeira rodada.
    """
    html = buscar("%s%s/" % (BASE, uf)).decode("utf-8", "ignore")
    return sorted({int(a) for a in re.findall(r"_ref_(\d{4})\.zip", html)})


def zip_do_ano(uf, ano):
    """Devolve os bytes do ZIP, do cache quando possível.

    O ano corrente NÃO é cacheado: ele ainda recebe focos novos todo dia, e
    servir um recorte velho como se fosse a série completa seria pior que não
    ter o dado.
    """
    nome = "focos_br_%s_ref_%d.zip" % (uf.lower(), ano)
    caminho = os.path.join(CACHE, nome)
    corrente = ano == date.today().year
    if os.path.exists(caminho) and not corrente:
        with open(caminho, "rb") as f:
            return f.read()
    bruto = buscar("%s%s/%s" % (BASE, uf, nome))
    if bruto is None:
        return None
    os.makedirs(CACHE, exist_ok=True)
    with open(caminho, "wb") as f:
        f.write(bruto)
    return bruto


def contar(bruto):
    """Conta focos e devolve também a quebra por bioma.

    Conta LINHAS do CSV, não `foco_id` distinto: o arquivo anual por estado do
    satélite de referência já vem sem repetição, e deduplicar em memória custaria
    guardar milhões de identificadores sem ganho verificado.
    """
    z = zipfile.ZipFile(io.BytesIO(bruto))
    nomes = [n for n in z.namelist() if n.lower().endswith(".csv")]
    if not nomes:
        return 0, {}
    total = 0
    por_bioma = defaultdict(int)
    with z.open(nomes[0]) as f:
        texto = io.TextIOWrapper(f, encoding="utf-8", errors="ignore")
        cabecalho = texto.readline().strip().split(",")
        try:
            i_bioma = cabecalho.index("bioma")
        except ValueError:
            i_bioma = -1
        for linha in texto:
            if not linha.strip():
                continue
            total += 1
            if i_bioma >= 0:
                partes = linha.rstrip("\n").split(",")
                if len(partes) > i_bioma:
                    por_bioma[partes[i_bioma].strip()] += 1
    return total, dict(por_bioma)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--amazonia", action="store_true", help="só as 9 UFs da Amazônia Legal")
    p.add_argument("--desde", type=int, default=0, help="ano inicial (padrão: tudo que houver)")
    args = p.parse_args()

    ufs = AMAZONIA_LEGAL if args.amazonia else listar_ufs()
    print("UFs a processar: %d" % len(ufs))

    serie = {}
    biomas_totais = defaultdict(int)
    anos_vistos = set()
    baixados = 0

    for uf in ufs:
        try:
            anos = [a for a in listar_anos(uf) if a >= args.desde]
        except Exception as e:
            print("  %s: nao consegui listar (%s)" % (uf, e), file=sys.stderr)
            continue
        por_ano = {}
        for ano in anos:
            bruto = zip_do_ano(uf, ano)
            if bruto is None:
                continue
            baixados += 1
            total, biomas = contar(bruto)
            por_ano[str(ano)] = total
            anos_vistos.add(ano)
            for b, n in biomas.items():
                biomas_totais[b] += n
        serie[uf] = por_ano
        print("  %s: %d anos, %d focos no total" % (uf, len(por_ano), sum(por_ano.values())))

    if not anos_vistos:
        raise SystemExit("nenhum dado obtido; nada a gravar")

    saida = {
        "meta": {
            "titulo": "Focos de queimada por unidade federativa e ano",
            "fonte": "Programa Queimadas, INPE",
            "publicador": "Instituto Nacional de Pesquisas Espaciais (INPE)",
            "url": PORTAL,
            "urlDados": BASE,
            "satelite": "satélite de referência",
            "notaMetodologica": (
                "Contagem de focos detectados pelo satélite de referência do INPE, "
                "a série indicada pelo próprio instituto para comparação entre anos, "
                "por manter o mesmo sensor e o mesmo horário de passagem. Foco de "
                "calor não é o mesmo que área queimada nem que incêndio confirmado: "
                "é uma detecção de anomalia térmica, e um incêndio grande pode gerar "
                "vários focos."
            ),
            "periodo": "%d a %d" % (min(anos_vistos), max(anos_vistos)),
            "unidade": "focos",
            "cobertura": "%d unidades federativas" % len(serie),
            "licenca": "Dados públicos, uso livre com citação da fonte (INPE)",
            "geradoEm": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "geradoPor": "scripts/build-focos.py",
        },
        "anos": sorted(anos_vistos),
        "focosPorUf": serie,
        "biomas": dict(sorted(biomas_totais.items(), key=lambda x: -x[1])),
    }

    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)
        f.write("\n")

    tamanho = os.path.getsize(DESTINO)
    print("\n%s" % DESTINO)
    print("  %d UFs, %d anos (%s), %.0f kB" % (len(serie), len(anos_vistos), saida["meta"]["periodo"], tamanho / 1024))
    print("  arquivos processados nesta rodada: %d" % baixados)
    print("  total de focos na serie: %d" % sum(sum(v.values()) for v in serie.values()))


if __name__ == "__main__":
    main()
