# Mapa Interativo do Brasil — INCT-CONEXAO

> Documento de arquitetura, decisões de projeto e governança editorial do módulo
> **Mapa Interativo** (`src/mapa/**`, rota `#/mapa`). Escrito para desenvolvedores
> e para a equipe de conteúdo do INCT-CONEXAO.

Status: **implementação de _staging_** (dados de demonstração, verificáveis e
rotulados). Ver §11 (Limitações) e §12 (Backlog) para o que falta antes de
popular todos os 27 estados e liberar em produção.

---

## 1. O que é

Uma experiência de mapa do Brasil integrada ao site, com três formas de uso:

- **Modo vitrine (`panorama`, padrão de abertura)** — a tela inicial mostra só o
  relevo 3D fotorrealista do território (sem camadas de dados), num _hero_ com CTAs
  para os outros modos. O usuário aprecia o mapa antes de qualquer seleção.
- **Modo narrativo** — capítulos curtos, baseados em evidências, que apresentam a
  rede e os temas do INCT-CONEXAO com transições geográficas suaves, com ênfase na
  Amazônia Legal.
- **Modo explorador** — o usuário busca estados, ativa camadas temáticas, inspeciona
  registros e compara regiões, com divulgação progressiva (o padrão mostra pouco;
  o detalhe abre sob demanda).

Renderiza as 27 unidades federativas (26 estados + DF) a partir de **limites
oficiais do IBGE**, distingue visualmente a Amazônia Legal, e abre um painel de
detalhe por estado (painel lateral no desktop, _bottom sheet_ no mobile) com seções
de divulgação progressiva (visão geral, animais peçonhentos, doenças tropicais e
negligenciadas, ambiente e clima, serviços e emergência, atividades do INCT).

---

## 2. Decisão-chave: SVG pré-computado do IBGE, **não** MapLibre/tiles

O enunciado pede para **preferir MapLibre GL JS + vector tiles/PMTiles quando
tecnicamente compatível**, mas também para **manter uma abordagem já adequada** e
**não introduzir um framework grande só para o mapa**, com justificativa
documentada. A decisão foi usar um **SVG pré-computado a partir da malha oficial do
IBGE**. Justificativa técnica:

| Critério | SVG IBGE pré-computado (escolhido) | MapLibre GL JS + tiles |
|---|---|---|
| **Peso** | Geometria versionada de **~55 kB gzip** (27 UFs), carregada só na rota `#/mapa` (chunk _lazy_). | Biblioteca ~**220 kB gzip** + tiles — quase 2× o _budget_ eager gzip do site inteiro (118 kB), mesmo _lazy_. |
| **WebGL** | Não exige. O enunciado proíbe tornar conteúdo essencial dependente de WebGL. | Exige WebGL; degrada em dispositivos/navegadores sem aceleração. |
| **Acessibilidade** | Cada UF é um elemento DOM (`<path>`/`<button>`) — focável, rotulável, lido por leitores de tela e navegável por teclado nativamente. | Canvas WebGL é opaco à árvore de acessibilidade; exige um DOM paralelo espelhado. |
| **Provedor/segredos** | Sem provedor proprietário, sem token, sem restrição de origem, sem _rate limit_, sem atribuição de tiles. | O enunciado exige gerir token por origem, _rate limit_, atribuição de tiles de terceiros. |
| **Hospedagem estática** | Geometria _checked-in_; zero _fetch_ em runtime; zero chamada externa. Casa com Hostinger estático. | Tiles exigem servidor/CDN de tiles ou PMTiles hospedado + range requests. |
| **Escopo** | 27 UFs (coroplético + seleção + narrativa). Suficiente e ideal. | Ideal para zoom contínuo até 5.570 municípios com camadas raster — que **não** é o escopo atual. |

**Conclusão:** para coroplético de 27 UFs + storytelling editorial, o SVG do IBGE é
mais leve, mais acessível e independente de provedor. **MapLibre + PMTiles fica no
backlog (§12)** como evolução caso se precise de zoom até município com camadas
raster — aí a troca se justifica. A fronteira da decisão está documentada, conforme
o enunciado pede.

A malha é **oficial e versionada** (não traçada à mão): gerada por
`scripts/build-geodata.mjs` a partir da _API de Malhas Territoriais v3_ do IBGE, com
os metadados (nome, sigla, região) da _API de Localidades v1_. O artefato
`src/mapa/geo/br-uf.json` é **comitado no repositório**, então o _build_ do site
nunca depende do IBGE estar no ar.

---

## 3. Arquitetura e integração (resumo)

- **Rota** `#/mapa` e `#/mapa/<uf>` — adicionada ao roteador único por hash
  (`src/webinars/router.ts`), montada em `src/App.tsx` via `React.lazy` (chunk
  próprio, fora do _bundle_ eager — igual à Plataforma de Seleções). Sub-estado
  (uf, modo, tema, camadas) é serializado na própria hash pelo módulo do mapa
  (`src/mapa/url.ts`), com _back/forward_ e _deep links_.
- **Sem Supabase.** O mapa não importa nada de `src/platform/**`; é 100% estático +
  JSON editorial. Verificado no _build_ (o chunk do mapa não contém `supabase`).
- **Design system.** Reutiliza os tokens e componentes existentes (prefixo `map-`
  no `src/styles.css` único). Sem dark mode, sem webfonts novas. Ver §5 do relatório.
