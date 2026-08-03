# INCT-CONEXAO — plataforma web

[![Produção](https://img.shields.io/badge/produção-inct--conexao.com.br-0d302b)](https://inct-conexao.com.br/)
[![Testes](https://img.shields.io/badge/testes-194%20passando-2f7a52)](#qualidade-e-verificação)
[![React](https://img.shields.io/badge/React-19-1f8ca5)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-1f8ca5)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-1f8ca5)](https://vite.dev/)

Sítio institucional e plataforma de dados do **INCT-CONEXAO** — Instituto Nacional
de Ciência e Tecnologia de Pesquisa e Conhecimento de Excelência da Amazônia
Ocidental. Reúne comunicação científica, um observatório territorial interativo,
processos seletivos e a produção editorial da rede.

**No ar:** <https://inct-conexao.com.br/>

---

## Autoria e manutenção

### Desenvolvimento da plataforma

**Aleff Ferreira** — concepção, arquitetura, desenvolvimento e manutenção.

Autoria única do desenvolvimento web: definição da arquitetura, implementação,
modelo de conteúdo, política de proveniência de dados, suíte de testes,
publicação e operação em produção. Todo o histórico de código deste repositório,
desde junho de 2026, é de autoria individual.

Contato: <labioprot.toxin@gmail.com>

### Conteúdo científico e editorial

**Coordenação do INCT-CONEXAO e equipes dos grupos de pesquisa** — participação
intensa e continuada.

O conteúdo publicado — textos institucionais, fichas estaduais, material das
expedições, definição das linhas de pesquisa, revisão técnica e validação
científica — resulta do trabalho da coordenação do instituto e dos membros das
equipes. A plataforma é o meio; o conhecimento que ela veicula é da rede.

Essa separação é deliberada e está refletida na arquitetura: o conteúdo vive em
arquivos JSON versionados e editáveis por CMS, **independentes do código**, para
que a autoria editorial permaneça com quem a produz.

Para citar esta plataforma, use o arquivo [`CITATION.cff`](CITATION.cff) — o
GitHub o expõe em **"Cite this repository"**, no menu lateral.

---

## O que a plataforma faz

| Módulo | Descrição |
|---|---|
| **Observatório territorial** | Mapa SVG interativo das 27 UFs, com camadas temáticas, modo narrativo e fichas estaduais |
| **Figuras citáveis** | Gráficos com fonte, ano, licença e CSV, que degradam para SVG estático sem JavaScript |
| **Processos seletivos** | Página de edital, resultado consultável e plataforma de inscrição/avaliação |
| **Editorial** | Matérias de campo, webinars, grupos de pesquisa — todos editáveis por CMS |
| **Rede** | Catálogo de instituições parceiras, com números derivados do próprio catálogo |

---

## Decisões de arquitetura

As escolhas abaixo respondem a três restrições reais: hospedagem estática sem
servidor de aplicação, público majoritariamente em conexão móvel cara, e a
exigência de integridade científica em tudo que é publicado.

**Sem servidor.** SPA em React com roteamento por hash, publicada como arquivos
estáticos. Não há backend próprio: o conteúdo é JSON versionado, lido em tempo
de build por `import.meta.glob`. Isso torna o site auditável — o que está no ar
está no repositório.

**Sem bibliotecas de gráfico ou animação.** Toda visualização é SVG construído no
próprio projeto; todo movimento é CSS e `IntersectionObserver`. A decisão é de
peso e de longevidade: um gráfico feito de `<path>` e `<text>` continua legível,
selecionável e traduzível daqui a dez anos.

**Geometria pré-computada.** A malha oficial do IBGE é baixada, projetada e
gravada como artefato versionado (`src/mapa/geo/br-uf.json`) por um script de
build. O site nunca chama a API do IBGE em tempo de execução.

**Contrato de figura.** Uma figura só existe se estiver no registro, de onde vêm
título, fonte, ano, licença e definição de cada coluna. A função de desenho é
pura, de string: o mesmo código gera o SVG estático no build (Node) e a primeira
pintura no navegador — estático e interativo não podem divergir.

**Números derivados, nunca escritos à mão.** Contagens exibidas na interface são
calculadas a partir da fonte de dados. É uma regra com história: o site já
afirmou "35 instituições" onde havia 34, e "16 países" onde havia 12. Hoje há
testes que reprovam qualquer número literal reintroduzido.

**Degradação honesta.** O que depende de JavaScript tem caminho alternativo real
— `public/figuras/` é servido como páginas estáticas, com gráfico, tabela e CSV,
sem uma linha de script.

---

## Dados abertos e proveniência

Toda série publicada carrega origem, período, licença e data de extração, e é
ingerida por script versionado — nunca digitada.

| Conjunto | Fonte | Cobertura |
|---|---|---|
| Focos de calor | Programa Queimadas, INPE (satélite de referência) | 27 UFs × 2003–2024 = **594 pontos**, 5,1 milhões de detecções |
| Malhas territoriais | IBGE, API de Malhas v3 | 27 UFs, projeção Mercator ajustada |
| Relevo | NASA GIBS (Blue Marble) × Terrarium DEM | Brasil, hillshade multidirecional |
| Notificações de doenças | SINAN via TabNet, DataSUS | 4 UFs, com ressalva metodológica declarada |

O registro completo de fontes está em
[`docs/mapa-interativo.md`](docs/mapa-interativo.md), seção *Registro de fontes
de dados*.

---

## Qualidade e verificação

```bash
npm test          # 194 testes
npm run build     # checagem de tipos + build de produção
```

A suíte não testa só comportamento: ela guarda **integridade editorial**. Há
testes que reprovam figura sem ano ou licença, capítulo que referencia camada
inexistente, número da interface divergente do catálogo, e campo de avaliação
que apareça em arquivo de resultado público.

Vários desses testes **nasceram vermelhos**, expondo defeitos já publicados —
essa é a função deles.

---

## Executar localmente

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run preview   # serve o build de produção
```

Requer **Node 20.19+** (Vite 8). Scripts de ingestão de dados usam Python 3.

```bash
python3 scripts/build-focos.py   # série de focos do INPE
node scripts/build-geodata.mjs   # malhas do IBGE
npm run figuras                  # gera SVG e CSV das figuras
```

---

## Publicação

Build local e envio de arquivos estáticos para hospedagem LiteSpeed. O passo a
passo, incluindo o que preservar no servidor e como conferir depois, está em
[`UPLOAD-HOSTINGER.md`](UPLOAD-HOSTINGER.md). Detalhes de hospedagem em
[`HOSTING.md`](HOSTING.md).

---

## Estrutura

```
src/
├── App.tsx              home e casca da aplicação
├── mapa/                observatório territorial (SVG, camadas, narrativa)
├── figuras/             contrato de figura citável
├── noticias/            módulo editorial
├── webinars/            transmissões, grupos e roteador
├── editais/             processos seletivos e resultados
├── platform/            inscrição e avaliação (Supabase, desativável)
├── ui/                  primitivas reutilizáveis
└── content/             conteúdo em JSON, editável por CMS

scripts/                 ingestão de dados e geração de artefatos
tests/                   194 testes, incluindo guardas de integridade editorial
docs/                    decisões de arquitetura e registro de fontes
public/admin/            Sveltia CMS, autenticado por git
```

---

## Documentação

- [`docs/mapa-interativo.md`](docs/mapa-interativo.md) — arquitetura do mapa,
  scrollytelling e registro de fontes de dados
- [`docs/noticias.md`](docs/noticias.md) — modelo de conteúdo editorial
- [`docs/plataforma-selecoes.md`](docs/plataforma-selecoes.md) — inscrição e avaliação
- [`docs/cms-setup.md`](docs/cms-setup.md) — configuração do CMS
- [`docs/guia-lideres.md`](docs/guia-lideres.md) — guia para coordenações

---

## Licença

© Aleff Ferreira. Todos os direitos reservados.

O conteúdo científico e institucional pertence ao INCT-CONEXAO e às instituições
parceiras. Os dados de terceiros mantêm as licenças de suas fontes originais,
declaradas em cada figura e no registro de fontes.
