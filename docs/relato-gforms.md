# Integração do Google Forms do CTC/CGES ao formulário da página

O Comitê Técnico-Científico mantém um **Google Forms de 32 perguntas**
("QUESTIONÁRIO PARA PESQUISADORES VINCULADOS AO INCT-CONEXAO"). A meta: o
formulário da página, quando completo, responde **as duas coisas** — o relato
que ele já pedia e as 32 do Forms — com **um preenchimento só**, o mais
automatizado possível.

A regra que governa a integração: **nunca perguntar o que já temos ou o que dá
para derivar.** Das 32, só ~8 viram campo novo; metade desses vem pré-preenchida.

## O mapeamento — as 32 perguntas

Legenda: **JÁ** = o formulário já coleta · **DERIVA** = o sistema calcula, a
pessoa confere · **NOVO** = campo novo.

| # | Pergunta do Forms | Situação | Onde, na página |
|---|---|---|---|
| 1 | Nome completo | **JÁ** | Tela 1 (catálogo da proposta) |
| 2 | E-mail institucional | **JÁ** | login |
| 3 | Instituição | **JÁ** | Tela 1 (catálogo) |
| 4 | Link Lattes | **JÁ** | Tela 1 (`lattesId` → URL) |
| 5 | ORCID | **JÁ** | Tela 1 (busca automática) |
| 6 | Programa de Pós-graduação | **NOVO** | Tela 1, um campo |
| 7 | Função no INCT | **JÁ** | `ciclo_membros.papel` |
| 8 | Nome do grupo no Diretório CNPq (DGP) | **DERIVA** | = o laboratório escolhido (a lista já traz os grupos DGP) |
| 9 | Link do DGP | **DERIVA/NOVO** | novo campo `dgp_url` no laboratório; a pessoa confere |
| 10 | Nº de estudantes por nível (só líder) | **DERIVA** | contadores calculados dos fatos de formação/bolsa no form do laboratório |
| 11 | Áreas do conhecimento + EETs | **DERIVA** | EETs vêm do laboratório; a pessoa confirma os relevantes |
| 12 | Processos, agência de fomento, projetos | **NOVO** | bloco "Fomento" compacto |
| 13 | Publicações com JCR, Qualis, links | **JÁ + NOVO** | Tela 2 já coleta a publicação pelo DOI; JCR e Qualis viram 2 campos opcionais por item |
| 14 | Índice H e citações | **NOVO** | Tela 1, dois campos numéricos |
| 15–19 | RH formados (IC, TCC, MS, DR, PD) | **DERIVA** | 5 contadores calculados dos fatos de formação (form do laboratório) |
| 20 | Objetivos do INCT a que contribuiu (lista de 43) | **DERIVA** | pré-marcados pelos EETs do laboratório; a pessoa confirma — **só os relevantes aparecem, não os 43** |
| 21 | Financiamento complementar (Sim/Não + agência/valor) | **NOVO** | mesmo bloco "Fomento" da 12 |
| 22 | Aquisição/infraestrutura de equipamentos | **JÁ** | fato `infraestrutura` (form do laboratório, L2) |
| 23 | Produto/processo/protocolo/tecnologia inovadora | **JÁ** | tipos `software`, `tecnologia_social`, `processo_nao_patenteavel` (Tela 2) |
| 24 | Depósito de patente | **JÁ** | tipo `patente`, âncora INPI (Tela 2) |
| 25 | Parcerias com empresas/órgãos | **JÁ** | fato `parceria` (L2) |
| 26 | Colaborações nacionais/internacionais | **JÁ** | fato `parceria`, campo `natureza` |
| 27 | Divulgação/popularização científica | **JÁ** | fato `acao_sociedade` (L2) |
| 28 | Projeto de extensão (Sim/Não) | **NOVO** | bloco "Extensão" (líder) |
| 29 | Título, instituição, responsável, período, coordenador | **NOVO** | idem, condicional ao Sim |
| 30 | Produtos do projeto de extensão (checkboxes) | **NOVO** | idem — reusa a taxonomia de produtos |
| 31 | Satisfação 1–5 | **NOVO** | micro-passo no fim |
| 32 | Anexo do relatório anual (PDF) | **DISPENSÁVEL** | o sistema **é** o relatório; oferece anexar como opcional |

**Contagem:** 11 já coletadas · 8 derivadas · 8 realmente novas · 5 já cobertas
por produção/fatos existentes.

## O que muda, em concreto

### No relato individual (`#/relatorio-anual`)
- **Tela 1 ganha 3 campos:** Programa de Pós-graduação, índice H, total de
  citações. Mais o `dgp_url` (herdado do laboratório, editável). São campos de
  conferência, não de digitação do zero.
