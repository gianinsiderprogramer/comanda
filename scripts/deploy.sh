#!/usr/bin/env bash
# Sube la última versión commiteada al Cloud Server y reinicia la app.
set -euo pipefail

SERVER=root@201.32.132.172
SSH="ssh -i $HOME/.ssh/donweb_hackaton -p 5750 -o BatchMode=yes -o IdentitiesOnly=yes"

git archive HEAD | $SSH "$SERVER" 'tar -x -C /root/comanda && cd /root/comanda && npm ci --omit=dev --no-audit --no-fund --silent && pm2 restart comanda --update-env > /dev/null'
sleep 2
curl -s -m 10 -o /dev/null -w 'https://dwday-124838444.online -> %{http_code}\n' https://dwday-124838444.online/
