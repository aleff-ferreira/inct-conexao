# Upload para a Hostinger — pasta `inct_deploy/`

Regenerado em **04/08/2026** a partir de um build LIMPO do commit `ad8feb7`
(worktree do HEAD — sem trabalho local não comitado). **228 arquivos,
86,3 MB.** Conferido byte a byte contra `dist/`. Inclui: plataforma de
webinários com os dois eventos publicados, mapa interativo (ondas 1–3, relevo
AVIF), resultado IC 2026 e notícias.

Pronto para subir: **`inct-site-2026-08-04.zip`** (80 MB, na raiz do repo) —
o conteúdo está na RAIZ do zip, então "Extrair" dentro de `public_html/`
coloca o `index.html` direto no lugar certo. *(O zip antigo embrulhava a
pasta `inct_deploy/` e o site já foi parar em `public_html/inct_deploy/` uma
vez — este formato elimina esse erro.)*

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

**Pelo hPanel (mais simples).** Gerenciador de Arquivos → entrar em
`public_html` → enviar **`inct-site-2026-08-04.zip`** → "Extrair" **ali
dentro** → apagar o zip do servidor. O conteúdo já está na raiz do arquivo:
extrai direto no lugar certo, sem criar subpasta. Não toque em `.htaccess`,
`llms.txt` nem `.private` — o zip não os contém e a extração não os remove.

**Por SSH/rsync (mais rápido e seguro).** `deploy.sh` na raiz do projeto já
faz isso; falta preencher `SSH_HOST` e `SSH_USER` com os dados de
hPanel → Avançado → SSH.

**Daqui em diante, o caminho preferido é o CI** (`.github/workflows/deploy.yml`):
configurados os secrets de FTP, todo push no `main` publica sozinho e este
processo manual vira emergência.

## Antes de extrair: limpar o build antigo

O Vite põe um hash no nome de cada arquivo, então os chunks do build anterior
**não são sobrescritos** — ficam ocupando espaço e sendo servidos a quem tiver
HTML em cache. A limpeza segura, no Gerenciador de Arquivos, é apagar **estas
quatro coisas** dentro de `public_html/` antes de extrair o zip (todas são
100% regeneradas pelo build):

```
public_html/index.html
public_html/assets/     (inteira)
public_html/admin/      (inteira)
public_html/figuras/    (inteira)
```

**NÃO apague** `.htaccess`, `llms.txt`, `.private` nem qualquer outro arquivo
na raiz — eles não vêm do build e o site precisa deles.

## Conferir depois do upload

Primeiro, o automático — da raiz do repositório:

```
bash scripts/probe-live.sh
```

Ele compara o bundle publicado com o local, confere os assets essenciais
(incluindo o relevo AVIF do mapa), verifica que a plataforma de webinários
está assada no bundle no ar e que `robots.txt`/`llms.txt` sobreviveram.

Depois, no navegador:

1. `https://inct-conexao.com.br/` carrega; o teaser do webinário em destaque
   mostra **"16:00 RO · 17:00 Brasília"**.
2. **`/#/webinars`** — destaque "Em breve" (Clima, 27/08) com contagem
   regressiva viva + cartão "Gravação" (Bioprospecção).
3. **`/#/webinars/mesa-redonda-clima-eventos-extremos-saude-unica-amazonia`**
   — contagem, horários traduzidos no topo e no painel lateral, botão
   "Adicionar à agenda" baixa um .ics válido.
4. **A página do evento encerrado** diz "A gravação será publicada em breve"
   (nunca um vídeo de Instagram no palco).
5. `/#/editais/selecao-ic-2026/resultado` — os 50 selecionados, busca sem acento.
6. `/#/mapa?modo=narrativa` — mapa fixo ao rolar; `/#/mapa?modo=explorador` —
   botão "Ocultar camadas" funciona.
7. `/figuras/` — página estática com gráfico, tabela e CSV.
8. Recarregue com Ctrl+F5: se algo parecer o site velho, é HTML em cache.
9. `/admin` — a tela do CMS abre, mas o LOGIN ainda não funciona (OAuth sem
   `base_url`); editar conteúdo em produção continua sendo pelo GitHub por
   enquanto. Não é regressão: nunca funcionou em produção.

## Sobre o peso

86,3 MB, dos quais **45 MB são cinco vídeos**:

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
