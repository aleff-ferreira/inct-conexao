#!/usr/bin/env python3
"""
Apura a presença no webinário e produz a lista de certificados.

COMO FUNCIONA
Durante a transmissão, o apresentador anuncia PALAVRAS-CHAVE em momentos
espalhados. No fim, o participante preenche um formulário informando as
palavras que ouviu. Cada palavra prova presença NAQUELE INSTANTE; o conjunto
delas prova permanência no INTERVALO entre a primeira e a última.

Por isso o cronograma importa mais do que a quantidade, e há DOIS erros a
medir: aprovar quem ficou pouco, e reprovar quem ficou bastante. Com
espaçamento `g` e exigência de `k` palavras, a menor permanência aprovada é
`(k-1)*g` e a maior reprovada é `k*g - 1`. Adotado: seis palavras de 20 em 20
minutos, exigindo quatro — garante 60 min e aprova sempre quem ficou 80+.
Ver `docs/presenca-certificados.md` para a conta e para a armadilha do DVR.

USO
    python3 scripts/apurar-presenca.py respostas.csv \\
        --codigos girassol tambor lanterna bussola vitrola pandeiro \\
        --minimo 4

    # e, se quiser conferir antes de valer:
    python3 scripts/apurar-presenca.py respostas.csv --codigos ... --simular

SAÍDAS (em envio-webinario-ofidio/)
    certificados-aprovados.csv  -> nome, e-mail: pronto para emitir
    certificados-revisar.csv    -> casos que exigem olho humano, com o motivo
"""
import argparse, csv, os, re, sys, unicodedata
from collections import Counter

PADRAO_INSCRITOS = "envio-webinario-ofidio/lista-envio.csv"
SAIDA_DIR = "envio-webinario-ofidio"


