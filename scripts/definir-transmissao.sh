#!/usr/bin/env bash
# ============================================================================
#  Cadastra a URL da transmissão no webinário e regenera o pacote de deploy.
#
#  Uso:
#    bash scripts/definir-transmissao.sh https://youtube.com/live/XXXXXXXXXXX
#    bash scripts/definir-transmissao.sh --limpar     # tira a URL (volta ao estado sem player)
#
#  NÃO força `status`. A página vira "ao vivo" sozinha no horário do evento
#  (18/08, 19h de Rondônia) e volta para "gravação" quando ele acaba. Forçar
#  status é coisa de ENSAIO (scripts/ensaio-transmissao.sh), não de produção.
#
#  A URL tem de ser a do VÍDEO/EVENTO, com o ID de 11 caracteres:
#     https://youtube.com/live/XXXXXXXXXXX          <- a do botão Compartilhar
#     https://www.youtube.com/watch?v=XXXXXXXXXXX   <- também serve
#  Formas que NÃO funcionam (o script recusa, em vez de deixar quebrar no ar):
#     youtube.com/@canal/live            (não tem ID; o site vira link externo)
#     youtube.com/embed/live_stream?...  (formato quebrado no próprio YouTube)
# ============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

JSON=src/content/webinars/webinario-ofidio-venom-saude-1.json
[ -f "$JSON" ] || { echo "ERRO: não achei $JSON"; exit 1; }

if [ "${1:-}" = "--limpar" ]; then
  "${PYTHON:-python3}" - "$JSON" <<'PY'
import json, sys
p = sys.argv[1]
j = json.load(open(p, encoding="utf-8"))
j.pop("liveStream", None); j.pop("liveStreamBackup", None); j.pop("status", None)
json.dump(j, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("== liveStream, liveStreamBackup e status removidos")
PY
else
  URL="${1:-}"
  [ -z "$URL" ] && { echo "uso: bash scripts/definir-transmissao.sh https://youtube.com/live/XXXXXXXXXXX"; exit 1; }

  "${PYTHON:-python3}" - "$JSON" "$URL" <<'PY'
import json, re, sys
p, url = sys.argv[1], sys.argv[2]

# Aceita as duas formas com ID; recusa as que o site não consegue incorporar.
m = (re.search(r"youtube\.com/live/([A-Za-z0-9_-]{11})", url)
     or re.search(r"[?&]v=([A-Za-z0-9_-]{11})", url)
     or re.search(r"youtu\.be/([A-Za-z0-9_-]{11})", url))
if not m or m.group(1) == "live_stream":
    print("ERRO: URL sem ID de vídeo. Use a do botão Compartilhar do evento,")
    print("      no formato https://youtube.com/live/<11 caracteres>.")
    print(f"      recebida: {url}")
    raise SystemExit(1)

j = json.load(open(p, encoding="utf-8"))
j["liveStream"] = url
# Rota de fuga sob o player, em endereço diferente do embed: se o iframe for
# bloqueado (proxy de universidade, extensão), a pessoa ainda chega ao vídeo.
j["liveStreamBackup"] = f"https://www.youtube.com/watch?v={m.group(1)}"
j.pop("status", None)              # o horário manda, não uma chave forçada
json.dump(j, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"== liveStream cadastrado (vídeo {m.group(1)})")
print(f"== liveStreamBackup: {j['liveStreamBackup']}")
print("== status NÃO forçado: a página vira ao vivo sozinha às 19h de 18/08")
PY
fi

echo
echo "== regenerando inct_deploy/"
bash scripts/build-deploy.sh

cat <<'FIM'

  ──────────────────────────────────────────────────────────────────────────
   1. Suba inct_deploy/ para public_html/ (o de sempre).
   2. Abra com Ctrl+Shift+R:
      https://inct-conexao.com.br/#/webinars/webinario-ofidio-venom-saude-1
      Esperado HOJE: contagem regressiva e, ao clicar no palco, o player do
      YouTube com a tela de espera do evento agendado.
      (Se aparecer "a transmissão aparecerá aqui", a URL não entrou.)
   3. Só então dispare o e-mail (envio-webinario-ofidio/).
  ──────────────────────────────────────────────────────────────────────────

FIM
