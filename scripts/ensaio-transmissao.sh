#!/usr/bin/env bash
# ============================================================================
#  Ensaio de transmissão — a página do webinário AO VIVO, só na sua máquina.
#
#  Para que serve: ver o player de verdade tocando a transmissão dentro da
#  página do evento, ANTES do dia, sem que ninguém veja e sem tocar no site
#  no ar.
#
#  Por que é seguro (três camadas independentes):
#   1. Roda o servidor de DESENVOLVIMENTO (não gera dist/, não gera
#      inct_deploy/). O site oficial só muda quando você sobe inct_deploy/
#      para a Hostinger — coisa que este script não faz e não pode fazer.
#   2. O JSON do webinário volta ao estado original quando o script termina,
#      inclusive com Ctrl+C ou erro (trap).
#   3. Enquanto o ensaio está aberto, o JSON carrega a marca `_ENSAIO`, e
#      `scripts/build-deploy.sh` ABORTA se a encontrar. Mesmo que este script
#      morra de um jeito que a trap não pegue, o pacote de deploy não sai
#      contaminado.
#
#  A transmissão no YouTube tem de estar como **NÃO LISTADA**:
#    Não listada -> ninguém acha (fora de busca, do canal, das indicações),
#                   inscritos NÃO são notificados, e o embed FUNCIONA.
#    Privada     -> o embed NÃO funciona (o player dá erro). Não sirva.
#    Pública     -> aparece para todo mundo. Não é ensaio.
#
#  Uso:
#    bash scripts/ensaio-transmissao.sh https://youtube.com/live/XXXXXXXXXXX
#    bash scripts/ensaio-transmissao.sh <url> --replay   # ensaia o estado "gravação"
#
#  Depois abra:  http://localhost:5199/#/webinars/webinario-ofidio-venom-saude-1
#  Para encerrar: Ctrl+C (o JSON é restaurado na hora).
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

URL="${1:-}"
MODO="${2:-live}"
if [ -z "$URL" ]; then
  echo "uso: bash scripts/ensaio-transmissao.sh <URL do YouTube> [--replay]"
  echo "     ex.: bash scripts/ensaio-transmissao.sh https://youtube.com/live/abcdefghijk"
  exit 1
fi

JSON=src/content/webinars/webinario-ofidio-venom-saude-1.json
NODE=./.tools/node-v22.22.3-linux-x64/bin/node
[ -x "$NODE" ] || { echo "ERRO: node do projeto não encontrado em $NODE"; exit 1; }

# Se a árvore já estiver suja neste arquivo, não sabemos o que restaurar.
if ! git diff --quiet -- "$JSON"; then
  echo "ERRO: $JSON já tem alterações não comitadas."
  echo "      Comite-as ou desfaça (git checkout -- $JSON) antes do ensaio,"
  echo "      para a restauração automática não apagar seu trabalho."
  exit 1
fi

restaura() {
  git checkout -- "$JSON" 2>/dev/null || true
  echo
  echo "== ensaio encerrado; $JSON restaurado"
  if grep -q '_ENSAIO' "$JSON" 2>/dev/null; then
    echo "   ATENÇÃO: a marca _ENSAIO continua no arquivo — desfaça à mão:"
    echo "   git checkout -- $JSON"
  else
    echo "   (sem status forçado, sem liveStream — como estava)"
  fi
}
trap restaura EXIT INT TERM

"${PYTHON:-python3}" - "$JSON" "$URL" "$MODO" <<'PY'
import json, sys
caminho, url, modo = sys.argv[1], sys.argv[2], sys.argv[3]
j = json.load(open(caminho, encoding="utf-8"))
j["_ENSAIO"] = "CONFIGURACAO TEMPORARIA DE TESTE — build-deploy.sh aborta se isto existir"
if modo == "--replay":
    j["status"] = "ended"
    j["replay"] = url
    print(f"== modo GRAVAÇÃO: status=ended, replay={url}")
else:
    j["status"] = "live"
    j["liveStream"] = url
    print(f"== modo AO VIVO: status=live, liveStream={url}")
json.dump(j, open(caminho, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
PY

cat <<FIM

────────────────────────────────────────────────────────────────────────────
  Abra:  http://localhost:5199/#/webinars/webinario-ofidio-venom-saude-1

  O que conferir:
   • o selo muda para AO VIVO (ou GRAVAÇÃO)
   • a fachada "Assistir agora · YouTube" aparece; ao clicar, o player toca
   • sob o palco, o link de fuga "assistir direto no YouTube"
   • console sem erro (F12)

  O site oficial NÃO é afetado: nada é construído nem enviado.
  Ctrl+C encerra e restaura o JSON.
────────────────────────────────────────────────────────────────────────────

FIM

PATH="$PWD/.tools/node-v22.22.3-linux-x64/bin:$PATH" \
  npm run dev -- --host 0.0.0.0 --port 5199 --strictPort