def normaliza_texto(s: str) -> str:
    """Minúsculas, sem acento, sem pontuação, espaços colapsados.

    O participante digita com pressa, no celular, ouvindo. "Jararaca!",
    " jararaca " e "JARARACA" têm de valer o mesmo — recusar por acento é
    reprovar quem estava presente.
    """
    s = unicodedata.normalize("NFD", (s or "").strip().lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def chave_email(e: str) -> str:
    """E-mail em forma canônica, para cruzar as duas listas.

    O Gmail ignora pontos no nome e tudo depois de '+'. Sem isso,
    'jo.ao+webinar@gmail.com' e 'joao@gmail.com' viram pessoas diferentes e
    alguém que assistiu fica sem certificado por causa de um ponto.
    """
    e = (e or "").strip().lower()
    if "@" not in e:
        return e
    local, dominio = e.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if dominio in {"gmail.com", "googlemail.com"}:
        local = local.replace(".", "")
    return f"{local}@{dominio}"


def acha_coluna(colunas, *palavras, obrigatoria=True, rotulo=""):
    """Localiza a coluna pelo cabeçalho. O Google Forms cria nomes longos e
    com a pergunta inteira, então buscamos por palavra-chave."""
    for c in colunas:
        n = normaliza_texto(c)
        if any(p in n for p in palavras):
            return c
    if obrigatoria:
        sys.exit(f"ERRO: não achei a coluna de {rotulo or palavras[0]!r}.\n"
                 f"       colunas disponíveis: {list(colunas)}")
    return None


def main():
    ap = argparse.ArgumentParser(description="Apura presença e gera a lista de certificados.")
    ap.add_argument("respostas", help="CSV exportado do Google Forms")
    ap.add_argument("--codigos", nargs="+", required=True, help="as palavras-chave anunciadas, na ordem")
    ap.add_argument("--minimo", type=int, default=4, help="quantas o participante precisa acertar (padrão: 4, de 6)")
    ap.add_argument("--inscritos", default=PADRAO_INSCRITOS, help=f"lista de inscritos (padrão: {PADRAO_INSCRITOS})")
    ap.add_argument("--simular", action="store_true", help="mostra o resultado sem gravar os arquivos")
    args = ap.parse_args()

    codigos = [normaliza_texto(c) for c in args.codigos]
    if args.minimo > len(codigos):
        sys.exit(f"ERRO: exige {args.minimo} acertos mas só há {len(codigos)} códigos.")

    # ---- inscritos (quem tinha direito de estar lá) ----
    with open(args.inscritos, encoding="utf-8-sig", newline="") as f:
        inscritos = list(csv.DictReader(f))
    por_email = {chave_email(i["email"]): i for i in inscritos}

    # ---- respostas do formulário ----
    with open(args.respostas, encoding="utf-8-sig", newline="") as f:
        respostas = list(csv.DictReader(f))
    if not respostas:
        sys.exit("ERRO: o CSV de respostas está vazio.")

    cols = list(respostas[0].keys())
    c_email = acha_coluna(cols, "email", "e mail", "endereco de email", rotulo="e-mail")
    c_nome = acha_coluna(cols, "nome", obrigatoria=False)
    # As colunas dos códigos: as que perguntam por palavra/código/senha.
    c_codigos = [c for c in cols if any(p in normaliza_texto(c) for p in
                                        ("palavra", "codigo", "senha", "chave"))]
    if not c_codigos:
        sys.exit(f"ERRO: não achei nenhuma coluna de palavra-chave.\n"
                 f"       colunas disponíveis: {cols}")

    aprovados, revisar = [], []
    vistos = set()
    motivos = Counter()

    for r in respostas:
        email_bruto = (r.get(c_email) or "").strip()
        chave = chave_email(email_bruto)
        nome_form = (r.get(c_nome) or "").strip() if c_nome else ""

        # quais códigos a pessoa acertou (em qualquer campo, em qualquer ordem)
        digitados = {normaliza_texto(r.get(c, "")) for c in c_codigos}
        digitados.discard("")
        acertos = sum(1 for c in codigos if c in digitados)

        insc = por_email.get(chave)
        nome = (insc or {}).get("nome") or nome_form or "(sem nome)"
        base = {"nome": nome, "email": email_bruto, "acertos": acertos,
                "de": len(codigos), "instituicao": (insc or {}).get("instituicao", "")}

        if chave in vistos:
            motivos["resposta duplicada"] += 1
            revisar.append({**base, "motivo": "respondeu mais de uma vez (mantida a 1ª)"})
            continue
        vistos.add(chave)

        if not insc:
            motivos["não estava na lista de inscritos"] += 1
            revisar.append({**base, "motivo": "e-mail não confere com nenhum inscrito (erro de digitação? outro e-mail?)"})
            continue

        if acertos >= args.minimo:
            aprovados.append(base)
        else:
            motivos[f"acertou {acertos} de {len(codigos)}"] += 1
            revisar.append({**base, "motivo": f"acertou {acertos}, mínimo {args.minimo}"})

    # ---- relatório ----
    print("=" * 68)
    print("APURAÇÃO DE PRESENÇA")
    print("=" * 68)
    print(f"  inscritos ................. {len(inscritos)}")
    print(f"  responderam o formulário .. {len(respostas)}")
    print(f"  regra ..................... acertar {args.minimo} de {len(codigos)}")
    print()
    print(f"  APROVADOS (certificado) ... {len(aprovados)}")
    print(f"  para revisar .............. {len(revisar)}")
    for m, n in motivos.most_common():
        print(f"     - {m}: {n}")
    if len(inscritos):
        print()
        print(f"  comparecimento aferido .... {len(aprovados)}/{len(inscritos)} "
              f"({len(aprovados) / len(inscritos):.0%} dos inscritos)")

    if args.simular:
        print("\n  (--simular: nenhum arquivo gravado)")
        return

    os.makedirs(SAIDA_DIR, exist_ok=True)
    p_ok = f"{SAIDA_DIR}/certificados-aprovados.csv"
    p_rev = f"{SAIDA_DIR}/certificados-revisar.csv"
    with open(p_ok, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["nome", "email", "instituicao", "acertos", "de"])
        w.writeheader(); w.writerows(aprovados)
    with open(p_rev, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["nome", "email", "instituicao", "acertos", "de", "motivo"])
        w.writeheader(); w.writerows(revisar)
    print(f"\n  -> {p_ok}")
    print(f"  -> {p_rev}")
    print("\n  Os dois arquivos têm DADOS PESSOAIS: a pasta está fora do git.")


if __name__ == "__main__":
    main()
