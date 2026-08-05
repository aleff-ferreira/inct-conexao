#!/usr/bin/env bash
# Sonda o site oficial DEPOIS de um upload.
#
# Não depende de nomes com hash (a versão anterior apontava para bundles de um
# build antigo e virava falso alarme): lê o index.html PUBLICADO e deriva os
# arquivos reais dele. Rode da raiz do repositório: bash scripts/probe-live.sh
S=https://inct-conexao.com.br

HTML=$(curl -s --max-time 25 "$S/")
BUNDLE=$(printf '%s' "$HTML" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
[ -z "$BUNDLE" ] && { echo "ERRO: index.html publicado não referencia bundle nenhum"; exit 1; }

echo "=== o build publicado é o esperado? ==="
LOCAL=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' inct_deploy/index.html 2>/dev/null | head -1)
echo "local : ${LOCAL:-'(rode do diretório do repo para comparar)'}"
echo "no ar : $BUNDLE"
[ -n "$LOCAL" ] && [ "$LOCAL" != "$BUNDLE" ] && echo ">>> DIFEREM: o upload não chegou (cache? pasta errada?)"

echo
echo "=== assets essenciais ==="
for path in "/$BUNDLE" /assets/clima-saude.jpg /assets/maps/brasil-relevo.avif /assets/maps/brasil-relevo-alta.avif /admin/config.yml; do
  curl -s -o /dev/null -w "%{http_code}  %{content_type}  %{size_download}b  $path\n" --max-time 25 "$S$path"
done

echo
echo "=== plataforma de webinários assada no bundle publicado ==="
JS=$(curl -s --max-time 60 "$S/$BUNDLE")
for marca in mesa-redonda-clima-eventos-extremos-saude-unica-amazonia \
             mesa-redonda-biodiversidade-bioprospeccao-bioeconomia-amazonia \
             youtube-nocookie "em Brasília" live_stream; do
  printf '%s' "$JS" | grep -q "$marca" && echo "ok    $marca" || echo "FALTA $marca"
done

echo
echo "=== cache headers num asset com hash ==="
curl -sSI --max-time 25 "$S/$BUNDLE" | grep -iE "cache-control|expires|content-encoding|content-type|etag"

echo
echo "=== redirects: http->https e www ==="
curl -s -o /dev/null -w "http  apex -> %{http_code} loc=%{redirect_url}\n" --max-time 25 "http://inct-conexao.com.br/"
curl -s -o /dev/null -w "https www  -> %{http_code} loc=%{redirect_url}\n" --max-time 25 "https://www.inct-conexao.com.br/"

echo
echo "=== arquivos que o upload NÃO pode ter destruído ==="
for path in /robots.txt /llms.txt; do
  curl -s -o /dev/null -w "%{http_code}  $path\n" --max-time 25 "$S$path"
done
