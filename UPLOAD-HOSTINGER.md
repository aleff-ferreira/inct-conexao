# Upload para a Hostinger — pasta `inct_deploy/`

Gerado em **30/07/2026** a partir do build atual. **215 arquivos, 82,5 MB.**
Conferido: idêntico a `dist/`, e testado servindo a própria pasta (todas as
rotas, o CMS, a página estática de figuras, os PDFs).

Este arquivo **não** faz parte do site — não suba ele.

> **Desde 04/08/2026 existe deploy automático** (`.github/workflows/deploy.yml`):
> todo push no `main` roda os testes, o build em Node 22 e envia o `dist/` por
> FTPS. O processo manual abaixo passa a ser SÓ para emergência — e tem um
> custo novo: upload manual dessincroniza o estado do CI
> (`.ftp-deploy-sync-state.json` no servidor). Se precisar fazê-lo, apague esse
> arquivo no servidor depois, para o próximo run ressincronizar tudo.
>
> **Para ativar o CI** (uma vez): criar uma conta FTP dedicada no hPanel
> (Arquivos → Contas FTP, restrita a `public_html`); no GitHub, Settings →
> Secrets and variables → Actions: secrets `FTP_SERVER`, `FTP_USERNAME`,
> `FTP_PASSWORD` e a **variable** `FTP_SERVER_DIR` começando em
> `./deploy-test/`. Conferido o resultado em
> `inct-conexao.com.br/deploy-test/`, mude a variable para `./` e apague a
> pasta de teste. Sem os secrets, o CI só valida o build (verde, sem deploy).
> A primeira execução com FTP sobe o site inteiro (10–20 min; **nunca estrear
> no dia de um evento**); as seguintes são incrementais (~4–6 min).
> `.htaccess`, `llms.txt` e `.private` no servidor não são tocados — o sync só
> apaga o que ele mesmo subiu.

---

## O que subir

Todo o conteúdo de `inct_deploy/` vai para **`public_html/`** na Hostinger.
Suba o **conteúdo** da pasta, não a pasta: o `index.html` tem de ficar em
`public_html/index.html`, e não em `public_html/inct_deploy/index.html`.

Estrutura esperada no servidor:

```
public_html/
├── index.html
├── admin/          (CMS Sveltia)
├── assets/         (JS, CSS, imagens, vídeos, PDFs)
└── figuras/        (páginas estáticas dos gráficos, com SVG e CSV)
```

## Como subir

**Pelo hPanel (mais simples).** Gerenciador de Arquivos → `public_html` →
enviar. Para 82,5 MB, compacte antes: `zip -r inct_deploy.zip inct_deploy` e
use "Extrair" no painel — enviar 215 arquivos avulsos pelo navegador costuma
falhar no meio.

**Por SSH/rsync (mais rápido e seguro).** `deploy.sh` na raiz do projeto já
faz isso; falta preencher `SSH_HOST` e `SSH_USER` com os dados de
hPanel → Avançado → SSH.

## Depois de subir: apagar os arquivos antigos

O Vite põe um hash no nome de cada arquivo, então os chunks do build anterior
**não são sobrescritos** — eles ficam no servidor ocupando espaço e sendo
servidos a quem tiver HTML em cache. Se você subir por cima em vez de limpar
`public_html/assets/` antes, apague estes 16:

```
assets/Gestao-DxlS685N.js          assets/NoticiasTeaser-OKwFh78s.js
assets/Inscricao-DAqfwtK_.js       assets/PasswordCard-FVs-e-Rx.js
assets/MapaPage-CmD1aObQ.js        assets/api-BHC-lVVU.js
assets/MapaTeaser-blAMooz8.js      assets/content-C8kZeA7h.js
assets/MinhaInscricao-TDC_Pg3G.js  assets/index-CVaDUo14.css
assets/NoticiaPage-BCox6jlN.js     assets/index-DwYg4LLd.js
assets/NoticiasHub-CTrwCQkX.js     assets/lock-BnPOzh37.js
assets/share-2-BmF__OcG.js         assets/shield-alert-BgWmjbpm.js
```

## Conferir depois do upload

1. `https://inct-conexao.com.br/` carrega e o menu funciona.
2. **`/#/editais/selecao-ic-2026/resultado`** — os 50 selecionados aparecem, e
   a busca acha um nome digitado sem acento.
3. `/#/mapa?modo=narrativa` — ao rolar, o mapa fica fixo e troca de camada.
4. `/figuras/` — abre como página estática, com gráfico, tabela e CSV.
5. `/#/editais/selecao-ic-2026` — o selo diz "Resultado publicado".
6. Recarregue com Ctrl+F5: se algo parecer o site velho, é HTML em cache.

## Sobre o peso

82,5 MB, dos quais **45 MB são cinco vídeos**:

| arquivo | tamanho |
|---|---|
| `assets/instagram-nazare-atendimentos.mp4` | 16,8 MB |
| `assets/instagram-inpe-visita-tecnica.mp4` | 7,7 MB |
| `assets/instagram-barco-ciencia-acao.mp4` | 7,6 MB |
| `assets/hero/hero-montage.mp4` | 7,1 MB |
| `assets/noticias/.../hero-sobrevoo.mp4` | 6,3 MB |

Os quatro do Instagram têm `preload="none"`: não pesam no carregamento, só
ocupam disco. O do hero baixa na primeira visita em desktop (no celular, uma
variante de 1,2 MB). Se o upload completo for um problema recorrente, esses
cinco arquivos são o alvo — vale reencodá-los antes do próximo deploy.

## Alternativa: upload incremental

Em relação ao que já está no ar, mudaram **26 arquivos novos** (~700 kB, quase
todos JS e CSS) e o `index.html`. Se preferir subir só o necessário, peça a
pasta incremental — sobem ~1 MB em vez de 82,5 MB, e os 16 arquivos acima
continuam precisando ser apagados.
