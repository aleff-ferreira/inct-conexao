# Upload para a Hostinger — pasta `inct_deploy/`

Regenerado em **13/08/2026** com typecheck e as **785 asserções** verdes
(28 arquivos de teste). **265 arquivos, ~85 MB** (zip de 80,8 MB).
`dist/` MENOS a matéria embargada (ver o bloco a seguir): é a única diferença.

A regeneração de **13/08** leva o **CONEXAO-BIOINFORMÁTICA** e os acabamentos
do dia:

- **Curso "CONEXAO-BIOINFORMÁTICA: Do átomo à ação biológica"** (`#/curso`):
  página pública com inscrição em 4 passos, escolha de turma (teórica 19 ou
  20/08, prática 21/08 manhã ou tarde), vagas restantes ao vivo com barra de
  ocupação (teto de 40 por turma, imposto no banco sob trava consultiva),
  LGPD, rascunho local, painel da coordenação com cartão de divulgação e CSV.
  **Depende da migração `013_curso_atomo.sql` + seed `004_curso_atomo.sql`**
  (já aplicadas e conferidas ao vivo em 13/08: `curso_vagas` responde 40/40).
- **Menu EVENTOS** no cabeçalho (agrupa Webinars, Fitofarmas e o curso) e a
  volta dos itens Governança, Mapa, Grupos e Contato; a barra recolhe para o
  menu lateral abaixo de 1400px.
- **Animação da molécula do herói refeita**: cena de docagem cientificamente
  correta (catecol em bola e vareta com Kekulé, bolso como superfície
  molecular, pontes de hidrogênio tracejadas) narrando o ciclo de associação
  e dissociação em 14 s. Decisão do dono: anima para todo mundo, inclusive
  sob prefers-reduced-motion.
- **Sem travessões** no texto visível do módulo do curso e do aviso da home
  (24 substituições, na régua de `docs/remocao-travessoes-2026-08-11.md`);
  rótulos de seção (`eyebrow`) do curso na variante escura, legíveis no fundo
  claro (contraste ~10,9:1).

⚠️ A ordem de SQL canônica agora é **`supabase/SEQUENCIA-COMPLETA.md`**
(13/08, provada num Postgres limpo). Antes deste upload, aplique o que lá
estiver pendente; em especial `011`, `012_superadmin`, `012_lla_vinculo`,
`013_identidade` e `014_documento_obrigatorio` (o relato depende delas), e
`008_workshop_fitofarmas` + seed `003_workshop_fitofarmas` para o Fitofarmas
gravar respostas.

A regeneração das **17h55 — a única válida desta data** (substitui a das 17h07
e todas as anteriores de 11/08) acrescenta a **remoção de todos os travessões
(—) e meias-riscas (–) do TEXTO VISÍVEL ao usuário**: 295 substituições por
pontuação natural do pt-BR (vírgula, dois-pontos, parênteses, ponto ou "a" em
intervalos) em 37 arquivos, cada uma com antes/depois/motivo em
`docs/remocao-travessoes-2026-08-11.md`. Não foram tocados comentários de
código, CSS, cabeçalhos de CSV, dados não-renderizados nem hífens comuns (o
processo 408474/2024-6 segue intacto). Varredura automática confirma **zero
travessões em texto renderizado**; suíte inteira verde (730) e embargo refeito.

A regeneração das **17h07** somou DUAS frentes: a
**revisão de texto de todo o site** — 110 correções de artefatos de escrita
(pontuação, decalques do inglês, fragmentação, capitalização) em 42 arquivos,
cada uma registrada com antes/depois/motivo em
`docs/revisao-copy-2026-08-11.md`, sem mudança de comportamento — e o
conserto do **"·" órfão** na linha de progresso do formulário individual
("Tela 1 de 6" e "faltam ~N min" agora são UMA linha; o separador solto virava
um ponto sozinho porque cada nó do grid vira linha própria) — e a linha de progresso dos DOIS formulários trocada por uma frase que acompanha o avanço ("Primeiro de 6 passos — uns 8 minutos ao todo" → "Passo 3 de 6 · faltam uns 5 minutos" → "Último passo — falta menos de um minuto"), sem repetir o título que o h2 da tela já diz. Suíte inteira
verde (730) e a conferência do embargo refeita e passada.