- **Tela 2 (produção) ganha 2 campos opcionais por item:** JCR (fator de
  impacto) e Qualis. Só aparecem em `artigo_periodico`. Ficam recolhidos.
- **Bloco novo "Fomento e extensão"** — um passo compacto: financiamento
  complementar (Sim/Não → agência/valor), projetos com número de processo, e o
  projeto de extensão (Sim/Não → detalhe + produtos). Tudo opcional; quem não
  tem, passa em segundos.
- **Micro-fecho:** satisfação 1–5, na revisão.
- **Objetivos (Q20):** os 43 são mostrados **filtrados pelos EETs do
  laboratório** e pré-marcados pela derivação; a pessoa desmarca o que não for.
  Nunca os 43 crus.

### No relato do laboratório (`#/relatorio-laboratorio`)
- **A Conferência (L4) ganha os contadores automáticos:** estudantes por nível
  e RH formados por nível (IC, TCC, MS, DR, PD) **somados dos fatos** que a
  equipe já declarou. O líder confere e ajusta; não redigita. É o maior ganho
  de automação — as perguntas 10 e 15–19 do Forms viram números calculados.

### No dado
- `ciclo_membros` ganha: `ppg`, `indice_h`, `total_citacoes`, `satisfacao`.
- `laboratorios` ganha: `dgp_nome`, `dgp_url`.
- `producoes`/vínculo ganham: `jcr`, `qualis` (opcionais).
- Financiamento, projetos e extensão entram no `respostas` jsonb do relato
  (não merecem tabela — são texto estruturado que a coordenação lê).

## Decisões que registro, e por quê

1. **A pergunta 20 (objetivos) passa a ser feita — mas filtrada.** A
   especificação original evitava perguntar objetivo ao membro (derivava
   lab→EET→objetivo) para poupar tempo. O Forms do CTC pergunta explicitamente.
   O meio-termo: derivar E mostrar só os objetivos dos EETs do laboratório, já
   marcados, para confirmação. Automatiza sem esconder.
2. **JCR e Qualis ficam manuais e opcionais.** Não há base pública gratuita e
   confiável de Qualis por navegador; o JCR é proprietário (Clarivate). Fingir
   que derivamos seria pior que pedir. Ficam como confirmação opcional por item.
3. ~~**Índice H e citações são manuais.**~~ **REVOGADA em 10/08/2026** pelo dono:
   *"índice H, citações devem ser extraídos automaticamente do google schoolar do
   pesquisador"*. Passam a ser buscados sozinhos. O que a investigação empírica
   mostrou, e que molda o desenho (detalhe em [relato-indicadores.md](relato-indicadores.md)):
   o Google Acadêmico **não manda cabeçalho CORS**, então o navegador não
   consegue lê-lo — exige proxy no servidor (Edge Function do Supabase); e o
   `robots.txt` dele **permite ler um perfil conhecido** (`/citations?user=`) mas
   **proíbe procurar autor por nome**, e o id do perfil não está em lugar nenhum
   que tenhamos (testei o ORCID de 4 pesquisadores reais: o campo de links vem
   vazio em todos). Daí o desenho de duas fontes: **OpenAlex por ORCID** preenche
   sozinho, hoje, sem infraestrutura nenhuma; **Google Acadêmico** assume quando
   o pesquisador colar o link do perfil uma única vez. A fonte é sempre dita na
   tela, porque o índice H do Acadêmico é maior que o do OpenAlex (corpus
   diferente) e número sem procedência, em relatório de agência, é passivo.
4. **O anexo PDF (Q32) vira opcional.** O sistema gera o relatório estruturado;
   forçar um PDF paralelo duplicaria trabalho. Quem quiser anexar, anexa.

## Decisões da implementação — fundação (migração 009, tipos e config)

Registradas aqui porque o contrato era omisso nesses pontos:

5. **JCR e Qualis moram em `producoes` (a canônica), não em `producao_vinculos`.**
   São propriedade do trabalho (do periódico), não da atribuição: no vínculo,
   N coautores produziriam N cópias livres para divergir. A RLS da 005
   (`producoes_update`, intocada) já dá a escrita certa: quem tem vínculo
   corrige, a coordenação sempre. Sem CHECK amarrando ao tipo (a coordenação
   pode querer Qualis de anais); o CHECK que existe é o de valores — união das
   duas escalas Qualis (`A1..A4, B1..B4, C` **e** `B5` da escala anterior, que
   muita gente ainda cita de memória).
6. **`relatos.respostas` é coluna NOVA da 009 — a 005 só tinha `narrativas`.**
   O contrato de `narrativas` é "nomes do PICC 5.7.2, colável no CNPq";
   fomento/extensão não são PICC 5.7.2 e não entram lá. Chaves do jsonb novo
   (espelho TS: `RespostasRelato` em `src/relato/types.ts`):
   `objetivos_confirmados: int[]` (Q20), `fomento: FomentoItem[]` (Q12+Q21,
   com `complementar: true` distinguindo a Q21) e `extensao: {tem, titulo,
   instituicao, responsavel, periodo_inicio, periodo_fim, coordenador,
   produtos: TipoProducao[]}` (Q28–30 — os produtos reusam a taxonomia da 005).
   Teto de 64 kB por CHECK; validação de forma é do cliente.