- **Conteúdo editável sem código.** Registros em `src/content/mapa/**` (JSON por
  estado), carregados com `import.meta.glob` (padrão idêntico ao de webinars), e
  editáveis no painel Sveltia CMS (`/admin`) — coleção nova em `public/admin/config.yml`.

## 3b. Camada visual "de jogo" (o que torna o mapa vivo)

Uma pesquisa de UX de mapas de videogame (Ghost of Tsushima, Assassin's Creed/Far Cry, Elden Ring, Civilization, RDR2) destilou as ideias que tornam mapas grandes **não** entediantes; aplicamos as que cabem num site científico leve e acessível (sem virar um jogo):

- **Sede como "vento-guia" (hub-and-spoke).** Arcos animados partem de **Rondônia** (sede) para as 20 UFs com instituições — a orientação ambiente que diz "o que importa" sem seta piscante. Camada **Conexões** (ligada por padrão). É o dado real da rede, não enfeite.
- **Pontos de interesse.** Marcadores por UF dimensionados pelo nº de instituições (dado real; RO=19 é a sede, em destaque). Camada **Instituições**.
- **Lentes (map lenses).** 4 camadas-base coloríveis (Amazônia Legal, Vagas de IC, Instituições, Conteúdo) — uma pergunta por vez, legenda que se atualiza. Só dados reais e citados.
- **Viagem rápida.** Busca com fly-to, atalhos por **região** (N/NE/CO/SE/S) e deep links — instantâneo é vantagem da web sobre o jogo.
- **Vida ambiente.** Fluxo animado nas conexões, pulso da sede, *ping* de seleção — amplitude pequena, tudo desligado sob `prefers-reduced-motion`.
- **Tooltip de contexto.** Cartão que segue o cursor com nome + indicador da lente + instituições + disponibilidade de ficha.
- **Profundidade.** Fundo de "oceano", grade sutil, relevo (sombra + brilho *soft-light*), vinheta — modernidade dentro da paleta forest/teal, sem dark mode.
- **Painel dinâmico.** Tiles de indicadores (vagas, instituições, Amazônia Legal), contadores por seção (Animais 3, Doenças 3…) e transição suave — leitura "de coleção" que mostra quanto há em cada estado.

Tudo continua **acessível** (cada UF é um `<button>` focável; camadas decorativas têm `aria-hidden`; a lista-alternativa e os rótulos carregam a informação) e **sem WebGL**.

## 3c. Camada de engajamento (visualizações + recompensas)

Segunda iteração, focada em **menos texto, mais visual**, técnicas de marketing e um sistema de recompensas de jogo:

- **Painel = dashboard visual** (`src/mapa/viz.tsx`, SVG puro sem libs): **anel de completude** da ficha (gamifica "quanto já existe"), **gráfico de barras** do perfil do estado (animais/doenças/instituições/vagas) e **números que "contam"** (CountUp — técnica de destaque de landing page). O texto virou secundário (`<details> Dados do estado`).
- **Linha do tempo climatológica ajustável** (`src/mapa/clima.ts` + `Timeline`): scrubber de 12 meses mostrando estação chuvosa/seca da região — dado climatológico **qualitativo e honesto** (rotulado "não é previsão nem indica risco de doença"), que amarra o tema clima↔saúde sem inventar epidemiologia.
- **Sistema de recompensas** (`src/mapa/gamify.ts`, `localStorage`): cada estado aberto conta na **exploração** (barra de progresso N/27); **conquistas/badges** (primeiro estado, todas as 5 regiões, 9 da Amazônia Legal, 10 estados, todos os 27) com **toast de "conquista desbloqueada"**; estados visitados ganham um selo no mapa (reveal ao estilo _fog-of-war_). Puro e testado (`conquistasDe`).
- **Marketing/atenção**: números animados, barra de progresso, hierarquia visual, micro-interações; entrada animada dos estados (fade escalonado).

Honestidade preservada: nenhuma métrica inventada — completude conta seções reais, o perfil usa dados reais, a timeline é climatologia geral rotulada. Tudo respeita `prefers-reduced-motion`.

**Aparência 3D "satélite" + gamificação discreta (3ª iteração):** o mapa ganhou volume — terra "extrudada" (camada escura deslocada dá espessura), oceano com gradiente de água e **reflexo de sol** que varre lentamente, textura de terreno, iluminação _soft-light_ (topo claro/base escura) e **nuvens à deriva** — leitura de satélite estilizada, sem virar globo realista, tudo em SVG e desligado sob `prefers-reduced-motion`. As **conquistas deixaram de ocupar a tela**: viraram uma **pílula compacta** no topo do mapa (progresso N/27 + nº de conquistas) cujo popover de badges só abre sob clique; o momento de recompensa continua no _toast_ transitório.

**Relevo fotorrealista + continente flutuante (5ª iteração — superar africa.climatemobility.org).** A referência é um Mapbox GL ao vivo (tiles não reaproveitáveis por licença); a resposta livre-de-token que a **supera em nitidez** é **compor a base offline** a partir de fontes públicas. `scripts/build-basemap.py` (Python + Pillow) gera dois assets em `public/assets/maps/` (EPSG:3857, alinhados à malha):
- **`brasil-relevo.jpg`** (~1,6 MB, 3000 px): **composição** de NASA Blue Marble Next Generation (true-color) × ASTER GDEM greyscale shaded relief (sombreamento), blend **overlay** + realce de saturação + _unsharp mask_ → relevo **embossado, fotográfico** (mais realista que tintas hipsométricas). Recortado ao contorno do Brasil (clipPath) com **sombra de elevação**.
- **`brasil-vizinhos.jpg`** (~0,26 MB, 2200 px): a América do Sul ao redor, **dessaturada e clareada** (fantasma quase branco) com o oceano na cor do fundo (máscara de terra por dominância de azul do Blue Marble) → moldura "flutuante", como a referência, mas com Brasil em cor plena por cima.
- **Canvas expandido:** `geo.WORLD` = Brasil + 18% de margem por lado; `fullViewBox` mostra a moldura, `focusViewBox` (seleção) volta a mergulhar no Brasil; `clampView` prende ao `WORLD`.
- Fundo creme `#f2eee7`, marcadores marrom+anel, atribuição "NASA / GIBS". Alinhamento pixel-a-pixel porque o raster é pedido no **mesmo Web Mercator** dos vetores (sem reprojetar). Regerar: `python3 scripts/build-basemap.py`.

**Topografia 3D real via DEM + vitrine de abertura (6ª iteração — o relevo "salta" da página).** Crítica: o sombreamento ASTER pré-assado era suave demais e faltava o volume 3D da referência. Correção: **calcular o sombreamento a partir de um Modelo Digital de Elevação (DEM) real, com exagero vertical**, em vez de reusar um hillshade genérico. `scripts/build-basemap.py` (Python + Pillow + numpy) passou a:
- **Baixar e costurar tiles Terrarium** — elevação em metros (`h = R*256 + G + B/256 − 32768`; AWS Open Data / Mapzen, sem token) — cobrindo o bbox do Brasil em z7 (~240 tiles) e a moldura em z6, recortando o mosaico exatamente ao extent Mercator da malha;
- **Computar um hillshade multidirecional** (4 azimutes ponderados, estilo cartografia suíça) com **exagero vertical `ZFACTOR≈9`** e esticão por percentis (2–98) → cristas, escarpas e vales ganham sombras próprias e fortes. Oceano/nodata são achatados (`elev≥0`) para não criar um "penhasco" na costa;
- **Compor sobre o Blue Marble** (modulação de luminância `color·(1+(hs−0,5)·2s)` + micro-_overlay_ + _unsharp_): a cor de satélite real ganha volume 3D controlado. Andes, Serra do Mar/Mantiqueira e o Planalto Central saltam; a bacia amazônica permanece plana (honesto — não há relevo a inventar). Assets agora ~2,1 MB (3200 px) / ~0,35 MB.
- **Modo Vitrine (`panorama`) virou o padrão de abertura** (`#/mapa`): só o relevo (sem tinta de dados, conexões, marcadores ou rótulos), num _hero_ de largura total com legenda _glass_ (headline + 3 indicadores + CTAs "Explorar"/"História") — o usuário aprecia o território antes de mergulhar. `BrazilMap` recebeu a prop `vitrine`; hover/clique num estado ainda mergulha no explorador. `url.ts` ganhou o modo `panorama` (default; `narrativa`/`explorador` viram parâmetro na hash). No mobile a legenda passa a ficar **abaixo** do mapa (não o cobre).

**Fronteiras em sulco 3D, estado "erguido" e roda-de-mouse civilizada (7ª iteração).** Feedback: a fronteira entre estados era "só uma linha" (design pobre) e a roda do mouse dava zoom E rolava a página ao mesmo tempo.
- **Fronteiras**: substituídas por um **sulco gravado no terreno** — três traços sobrepostos (halo de sombra difuso + vinco escuro deslocado + fio de luz na crista), todos `non-scaling-stroke`. Na entrada, o fio de luz **desenha** as fronteiras (stagger de 36 ms/UF via `pathLength=1`), com halo/vinco em _fade_. Os deslocamentos do sulco escalam com o zoom via `--mapk` (senão as linhas "descolariam" ao aproximar). Na vitrine as fronteiras ficam a 62% de opacidade.
- **Estado erguido**: no hover (e na seleção), o estado **levanta fisicamente do mapa** — cópia do próprio relevo recortada ao estado (`clipPath` por UF), escala 1,013 no centróide, sombra difusa projetada e leve brilho; anel branco no hover (na seleção o contorno fica por conta do `.map-sel-outline`, senão dobraria a borda). Funciona também com foco por teclado (tooltip ancorado no centróide do estado focado, não mais em posição obsoleta do cursor).
- **Roda do mouse**: o `onWheel` do React é **passivo** (o `preventDefault` era ignorado — a página rolava junto do zoom). Agora é um listener nativo `{passive:false}` no próprio `<svg>`: sobre o mapa a roda **só** dá zoom; fora dele a página rola; e **no limite** do zoom (mín/máx) o mapa devolve a rolagem à página (sem "armadilha de scroll").
- **Precisão de cursor**: `clientToView` e o delta do arrasto agora passam por `getScreenCTM()` — o mapeamento linear anterior ignorava o _letterboxing_ do `preserveAspectRatio` (o zoom derivava para o centro e o arrasto "escorregava" na horizontal em monitores largos).
- **Revisão adversarial (workflow multi-agente): 22 achados brutos → 13 confirmados por 3 verificadores independentes cada → todos corrigidos.** Destaques: (a) `stroke-dasharray` permanente + `non-scaling-stroke` fazia o Chromium renderizar as fronteiras **pontilhadas ao aproximar** (bug reproduzido empiricamente) — o tracejado agora vive só dentro dos keyframes da animação; (b) o "Modo leve"/economia de dados **não chegava ao mapa** — agora `leve` suprime as imagens de relevo (silhueta plana no lugar, ~2,2 MB economizados); (c) a regra `.is-explored` engolia o anel de foco do teclado (WCAG 2.4.7) — trocada por aguada verde + foco re-afirmado na cascata; (d) o brilho das conexões recalculava 20 `drop-shadow` por frame — removido (traço mais largo no lugar); (e) a varredura de luz da vitrine estava **isolada do blend** por um `<g clipPath>` (o soft-light não "via" o relevo — confirmado em teste de pixel) — clip movido para o próprio `<rect>`, e a varredura some ao aproximar (viraria neblina de tela cheia). Assets migrados para **WebP** (`brasil-relevo.webp` ~2,0 MB, `brasil-vizinhos.webp` ~0,17 MB).

**Dados de doenças tropicais com procedência + interface de notificações (8ª iteração — referência: PDF "Informações iniciais do mapa", com pesquisa e verificação próprias).** O PDF trouxe **notificações do DataSUS/TabNet (SINAN), acumuladas desde 2018**, para doenças tropicais da Amazônia Legal — mas só preencheu **Acre** e **Amapá** (os outros 7 estados vieram como cabeçalhos vazios). O tipo `Doenca` ganhou `notificacoes` (`{ valor, periodo, sistema, representativo?, nota?, fonte }`) além de `comoReconhecer` e `tratamento`, mapeando a estrutura "prevenir / reconhecer / cuidar" do PDF. Fichas **`ac.json` e `ap.json`** foram escritas fiéis ao PDF (`demonstracao:false`, dado real e citado), corrigindo erros de digitação e imprecisões.
- **Confiabilidade do dado (workflow de pesquisa + verificação adversarial, 59 agentes):** confirmou que na Amazônia a **malária é acompanhada pelo SIVEP-Malária, não pelo SINAN** — o "21" do SINAN para o Amapá subnotifica drasticamente (o SIVEP registrou ~24,8 mil casos entre 2019–2023). Por isso a malária recebe `representativo:false`: **fica fora de totais e rankings**, sem número de destaque (só a etiqueta "ver ressalva"), e mostra a ressalva por extenso. As demais doenças (dengue, zika, leishmanioses, leptospirose, Chagas) **são de notificação compulsória no SINAN**, então seus números do TabNet são válidos como *notificações* (não casos confirmados). O bullet genérico "Vacinação" da dengue foi **corrigido** (no SUS a vacina é dirigida a públicos específicos, não à população em geral).
- **Interface (mais atraente e assimilável):** a seção "Doenças" agora abre com um **panorama** — total de notificações (CountUp) + **ranking em barras** das doenças do estado (números em pt-BR) + a nota de honestidade ("notificação ≠ caso; depende da vigilância; use como ordem de grandeza"). Cada doença virou um **accordion** que mostra, no cabeçalho, o número de notificações e, ao abrir, os blocos com ícone **Como se prevenir / Como reconhecer / Primeiros cuidados**, os sinais de alerta e a ressalva de origem.
- **Nova lente "Doenças (notificações)"** (`layers.ts`): coroplético em rampa quente pelo total de notificações representativas por UF, alimentado por `content.totalNotificacoes(uf)`. Honesta por construção: só **AC e AP** aparecem coloridos; os demais ficam cinza "Sem dado (em preparação)". Legenda e descrição avisam que a comparação entre estados é imperfeita e que a malária fica de fora. **Nenhum dado foi inventado** para os 7 estados que o PDF deixou vazios.
- Regras de segurança preservadas: nenhum medicamento, dose ou diagnóstico; primeiros cuidados e "procure atendimento oficial". 121 testes verdes (5 novos no `tests/mapa.test.ts`). Chunk `MapaPage` ~89,6 kB gzip.

## 4. Inventário de arquivos

**Criados**

| Arquivo | Papel |
|---|---|
| `scripts/build-geodata.mjs` | Pipeline: baixa a malha oficial do IBGE e gera o artefato SVG versionado. Zero deps. |
| `src/mapa/geo/br-uf.json` | Artefato geográfico (27 UFs, paths + centroides + bbox + Amazônia Legal + metadados de origem). **Comitado.** |
| `src/mapa/types.ts` | Tipos de domínio (geometria + conteúdo editorial). |
| `src/mapa/geo.ts` | Carrega o artefato; helpers (`ufBySigla`, `focusViewBox`, `ufsPorRegiao`). |
| `src/mapa/layers.ts` | Temas e camadas (Amazônia Legal, Vagas de IC 2026, Conteúdo) — só dados reais e citados. |
| `src/mapa/url.ts` | Estado serializado na hash (`parseMapaHash`/`buildMapaHash`) — deep links + voltar/avançar. |
| `src/mapa/content.ts` | Carrega o conteúdo editorial (`import.meta.glob`) e os capítulos. |
| `src/mapa/BrazilMap.tsx` | Mapa SVG acessível: hover/foco, teclado, fly-to animado, zoom. |
| `src/mapa/StatePanel.tsx` | Painel de detalhe (lateral/bottom sheet), divulgação progressiva, emergência, fontes. |
| `src/mapa/MapaPage.tsx` | Entrada (default export, lazy): modos narrativa/explorador, busca, legenda, lista-alternativa. |
| `src/content/mapa/estados/{ro,am,ce}.json` | Fichas de demonstração (RO, AM na Amazônia Legal; CE fora dela). |
| `src/content/mapa/narrativa/0{1..4}-*.json` | Capítulos do modo narrativo. |
| `tests/mapa.test.ts` | 22 testes (geo, URL, camadas, conteúdo, roteador). |
| `docs/mapa-interativo.md` | Este documento. |

**Modificados** (mínimos, sem regressão): `src/webinars/router.ts` (rota `mapa` + `MAPA_HREF` + correção de query string), `src/App.tsx` (import lazy + render da rota + item de nav "Mapa"), `src/styles.css` (bloco `map-*`, ~330 linhas), `public/admin/config.yml` (coleções `mapa-estados` e `mapa-narrativa`).

## 5. Design system reutilizado

Nenhum token novo além dos existentes (`--forest`, `--river`, `--river-ink`, `--leaf`, `--gold`, `--clay`, `--line`, `--paper`, `--surface`, `--radius`, `--shadow`). Padrões reaproveitados: cabeçalho `eyebrow dark` + `h2`; cartões brancos com _hover_ teal (`border-color rgba(31,140,165,.42)` + `translateY(-2px)`); pílulas 999px; `.button.primary`/`.plat-ghost`; painel colante `top:124px`; rotação de acento forest→river→leaf→gold→clay. Texto pequeno em teal usa `--river-ink` (AA). Sem dark mode (o site declara `color-scheme: light`). Prefixo único `map-*` no `src/styles.css` único (não há CSS modules).

## 6. Modelo de conteúdo e esquemas

Um JSON por estado em `src/content/mapa/estados/<uf>.json` (tipo `EstadoConteudo`): `uf`, `resumo`, `destaque`, `publicado`, `demonstracao`, `revisadoPor`, `revisadoEm`, e listas aninhadas `animais[]` (`AnimalPeconhento`: nome comum/científico, grupo, `ocorrencia` ∈ confirmado/provável/incerto, identificação, prevenção, primeirosSocorros, `naoFazer`, imagem+crédito+alt, `fontes`), `doencas[]` (`Doenca`: agente, transmissão, `notificacoes` (`{valor, periodo, sistema, representativo?, nota?, fonte}`), prevenção, `comoReconhecer`, `sinaisAlerta`, `tratamento`, `manejoServicos`, fontes), `ambiente` (biomas, hidrografia, clima, resumo, fontes), `servicos[]`, `atividadesInct[]` (com `confianca`) e `fontes[]`. Capítulos em `src/content/mapa/narrativa/*.json` (tipo `Capitulo`: id, ordem, titulo, texto, foco, destaques, camada, fontes). Carregamento **no build** via `import.meta.glob` eager (idêntico a `webinars/data.ts`); `publicado:false` oculta o registro.

## 7. Registro de fontes de dados (data-source register)

| Conjunto | Origem | Responsável | Período | Resolução | Licença | Atualização |
|---|---|---|---|---|---|---|
| Limites das UFs | API de Malhas Territoriais v3 (`qualidade=intermediaria`) | IBGE | 2023 (última malha) | Estadual (UF) | Dados públicos IBGE | rodar `build-geodata.mjs` |
| Nomes/siglas/regiões | API de Localidades v1 | IBGE | — | UF | Dados públicos IBGE | idem |
| Base 3D — cor | NASA GIBS — BlueMarble_NextGeneration (true-color, EPSG:3857) | NASA EOSDIS | 2004 (composto) | 500 m nativo → 3200 px | Domínio público (creditar NASA/GIBS) | `python3 scripts/build-basemap.py` |
| Base 3D — elevação (DEM p/ sombreamento 3D) | Terrarium terrain tiles (`elevation-tiles-prod`, XYZ Web Mercator) | AWS Open Data / Mapzen (fontes: SRTM, ASTER, NED…) | contínuo | z7 Brasil (~1,2 km/px) / z6 moldura | Uso livre (open data; creditar Mapzen/AWS) | idem (hillshade multidirecional por numpy) |
| Amazônia Legal | LC nº 124/2007 | IBGE/legislação | 2007 | UF (MA parcial) | Pública | estável |
| Vagas de IC | Edital 04/2026 | INCT-CONEXAO | 2026 | UF (18) | Pública | por edital |
| Doenças — notificações | SINAN via TabNet DataSUS (doenças de notificação compulsória) | Ministério da Saúde / DataSUS | acumulado a partir de 2016 ou 2018, conforme o estado | UF (AC, AP, MA, TO) | Dados públicos | consultar TabNet e atualizar o JSON da UF; a descrição da camada é DERIVADA das fichas |
| Doenças — malária | SIVEP-Malária (sistema à parte; a malária na Amazônia **não** entra no SINAN) | Ministério da Saúde / SVSA | — | UF | Dados públicos | marcada `representativo:false`; SINAN subnotifica |
| Doenças — Acre (corrobora) | Observatório de Saúde do Acre (boletins) | SESACRE | boletins | UF | Pública | `observatorio.saude.ac.gov.br/boletins/` |
| Focos de queimada | Programa Queimadas — satélite de referência (`dataserver-coids.inpe.br/queimadas/.../EstadosBr_sat_ref/`) | INPE | 2003–2024 (anual) | UF (27) × ano | Dados públicos, citar o INPE | `python3 scripts/build-focos.py` |
| Conteúdo disponível | Registros editoriais do mapa | INCT-CONEXAO | vivo | UF | Interna | por publicação |
| Fichas RO/AM/CE | MS, Butantan, Fiocruz, IBGE, INPA (citadas em cada registro) | equipe científica | 2026 | UF | ver cada fonte | editorial |

Cada camada exibe sua fonte na interface (rodapé do mapa + legenda). Nenhuma camada é apresentada como "tempo real". Camadas de vigilância/ambiente com dados oficiais georreferenciados estão no backlog (§16) — **não** foram inventadas.

### Decisão: a camada de doenças não vira imagem publicada

**Não existe, e não deve passar a existir, uma versão estática da camada
`doencas-notificacoes` em `public/`** — nem SVG, nem PNG, nem WebP. Decisão do
coordenador do projeto, tomada em 2026-08-04, e travada por teste em
`tests/mapa.test.ts`.

O motivo é o mesmo que já impede `sort()` nessa camada: os totais somam
conjuntos **diferentes** de doenças em cada estado. Tocantins traz 88.065 de
dengue sozinha; o Acre traz 79.324 somando quatro doenças. O mapa interativo
pode mostrar a camada porque leva junto a legenda, a frase `naoMede`, o selo de
maturidade e o aviso de cobertura — tudo colado ao número, na mesma tela.

Uma URL permanente com um coroplético mostrando Tocantins como o estado mais
escuro é outra coisa: é republicável por qualquer redação, e nesse trajeto a
imagem viaja e o parágrafo de cautela fica para trás. A afirmação que sobra —
"Tocantins é o estado com mais doenças" — é falsa, e teria sido fabricada por
nós, não pelo dado.

Se um dia for preciso publicar essa evidência fora da página, o formato é a
**tabela por UF × doença**, em que cada linha diz qual doença está contando.

### "Ocultar camadas"

`sem-camada` é uma camada de verdade (id em `CAMADA_IDS`, opção no CMS), e não um
booleano de interface: `camada` é o que viaja no link, e um mapa limpo que volta
pintado ao ser compartilhado seria um link mentindo sobre o que a pessoa viu.
Ela devolve `null` em todas as UFs, o que já apaga a tinta sozinho — o desenho
usa `fillOpacity = valor != null ? 0.42 : 0`, então nenhuma linha nova entrou no
SVG. O botão no explorador desliga também as sobreposições (conexões e pinos):
para quem olha a tela, elas são camadas tanto quanto a pintura.


## Modo narrativa: a história dirige o mapa (scrollytelling)

Padrão do Reuters Graphics: `position: sticky` mais `IntersectionObserver`, sem
biblioteca. Os quatro capítulos ficam todos no DOM, empilhados; o mapa fica
grudado ao lado; o capítulo que está na faixa de leitura manda no que o mapa
mostra.

**O que estava quebrado antes (medido no navegador, não deduzido):**

| sintoma | causa |
|---|---|
| 4 capítulos, **2** estados visuais | `cap.camada` era dado morto: estava no tipo e nos 4 JSONs e nenhuma linha o lia |
| `position: sticky` sem efeito no site inteiro | `.site-shell { overflow: hidden }` virava o scrollport mais próximo; rolar 900px levava `.map-stage` de `top:544` para `-900` |
| curso de rolagem de **4px** | um capítulo por vez na coluna: ela nunca ficava mais alta que o mapa |
| `?cap=inválido` apagava a página | sem fallback, `Narrativa` fazia early-return e sumiam mapa, palco e texto — restava "nenhum capítulo cadastrado", havendo quatro |
| "o Maranhão aparece destacado" | `destaques` estava ausente dos 4 JSONs |

**Depois:** 4 estados visuais distintos, 2038px de curso de sticky, e a legenda e
a nota de fonte acompanham a camada de cada capítulo.

### Regras que não podem ser afrouxadas

- **A faixa é `rootMargin`, nunca `threshold`.** Um capítulo mais alto que a
  faixa nunca alcança razão de interseção 0,5, então com limiar o callback nunca
  dispara e a funcionalidade morre calada. Os passos têm `min-height: 72svh`.
- **O trilho e o cartão são caixas separadas.** `.map-step` é o trilho: só
  altura, sem moldura, é dele o `min-height` que dá curso à rolagem.
  `.map-step-card` é o cartão: tem a altura do texto que carrega. Eram a mesma
  caixa, e o resultado numa tela de 1080 era um cartão de mais de 800px para uns
  600 caracteres — 28% a 44% de branco emoldurado, medido. O curso de rolagem
  tem de existir; a moldura em volta dele, não. Guardado por teste.
- **`.site-shell` usa `overflow-x: clip`, não `hidden`.** `clip` não cria
  contêiner de rolagem; `overflow-x: hidden` com `overflow-y: visible` é
  promovido a `auto` pelo navegador e o problema volta.
- **No celular, `.map-narrativa` é `display: block`.** Num grid de uma coluna o
  bloco contenedor do sticky é a área do grid, que tem a altura do próprio item
  — curso zero. Em fluxo de bloco o contêiner passa a ser a narrativa inteira.
- **`zoomRoda={false}` no mapa da narrativa.** Com o mapa parado, o cursor passa
  a história inteira sobre ele; com a roda ativa o leitor aproxima e não
  consegue mais voltar.
- **A rolagem escreve o capítulo com `replace`.** `pushState` por passo encheria
  o histórico e o botão Voltar viraria armadilha. O deep-link `?cap=` posiciona
  a rolagem UMA vez, na montagem, com rolagem instantânea — animada, ela
  atravessaria os capítulos do caminho disparando o observador em cada um.
- **Camada, legenda, tooltip e `aria-label` mudam juntos.** Pintar uma camada
  enquanto o hover descreve outra é o mesmo defeito de integridade, só que
  escondido de quem não usa leitor de tela.

### Arquivos

- `src/ui/passos.ts` — `escolherPasso` (pura, testada em Node) e `usePassoAtivo`
- `src/mapa/MapaPage.tsx` — `Narrativa` monta a pilha; `tooltipCom`/`rotuloCom`
  são funções da camada, não do estado da página
- `src/mapa/geo.ts` — `ufsViewBox`, `enquadramentoDe`
- `src/mapa/content.ts` — `capituloInicial` (fallback)
- `src/styles.css` — `.map-step`, `.map-story` (contêiner), media query de 980px

Nota sobre o enquadramento da Amazônia Legal: a justificativa fácil de que
`regionViewBox("Norte")` "corta o Maranhão" é **falsa** — medida, a caixa do
Norte acaba contendo MA e MT, porque o padding e a escala mínima a inflam. O
problema é que essa cobertura é acidente: MA termina em x=774 numa caixa que vai
até 789, encostado na borda. `enquadramentoDe("amazonia-legal")` parte das 9 UFs
certas e dá 124 unidades de margem.

## 8. Procedimentos de importação e atualização

**Focos de queimada (anual):** `python3 scripts/build-focos.py` baixa os ZIP anuais por UF do
Programa Queimadas e grava `src/content/dados/focos-por-uf-ano.json` (27 UFs × 22 anos, ~14 kB).
Os ZIP ficam em `tmp/focos-inpe/` (ignorada pelo git), então repetir é barato; o ano corrente nunca
é lido do cache, porque ainda recebe focos. `--amazonia` restringe às 9 UFs da Amazônia Legal.
Use SEMPRE a série do satélite de referência: é a que o INPE indica para comparar anos, por manter o
mesmo sensor e horário de passagem. Misturar satélites dá números maiores e não comparáveis.
Depois de atualizar, rode `node scripts/build-figuras.mjs` — `tests/figuras.test.ts` reprova se os
SVG publicados ficarem para trás do registro.

**Geometria (raro):** `node scripts/build-geodata.mjs` (opcional `GEO_QUALIDADE=minima|intermediaria|maxima`). O script valida 27 UFs, projeta em Mercator ajustado ao viewBox, e regrava `src/mapa/geo/br-uf.json`. Commit do artefato. O build do site nunca chama o IBGE.

**Conteúdo (rotina):** editar no painel `/admin` (coleções "Mapa · Fichas de estado" e "Mapa · Capítulos") ou à mão nos JSON. Depois: `git pull` → `npm run build` → upload do `dist/` (recipe do `HOSTING.md`). Não há CI — o conteúdo é assado no build.

## 9. Governança, revisão científica e instruções ao administrador

O mecanismo editorial é o **Sveltia CMS já existente** (git-backed, `public/admin/config.yml`), reaproveitado — não foi criada plataforma paralela (conforme o enunciado permite quando já há mecanismo). Fluxo: (1) autor edita a ficha no painel → commit no GitHub; (2) **revisão científica**: cada ficha tem `demonstracao`, `revisadoPor` e `revisadoEm`; enquanto `demonstracao:true`, a UI mostra um selo "demonstração"; a passagem para produção exige um revisor preencher `revisadoPor`/`revisadoEm` e desmarcar `demonstracao`; (3) o administrador revê o commit antes de `git pull`+build (ponto de controle humano); (4) `publicado:false` mantém rascunhos fora do ar sem perder o texto. **Regras de segurança de conteúdo embutidas na UI e nas instruções:** nunca usar imagens de animais geradas por IA; toda ficha publicada não-demonstração exige fontes (teste automatizado); doenças trazem apenas informação educativa (sem diagnóstico, dose ou automedicação); primeiros socorros só de fontes oficiais (MS/Butantan/Fiocruz); ausência de registro nunca é apresentada como ausência de risco.

## 10. Auditoria de acessibilidade (WCAG 2.2 AA)

- **Teclado:** cada UF é `role="button" tabindex=0` com Enter/Espaço; Escape fecha o painel; foco vai ao título ao abrir. Controles (zoom, camada, busca, abas) são elementos nativos.
- **Sem dependência de cor/hover/WebGL:** a informação de cada estado está no `aria-label` ("Rondônia, Norte. Amazônia Legal (integral). ficha disponível. Enter para abrir") e na **lista-alternativa** (`?lista=1`), pesquisável, agrupada por região. Legenda com padrão de hachura além da cor.
- **Leitores de tela:** painel `role="dialog" aria-labelledby`; preview `role="status" aria-live="polite"`; SVG com `<title>` e rótulo de grupo. Foco visível herda o anel global `:focus-visible`.
- **Alvos ≥ 44px**, contraste AA (teal pequeno → `--river-ink`), `prefers-reduced-motion` respeitado (kill-switch CSS global + `matchMedia` no fly-to). Título por rota via `document.title`. Verificado no navegador (árvore de acessibilidade + teclado); ver §13.

## 11. Desempenho

- **Bundle eager inalterado:** `index-*.js` 353 kB/**103 kB gzip** (idêntico ao anterior) — o mapa **não** pesa no site público.
- **Chunk do mapa (lazy, só em `#/mapa`):** `MapaPage-*.js` 216 kB/**77 kB gzip**, dominado pela geometria (`br-uf.json` 55 kB gzip). CSS +2,3 kB gzip.
- **Zero fetch em runtime** (geometria e conteúdo assados no build), zero WebGL, imagens `loading=lazy`. **Modo leve** (`?leve=1` ou `navigator.connection.saveData`) suprime imagens/mídia. `focusViewBox` limita o zoom; `requestAnimationFrame` cancelado no unmount.

## 12. Revisão de segurança

- **Sem Supabase e sem segredos:** verificado no build — nem `index-*.js` nem `MapaPage-*.js` contêm `supabase`. O mapa não importa de `src/platform/**`.
- **Sem provedor de tiles/token:** geometria própria, sem chamadas externas, sem restrição de origem a gerir.
- **Sem PII/geolocalização:** nada de dado pessoal; sem geolocalização automática; seleção de estado é manual. Links externos com `rel="noreferrer"`; `tel:` para emergência.
- **Superfície estática:** conteúdo é JSON versionado; controle de acesso = permissão de escrita no repositório/painel + revisão de commit (herdado do CMS).

## 13. Relatório de testes

`npx vitest run` → **96 testes, 6 arquivos, verde** (22 novos do mapa: geometria 27 UFs/paths/bbox/Amazônia Legal=9/fly-to nos limites; round-trip parse↔build da URL; regressão do roteador com query; camadas com fonte+legenda; vagas somam 50/18 UFs; esquema de conteúdo com fontes obrigatórias; capítulos). `tsc --noEmit` limpo (strict). Build verde. **Verificação no navegador** (preview): visão nacional, previews acessíveis, seleção→painel+URL+fly-to, deep-link restaura UF+seção, voltar/avançar, troca de camada recolore + URL, lista-alternativa (5 regiões/27 UFs), **bottom sheet no mobile** (`position:fixed;bottom:0;z-index:46`), sem erros no console. Um bug real foi encontrado e corrigido na verificação: o roteador principal não reconhecia `#/mapa?query` (caía na home) — corrigido e coberto por teste.

## 14. Limitações conhecidas

- **Staging, não produção:** só RO, AM e CE têm ficha (marcadas "demonstração"); os outros 24 estados mostram "ficha em preparação". As fichas ainda **não passaram por revisão científica formal** (falta preencher `revisadoPor` e desmarcar `demonstracao`).
- **Camadas:** três, todas de dado real. Camadas de vigilância/ambiente (focos, clima, desmatamento) dependem de ingestão de dados oficiais — backlog.
- **Cartões sociais por URL** (Open Graph por estado) são impossíveis no host estático com hash routing (um único `index.html`); só `document.title`/meta via JS. Documentado.
- **Login remoto do CMS** ainda não ativado (o `base_url` do OAuth segue comentado no `config.yml`) — hoje edita-se em modo local ou à mão.
- **Sem zoom até município** (fora do escopo; ver backlog).

## 15. Procedimento de rollback

O mapa é **aditivo e isolado**: para desativá-lo, reverter os 4 arquivos modificados (ou só remover o item de nav e o `render` da rota `mapa` em `App.tsx`) e rebuildar — nada mais do site depende de `src/mapa/**` ou de `src/content/mapa/**`. Como cada mudança é _lazy_ e sem estado global, remover a rota não afeta as demais páginas. Reverter o commit do módulo restaura o site anterior integralmente. O artefato de deploy antigo (`inct_deploy/`) permanece como ponto de restauração até o novo ser publicado.

## 16. Backlog priorizado

1. **Revisão científica** das fichas RO/AM/CE e expansão para os 27 estados (com revisor e data).
2. **Camadas de dados oficiais** georreferenciados (focos de queimada/INPE, arboviroses/DATASUS, biomas/MapBiomas) com registro de origem, resolução e data — agrupadas por tema (Saúde, Ambiente, Pesquisa, Comunidades).
3. **Migrar o catálogo de instituições** (86 parceiros hoje _hardcoded_ em `App.tsx`) para uma coleção do CMS e cruzar com o mapa (camada "Instituições da rede").
4. **Zoom até município** com **MapLibre GL JS + PMTiles** (a troca se justifica quando o dado exigir 5.570 municípios/camadas raster — ver §2).
5. **i18n** (en/es/fr) — os rótulos e o conteúdo já são separados da lógica.
6. **Imagens creditadas** de animais peçonhentos (bancos oficiais), com alt e direitos.
7. Ativar login remoto do CMS (Cloudflare Worker/DecapBridge) para os líderes.
8. Pré-renderização/SSG opcional para cartões sociais e SEO por estado.
