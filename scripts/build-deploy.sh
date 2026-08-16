#!/usr/bin/env bash
# ============================================================================
#  Regenera inct_deploy/ — A ÚNICA forma correta de fazê-lo.
#
#  Fonte: a ÁRVORE DE TRABALHO (comitada ou não). O GitHub é portfólio; o que
#  vai ao ar é o que está nesta pasta. Nunca construir de um worktree limpo do
#  HEAD (perde .env, rodapé, relato e o que mais estiver só local).
#
#  EMBARGO (UPLOAD-HOSTINGER.md, seção ⛔): a matéria do Barco da Ciência não
#  vai ao ar. `"publicado": false` só esconde a ROTA — o glob das notícias é
#  eager, então o texto entraria no JavaScript, e o Vite copia public/ inteiro,
#  então os 35 MB de mídia iriam junto. Por isso o JSON e a pasta de assets
#  saem da árvore SÓ durante o build (e voltam mesmo se o build falhar: trap).
#  A guarda final é a conferência que o doc exige: grep de "barco-da-ciencia"
#  em inct_deploy/ tem de voltar vazio, senão o script ABORTA e a pasta antiga
#  é preservada.
#
#  Uso (da raiz do repo, no WSL):  bash scripts/build-deploy.sh
#  Para publicar a matéria quando for a hora: EMBARGO=0 bash scripts/build-deploy.sh
#  (e troque "publicado" para true no JSON — senão sobe sem página).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

NODE=./.tools/node-v22.22.3-linux-x64/bin/node
[ -x "$NODE" ] || { echo "ERRO: node do projeto não encontrado em $NODE (o Node 18 do WSL falha em silêncio)"; exit 1; }

# Trava do ensaio de transmissão. `scripts/ensaio-transmissao.sh` marca o
# conteúdo com `_ENSAIO` enquanto um teste roda. Duas situações OPOSTAS:
#   - ensaio LOCAL (localhost): nunca pode virar pacote -> aborta sempre;
#   - ensaio de PRODUÇÃO: precisa virar pacote para ser subido -> só passa com
#     ENSAIO_PRODUCAO=1, que o próprio script de ensaio exporta.
# Sem essa distinção a guarda protegia o caminho seguro e deixava passar o
# perigoso (edição manual que vai ao ar sem aviso nenhum).
if grep -rl '"_ENSAIO"' src/content/ 2>/dev/null | grep -q .; then
  if [ "${ENSAIO_PRODUCAO:-0}" != "1" ]; then
    echo "ERRO: há configuração de ENSAIO ativa em src/content/ — inct_deploy/ NÃO foi tocada:"
    grep -rl '"_ENSAIO"' src/content/
    echo "      encerre o ensaio LOCAL (Ctrl+C no ensaio-transmissao.sh) ou, se for"
    echo "      ensaio de PRODUÇÃO, use: bash scripts/ensaio-transmissao.sh --producao <url>"
    exit 1
  fi
  cat <<'AVISO'

  ############################################################
  #  PACOTE DE ENSAIO — NÃO É O SITE NORMAL                  #
  #  Contém um evento de teste, publicado e AO VIVO.         #
  #  Depois do teste, rode:                                  #
  #     bash scripts/ensaio-transmissao.sh --fim             #
  #  e suba inct_deploy/ de novo.                            #
  ############################################################

AVISO
fi

EMBARGO="${EMBARGO:-1}"
SLUG=expedicao-barco-da-ciencia-nazare
JSON=src/content/noticias/$SLUG.json
MIDIA=public/assets/noticias/$SLUG
GUARDA=$(mktemp -d)

restaura() {
  [ -f "$GUARDA/$SLUG.json" ] && mv "$GUARDA/$SLUG.json" "$JSON"
  [ -d "$GUARDA/$SLUG" ] && mv "$GUARDA/$SLUG" "$MIDIA"
  rmdir "$GUARDA" 2>/dev/null || true
}
trap restaura EXIT

if [ "$EMBARGO" = "1" ]; then
  echo "== embargo ATIVO: retirando a matéria da árvore só durante o build"
  [ -f "$JSON" ] && mv "$JSON" "$GUARDA/"
  [ -d "$MIDIA" ] && mv "$MIDIA" "$GUARDA/"
else
  echo "== EMBARGO=0: a matéria ENTRA no build (confira 'publicado': true no JSON)"
fi

