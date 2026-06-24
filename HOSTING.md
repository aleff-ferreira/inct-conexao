# Hospedagem & deploy — inct-conexao.com.br

Referência para publicar atualizações. Verificado em 2026-06-23 inspecionando o
site no ar.

## Onde o site está

- **Host:** Hostinger (hPanel, servidor **LiteSpeed**, HTTP/2 + HTTP/3). SSL
  gratuito ativo; `http://` redireciona 301 para `https://` (apex).
- **O site é estático:** um build do React 19 + Vite (`dist/` = `index.html` +
  assets com hash no nome, `base:"./"`). Roteamento por **hash** (`/#/webinars`,
  `/#/webinars/<slug>`, `/#/admin`).
- **Conteúdo dinâmico (webinars):** vive no **Supabase** (serviço separado), lido
  pelo navegador. O Hostinger só serve os arquivos estáticos.

## Regra de ouro

> **Conteúdo (webinars) = Supabase → publica na hora, sem redeploy.**
> **Código/visual ou troca de chaves do Supabase = rebuild local + reenviar `dist/`.**

O Hostinger **não compila** o projeto. Sempre rode `npm run build` **localmente**
e suba o `dist/`.

## Publicar uma atualização (passo a passo)

1. **Build local:**
   ```
   cd /home/aleff/inct
   PATH=/home/aleff/inct/.tools/node-v22.22.3-linux-x64/bin:$PATH npm run build
   ```
2. **Gerar o zip** com o **conteúdo** de `dist/` (o `index.html` na raiz do zip):
   ```
   python3 scripts/make-zip.py        # gera inct-conexao-deploy.zip
   ```
3. **hPanel → File Manager → `public_html`:**
   - **Apague os arquivos antigos do build primeiro** — o `index.html` e a pasta
     `assets/` antiga. (Como os nomes têm hash, os arquivos antigos não são
     sobrescritos e se acumulam.) **Não apague** o `.htaccess` nem arquivos que
     você mantém à mão.
   - **Upload** do `inct-conexao-deploy.zip` → clique direito → **Extract** em
     `public_html` → apague o zip.
   - Confira que existem `public_html/index.html` e `public_html/assets/`.
4. Se uma mudança não aparecer, **limpe o cache**: hPanel → site → Manage →
   Advanced → Cache Manager → Purge All (e o CDN, se estiver ligado).

Alternativas de upload: **FTP/SFTP** (SFTP em planos com SSH) para automação; a
**Git deployment** do Hostinger só faz *pull* (não compila) — só serviria se o
`dist/` fosse commitado no repositório. **Não** use o recurso "Node.js App" para
este site estático.

## Conteúdo — site estático + painel (CMS) para editar

O site servido é **100% estático** (sem backend no Hostinger). O conteúdo vive em
arquivos JSON, **um por item**:
- **Webinars:** `src/content/webinars/<slug>.json`
- **Grupos:** `src/content/groups/<slug>.json`
- `src/webinars/data.ts` apenas **carrega** esses JSONs (via `import.meta.glob`),
  normaliza os caminhos de imagem e expõe os arrays para os componentes.

Há **duas formas** de editar:
1. **Painel `/admin`** (Sveltia CMS): líderes de grupo editam em formulários e o
   painel grava os JSONs no GitHub. Você faz `git pull` + build + upload. Guia
   completo: [`docs/cms-setup.md`](docs/cms-setup.md).
2. **À mão / modo local:** editar os JSONs (ou usar o painel em "modo local") →
   `npm run build` → reenviar o `dist/`.

O painel é estático e sobe junto no build (fica em `/admin`, marcado `noindex`).
Para funcionar online, o projeto precisa estar num repositório do GitHub e ter o
login configurado — ver `docs/cms-setup.md`.

## Roteamento (importante)

O roteamento por **hash** funciona sem nenhuma config no servidor — o caminho no
servidor é sempre `/`. Caminhos "profundos" sem hash (ex.: `/webinars`) retornam
**404** (não há fallback de SPA), mas isso **não afeta** as rotas reais do site,
que usam `#/`. Ao compartilhar links, inclua o `#/`.

> Se um dia migrarmos para URLs "limpas" (history routing, ex.: `/webinars`), aí
> sim será preciso um `.htaccess` reescrevendo tudo para `index.html` (ver abaixo).

## `.htaccess` recomendado (aplicar UMA vez, com cuidado)

O servidor já parece ter um `.htaccess` (a URL `/.htaccess` responde 403). **Não**
inclua um `.htaccess` no zip de deploy — ele sobrescreveria o do servidor na
extração. Em vez disso, edite o `.htaccess` existente pelo File Manager e
acrescente os blocos abaixo (mescle, não substitua).

**1) Cache certo (recomendado):** garante que o `index.html` nunca fique preso em
cache (senão visitantes recorrentes veem o build antigo após um deploy), enquanto
os assets com hash podem ser "imutáveis":

```apache
<IfModule mod_headers.c>
  <FilesMatch "index\.html$">
    Header set Cache-Control "no-cache, must-revalidate"
  </FilesMatch>
  <FilesMatch "\.(js|mjs|css|woff2|png|jpg|jpeg|svg|webp|avif)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

**2) Canonical www→apex (opcional, bom para SEO):** hoje o `www` também responde
200 sem redirecionar. Use `https://` no destino (Force HTTPS está ligado):

```apache
RewriteEngine On
RewriteCond %{HTTP_HOST} ^www\.inct-conexao\.com\.br$ [NC]
RewriteRule ^(.*)$ https://inct-conexao.com.br/$1 [L,R=301]
```

**3) Fallback de SPA — SÓ se migrar para history routing (não usar hoje):**

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>
```

## Staging / pré-visualização

Não há staging para sites estáticos no Hostinger (o staging do painel é só para
WordPress). Opções: `npm run preview` localmente, ou criar um **subdomínio**
(ex.: `staging.inct-conexao.com.br`) e subir o build lá antes de promover para o
`public_html`.

## Estado atual (2026-06-23)

No ar está o build mais recente (chunks `index-*`, `Admin-*` e o SDK do Supabase
`dist-*` carregam 200; assets e logos OK). O módulo de webinars está **no ar em
modo de demonstração** — falta apenas criar o projeto Supabase e subir um build
com as chaves para ativar o login do operador.

## Lacunas a considerar depois

- Sem `robots.txt` / `sitemap.xml` (ambos 404) — úteis para SEO.
- `www` sem redirect canônico (ver `.htaccess` acima).
- `index.html` sem `Cache-Control` explícito (ver `.htaccess` acima).