7. **O mapa EET→objetivos da Q20 é curadoria editorial, não dado da proposta.**
   A proposta não traz mapa objetivo↔EET (docs/relato-anual.md §4.2 avisa).
   O mapa vive em `OBJETIVOS_POR_EET` (`src/relato/config.ts`), lido contra os
   títulos das 8 EETs, com três salvaguardas: só pré-marca (o dado que persiste
   é a confirmação humana), na dúvida o objetivo entrou em mais de uma EET
   (sobra desmarcável > falta invisível), e o objetivo 43 (transversal:
   publicações) entrou nas 8. **Pendência declarada: homologação pelo CGES**,
   no mesmo rito do mapa meta→objetivo (§8.8 do relato-anual).
8. **`satisfacao` (Q31) mora em `ciclo_membros`**, porque é resposta do ciclo
   (a mesma pessoa pode responder diferente no Ciclo 2) — junto de `ppg`,
   `indice_h` e `total_citacoes`. As quatro ficam fora da lista barrada do
   guarda da 007: são exatamente o que a Tela 1 pede que a pessoa preencha.
9. **`dgp_nome`/`dgp_url` são escritos pela coordenação; o LLA confere.** A RLS
   da 005 (`labs_coord_write`) não foi tocada — a 009 não altera política
   nenhuma. Se a conferência do LLA precisar virar edição direta, é decisão de
   política com migração própria.

## Decisões da implementação — contadores da Conferência (Q10 e Q15–19)

Registradas aqui porque o contrato era omisso nesses pontos (contagem em
`src/relato/narrativa.ts` — `contarEstudantesEFormados`, pura; tela em
`MeuLaboratorio.tsx`, L4):

10. **O que persiste é a divergência, nunca a contagem.** A contagem é
    reproduzível a partir dos fatos; o que o líder sobrepõe (valor + nota) vai
    em `relatos.respostas.contadores` — mesma coluna da 009, nenhuma coluna
    nova. Forma: `{ estudantes?: { ICJ|IC|AT|DTI|MS|DR|PD: {valor, nota?} },
    formados?: { IC|TCC|MS|DR|PD: {valor, nota?} } }`. O tipo TS
    (`RespostasComContadores`) é alargamento LOCAL de `narrativa.ts`;
    `RespostasRelato` em `types.ts` segue sendo o contrato do individual.
    Ausência de chave = concordância com o contado. A gravação relê o jsonb
    inteiro do banco e sobrescreve só `contadores` (mesmo contrato de
    `salvarNarrativas`), para nunca apagar o `fomento`/`extensao` gravados em
    `#/relatorio-anual`.
11. **Recorte da contagem = o recorte de toda a Conferência:** fatos
    confirmados com data no período (DECISÃO 3 vale aqui também).
    Estudantes (Q10) = formações `em_andamento` (campo `nivel`) + bolsas
    `implantada`/`em_curso` (sigla da `modalidade`). RH formados (Q15–19) =
    formações `concluida_no_periodo`. ICJ e IC somam juntos na categoria IC dos
    formados — é como a Meta 23 pactua ("ICJ e IC").
12. **Bolsa vira nível SÓ quando a sigla é inequívoca:** IC→IC, ICJ→ICJ,
    DTI-*→DTI, AT*→AT, GM→MS, GD→DR, PDJ/PDS→PD. ITI, SET, ADC, EXP e EV (que
    são 13 das 17 modalidades da quota) não têm nível de estudante no Forms e
    aparecem LISTADAS em tela como fora da soma — não somem em silêncio.
13. **TCC (Q16) não é contável e a tela diz isso:** `NivelFormacao` (005) não
    tem "graduação/TCC". A linha existe vazia, explica o porquê e aceita o
    número do líder com nota. **Pendência declarada:** se a coordenação quiser
    TCC contado, é acrescentar o nível ao CHECK de `formacao` em migração
    própria (e a `NivelFormacao` de `types.ts`), não inventar aqui. O mesmo
    vale para AT via formação — hoje AT só pode vir de bolsa com sigla AT*, que
    a quota atual não tem.
14. **Sobreposição formação×bolsa é declarada, não adivinhada:** o payload dos
    fatos não tem identificador de pessoa (o nome é texto livre; bolsista nem
    nome tem), então a mesma pessoa pode contar duas vezes. A tela avisa e o
    ajuste humano resolve — deduplicar por string seria inventar dado.
