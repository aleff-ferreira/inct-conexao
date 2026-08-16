#!/usr/bin/env bash
# ============================================================================
#  Ensaio de transmissão — ver o player tocando de verdade, antes do dia.
#
#  DOIS MODOS
#
#  1) LOCAL (padrão) — só na sua máquina, nada sai daqui:
#       bash scripts/ensaio-transmissao.sh https://youtube.com/live/XXXXXXXXXXX
#     Força "ao vivo" no webinário real, sobe o servidor de desenvolvimento em
#     http://localhost:5199 e desfaz tudo no Ctrl+C. `build-deploy.sh` aborta
#     enquanto isso estiver aberto.
#
#  2) PRODUÇÃO — no site oficial, para provar o domínio real:
#       bash scripts/ensaio-transmissao.sh --producao https://youtube.com/live/XXXXXXXXXXX
#       (testa)   ... e no fim, obrigatoriamente:
#       bash scripts/ensaio-transmissao.sh --fim
#
#     O modo produção força "ao vivo" no PRÓPRIO webinário de 18/08 (decisão do
#     dono, 16/08/2026): é a página que vai ao ar de verdade, e é ela que se
#     quer provar. Enquanto o ensaio durar, o site oficial mostra, medido no
#     código:
#       - selo "Ao vivo" ao lado de "18 de agosto de 2026" (a data não muda);
#       - o botão "Adicionar à agenda" SOME do hero e do painel lateral (ele só
#         existe no estado "em breve"), e é o único caminho de calendário;
#       - o hub diz "Nenhuma transmissão agendada no momento" na mesma tela em
#         que anuncia "Ao vivo agora";
#       - o bloco de perguntas continua com "será aberto pouco antes".
#     Nada disso quebra a página; são frases incoerentes enquanto o teste roda.
#     Por isso o ensaio deve ser CURTO e o --fim é obrigatório.
#
#  A TRANSMISSÃO NO YOUTUBE deve estar como NÃO LISTADA:
#    Não listada -> fora da busca, fora do canal, INSCRITOS NÃO SÃO NOTIFICADOS
#                   (documentado: support.google.com/youtube/answer/7457584),
#                   e o embed funciona.
#    Privada     -> o embed PARA de funcionar (answer/9230970). Não serve.
#  Confira também "Permitir incorporação" ligada, em Studio > Conteúdo > Ao vivo
#  > Detalhes > Mostrar mais (ou na Sala de Controle > Editar > Personalização).
#
#  SAIBA: no modo produção o site publica a URL da transmissão em texto
#  clicável sob o player ("assistir direto no YouTube") e ela também fica
#  legível dentro do JavaScript. "Não listada" significa "quem tem o link
#  assiste" — o link deixa de ser secreto. Use uma transmissão DESCARTÁVEL no
#  ensaio, nunca a mesma que vai servir o evento real.
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

NODE=./.tools/node-v22.22.3-linux-x64/bin/node
[ -x "$NODE" ] || { echo "ERRO: node do projeto não encontrado em $NODE"; exit 1; }

REAL=src/content/webinars/webinario-ofidio-venom-saude-1.json
ENSAIO=src/content/webinars/_ensaio-tecnico.json

