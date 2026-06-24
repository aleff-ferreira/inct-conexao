#!/usr/bin/env bash
S=https://inct-conexao.com.br
echo "=== lazy chunks + assets present ==="
for path in /assets/Admin-BfsoARiR.js /assets/dist-Ce_BdC0M.js /assets/clima-saude.jpg /assets/institution-logos/unir.png; do
  curl -s -o /dev/null -w "%{http_code}  %{content_type}  %{size_download}b  $path\n" --max-time 25 "$S$path"
done
echo
echo "=== cache headers on a hashed asset ==="
curl -sSI --max-time 25 "$S/assets/index-CYQvwmZx.js" | grep -iE "cache-control|expires|content-encoding|content-type|server|vary|etag"
echo
echo "=== deep path / SPA fallback behaviour ==="
curl -s -o /dev/null -w "/webinars       -> %{http_code}\n" --max-time 25 "$S/webinars"
curl -s -o /dev/null -w "/inexistente123 -> %{http_code}\n" --max-time 25 "$S/inexistente123"
echo
echo "=== redirects: http->https and www ==="
curl -s -o /dev/null -w "http  apex -> %{http_code} loc=%{redirect_url}\n" --max-time 25 "http://inct-conexao.com.br/"
curl -s -o /dev/null -w "https www  -> %{http_code} loc=%{redirect_url}\n" --max-time 25 "https://www.inct-conexao.com.br/"
echo
echo "=== robots.txt / sitemap ==="
curl -s -o /dev/null -w "/robots.txt  -> %{http_code}\n" --max-time 25 "$S/robots.txt"
curl -s -o /dev/null -w "/sitemap.xml -> %{http_code}\n" --max-time 25 "$S/sitemap.xml"