echo "== testes"
"$NODE" node_modules/vitest/vitest.mjs run 2>&1 | tail -3
echo "== typecheck + build (Node $("$NODE" --version))"
"$NODE" node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
"$NODE" node_modules/vite/bin/vite.js build 2>&1 | tail -2

# Guarda anti-build-vazio (o mesmo cinto do CI).
test -s dist/index.html && grep -q "assets/index-" dist/index.html || { echo "ERRO: dist/ inválido"; exit 1; }

if [ "$EMBARGO" = "1" ]; then
  if grep -rl "barco-da-ciencia" dist/ >/dev/null; then
    echo "ERRO: o embargo VAZOU no dist/ — inct_deploy/ NÃO foi tocada:"
    grep -rl "barco-da-ciencia" dist/
    exit 1
  fi
  echo "== guarda do embargo: ok (zero rastros no dist/)"
fi

echo "== inct_deploy/ = dist/"
rsync -a --delete dist/ inct_deploy/
diff -rq dist inct_deploy >/dev/null && echo "inct_deploy == dist"

# ---------------------------------------------------------------------------
# O SQL VAI JUNTO, e é gerado AQUI (decisão do dono, 15/08/2026): o banco e o
# site sobem no mesmo movimento, então o arquivo que está em inct_deploy/ é
# sempre o SQL do site que está sendo publicado. Um paste só, ordem canônica,
# idempotente, sem desfazer o que já existe (as travas estão documentadas em
# scripts/build-sql-completo.py, e o gerador ABORTA se alguma delas deixar de
# casar). O `rsync --delete` acima roda ANTES de propósito: o arquivo é
# recriado a cada regeneração e nunca fica velho.
# ---------------------------------------------------------------------------
echo "== SQL completo do banco"
"${PYTHON:-python3}" scripts/build-sql-completo.py || {
  echo "ERRO: não consegui gerar o BANCO-COMPLETO.sql — inct_deploy/ ficou SEM o SQL."
  echo "      (o gerador aborta de propósito quando uma trava de semente não casa mais)"
  exit 1
}

# O estado de ensaio precisa existir FORA do terminal: quem sobe a pasta pode
# não ser quem a gerou, e o arquivo aparece na listagem do hPanel.
rm -f inct_deploy/ENSAIO-ATIVO.txt
if [ "${ENSAIO_PRODUCAO:-0}" = "1" ]; then
  cat > inct_deploy/ENSAIO-ATIVO.txt <<AVISO
PACOTE DE ENSAIO — gerado em $(date '+%F %H:%M') — NÃO é o site normal.
Contém um evento de teste publicado e AO VIVO na home e no hub.
Para desfazer: bash scripts/ensaio-transmissao.sh --fim  (e subir de novo).
AVISO
fi

echo "== conferências"
JS=$(ls inct_deploy/assets/index-*.js | head -1)
CSS=$(ls inct_deploy/assets/index-*.css | head -1)
grep -q "supabase.co"       "$JS"  && echo "ok  Supabase assado (.env presente)"      || echo "ATENÇÃO: sem Supabase no bundle (faltou .env?)"
grep -q "footer-watermark"  "$CSS" && echo "ok  rodapé novo"                          || echo "ATENÇÃO: rodapé novo ausente"
grep -q "meu-ano"           "$JS"  && echo "ok  relato anual"                         || echo "ATENÇÃO: relato ausente"
grep -q "webinario-ofidio-venom-saude-1" "$JS" && echo "ok  webinário OFÍDIO"          || echo "ATENÇÃO: webinário ausente"
[ -f inct_deploy/robots.txt ]      && echo "ok  robots.txt"                           || echo "ATENÇÃO: robots.txt ausente"
grep -q "016_trocar_identificacao" inct_deploy/BANCO-COMPLETO.sql 2>/dev/null \
  && echo "ok  BANCO-COMPLETO.sql ($(wc -l < inct_deploy/BANCO-COMPLETO.sql) linhas, a sequência inteira)" \
  || echo "ATENÇÃO: BANCO-COMPLETO.sql ausente ou incompleto"
echo "arquivos: $(find inct_deploy -type f | wc -l) · $(du -sh inct_deploy | cut -f1) · bundle: $(basename "$JS")"
echo "== pronto: suba o CONTEÚDO de inct_deploy/ para public_html/ e rode bash scripts/probe-live.sh"
