#!/usr/bin/env bash
# ============================================================================
#  Deploy do site INCT-CONEXAO para a Hostinger via SSH/rsync.
#  Uso:  bash deploy.sh
#  Pré-requisitos (uma vez só):
#    1. hPanel → Avançado → SSH: ativar e anotar HOST/PORTA/USUÁRIO abaixo;
#    2. autorizar a chave:  ssh-copy-id -i ~/.ssh/hostinger_deploy.pub \
#         -p PORTA USUARIO@HOST   (digite a senha do painel uma única vez)
#  Depois disso, todo deploy é só rodar este script.
# ============================================================================
set -euo pipefail

# --- PREENCHA com os dados de hPanel → Avançado → SSH -----------------------
SSH_HOST="COLOQUE_O_IP_OU_HOST_AQUI"      # ex.: 185.x.x.x  ou  br-srv...
SSH_PORT="65002"                          # porta SSH da Hostinger (confira no painel)
SSH_USER="COLOQUE_O_USUARIO_AQUI"         # ex.: u859281447
REMOTE_DIR="~/public_html"                # raiz pública do site
# ----------------------------------------------------------------------------

KEY="$HOME/.ssh/hostinger_deploy"
SRC="$(cd "$(dirname "$0")" && pwd)/dist/"

if [ ! -d "$SRC" ]; then
  echo "ERRO: pasta dist/ não existe — rode 'npm run build' antes." >&2
  exit 1
fi

echo "== Deploy INCT-CONEXAO → ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR} =="
echo "   (aditivo: NÃO usa --delete, então os arquivos do WordPress ficam intocados)"

# rsync incremental: só envia o que mudou. Sem --delete de propósito —
# public_html ainda contém o WordPress e não queremos apagá-lo por engano.
rsync -avz --progress \
  -e "ssh -i $KEY -p $SSH_PORT -o StrictHostKeyChecking=accept-new" \
  "$SRC" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

echo ""
echo "✔ Deploy concluído. Agora limpe o cache: hPanel → Essenciais → Cache → Limpar cache."