A regeneração de 13h08 consolidara TRÊS decisões
da coordenação do dia: (1) a remoção dos **dois parágrafos de abertura do
formulário Fitofarmas** ("Você já está inscrito(a)…" e "São cerca de 5
minutos…") — o cabeçalho de `#/fitofarmas` vai direto das datas ao primeiro
passo, com a estimativa de tempo preservada na barra de progresso; (2) a
remoção da **nota "estes formulários não são a prestação de contas ao CNPq"**
dos cartões da Gestão (a distinção segue em `docs/relato-anual.md`); e (3) a
remoção da **linha do ciclo** ("Relato Anual — Ciclo 1 · período reportável ·
janela de envio") do painel — período e prazo seguem dentro dos formulários.
O artefato é **`inct_deploy/` + `inct-site-2026-08-11.zip`**, que INCLUEM
tudo das letras de 10/08 (anexo .docx, acesso por papel, acabamentos).

A 7ª regeneração acrescenta o **anexo `.docx`** ao relato individual (o
documento com dados da pesquisa, até 10 MB; PDF segue 1 MB e `.doc` de 2003
não entra) e a seção **"Documentos anexados"** no painel da coordenação —
lista com pessoa, laboratório, data, download por URL assinada e o consumo de
storage contra o orçamento de 1 GB. **Depende da migração 011** no Supabase
ANTES deste upload (`supabase/APLICAR-PRODUCAO.md`, linha 5b): sem ela o
bucket recusa o formato novo. (As letras “b” a “j” de 10/08 foram
consolidadas no artefato de 11/08 do topo deste arquivo — 730 asserções em 26
arquivos de teste.)
O “i” acrescenta o **acesso por papel** (decisão do dono, 10/08): líder de
laboratório vê e acessa SÓ o Formulário do LLA (no individual, um cartão o
direciona depois da identificação); os demais membros veem SÓ o individual;
deslogado vê os dois cartões (a porta decide). **Depende também da migração
012** (linha 5c do APLICAR-PRODUCAO.md): é ela que vincula `lla_user_id`
automaticamente na identificação do líder — sem ela o líder vê o gate mas a
RLS ainda o barra no formulário do laboratório.
As rodadas de acabamento de 10/08, acumuladas: perguntas dos marcáveis em
corpo/cor de título com placar “N marcadas” e ✓ no chip marcado; satisfação
1..5 como régua própria (5 quadrados, extremos escritos, ativo preenchido —
antes eram números sublinhados num grid quebrado, com classe ativa que nem
existia no CSS); anexo com botão em pt-BR (input nativo recortado da tela — o
“Choose File” vinha no idioma do navegador); declarações de veracidade/cessão
de volta ao plat-consent puro com checkbox visível de 18px (o rel-escolha as
centralizava e escondia o quadradinho de uma declaração com consequência
legal); e a seção dos cartões-porta com régua única de 16px e vão texto→botão
de 8px (o margin fixo do .plat-nav somado ao auto abria ~60px de buraco).
Além do anexo .docx, leva os acertos de interface apontados pelo dono em
10/08: cartões-porta do painel com altura igual e botões alinhados; fim do
botão duplicado “Está certo”/“Continuar” na Tela 1; o convite “Definir uma
senha” só para quem ainda não tem senha (detecção `temSenhaAtiva`: amr do JWT
+ marca `user_metadata.senha_definida`); o padrão “recolhido opcional” (Quer
detalhar?, JCR/Qualis, senha…) com moldura, resumo clicável em 0,95rem e
largura de linha inteira; e o bloco de objetivos (Q20) redesenhado — cada EET
é um menu recolhível com código em cor própria e placar, e os objetivos viram
linhas de checklist à esquerda em vez de caixas de chip centradas.

A 6ª regeneração leva o ciclo completo do **Relatório Anual**:

- **Formulário individual** (`#/relatorio-anual`, 6 telas) integrado às 32
  perguntas do questionário do CTC — um preenchimento responde os dois
  (mapeamento: `docs/relato-gforms.md`);
- **Índice H e citações automáticos**: OpenAlex pelo ORCID preenche sozinho;
  Google Acadêmico assume quando a pessoa colar o link do perfil uma vez
  (Edge Function `indicadores`; sem ela o OpenAlex cobre em silêncio). A fonte
  do número sai sempre escrita na tela (`docs/relato-indicadores.md`);
- **Painel da coordenação** (`#/gestao?area=relatorio`): 7 abas — cobertura,
  produção, RH, fomento/extensão, vozes da rede, metas/objetivos — e as
  automações: 3 CSVs pt-BR, envelope JSON do ciclo e a **minuta factual** com
  os números reais e a fonte de cada um, para colar no relatório do CNPq;
- Contadores de estudantes e RH formado **somados dos fatos** no formulário do
  laboratório (o líder confere, não redigita).

⚠️ **Depende das migrações 009 e 010 no Supabase ANTES deste upload** — a
ordem completa está em `supabase/APLICAR-PRODUCAO.md`. Subir o site com o
banco velho derruba o autosave de quem abrir o formulário.

A 5ª regeneração acrescenta o **painel do workshop dentro da Gestão**
(`#/gestao?area=fitofarmas` — a área "Fitofarmas" ao lado de "Processo
Seletivo" e "Relatório Anual"). Administradores logados veem: métricas de
campanha (respostas e correções, escore médio, **cadeiras por dia** 25/27,
faixas de priorização, compromissos assumidos, eixos e vínculos), a lista
priorizada por escore com busca e filtros, a **ficha completa de cada pessoa**
(contato clicável, Lattes/ORCID, todas as respostas) e **Exportar CSV** com os
rótulos legíveis. Só leitura e só admin — a regra é a RLS da migração 008, não
a tela; quem não é admin vê a explicação. Chunk próprio (~14 kB), não pesa em
quem não abre a área. Detalhes: docs/fitofarmas-pre-evento.md §5.

## ⛔ EMBARGO: a matéria do Barco da Ciência NÃO vai ao ar nesta versão

> **INCIDENTE CORRIGIDO em 10/08/2026 — leia antes de regenerar de novo.**
> O JSON da matéria apareceu com a chave `"publicado"` DUPLICADA: `false` no
> topo (o embargo) e `true` acrescentado no fim — provável gravação do CMS. Em
> `JSON.parse`, a última vence: o embargo estava anulado, e a pasta de deploy
> de 08/08 saiu com o texto E os assets da matéria dentro (nunca foi enviada ao
> servidor; o arquivo nunca foi commitado, então o CI tampouco a publicou).
> A duplicata foi removida. **Toda regeneração desta pasta deve terminar com a
> conferência:** `grep -rl "barco-da-ciencia" inct_deploy/` tem de voltar
> vazio — o script da 6ª regeneração já aborta sozinho se vazar.

Decisão da coordenação (07/08/2026): a matéria **"Adiada pelas condições do
rio, a última expedição do Barco da Ciência desembarcou em Nazaré"** ainda não
deve ser disponibilizada. Nesta versão:

- `src/content/noticias/expedicao-barco-da-ciencia-nazare.json` está com
  **`"publicado": false`** (o rascunho oficial do módulo: some do hub, da home
  e da rota, sem perder o conteúdo);
- além da flag, o BUILD desta pasta foi feito **sem o arquivo e sem os assets**
  da matéria (o glob das notícias é `eager` — só a flag deixaria o texto
  inteiro dentro do JavaScript). Zero rastros no zip: nem texto, nem imagens,
  nem os vídeos de drone (por isso os ~30 MB a menos).

**O upload NÃO apaga o que já está no servidor** — e a matéria FOI publicada
na versão anterior do site. Depois de extrair o zip, delete no Gerenciador de
Arquivos do hPanel, dentro de `public_html/`:

1. `assets/noticias/expedicao-barco-da-ciencia-nazare/` — as imagens e vídeos
   da matéria continuam lá, alcançáveis por URL direta, até serem apagados;
2. (opcional, higiene) os `assets/*.js` antigos que não constam do zip novo —
   são chunks órfãos da versão anterior; um deles contém o texto da matéria.

**Para publicar a matéria quando for a hora:** troque `"publicado": false` por
`true` (ou remova a linha) no JSON, rode o build normalmente e suba — nada
mais é preciso; o build normal volta a incluir arquivo e assets.

A 3ª regeneração (19h20) atendeu à decisão da coordenação: **"Fitofarmas"
entrou no menu do cabeçalho** (entre "Grupos" e "Contato"), no menu lateral e
com a rota ativa. Junto foi o ajuste MEDIDO que o 11º item exige: a navegação
de desktop agora recolhe para o menu lateral abaixo de **1500px** (antes
1360px) — com 11 itens, a 1366px o primeiro item invadia a marca em 76px.
Notebooks de 1366/1440px passam a ver o menu-hambúrguer; telas de 1536px+ veem
a barra completa com folga. A 4ª regeneração também leva os **nomes reais dos
27 Laboratórios Associados** em `laboratorios.json` (verificação com fonte por
registro) — o banco recebe os mesmos nomes pelo item 7 do SQL abaixo.

A 2ª regeneração (18h30) corrigira um defeito MEDIDO no primeiro teste real da
redefinição de senha: o painel do Supabase envia código de **8 dígitos**
(`otp_length = 8`) e a tela truncava a colagem em 6 — a pessoa via "código
incorreto" com o código certo na mão. A tela agora aceita a faixa inteira do
painel (6–10) e nenhum texto promete um comprimento fixo.

Novo nesta versão, além do que já existia (webinários, mapa interativo,
resultado IC 2026, notícias, Relatório Anual):

- **Formulário pré-evento do I Workshop Conexão Fitofarmas** (`#/fitofarmas`):
  público, sem login, mede intenção de colaborar com a rede. Depende da
  **migração 008 + seed 003** (ver o aviso abaixo); sem elas a página abre e o
  envio mostra "ainda não está no ar do nosso lado".
- **Redefinição de senha por código numérico** (`#/nova-senha`): a tela aceita
  o código do e-mail (6 a 10 dígitos, conforme o painel — este projeto usa 8),
  imune aos rastreadores que gastavam o link (Brevo/Safe Links). Os templates
  de e-mail correspondentes estão em `docs/emails-autenticacao.md` e são
  colados NO PAINEL do Supabase **depois** deste deploy — a ordem importa. Quem
  já colou o template de recuperação antes de 07/08 18h30 deve recolar: a linha
  "São seis dígitos." saiu do corpo do e-mail.

**O artefato de upload é a pasta `inct_deploy/`** (265 arquivos, ~85 MB,
gerada 13/08): suba o CONTEÚDO dela para `public_html/`, com o
`index.html` direto na raiz, nunca dentro de uma subpasta `inct_deploy/`.

Alternativa: **`inct-site-2026-08-13.zip`** (raiz do repo, 13/08, 80,8 MB) é a
mesma pasta empacotada com o conteúdo na raiz do zip e separadores `/`, para
quem preferir subir um arquivo só e "Extrair" no hPanel. **TODOS os zips e
pastas anteriores estão SUPERADOS. Os de 08/08 contêm a matéria embargada
por causa do incidente da chave duplicada (ver o bloco do embargo); apague-os,
não use.**

> ⚠️ **ANTES DE SUBIR, ponha o SQL em dia.** A ordem completa e atualizada
> (006 → 007 → 008_sigla → **009 → 010** → seeds 002/003 → patch de nomes,
> mais a Edge Function `indicadores` e o módulo Fitofarmas à parte) está em
> **`supabase/APLICAR-PRODUCAO.md`** — este arquivo deixou de listar a ordem
> para não haver duas versões dela. Tudo é idempotente; na dúvida, rode.
> As migrações 009 e 010 terminam em blocos de SANIDADE: **leia o resultado**
> (9× e 5× `true`, respectivamente).

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
`public_html` → enviar **`inct-site-2026-08-07.zip`** → "Extrair" **ali
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
8. **`/#/fitofarmas`** — o formulário do workshop abre no passo "Quem é você".
   Com a 008 + seed 003 aplicadas, um envio de teste com o SEU e-mail devolve
   um protocolo `WFF-0001`; sem elas, a mensagem honesta de indisponibilidade.
   Marque "Quero só acompanhar" no passo 2 e confira que o formulário encurta
   para 3 passos.
   **E o menu:** em tela larga (1536px+), "Fitofarmas" aparece na barra entre
   "Grupos" e "Contato"; em notebook (1366/1440px) a barra vira menu-hambúrguer
   — abra-o e confira o item lá dentro. Não é regressão: é o recolhimento
   calibrado para os 11 itens.
9. **`/#/gestao?area=fitofarmas`** — logado como admin, a área "Fitofarmas"
   mostra as métricas e a lista de respostas (vazia até alguém responder, com
   a frase "Nenhuma resposta ainda"). Sem a 008 aplicada, mostra o aviso
   orientando a rodar a migração; logado sem papel de admin, explica a
   restrição. Toque numa resposta para abrir a ficha; "Exportar CSV" baixa o
   arquivo que abre no Excel com acentos corretos.
10. Recarregue com Ctrl+F5: se algo parecer o site velho, é HTML em cache.
11. `/admin` — a tela do CMS abre, mas o LOGIN ainda não funciona (OAuth sem
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