# ---------------------------------------------------------------- modo --fim
if [ "${1:-}" = "--fim" ]; then
  [ -f "$ENSAIO" ] && rm -f "$ENSAIO" && echo "== evento de ensaio removido"
  git checkout -- "$REAL" 2>/dev/null || true
  echo "== regenerando inct_deploy/ SEM o ensaio"
  bash scripts/build-deploy.sh
  cat <<'FIM'

  ──────────────────────────────────────────────────────────────────────────
   FALTA O PASSO QUE DESFAZ DE VERDADE: suba inct_deploy/ para public_html/.
   Enquanto não subir, o site oficial CONTINUA em estado de ensaio.

   Depois, confira:  bash scripts/probe-live.sh
   E apague no hPanel os assets/*.js antigos (o chunk do ensaio carrega a URL
   da transmissão e continua alcançável por link direto até ser apagado).
  ──────────────────────────────────────────────────────────────────────────

FIM
  exit 0
fi

# -------------------------------------------------------- argumentos comuns
MODO=local
URL="${1:-}"
if [ "${1:-}" = "--producao" ]; then MODO=producao; URL="${2:-}"; fi

if [ -z "$URL" ]; then
  cat <<'USO'
uso:
  ensaio local (só na sua máquina):
    bash scripts/ensaio-transmissao.sh https://youtube.com/live/XXXXXXXXXXX
  ensaio no site oficial:
    bash scripts/ensaio-transmissao.sh --producao https://youtube.com/live/XXXXXXXXXXX
    bash scripts/ensaio-transmissao.sh --fim        # OBRIGATÓRIO depois
USO
  exit 1
fi

# ------------------------------------------------------------ modo produção
if [ "$MODO" = "producao" ]; then
  if ! git diff --quiet -- "$REAL"; then
    echo "ERRO: $REAL já tem alterações não comitadas."
    echo "      Comite ou desfaça (git checkout -- $REAL) antes do ensaio,"
    echo "      para o --fim não apagar seu trabalho."
    exit 1
  fi

  "${PYTHON:-python3}" - "$REAL" "$URL" <<'PY'
import json, sys
caminho, url = sys.argv[1], sys.argv[2]
j = json.load(open(caminho, encoding="utf-8"))
j["_ENSAIO"] = {"modo": "producao",
                "aviso": "ESTADO DE TESTE NO AR. Desfazer: bash scripts/ensaio-transmissao.sh --fim"}
j["status"] = "live"          # a data continua 18/08; só o ESTADO é forçado
j["liveStream"] = url
json.dump(j, open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"== webinário real forçado para AO VIVO com {url}")
PY

  echo "== regenerando inct_deploy/ COM o ensaio"
  ENSAIO_PRODUCAO=1 bash scripts/build-deploy.sh

  cat <<FIM

  ──────────────────────────────────────────────────────────────────────────
   1. Suba inct_deploy/ para public_html/ (o de sempre).
   2. Teste em:
      https://inct-conexao.com.br/#/webinars/webinario-ofidio-venom-saude-1
      (a home e o hub também mostram "Ao vivo" enquanto durar)
   3. TERMINOU? rode:  bash scripts/ensaio-transmissao.sh --fim
      e suba inct_deploy/ de novo. Só isso tira o site do estado de ensaio.

   URL em teste: $URL
   Enquanto o ensaio estiver no ar: o botão "Adicionar à agenda" some da
   página, o hub diz "Nenhuma transmissão agendada" ao lado de "Ao vivo
   agora", e a URL acima fica clicável sob o player. Faça curto.
  ──────────────────────────────────────────────────────────────────────────

FIM
  exit 0
fi

# --------------------------------------------------------------- modo local
if ! git diff --quiet -- "$REAL"; then
  echo "ERRO: $REAL já tem alterações não comitadas."
  echo "      Comite ou desfaça (git checkout -- $REAL) antes do ensaio."
  exit 1
fi

restaura() {
  git checkout -- "$REAL" 2>/dev/null || true
  echo; echo "== ensaio local encerrado; $REAL restaurado"
}
trap restaura EXIT INT TERM

"${PYTHON:-python3}" - "$REAL" "$URL" <<'PY'
import json, sys
caminho, url = sys.argv[1], sys.argv[2]
j = json.load(open(caminho, encoding="utf-8"))
j["_ENSAIO"] = {"modo": "local", "aviso": "build-deploy.sh aborta enquanto isto existir"}
j["status"] = "live"
j["liveStream"] = url
json.dump(j, open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"== modo LOCAL: status=live, liveStream={url}")
PY

cat <<'FIM'

────────────────────────────────────────────────────────────────────────────
  Abra:  http://localhost:5199/#/webinars/webinario-ofidio-venom-saude-1
  O site oficial NÃO é afetado. Ctrl+C encerra e restaura.
────────────────────────────────────────────────────────────────────────────

FIM

PATH="$PWD/.tools/node-v22.22.3-linux-x64/bin:$PATH" \
  npm run dev -- --host 0.0.0.0 --port 5199 --strictPort
