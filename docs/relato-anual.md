# ESPECIFICAÇÃO FINAL — Formulário de Relato do 1º ano do INCT-CONEXAO

**Para implementação por Aleff Ferreira. Nada foi escrito no repositório.**
Fontes conferidas nesta apuração: `supabase/migrations/001–004`, `src/platform/*`, `src/webinars/router.ts`, `src/App.tsx`, `src/content/rede.ts`, `scripts/`, `/tmp/proposta_inct.txt` e o artefato `est_proposta.json` (26 metas, 43 objetivos, 24 indicadores, 92 números pactuados).

---

## 0. As quatro decisões que governam tudo (leia antes)

**0.1 — A janela do Ciclo 1 é 01/05/2025 → 30/04/2026, e ela já fechou.**
Linha 21 da proposta, campo do próprio formulário do CNPq: `INÍCIO: 01/05/2025 DURAÇÃO: 60 meses`. Logo o 1º ano do projeto terminou em 30/04/2026 — há três meses. Hoje (04/08/2026) a rede está no 4º mês do 2º ano, e o relatório dos **24 meses** vence por volta de **30/04/2027** (a confirmar contra o Termo de Outorga). Consequência de projeto: **o formulário não pode ter uma janela só.** Ele coleta continuamente e o **item carrega a data do fato**; o sistema atribui o ciclo. O Ciclo 2 nasce aberto junto com o Ciclo 1, e o que aconteceu entre 01/05/2026 e hoje entra no Ciclo 2 sem se perder e sem contar duas vezes. Isso resolve, de uma vez, o buraco de três meses e a coleta do ano que já está correndo.

**0.2 — Fato coletivo é declarado uma vez, pelo laboratório. O membro só ADERE.**
Expedição, ação de divulgação, parceria institucional, bolsista e formação são coletivos por natureza. Se cada membro puder criar um registro desses, cinco pessoas na mesma expedição produzem cinco expedições — e a Meta 7 pactua "até 50 expedições". Deduplicação por DOI resolve artigo; não resolve nada disso. **Só o formulário do laboratório (`#/meu-laboratorio`) cria fatos coletivos; o formulário individual (`#/meu-ano`) só marca "participei deste" numa lista, ou propõe um fato que vai para a fila do LLA.** Essa é a única mudança que faz os números fecharem, e é o motivo de existirem dois formulários e não um.

**0.3 — Isto não é prestação de contas ao CNPq. É o Indicador nº 2 pactuado pela própria rede.**
A Chamada MCTI/CNPq/SECTICS/MS/CAPES/FAPs **nº 46/2024** (confirmada, 5 ocorrências na proposta; a 22/2024 é outro programa) exige relatório parcial aos 24 e 48 meses, não aos 12. E nenhuma das 26 metas tem marco no 1º ano — todas medem em 2º/4º/5º. Portanto o formulário pode ser tolerante, incremental e sem trava de obrigatoriedade — desde que cada campo já nasça no formato que o CNPq vai cobrar em 2027. Dizer isso na primeira tela é requisito de produto, não cortesia.

**0.4 — Nunca se pergunta percentual de meta. Mas o percentual é obrigatório.**
A proposta (linha 1538) compromete a governança com "mensuração do percentual atingido das metas pactuadas". A resposta certa não é omitir: é **o sistema calcular** a execução absoluta a partir dos itens declarados, exibir como **projeção informativa contra o marco do 2º ano**, e o LLA/CGES homologar. Campo de percentual não existe em tela nenhuma para o membro.

---

## 1. ARQUITETURA

### 1.1 Rotas

Três superfícies, dois formulários:

| Rota | Componente | Público | Tempo |
|---|---|---|---|
| `#/meu-ano` | `src/relato/MeuAno.tsx` | os 209 membros | 6–9 min (mediana), 3 min no "nada a declarar" |
| `#/meu-laboratorio` | `src/relato/MeuLaboratorio.tsx` | 28 LLAs (+ coordenação) | 20–35 min, sessão separada, **abre 15 dias antes** |
| `#/gestao` → nova aba "Relatos" | `src/relato/Consolidacao.tsx` | coordenação/CGES | leitura e exportação |

Implementação do roteamento, seguindo `src/webinars/router.ts` exatamente como está:

- acrescentar ao union `Route`: `| { name: "meu-ano" } | { name: "meu-laboratorio" }`;
- em `parseHash`, dois `if (segments[0] === "meu-ano")` / `"meu-laboratorio"` antes do fallback;
- exportar `MEU_ANO_HREF = "#/meu-ano"` e `MEU_LAB_HREF = "#/meu-laboratorio"`;
- em `App.tsx`, `lazy(() => import("./relato/MeuAno"))` dentro de `<Suspense fallback={<PlatformFallback />}>`, no mesmo padrão de `Inscricao`/`Gestao`. **Não** entram no `navItems` do header — são rotas de convite, não de navegação pública.

Módulos compartilhados novos, todos em `src/relato/`:
`api.ts` (todas as chamadas ao Supabase), `metadados.ts` (resolução DOI/ORCID/ROR), `config.ts` (tipos do jsonb do ciclo), `dedupe.ts`, `i18n.ts` (pt-BR/en), `types.ts`, `validation.ts` (checksum ORCID MOD 11-2, DOI, ISBN, ISSN, ROR).

Reaproveitar sem tocar: `supabaseClient.ts`, `AuthCard.tsx`, `PasswordCard.tsx`, `auth.tsx`, `errors.ts`, `audit.ts`.

### 1.2 Papéis — a decisão

**Não tocar em `profiles.role`.** O check `('admin','avaliador','candidato')` e todas as políticas RLS dele estão validados em produção com 83 candidaturas homologadas; reescrever isso por vocabulário é risco gratuito. O membro que fizer login vai nascer `candidato` no `profiles` — e isso é irrelevante, porque **nenhuma política nova consulta `profiles.role`**.

O papel do relatório vive em `ciclo_membros`, e é **propriedade do ciclo, não da pessoa** (a mesma pessoa pode ser LLA no Ciclo 1 e não no Ciclo 2):

```
papel ∈ ('coordenacao','cges','lla','pesquisador','estudante','tecnico_admin')
```

Seis valores, colapsando as 13 categorias que a proposta registra no PICC (Pesquisador 74 · LLA 28 · Colaborador 23 · Pesq. Estrangeiro 22 · Pesq. Colaborador 21 · Aluno 13 · Aluno de Pós 9 · Comitê Gestor 8 · Administrativa 5 · Técnico 3 · Apoio Técnico 1 · Téc. de Laboratório 1 · Vice-Coordenador 1 = **209**). A categoria original é preservada em `categoria_picc` (texto, 13 valores) porque é a que o CNPq conhece — o colapso é só para ramificar tela. A palavra "candidato" não aparece em nenhum lugar da interface deste ciclo.

Funções `SECURITY DEFINER` novas, no padrão do 001 (evitam recursão de RLS):

- `papel_no_ciclo(p_ciclo uuid) returns text`
- `is_coordenacao(p_ciclo uuid) returns boolean` — `papel in ('coordenacao','cges') or is_admin()`
- `is_lla_de(p_lab uuid) returns boolean`
- `meu_laboratorio(p_ciclo uuid) returns uuid`

Nota importante: `is_staff()` (001) inclui `avaliador`. **Não use `is_staff()` nas políticas novas** — os avaliadores da seleção de IC não devem ler os relatos da rede. Use `is_coordenacao()`.

### 1.3 Migração 005 — schema descrito

Arquivo único `supabase/migrations/005_relatos.sql`, rodado após 001→004, com o mesmo estilo de comentário-cabeçalho das anteriores.

**`relatorio_ciclos`** — a tabela de configuração, no espírito literal do comentário do 001 ("lançar uma nova seleção = inserir uma linha; nenhum código muda"). Colunas: `id uuid pk`, `slug text unique`, `numero int` (1, 2, …), `titulo text`, `status text check in ('rascunho','aberto','em_conferencia','consolidado','arquivado')`, `periodo_inicio date`, `periodo_fim date` (o que é reportável — Ciclo 1: 2025‑05‑01 a 2026‑04‑30), `abre_em timestamptz`, `fecha_em timestamptz` (a janela de **envio**, distinta da janela do que é reportável), `vigencia_inicio date` (data do Termo de Outorga; dela derivam os marcos de 24/48 meses e o prazo do REO — **nunca constante no código**), `chamada text`, `processo text` (nullable, ver §8), `config jsonb`, timestamps + trigger `touch_updated_at` (já existe no 001). Constraint: `periodo_fim > periodo_inicio`; e um índice/EXCLUDE que impeça sobreposição de períodos entre ciclos.

O `config jsonb` recebe, tal como saem de `est_proposta.json`: as 8 EETs com título integral, os 43 objetivos com `missao`, as 26 metas com `objetivosAssociados`/`progresso`/`numerosPactuados` (92 linhas), os 24 indicadores com o ano, as 17 modalidades de bolsa (incluindo SET‑G, EXP‑1 e EV‑3, que listagens parciais omitem), os 6 comitês, a lista curada de instituições com ROR id, e os dois mapas de derivação (§4.2). Nada disso é literal no TypeScript.

**`laboratorios`** — os Laboratórios Associados. `id`, `ciclo_id`, `sigla`, `nome`, `instituicao_ror`, `uf`, `eets text[]`, `lla_user_id uuid null`. Semeada pela coordenação. **Quantos são está em disputa (26 no resumo, 28 no Quadro Geral do PICC, 27 publicados hoje em `rede.ts`) — ver §8.1.** É por isso que os LLAs são uma tabela e não um enum.

**`ciclo_membros`** — o *roster* e o denominador. `id`, `ciclo_id`, `user_id uuid null references auth.users`, `nome text`, `email text` (lower, unique por ciclo), `categoria_picc text`, `papel text check (...)`, `laboratorio_id uuid null`, `instituicao_ror text`, `lattes_id text`, `orcid text null`, `idioma text default 'pt'`, `convidado_em timestamptz`, `primeiro_acesso_em timestamptz null`, `ativo boolean default true`. As linhas são criadas **antes** de qualquer login, importadas da seção EQUIPE da proposta (209 blocos `RESPONSABILIDADE NO PROJETO`, 190 URLs `lattes.cnpq.br` — o ID Lattes de 16 dígitos já está lá, e a instituição e a titulação também). Estender `handle_new_user()` (ou um trigger irmão) para, no primeiro acesso, casar `lower(email)` e gravar `user_id` + `primeiro_acesso_em` — exatamente o mecanismo já usado pelo `staff_allowlist`.

**`relatos`** — um por (`ciclo_id`,`user_id`), `unique`. `protocolo text unique`, `status text check in ('rascunho','enviado','em_conferencia','conferido')`, `nada_a_declarar boolean default false`, `narrativas jsonb`, `declaracao_veracidade boolean`, `cessao_imagem boolean`, `submitted_at`, timestamps + `touch_updated_at`.

**`producoes`** — canônica, uma linha por trabalho na rede inteira. `id`, `ciclo_id`, `ancora_tipo`, `ancora_valor`, `metadados jsonb` (cache do CSL‑JSON no momento da resolução), `tipo`, `ambito`, `ano int`, `publicado_em date null`, `criado_por uuid`. **`unique (ciclo_id, ancora_tipo, lower(ancora_valor))`** — a unicidade fica aqui, nunca no vínculo.

**`producao_vinculos`** — `unique (producao_id, relato_id)`, mais `origem text check in ('orcid','doi_colado','manual','importado')`, `mencionaApoio`, `objetivos int[]`, `confirmado_em`. É onde mora a atribuição; a contagem roda na canônica.

**`producao_autores`** — cache dos coautores devolvidos pelo Crossref: `producao_id`, `orcid`, `nome`, `ordem`, `is_membro_rede boolean`, `user_id null`. Alimenta a sugestão "você é coautor deste?" e mede a colaboração **interna** da rede, que é literalmente o Indicador nº 3.

**`fatos`** — os fatos coletivos, do laboratório. `id`, `ciclo_id`, `laboratorio_id`, `tipo text check in ('expedicao','acao_sociedade','parceria','formacao','bolsista','acervo','dado_software','infraestrutura','politica_publica')`, `ocorrido_em date` (precisão de mês aceita: dia 1), `titulo text(140)`, `payload jsonb` (campos específicos do tipo, §2.4), `status text check in ('proposto','confirmado','duplicado_de','rejeitado')`, `duplicado_de uuid null`, `criado_por uuid`, `confirmado_por uuid null`, `comite text` (derivado por trigger do tipo — CEXPECIAL/CDIV/CPIE/CINTER/CCCO/CTC), `eets text[]` (herdado do laboratório), `objetivos int[]`.

**`fato_participantes`** — a adesão. `fato_id`, `relato_id`, `user_id`, `papel_no_fato text null`, `unique (fato_id, user_id)`.

**`relato_arquivos`** — `relato_id null`, `fato_id null`, `storage_path`, `sha256`, `mime`, `bytes`, `uso text check in ('comprovante','imagem_publicavel')`.

**`relato_eventos`** — log append-only, cópia do padrão do 004: `relato_id`, `action`, `snapshot jsonb`, `snapshot_sha256 text`, `por uuid` (quem gravou — diferente do dono quando a coordenação preenche por alguém), `at`. Inserção exclusivamente por trigger `SECURITY DEFINER`; leitura só `is_coordenacao()`.

**`relato_protocolo_seq`** — `ciclo_id pk`, `ultimo int`, RLS ligada e **sem policy** (inacessível pela API), com `reserve_protocolo_relato(uuid)` e trigger `BEFORE INSERT` — cópia literal da mecânica do 003, que já existe justamente porque `count(*)+1` colidiu no pico de abertura. Formato: **`CNX-R1-0001`**. E, como no 003, `revoke execute ... from public, anon, authenticated`.

**Trigger de ciclo por data.** `BEFORE INSERT OR UPDATE` em `producoes` e `fatos`: se `ciclo_id` vier nulo, resolver pelo `ocorrido_em`/`publicado_em` contra os `periodo_inicio/fim` dos ciclos. Fato fora de qualquer período → aceito com `ciclo_id` do ciclo corrente e marcado `payload->>'fora_de_periodo' = 'linha_de_base'`, que é dado útil (§5.4), não erro.

**Trigger de janela.** Análogo ao `enforce_edital_window` do 001, mas **só barra a transição para `status='enviado'`** fora de `abre_em..fecha_em`. Rascunho e edição de item são livres o ano inteiro — é o modelo Researchfish, e é o que faz o membro registrar o artigo quando ele sai.

**Views (nunca colunas):** `v_producao_por_tipo` (as linhas exatas da tabela A do CNPq), `v_formacao` (tabela B, encerrados × em andamento), `v_rede_instituicoes` e `v_rede_paises` (Indicador 3, derivados de ROR), `v_meta_execucao` (execução absoluta por `numero_pactuado_key`), `v_meta_projecao` (percentual contra o marco do 2º ano, sempre rotulado projeção), `v_cobertura` (o denominador: convidados / entraram / declararam / declararam nada / silenciosos).

### 1.4 RLS — a cadeia Membro → LLA → Comitê → CGES

É a cadeia que a própria proposta define (p. 37) e é requisito de banco, não de tela.

- `relatos`: `select` para `user_id = auth.uid()` **ou** `is_lla_de(lab do dono)` **ou** `is_coordenacao()`. `insert/update` só para o dono enquanto `status in ('rascunho','enviado')`; `is_coordenacao()` pode escrever sempre (é a válvula de "preencher em nome de", e o log registra quem).
- `producoes`: `select` para qualquer membro autenticado do ciclo (é a base de dedupe), mas a coluna de quem declarou **não** é exposta ao segundo declarante — a checagem passa por RPC `checar_ancora(p_ciclo, p_tipo, p_valor)` que devolve `{existe: true, titulo, ja_declarado_por_membro: true}` **sem nome**. O nome só aparece depois que o segundo confirma a coautoria. Isso é vazamento de informação, e é por RLS/RPC, não por texto de tela.
- `fatos`: `select` para membros do mesmo `laboratorio_id`, LLA do laboratório e coordenação. `insert/update` para o LLA e a coordenação; membro pode inserir apenas com `status='proposto'`.
- `fato_participantes`: o próprio usuário insere/apaga a própria adesão.
- Storage: bucket privado novo **`relatos`**, caminho `<auth.uid()>/<ciclo_slug>/<item_id>/<n>.<ext>`, política `(storage.foldername(name))[1] = auth.uid()::text` — idêntica ao `inscricoes` do 001. **Atenção:** o bucket `inscricoes` é `2097152` bytes e `array['application/pdf']`. O novo precisa de `image/jpeg`, `image/png` e `application/pdf`, com limite de **1 MB por arquivo** e compressão no cliente (1600 px, JPEG q0.8, máx. 3 imagens por item, teto de 12 arquivos por relato).

### 1.5 Coordenação: como lê e como exporta

Nova aba dentro de `#/gestao` (não uma rota nova — o portal já existe e a comissão já sabe entrar). Quatro painéis:

1. **Cobertura** — a tela mais importante do ciclo, e a que nenhum dos desenhos originais tinha: convidados 209 · entraram *n* · enviaram *n* · declararam "nada a declarar" *n* · silenciosos *n*, quebrado por laboratório e por UF, com botão "reenviar convite" por linha. **Sem esse painel, o relatório não consegue dizer se o número baixo é baixa produção ou baixa resposta — e essa é a coisa mais importante que um relatório de 1º ano pode dizer.**
2. **Pendências** — itens sem âncora resolvida, fatos `proposto` sem confirmação do LLA, DOIs com coautoria não confirmada. Fila roteada por `comite`.
3. **Números** — as views acima, cada célula clicável abrindo a lista de itens que a compõem. Nenhum número digitado em lugar nenhum.
4. **Exportar** — três saídas: (a) **JSON** integral do ciclo (schema da §2), que é o backup e a fonte do relatório de 2027; (b) **CSV por tabela oficial do CNPq** (A/B/C/D + acordos + divulgação), com os cabeçalhos literais do formulário oficial; (c) **anexo de referências por tipo de produção**, exigido no item 6.1 ("listar, ao final do relatório, todas as referências que compõem o quantitativo aqui informado"), gerado do `metadados` cacheado. Tudo gerado no cliente a partir de um `select` — sem backend.

### 1.6 Contingência: o projeto free pausa por inatividade

Projeto Supabase no plano gratuito **pausa após ~7 dias sem requisição**, e retomar é manual pelo dashboard. Numa coleta que fica aberta o ano inteiro, isso é uma falha garantida — o membro que abrir o link num domingo de janeiro encontra erro de rede, e não volta. Três camadas, todas obrigatórias:

1. **Keep-alive.** GitHub Action (`.github/workflows/supabase-keepalive.yml`) rodando `cron: "17 */8 * * *"` com um `curl` a `${SUPABASE_URL}/rest/v1/relatorio_ciclos?select=slug&limit=1` usando a anon key em secret. O repositório já é GitHub (o Sveltia é git-backed), então não há infraestrutura nova. Falha do workflow deve abrir issue automaticamente.
2. **Plano Pro durante a coleta.** ~US$ 25/mês elimina a pausa, sobe o storage e destrava o SMTP dedicado. Recomendo assinar pelo período de coleta (§8.6). O keep-alive continua valendo como cinto de segurança se voltar ao free.
3. **Backup semanal fora do Supabase.** Segunda Action, `cron: "0 6 * * 1"`, que puxa via REST cada tabela do 005 em JSON e commita em `backups/relatos/<data>/` num repositório **privado** (nunca no repo do site — há dados pessoais). Retenção de 12 semanas. É o que garante que uma pausa mal resolvida, um `delete` errado ou um fim de free-tier não custem o ciclo inteiro.

Adicionalmente: `#/meu-ano` deve tratar falha de rede como **estado, não como tela de erro** — "não conseguimos salvar agora; seu texto está aqui e vamos tentar de novo" com retry exponencial, preservando o que foi digitado.

### 1.7 O envio dos convites (bloqueante, e frequentemente esquecido)

- **A proposta não tem e-mails.** Confere: 209 blocos de equipe, 190 URLs do Lattes, **zero endereços de e-mail**. Montar a lista de 209 e-mails é trabalho da coordenação e é pré-requisito de tudo. Comece por aí.
- **O SMTP padrão do Supabase não serve.** O serviço de e-mail embutido é limitado a poucas mensagens por hora e destinado a testes. Para 209 links mágicos é obrigatório **SMTP customizado** (Resend/SES/SendGrid) com **SPF e DKIM do domínio `inct-conexao.com.br`** validados, e teste prévio nos domínios mais frequentes da rede (`fiocruz.br`, `unir.br`, `.edu.br`). Link mágico que cai no spam de instituição federal é conclusão zero, e nenhuma qualidade de formulário salva isso.
- **O link do e-mail já é o link mágico**: o primeiro clique cai dentro da Tela 1, nunca numa tela de login. O PKCE já configurado (`flowType: "pkce"`) foi escolhido justamente para o retorno vir em `?code=` e não conflitar com o roteamento por hash — não mexa nisso.
- **"Me mande outro link"** autosserviço na porta de entrada, com cooldown de 60 s, porque o token expira e o sênior que abre o e-mail três dias depois é exatamente quem desiste.
- **Senha opcional** logo após o primeiro acesso (`PasswordCard.tsx` já existe): quem volta seis vezes ao longo do ano não deve depender do e-mail toda vez.

---

## 2. O MODELO DE DADOS

Este é o item que decide se o relatório sai por agregação ou por copiar-e-colar. Abaixo, o envelope exato que um envio produz — é o que o botão **Exportar JSON** cospe e o que o relatório de 2027 vai ler.

### 2.1 Envelope

```jsonc
{
  "schema": "inct-relato/1",                  // string, versionada; nunca mude sem migrar
  "ciclo": {
    "slug": "ciclo-1",                        // string
    "numero": 1,                              // int
    "periodo_inicio": "2025-05-01",           // date (ISO)
    "periodo_fim": "2026-04-30",              // date
    "vigencia_inicio": null,                  // date|null — Termo de Outorga (§8.2)
    "chamada": "MCTI/CNPq/SECTICS/MS/CAPES/FAPs nº 46/2024",
    "processo": null                          // string|null — NÃO preencher sem confirmar (§8.3)
  },
  "membro": { … },        // §2.2
  "producoes": [ … ],     // §2.3
  "adesoes": [ … ],       // §2.5
  "fatos_propostos": [ … ],// §2.4, com status "proposto"
  "narrativas": { … },    // §2.6
  "envio": { … }          // §2.7
}
```

O export do laboratório (`#/meu-laboratorio`) usa o mesmo envelope com `"schema": "inct-relato-lab/1"` e troca `producoes`/`adesoes` por `fatos` (§2.4) e `governanca` (§2.8).

### 2.2 `membro` — tudo pré-preenchido do roster

```jsonc
{
  "membro_id": "uuid",
  "nome": "string(120)",                  // pré-preenchido da proposta, editável
  "email": "string",                      // read-only, vem do auth
  "categoria_picc": "Pesquisador",        // string, 1 de 13, read-only (do roster)
  "papel": "pesquisador",                 // enum 6, pré-marcado, corrigível em 1 toque
  "laboratorio_id": "uuid|null",          // select dos LLAs; obrigatório exceto coordenação/CGES
  "instituicao_ror": "https://ror.org/02842cb31",  // string; select da lista curada
  "instituicao_nome": "string",           // derivado do ROR (cache)
  "pais_iso2": "BR",                      // DERIVADO do ROR — nunca digitado
  "uf": "RO",                             // derivado do ROR quando BR
  "lattes_id": "1305959204330545",        // string, exatamente 16 dígitos; pré-preenchido
  "orcid": "0000-0002-1825-0097|null",    // string; validação MOD 11-2 local
  "idioma": "pt|en"
}
```

**Não se pede:** CPF (minimização é obrigação da LGPD; a base legal aqui é obrigação regulatória, não pesquisa), telefone, endereço, data de nascimento, titulação, lotação detalhada, `lattes_atualizado_em` (é inverificável, obriga a sair do site na primeira tela e vira um bloqueio duro antes de qualquer pergunta útil — vira **aviso**, não campo).

### 2.3 `producoes[]` — um objeto por trabalho

```jsonc
{
  "producao_id": "uuid",
  "ancora_tipo": "doi",                 // enum: doi|isbn|issn_pagina|inpi|url_com_captura|arquivo_sha256
  "ancora_valor": "10.1016/j.toxicon.2025.108123", // normalizado: minúsculas, sem prefixo de URL
  "ancora_resolvida": true,             // boolean — escrito pelo SISTEMA, nunca pelo usuário
  "origem": "orcid",                    // enum: orcid|doi_colado|manual|importado — auditoria
  "tipo": "artigo_periodico",           // enum fechado (abaixo)
  "ambito": "internacional",            // enum nacional|internacional — ver §2.3.1
  "convidado": false,                   // boolean, só p/ trabalho em evento
  "ano": 2025,                          // int, derivado dos metadados
  "publicado_em": "2025-11-14",         // date|null
  "mencionaApoio": "nao_sei",           // enum sim|nao|nao_sei — default nao_sei, NÃO trava
  "acesso_aberto": null,                // boolean|null — derivado da licença quando houver
  "objetivos": [19, 22],                // int[] 1..43 — OPCIONAL; default herda do laboratório
  "metas_derivadas": [19],              // int[] — CALCULADO, read-only, exibido
  "indicadores": [],                    // int[] — CALCULADO
  "publicavel": true,                   // boolean — separa o que vira site do que é interno
  "metadados": {                        // jsonb: cache do CSL-JSON no momento da resolução
    "title": "…", "container-title": "Toxicon", "ISSN": ["0041-0101"],
    "publisher": "…", "volume": "240", "page": "108123",
    "issued": {"date-parts": [[2025,11,14]]}, "type": "journal-article",
    "license": [...], "author": [{"given":"…","family":"…","ORCID":"…"}]
  },
  "coautores_na_rede": ["uuid", "uuid"]  // uuid[] — casado por ORCID contra ciclo_membros
}
```

`tipo` — enum fechado, união da taxonomia CAPES (bibliográfica/técnica/artística) com as **linhas literais da tabela A do formulário oficial do CNPq**, para que o roll-up saia pronto:
`livro · capitulo · artigo_periodico · trabalho_anais_completo · trabalho_anais_resumo · trabalho_anais_resumo_expandido · traducao · software_aplicativo · base_dados · patente · desenho_industrial · marca · cultivar · tecnologia_social · processo_nao_patenteavel · manual_protocolo · relatorio_tecnico · material_didatico · curso_formacao · evento_organizado · norma_marco_regulatorio · acervo_curadoria_colecao · carta_mapa · produto_comunicacao · producao_artistica · outro`.
`outro` exige `outro_descricao` + âncora.

**Não se pede:** citação em ABNT, número de citações, fator de impacto, Qualis, ISSN digitado, páginas, lista de coautores. Tudo isso vem do DOI, e é literalmente assim que o CNPq conta (pelo Lattes e pelo DOI, via WoS/Scopus). Pedir de novo garante divergência entre duas bases, e em auditoria duas classificações divergentes são piores que uma.

**2.3.1 — `ambito` é um problema mal resolvido em toda parte, e a decisão aqui é diferente.** Não existe definição operacional de "periódico nacional" que 209 pessoas apliquem igual (revista brasileira em inglês com corpo editorial internacional é o quê?). Perguntar produz 209 definições na mesma coluna. **Decisão: o campo é preenchido pelo sistema** a partir do país da editora nos metadados (`publisher-location` / prefixo do ISSN), gravado como `ambito_origem: "inferido"`, e **a regra fica no `config` do ciclo**, aplicada uniformemente pela coordenação na hora do relatório. O membro não vê o campo. Se a coordenação quiser confirmar caso a caso, faz isso na fila do CTC, uma vez, com uma regra só — não 209 vezes com 209 regras.

### 2.4 `fatos[]` — os coletivos, só no formulário do laboratório

Campos comuns a todos os tipos:

```jsonc
{
  "fato_id": "uuid",
  "tipo": "expedicao",                  // enum de 9 (abaixo)
  "laboratorio_id": "uuid",
  "ocorrido_em": "2025-09-01",          // date com precisão de MÊS (dia = 1)
  "titulo": "string(140)",              // "o quê", uma linha
  "status": "confirmado",               // proposto|confirmado|duplicado_de|rejeitado
  "eets": ["EET-3"],                    // herdado do laboratório, editável
  "objetivos": [12, 13],                // int[]
  "comite": "CEXPECIAL",                // DERIVADO do tipo — nunca perguntado
  "participantes": ["uuid", "uuid"],    // uuid[] escolhidos da lista de membros do lab
  "payload": { … }                      // específico do tipo
}
```

`payload` por tipo:

| tipo | payload | comitê | alimenta |
|---|---|---|---|
| `expedicao` | `municipio` (código IBGE), `uf`, `comunidade?`, `dias int`, `pessoas_equipe int`, `autorizacao?` (nº CEP/CONEP, SISBIO, SISGEN, CGEN) | CEXPECIAL | Meta 7 |
| `acao_sociedade` | `veiculo[]` (lista literal do CNPq), `publico_alvo[]` (ensino básico/fundamental/médio/superior/público em geral/profissionais setoriais/comunidade tradicional), `pessoas_alcancadas int`, `url`, `municipio` | CDIV | **Indicador 5**, item 7.3 |
| `parceria` | `ror_id` **obrigatório**, `pais_iso2` (derivado), `natureza` enum(`acordo_formal`\|`coautoria`\|`visita_tecnica`\|`intercambio`\|`projeto_conjunto`\|`fornecimento_amostras`\|`empresa`\|`org_publica_social`), `objetivo_resumido text` | CINTER/CTC | **Indicador 3**, item 3.1 |
| `formacao` | `nome`, `nivel` enum(`ic_junior`\|`ic`\|`mestrado`\|`doutorado`\|`pos_doc`\|`tecnica`\|`comunitaria`), `situacao` enum(`em_andamento`\|`concluida_no_periodo`\|`interrompida`), `data_defesa?`, `instituicao_ror`, `uf`, `codigo_ppg_capes?`, `titulo_trabalho?`, `situacao_atual_egresso?` | CTC | Tabela B, item 6.3, Meta 23 |
| `bolsista` | `modalidade` (as **17**), `situacao` enum(`implantada`\|`em_curso`\|`concluida`\|`cancelada`\|`nao_implantada`), `inicio`, `fim?`, `orientador_id`, `avaliacao_desempenho text(300)` | CTC | Manual PICC 5.7.2.2 |
| `acervo` | `sigla_colecao`, `o_que_foi_incorporado`, `registros int`, `faixa_tombo?`, `sisgen?` | CCCO/CTC | **Indicador 4** |
| `dado_software` | `doi_ou_url`, `nome`, `repositorio` | CTC | Indicador 1, avaliação CGEE |
| `infraestrutura` | `o_que`, `onde_instalada`, `multiusuaria boolean` | CTC | Meta 3 (14 estações meteorológicas, 8 de qualidade do ar) |
| `politica_publica` | `instrumento`, `orgao`, `situacao` | CPIE | Item 6.2 quadro B |

Os três campos que a proposta obriga a coletar e que ninguém deve cortar — resultados, **dificuldades** e oportunidades — estão em §2.6.

**Números de pessoas alcançadas.** `pessoas_alcancadas` e `pessoas_equipe` são as únicas métricas sem âncora do modelo, e são as que mais provavelmente vão para o release público. Duas travas: (a) só existem dentro de fato coletivo, declarado uma vez — não multiplicam por declarante; (b) no export, saem rotulados `estimado: true` e o relatório deve exibi-los com a palavra "aproximadamente". Não invente precisão que não existe.

### 2.5 `adesoes[]` — o que o formulário individual grava sobre fatos coletivos

```jsonc
{ "fato_id": "uuid", "papel_no_fato": "string|null", "aderido_em": "timestamptz" }
```

Uma linha, sem payload. É a diferença entre "5 pessoas participaram de 1 expedição" e "5 expedições".

### 2.6 `narrativas` — nomeadas exatamente como no PICC

```jsonc
{
  "resultado_principal": "text(600)",              // OBRIGATÓRIO
  "dificuldades": "text(600)",                     // opcional, marcado "a coordenação precisa desta"
  "oportunidades": "text(600)",                    // opcional
  "texto_nao_especialistas": "text(400)",          // pré-preenchido com resultado_principal
  "impacto_estado_da_arte": "text(1200)|null",     // só LLA/CGES
  "contribuicao_inovacao": "text(1200)|null",      // só LLA/CGES
  "contribuicao_formacao_rh": "text(1200)|null",   // só LLA/CGES
  "contribuicao_difusao": "text(1200)|null",       // só LLA/CGES
  "justificativa_discrepancia": "text(1200)|null"  // só LLA/CGES — item 12.1.2.c
}
```

Os quatro campos de 1.200 caracteres têm os nomes literais do PICC (5.7.2) para que o texto seja colável no sistema do CNPq em 2027 sem reescrita. Eles ficam **no formulário do laboratório**, não no individual — pedir quatro dissertações a 209 pessoas é a forma mais eficiente de zerar a taxa de resposta.

### 2.7 `envio`

```jsonc
{
  "protocolo": "CNX-R1-0148",
  "status": "enviado",
  "nada_a_declarar": false,
  "declaracao_veracidade": true,        // obrigatório para status='enviado'
  "cessao_imagem": true,                // obrigatório APENAS se houver imagem
  "submitted_at": "2026-09-14T17:22:03-04:00",
  "snapshot_sha256": "…",
  "preenchido_por": "uuid|null"         // ≠ dono quando a coordenação preencheu em nome de
}
```

### 2.8 `governanca` — só no export do laboratório

As quatro perguntas coladas do formulário oficial do CNPq, que só o líder pode responder:
`alterou_objetivos_metas boolean + detalhe`, `alterou_cronograma boolean + detalhe`, `alterou_equipe boolean + inclusoes int + exclusoes int`, `mecanismos_de_interacao text(1200)`, `dificuldades_na_rede text(1200)`.

---

## 3. AS TELAS

Regras válidas em **todas** elas, sem exceção: coluna única; `<label for>` real acima do campo, nunca placeholder como rótulo; `<fieldset>/<legend>` em grupo de rádio/checkbox; marcar os campos **opcionais** (não asteriscar os obrigatórios); nenhum botão de limpar; erro em texto ao lado do campo com `aria-describedby` + `aria-invalid`, preservando o que foi digitado; foco visível nunca removido; alvos de toque de 44 px; autosave com debounce de 800 ms anunciado em região `aria-live="polite"` **mais** um botão "Salvar e continuar depois" mesmo sendo tecnicamente redundante — a expectativa mental exige o botão.

Barra de progresso em **minutos**, não em porcentagem: "Tela 2 de 6 · faltam ~5 min". Rodapé fixo: "Salvo automaticamente às 14:32 · pode fechar e voltar depois".

### 3.1 `#/meu-ano` — o relato individual

**Porta (sem sessão).** Título: "Meu ano no INCT-CONEXAO". Três linhas:
> Este não é o relatório de prestação de contas ao CNPq — esse só vence aos 24 meses. Este é o **Indicador nº 2** que a própria rede pactuou: o relatório anual sobre o desenvolvimento técnico-científico da proposta, voltado a gestores públicos e à sociedade.
> Leva cerca de 8 minutos. Você pode sair e voltar quando quiser — fica salvo no servidor, não no seu navegador.
> Período do Ciclo 1: 01/05/2025 a 30/04/2026. O que for de depois disso entra no Ciclo 2 automaticamente.

Campo de e-mail + "Receber meu link de entrada" · "Já tenho senha" · "Aviso de privacidade". Quem vem pelo link do convite **não vê esta tela**.

**Tela 1 — "Confirme quem é você" (30 s).** Tudo pré-preenchido do roster: nome, categoria PICC, papel (rádio de 6, pré-marcado), laboratório, instituição (com ROR), ID Lattes. Só dois campos podem estar vazios: **ORCID** (com máscara `0000-0000-0000-000X`, validação MOD 11-2 **local**, botão "não lembro o meu" que chama `pub.orcid.org/v3.0/expanded-search` por nome) e o idioma. Um botão: **"Está certo"**.
No pé, a saída de dignidade: **"Neste ciclo não tive produção nem atividade para relatar"** → vai direto à Tela 6 com **uma** pergunta opcional e sem julgamento ("Quer contar o que faltou para começar? (opcional)") e encerra em 90 s. **Essa saída nunca pode desembocar num campo obrigatório** — quem acabou de declarar que não teve nada não pode ser obrigado a descrever seu resultado mais importante.

**Tela 2 — "Sua produção: confira o que encontramos" (1 min 30).**
Se há ORCID: chamada a `pub.orcid.org/v3.0/{orcid}/works` **no navegador** (CORS `*`, sem chave — testado), filtrada pelo período, cada DOI resolvido em fila de concorrência 3 no Crossref. Cabeçalho: "Encontramos 6 produções suas entre 01/05/2025 e 30/04/2026."
Cada linha: título em 2 linhas, veículo e ano, e **três alvos de toque**: `É minha e é do CONEXÃO` · `Não é do CONEXÃO` · `Não é minha`. Um toque por item.
Se o ORCID estiver vazio ou não devolver nada, a tela **não** fica vazia: mostra o campo grande "Cole o DOI, o link ou o ISBN" já focado, com o texto "Seu ORCID não tem trabalhos no período. Cole os DOIs — cada um leva 5 segundos."
Três formas de acrescentar: DOI único (resolve e mostra a citação montada para conferência); "Colar vários de uma vez" (textarea, um por linha); "Registrar item sem DOI" (**sempre visível**, 4 campos manuais).
Dedupe inline: "Este trabalho já foi registrado por outro membro da rede. Você é coautor?" → um toque, dois vínculos, uma contagem. O nome só aparece **depois** da confirmação.
Qualquer falha de API degrada para os 4 campos manuais preservando o que foi digitado — nunca para tela de erro.

**Tela 3 — "O que o seu laboratório fez, e você participou" (1 min).**
Lista dos `fatos` já declarados pelo LLA do laboratório da pessoa, agrupados por tipo, com uma caixa "participei". Nada para digitar.
Abaixo: **"Aconteceu algo que não está nesta lista?"** → abre um cartão de 3 campos (tipo, quando, o quê) que grava `status='proposto'` e vai para a fila do LLA. Não conta até ser confirmado, e a tela diz isso: "Vamos avisar o(a) líder do seu laboratório para confirmar."
Se o laboratório ainda não declarou nada, a tela mostra só a segunda parte, com o texto "Seu laboratório ainda não registrou as atividades do ano. O que você contar aqui vai para a conferência dele(a)."

**Tela 4 — "Em suas palavras" (2 min 30).** É aqui que o tempo mora.
1. "Em uma frase, qual foi seu resultado mais importante neste ciclo?" — 600 caracteres, contador visível, **obrigatória**.
2. "O que atrapalhou? Fale sem rodeios — dificuldade relatada agora vira argumento na renovação." — opcional, marcada em tela como "a coordenação precisa desta". Ao lado, a nota que muda a resposta: **"Este campo vai direto ao Comitê Gestor. Não passa pelo(a) líder do seu laboratório e não será publicado."** Sem isso, o campo vem mentiroso — optativo mais leitura hierárquica é igual a "nenhuma dificuldade a relatar", e um corpus de "sem dificuldades" depois é citado como evidência de que a rede não teve problemas.
3. "Que oportunidade nova apareceu?" — opcional.
Assim que a caixa 1 é preenchida, aparece abaixo uma quarta caixa **já preenchida com o mesmo texto**: "Podemos publicar esta frase no relatório para gestores e para a sociedade? Ajuste para quem não é da área." Vira edição, não redação — e é exatamente o "texto para não especialistas" do PICC e a matéria-prima do Indicador nº 2.

**Tela 5 — "Revise e envie" (40 s).** Resumo completo do que será enviado, item por item, com link para voltar a cada tela (exigência do WCAG 3.3.4 e da responsabilidade pessoal pela veracidade, que no CNPq é de quem preenche). Painel de pendências no topo, se houver: "2 itens estão sem âncora resolvida e não entram na contagem — você pode enviar assim mesmo."
Uma caixa: "Declaro que as informações acima são verdadeiras." Segunda caixa **só se houve imagem**: "Autorizo o uso destas imagens pelo INCT-CONEXAO e pelo CNPq em comunicação institucional."
Botão: **"Enviar meu relato"**. Depois: "Recebido. Protocolo CNX-R1-0148. A coleta segue aberta — você pode voltar e complementar quando quiser."

### 3.2 `#/meu-laboratorio` — o formulário do LLA

Convite próprio, **enviado 15 dias antes** do convite individual, em outro e-mail. 20–35 min, com "salve e volte" agressivo.

**L1 — Equipe.** Lista dos membros do laboratório vinda do roster; o LLA confirma quem saiu, quem entrou (contadores de inclusões/exclusões, que é o que o CNPq pergunta).
**L2 — Fatos do laboratório.** Nove fichas (§2.4). Tocar numa ficha abre um cartão e a adiciona à lista; quem não teve nada não toca em nada. Em cada fato, os participantes são **escolhidos da lista de membros**, não digitados. Aqui é onde estações do SIMBAM, expedições, acervos, parcerias com ROR, bolsistas e orientações entram — uma vez cada.
**L3 — Fila de propostas.** O que os membros propuseram: confirmar, fundir com um fato existente (`duplicado_de`), ou rejeitar com comentário que volta ao membro.
**L4 — Conferência.** "Sua equipe declarou 14 produções e 3 expedições." Tabela com o que o sistema contou, por meta, com a **projeção** contra o marco do 2º ano claramente rotulada. O líder aprova ou aponta; não redigita.
**L5 — Governança.** As quatro perguntas do formulário oficial (§2.8) e os quatro campos narrativos do PICC.
**L6 — Revisão e envio**, igual à do individual.

### 3.3 Validações (a lista completa)

| Campo | Regra | Mensagem |
|---|---|---|
| `orcid` | 16 dígitos, checksum ISO 7064 MOD 11‑2, último pode ser `X`; validação **local**, sem ida ao servidor | "Esse ORCID não confere — o último dígito não bate. Confira em orcid.org." |
| `lattes_id` | exatamente 16 dígitos (não há checksum público) | "O ID Lattes tem 16 números." |
| `doi` | normaliza (minúsculas, remove `https://doi.org/`, `doi:`, espaços colados de PDF) e casa `^10\.\d{4,9}/\S+$`; resolve Crossref → DataCite → doi.org CSL‑JSON | "Não encontramos esse DOI. Confira, ou registre à mão." |
| `isbn` | ISBN‑10/13 com dígito verificador; consulta OpenLibrary como conveniência | — |
| `ror_id` | `^0[a-z0-9]{8}$`; **nunca texto livre**; busca em `api.ror.org` só para "não encontrei a minha" | — |
| `ocorrido_em` | não pode ser futuro; fora do período → aceito e marcado como linha de base | "Essa data ainda não chegou." / "Isso é de antes do INCT começar — entra como linha de base." |
| `resultado_principal` | 20–600 caracteres | "Escreva pelo menos uma frase." |
| `declaracao_veracidade` | obrigatório para enviar | erro no topo, com link que move o foco |
| `cessao_imagem` | obrigatório **apenas** se houver arquivo `imagem_publicavel` | — |
| upload | ≤ 1 MB pós-compressão; jpeg/png/pdf; SHA‑256 calculado no navegador antes de subir | — |

---

## 4. AS REGRAS ESPERTAS

**4.1 Ramificação.** Por `papel`: `lla` vê o convite do laboratório (e o individual); `estudante` **não** vê ficha de formação nem de bolsista (é o orientador que declara — é assim que se mata a dupla contagem orientador × orientando); `tecnico_admin` recebe uma Tela 2 com o texto "Se você não publica, tudo bem — vá direto para a próxima" e a saída "nada a declarar" em destaque. Por laboratório: as fichas de acervo aparecem só para os laboratórios marcados como curadores no `config`; as de infraestrutura, só para os dos EET‑1/EET‑5.

**4.2 Classificação sem perguntar.** A cadeia é `laboratório → EET → objetivos → metas`, e **nenhum elo é perguntado ao membro comum**:
- `laboratório → EETs`: tabela `laboratorios.eets`, 28 linhas, preenchida uma vez pelo CGES. É tratável porque a proposta já afirma que "cada etapa estratégica conta com pelo menos 2 LLAs associados aos seus grupos" — o EET é propriedade do laboratório, não da pessoa. **Atenção: não existe na proposta nenhum mapa objetivo→EET.** Quem tentar derivar EET a partir dos 43 objetivos está inventando um dado; por isso a derivação vai no sentido contrário.
- `objetivos`: herdados do laboratório (campo `laboratorios.objetivos`, também do CGES) e sobrescrevíveis por item, num controle **opcional** e recolhido, filtrado pela missão. Não é obrigatório e não é decorativo: quem quiser precisão tem onde dar.
- `objetivo → meta`: mapa de 26 linhas de `est_proposta.json`, lido por coordenadas do PDF (todas as 26 com `objetivosAssociadosAmbiguo: false`; cobre 38 dos 43 objetivos). **Os objetivos 1 a 5 — todo o bloco biometeorologia/SIMBAM — não pertencem a meta nenhuma** e só existem via o Indicador nº 1, que é justamente de 1º ano. Por isso a navegação nunca pode ser organizada por metas: perderia o eixo inteiro no ano em que ele é cobrado.
- `tipo de fato → comitê`: derivado por trigger. Ninguém pergunta a que comitê algo pertence.

**4.3 Autopreenchimento — o que funciona sem backend, testado.** Todas estas chamadas foram verificadas ao vivo com `Origin: https://inct-conexao.com.br`, devolvem CORS aberto e **não exigem chave**:

| API | Uso | Observação de implementação |
|---|---|---|
| `api.crossref.org/works/{doi}` | artigo, livro, capítulo, anais, preprint | `access-control-allow-origin: *`; 10 req/s, concorrência 3; a rota **não** aceita `select`; 404 vem em `text/plain` (cheque o status, não parseie); use `?mailto=` (o navegador não pode setar User-Agent) |
| `pub.orcid.org/v3.0/{orcid}/works` | lista da pessoa | sem token; 404 devolve JSON estruturado |
| `pub.orcid.org/v3.0/expanded-search` | "não lembro meu ORCID" | busca por nome |
| `api.datacite.org/dois/{doi}` | dataset, software, Zenodo | fallback do Crossref |
| `doi.org` + `Accept: application/vnd.citationstyles.csl+json` | rede de segurança | dispara preflight (Accept customizado) — use por último |
| `api.ror.org/organizations` | instituição canônica | traz país e coordenadas (que alimentam o `#/mapa` que já existe) |
| `openlibrary.org/api/books?bibkeys=ISBN:` | livro | cobertura irregular para livro brasileiro |

**Não construa nada em cima de:** Lattes (Busca Textual não tem CORS; WSCurriculo é SOAP com convênio), INPI (sem CORS — patente é digitação manual assumida, com número no formato + comprovante), Portal ISSN (API paga), OpenAlex (funciona hoje, mas mudou para regime de créditos em 2026 — só como enriquecimento que degrada em silêncio).
**Não tente achar a produção do INCT pelo número do processo:** `filter=award.number:...` devolve zero no Crossref; o dado não está nos metadados. O filtro por financiador (`funder:10.13039/501100003593`) funciona e serve para uma varredura **administrativa** de conferência, nunca para o fluxo do usuário.

Um módulo `metadados.ts` com: normalização de entrada, cadeia de provedores com fallback, fila de concorrência 3, timeout de 8 s, aborto da requisição anterior a cada digitação, cache em memória por DOI na sessão, e **cache no servidor** do resultado resolvido junto do item — para que gerar o relatório em 2027 não dependa de reconsultar 800 DOIs em API externa.

**4.4 Salvamento.** `status='rascunho'` no servidor (padrão já do 001), autosave com debounce de 800 ms por bloco, anunciado em `aria-live`. Nada de localStorage como fonte de verdade. Falha de rede vira estado, com retry exponencial.

**4.5 Deduplicação.** Canônica por `(ciclo, ancora_tipo, lower(ancora_valor))`; vínculo por declarante; **o segundo nunca é bloqueado**; o nome do primeiro só aparece após confirmação de coautoria; a contagem roda na canônica. Para fatos coletivos, a dedupe é estrutural (só o laboratório cria) mais o `duplicado_de` para o caso de dois laboratórios declararem a mesma expedição conjunta — nesse caso conta uma vez na rede e aparece nos dois grupos, e a tela do LLA precisa dizer isso explicitamente antes que alguém reclame do número.

**4.6 Pré-preenchimento por link.** `#/meu-ano?m=<token>` no convite: o token identifica a linha de `ciclo_membros` e traz o roster para a Tela 1 já resolvido. O token **não autentica** — é só a chave do pré-preenchimento; a sessão vem do link mágico do Supabase no mesmo clique. Não coloque dado pessoal na query string além do identificador opaco.

**4.7 Idioma.** São 22 pesquisadores estrangeiros — 10,5% da rede, e exatamente as pessoas de quem dependem o CINTER e o Indicador nº 3. `#/meu-ano` bilíngue pt-BR/en por um módulo `i18n.ts` de strings (sem biblioteca), com o idioma vindo de `ciclo_membros.idioma` e um alternador no cabeçalho. `#/meu-laboratorio` fica só em pt-BR na v1 (§9.4).

---

## 5. COMO VIRA RELATÓRIO

### 5.1 Os 5 indicadores do 1º ano

| Indicador (texto pactuado) | De onde sai | Como |
|---|---|---|
| **1.** Diagnóstico biometeorológico dos últimos 10 anos e de saúde pública, base para treinar a PINN do SIMBAM | `fatos` tipo `dado_software`, `infraestrutura` e `producoes` tipo `base_dados`/`carta_mapa`/`software_aplicativo`, dos laboratórios de EET‑1/EET‑5 | lista nominal + DOI/URL. Cobre os objetivos 1–5, que **nenhuma meta cobre** |
| **2.** Relatório anual para gestores e sociedade | `narrativas.texto_nao_especialistas` de todos + `resultado_principal` | é o próprio produto: 209 parágrafos já escritos para não especialistas. **Alguém precisa editorá-los num documento — ver §8.5** |
| **3.** 35 instituições dos 9 estados + 45 nacionais/internacionais em 13 países | `fatos` tipo `parceria` + `ciclo_membros.instituicao_ror` + `producao_autores` (coautoria interna) | `v_rede_instituicoes` e `v_rede_paises`, contagem **derivada de ROR id**. Ninguém digita "13 países" |
| **4.** Aumento dos acervos etnobotânico e etnoecológico nas Coleções Biológicas | `fatos` tipo `acervo` | soma de `registros` por coleção, com faixa de tombo e SISGEN |
| **5.** Programas de divulgação e educação junto a comunidades tradicionais e sociedade | `fatos` tipo `acao_sociedade` | tabela com as colunas literais do item 7.3: veículo · público-alvo · atividade com URL, mais município IBGE e participantes |

### 5.2 As tabelas oficiais do CNPq (que vencem aos 24 meses)

- **Tabela A — produção:** `v_producao_por_tipo` produz exatamente as linhas do formulário oficial (livros; capítulos; artigos em periódicos nacionais; internacionais; trabalhos em congressos nacionais; internacionais; trabalhos convidados; software; patentes por produto/processo; produção artística; outros). O **anexo de referências por tipo** (exigência literal do item 6.1) sai do `metadados` cacheado.
- **Tabela B — formação:** `v_formacao`, dupla (encerrados × em andamento) por nível, com as colunas do item 6.3, incluindo **`situacao_atual_egresso`** — o campo que fica impossível de reconstituir depois e que por isso se coleta já no ano 1, mesmo sendo raro.
- **Tabela C — transferência:** `fatos` de `politica_publica`, `producoes` de patente/tecnologia social/processo, com a tipificação do quadro B do item 6.2.
- **Tabela D — educação e divulgação:** `fatos` `acao_sociedade` + `producoes` de `material_didatico`/`curso_formacao`/`evento_organizado`/`produto_comunicacao`.
- **Itens 1.6, 2.3–2.5, 3.1–3.4, 4.1** (recursos de outras fontes, cooperação nacional, internacionalização, articulação com organizações públicas/sociais): todos de `fatos` tipo `parceria`, filtrados por `natureza` e por `pais_iso2`.
- **Itens 5.1/5.2 e 12.1.2.c** (alterações de objetivos/metas e justificativa de discrepância): §2.8 e `narrativas.justificativa_discrepancia`.
- **Vertentes A/B/C/D** do formulário oficial: derivadas do `tipo` do item mais a `missao` do objetivo — classificadas na origem, nunca reclassificadas à mão em 2027.

### 5.3 Progresso rumo aos marcos do 2º ano

`v_meta_execucao` soma os itens por `numero_pactuado_key` (as 92 quantidades de `est_proposta.json`, com suporte a piso aberto — "pelo menos 5 AEPLs" — e teto aberto — "até 50 expedições"). `v_meta_projecao` divide pelo mínimo pactuado e compara ao marco do 2º ano (35%/70%/100% em 14 metas; 25/50/100 em 5; 45/90/100 em 2; e as demais). **Toda exibição desse número carrega o rótulo "projeção informativa — nenhuma meta vence no 1º ano".** As metas com muitas quantidades (19 tem 9; 23 tem 8; 24 tem 7; 22 tem 6) viram grades, nunca uma pergunta só — e essas grades vivem na tela do LLA, não na do membro.

### 5.4 Linha de base

Item cuja data cai antes de 01/05/2025 é aceito e marcado `linha_de_base`. Não entra na execução do ciclo; entra na coluna "o que já existia". Sem ponto de partida não há deslocamento, e o relatório de 1º ano mede exatamente deslocamento.

### 5.5 A saída que ninguém pediu e que é a mais importante

`v_cobertura`, no topo do relatório: convidados 209 · com primeiro acesso *n* · com relato enviado *n* · com "nada a declarar" *n* · silenciosos *n*. Sem ela, um número baixo é ambíguo entre baixa produção e baixa resposta — e essa ambiguidade destrói qualquer leitura do documento.

---

## 6. ACESSIBILIDADE E LGPD

### 6.1 Acessibilidade (eMAG é obrigatório para sítio de projeto federal — Portaria SISP nº 3/2007)

Lista fechada, tudo verificável em revisão de código:

1. `<label for>` real em **todo** campo. Nada de `aria-label` improvisado, nada de placeholder no lugar de rótulo.
2. `<fieldset>` com `<legend>` em todo grupo de rádio/checkbox (papel, âmbito, público-alvo, veículos).
3. **WCAG 3.3.1/3.3.3:** erro identificado **em texto** ao lado do campo (não só por cor), ligado por `aria-describedby`, com `aria-invalid="true"`, e com sugestão de correção quando ela é conhecida (DOI, ORCID, ISBN).
4. Resumo de erros no topo da tela, com links que **movem o foco** para o campo.
5. **WCAG 1.3.5:** `autocomplete="name"`, `"email"`, `"organization"` nos campos de perfil.
6. **WCAG 2.4.7:** foco visível nunca removido no CSS. Auditar o `:focus-visible` do `styles.css` antes de subir.
7. **WCAG 4.1.3:** "Salvo automaticamente às 14:32", "item adicionado", "6 produções encontradas" em região `aria-live="polite"`, sem mover o foco.
8. **WCAG 3.3.4:** a tela de revisão antes do envio é **obrigatória**, não opcional — envio com efeito jurídico precisa permitir verificar e confirmar. A declaração de veracidade tem consequência administrativa, civil e penal para quem assina.
9. Todo o fluxo navegável só com teclado, incluindo listas de itens, botões de remover e o alternador de idioma. Ordem de tabulação lógica.
10. Alvos de toque de 44 px; contraste mínimo AA; a barra de progresso não pode ser o único indicador de estado.

### 6.2 LGPD

**A base legal não é "órgão de pesquisa".** O regime dos arts. 7º, IV e 11, II, "c" trata de dados **dos sujeitos de pesquisa**. Aqui se tratam dados administrativos de ~209 membros para prestação de contas de um termo de outorga: as bases adequadas são **cumprimento de obrigação legal/regulatória** e **execução de políticas públicas**. Isso muda o que se pede e como se justifica.

Obrigações concretas:

- **Não pedir CPF.** Não é necessário para relatar produção. Se alguma bolsa específica exigir, colete no fluxo daquela bolsa. Minimização é obrigação, não recomendação.
- **Aviso de privacidade próprio**, curto, linkado da porta e do rodapé de todas as telas, dizendo: controlador (a instituição sede), finalidade (relatório de resultados do INCT e prestação de contas ao CNPq), base legal, com quem é compartilhado (CNPq/MCTI), retenção (5 anos após a aprovação da prestação de contas, alinhado à regra de guarda de comprovantes do CNPq), e como exercer acesso/retificação/eliminação, com um e-mail que funciona.
- **Dizer o que vira público, antes de a pessoa escrever.** `texto_nao_especialistas` e `resultado_principal` podem ir para o site e para o relatório: o aviso fica **ao lado do campo**, não numa página distante. `dificuldades` **nunca** é publicado e não passa pelo LLA — e a tela diz isso.
- **Cessão de imagem** explícita e separada, obrigatória só quando há imagem, porque o REO (item 12.1.2.d) autoriza o CNPq a reutilizar o material institucionalmente.
- **Comunidades tradicionais são outro regime.** Nada de nome, foto identificável ou informação de pessoa de comunidade neste formulário. O que se pede é o **número do parecer** (CEP/CONEP, SISGEN, SISBIO, CGEN), não o dado. Aviso fixo na ficha de expedição: "Não escreva aqui nome, foto nem informação de pessoa da comunidade."
- **Rótulo do upload de imagem:** "foto do local, do material ou da atividade", com o aviso "sem rostos, a menos que você tenha termo de autorização assinado — nesse caso, anexe o termo junto". Isso não fecha a distância entre conformidade e ética, mas é o máximo que um campo de formulário faz.
- **Região do projeto Supabase.** Confirme que é São Paulo. Se estiver fora do Brasil, é transferência internacional e precisa estar declarada no aviso.
- **Log de quem preencheu por quem.** Quando a coordenação preenche em nome de alguém, `relato_eventos.por` registra, e a tela do titular exibe "Registrado por X em nome de Y".

---

## 7. O QUE FICA DE FORA DA PRIMEIRA VERSÃO

| Fora | Por quê |
|---|---|
| **Arquitetura offline-first (IndexedDB + outbox + resolução de conflito + PWA)** | É um motor de sincronização, não um formulário — de longe a maior peça de engenharia possível aqui, para algo que roda uma ou duas vezes por ano. E o Safari do iOS descarta storage de site não instalado em ~7 dias, então nem o resultado é confiável. A necessidade offline é real, mas pertence a **um** tipo de registro (expedição em campo). Se aparecer demanda medida, vira um app separado na v2. |
| **Edge Function de pré-carga semanal (varredura ORCID/Crossref no servidor)** | Deno, deploy, cron e service key são um componente de servidor que este projeto **nunca operou**, e que atrasaria a estreia — nada poderia ser enviado antes de a infra existir. Na v1 a busca no ORCID acontece **no navegador**, no momento em que a pessoa abre a Tela 2. Mesmo resultado percebido, zero infra nova. |
| **Import do XML do Lattes** | Exige sair do site, logar na Plataforma Lattes, baixar um `.zip`, voltar; descompactar no cliente; decodificar ISO‑8859‑1; e os nomes das tags precisam ser conferidos contra um arquivo real antes de escrever o parser. No celular é impraticável. Fica para a v1.1, e só se a taxa de itens manuais justificar. |
| **Delegação usuário→usuário (secretária preenche pelo sênior)** | Valiosa, mas acrescenta uma tabela e um eixo inteiro de RLS. Na v1 existe a válvula mais simples e já auditável: **a coordenação preenche em nome de**, com registro no log. Se a demanda for grande, vira `delegacoes` na v2 — e o delegado **nunca** assina a declaração de veracidade. |
| **Grade completa dos 92 números pactuados como campos** | Nenhuma meta vence no ano 1; a execução é **contada**, não digitada. A grade aparece só como leitura na tela do LLA. Quem esperar do relatório de ano 1 uma tabela de execução preenchida contra os 92 números vai encontrá-la parcialmente vazia — e precisa ser avisado **antes**, não depois. |
| **Campo `ambito` perguntado ao respondente** | Sem definição operacional comum, 209 respostas são 209 definições. Vira inferência + regra única no `config`. |
| **`lattes_atualizado_em` como campo obrigatório** | Inverificável, obriga a sair do site na primeira tela, e é o campo que mais mata conclusão. Vira **aviso** ("é do Lattes que o CNPq vai contar a produção — se ele estiver desatualizado, o relatório de 2027 fica menor do que a rede produziu"). |
| **Qualis, fator de impacto, nº de citações, citação em ABNT** | Derivados do DOI/ISSN. O CNPq recupera citações de WoS/Scopus a partir do DOI. Pedir garante divergência com o Lattes. |
| **Aposentar `scripts/relatorios-form.gs` e `relatorios-drive.gs`** — na verdade isto **entra** na v1 | Mover para `scripts/legado/` com aviso no topo (preservar o histórico, não apagar). O próprio cabeçalho do `.gs` documenta o que o condena: upload de arquivo só existe em Workspace pago, metas em constante recompilada, planilha em Drive pessoal, identidade em campo de texto livre — logo, incapaz de deduplicar e de guardar comprovante. Mantê-los vivos em paralelo garante **duas bases de verdade divergentes**. |

---

## 8. DECISÕES QUE SÃO DO ALEFF OU DA COORDENAÇÃO

Cada item abaixo está formulado como a pergunta exata a fazer. Todos são **configuração**, não código — mas todos precisam de resposta antes de o primeiro e-mail sair.

**8.1 — Quantos são os Laboratórios Associados? ✅ RESPONDIDO em 04/08/2026 — são 28**
A coordenação oficializou **28**, que é o número do Quadro Geral do PICC (28 registros de "Líder de Laboratório Associado"). O resumo da proposta, que diz 26, fica como divergência conhecida da própria proposta — é uma das 8 catalogadas em `proposta-inct-2024.json`.

Segue em aberto o **catálogo de instituições**, e aqui o projeto já tem precedente próprio: `src/content/rede.ts` publica hoje **81 catalogadas** e declara à parte `naProposta: 86`, com o comentário "a diferença é declarada na página, não escondida". O relatório deve reusar essa convenção em vez de inventar outra — publicar os dois números e explicar a diferença uma vez.

Consequência que permanece: quando o Indicador 3 for contado por baixo, a partir dos ROR efetivamente declarados, o número quase certamente virá **menor** que o publicado. Melhor explicar agora do que defender um número sem lastro numa auditoria.

**8.2 — Qual é a data de assinatura do Termo de Outorga?**
> "Precisamos da data exata. Dela derivam os marcos de 24 e 48 meses, o prazo do REO e o painel de prazos. Enquanto não vier, o campo `vigencia_inicio` fica nulo e o painel mostra placeholder."
Sabemos que o **projeto** começa em 01/05/2025 (linha 21 da proposta), mas a vigência da outorga pode não coincidir.

**8.3 — Qual é o número do processo? ✅ RESPONDIDO em 04/08/2026 — `408474/2024-6`**
A coordenação informou, e o número foi conferido: está na **linha 6 da proposta submetida**. O nome oficial completo também: **INCT-CONEXAO BIO3TOX** (linhas 22 e 24).
Os valores canônicos vivem agora em `src/content/relato/identificacao.json`, que é a fonte única — nenhum deles deve ser digitado de novo em outro lugar.

> ⚠️ **Registro de um erro desta especificação, mantido de propósito.** A versão original deste item afirmava que "o número `408549/2024-6` não aparece em lugar nenhum da proposta (conferido: zero ocorrências)". A verificação estava certa e a conclusão estava certa — mas **o número era fabricado**. Ele nunca existiu em fonte nenhuma. O número real, `408474/2024-6`, estava na linha 6 do mesmo arquivo e teria sido encontrado por uma busca pelo *padrão* `[0-9]{6}/20[0-9]{2}-[0-9]`, que é o que se deve fazer quando se procura um identificador cujo valor não se conhece.
> Fica como advertência para quem mexer aqui depois: conferir que um valor inventado não existe na fonte **parece** verificação e não é. Este é o único campo do sistema cujo erro sai de casa — vai para o agradecimento de artigo publicado, onde é permanente e onde o CNPq procura.

Continua pendente a grafia da **chamada**: a proposta escreve `MCTI/CNPq/SECTICS/MS/CAPES/FAPs Nº 46/2024` (4 ocorrências); a coordenação informou `CNPq/SECTICS/CAPES/FAPs Nº 46/2024`. O número — 46/2024 — está confirmado nos dois. A lista de órgãos precisa ser conferida contra o Termo de Outorga antes de ir para a capa do relatório. Até lá, a frase de agradecimento cita só o processo, que é o que o CNPq indexa.

**8.4 — Ciclo 1 retroativo, ou já abrir o Ciclo 2? ✅ RESPONDIDO em 04/08/2026 — só o Ciclo 1**
A coordenação decidiu abrir **apenas o primeiro ciclo de 12 meses**: período reportável de **01/05/2025 a 30/04/2026**. O Ciclo 2 não é criado agora.

Consequência que a implementação **tem de tratar**, e que não estava na versão original desta especificação: hoje é 04/08/2026, três meses depois do fim do período. Um pesquisador vai querer declarar uma expedição de junho de 2026. Se o formulário **rejeitar**, o caminho de menor esforço para ele é **adulterar a data para caber na janela** — corrompendo exatamente o dado que o CNPq vai auditar em 2027.

Regra adotada: o item é **aceito com a data verdadeira**, marcado como fora do período, **não entra em nenhuma contagem do Ciclo 1**, e a tela diz que fica guardado para o próximo relatório. Quando o Ciclo 2 for criado, uma única consulta reivindica esses itens. Nada se perde e nada é contado no lugar errado — e, sobretudo, ninguém tem incentivo para mentir na data.

**8.5 — Quem escreve o relatório, com que template e até quando?**
> "O sistema entrega um banco de dados e 209 parágrafos para não especialistas. O Indicador nº 2 pede um **documento** para gestores públicos e sociedade. Quem edita, quem revisa, e qual é o prazo?"
Nenhum software resolve isso, e não está orçado em lugar nenhum.

**8.6 — Plano do Supabase durante a coleta.**
> "O plano gratuito pausa o projeto após ~7 dias sem uso, limita o storage a 1 GB e o envio de e-mail a poucas mensagens por hora. Para 209 convites e coleta aberta o ano todo, recomendo Pro (~US$ 25/mês) durante a janela, mais SMTP próprio com SPF/DKIM do domínio. Aprova?"

**8.7 — Quem preenche o mapa `laboratório → EETs` e `laboratório → objetivos`?**
> "São 28 linhas, e só o CGES pode fazer. Sem elas, nenhum item declarado consegue ser amarrado a meta ou indicador."

**8.8 — O mapa meta→objetivo precisa ser homologado.**
> "Extraímos os 26 mapas por leitura de coordenadas do PDF, e nenhum ficou ambíguo. Mas é ele que converte 'declarei um artigo' em 'a meta 19 avançou' dentro de um documento do CNPq. Peço que o CGES **assine uma vez** a página impressa desse mapa."
Ele vive em `ciclo.config`, nunca é inferido em silêncio, e nunca muda sem nova homologação.

**8.9 — Piloto antes do disparo geral.**
> "Antes de mandar 209 e-mails, rodar com **um** laboratório de Rondônia. A métrica não é 'oito minutos de mediana' — isso é inverificável. A métrica é **taxa de conclusão** e **quantos itens a coordenação precisou corrigir à mão por respondente**."

**8.10 — Ordem dos convites.**
> "Confirma que o convite dos 28 LLAs sai **15 dias antes** do convite geral? É disso que depende a lista de fatos coletivos existir quando os membros chegarem."

---

## 9. INCERTEZAS

**9.1 — Não confirmado: data do Termo de Outorga, número do processo, e se há FAP coparticipante com calendário próprio.** A Chamada 46/2024 prevê aporte de FAPESP, FAPERJ, FAPEMIG e FAPES e permite adesão de outras; se houver FAP no arranjo do CONEXAO, pode haver um segundo calendário de relatório. Nada disso trava o código (tudo é linha de configuração), mas trava a comunicação.

**9.2 — Não confirmado: se o CNPq publicou um formulário novo de acompanhamento para a safra 2024 dos INCTs.** O modelo em que o modelo de dados se apoia é o consolidado das safras anteriores (recuperado de dois relatórios reais de INCTs). O PICC pode ter mudado a tela. O risco é baixo porque as colunas são estáveis há uma década, mas é risco.

**9.3 — Cobertura de ORCID nesta população é desconhecida.** A promessa "confirme em vez de digitar" depende de o ORCID existir, estar populado e cobrir o período. A proposta traz 190 URLs de Lattes e **zero ORCIDs** — o que sugere que boa parte da rede mantém o Lattes e não o ORCID. Se a cobertura for baixa, a Tela 2 degrada para colar DOI um a um: ainda funciona, mas a primeira impressão prometida não se cumpre. **Mitigação recomendada: convite em duas etapas** — o primeiro e-mail pede só o ORCID (30 segundos, funciona no celular), e o segundo, uma semana depois, traz a lista pronta. Custa o dobro de e-mails e é a única mitigação real que existe.

**9.4 — Todos os 28 LLAs são lusófonos?** Assumi que sim ao deixar `#/meu-laboratorio` monolíngue. Se houver LLA estrangeiro, isso precisa mudar antes do disparo.

**9.5 — A derivação `laboratório → EET → objetivo → meta` é uma inferência da máquina em nome da pessoa.** É defensável para contagem agregada e **indefensável para qualquer afirmação individual**. Se em 2027 o CNPq perguntar quais resultados empurraram a meta 19, a resposta será uma inferência que ninguém validou na origem. Foi escolha consciente: obrigar cada membro a escolher entre 43 objetivos custaria 2 a 4 minutos por respondente e uma taxa de abandono que julgo maior que o custo da reconciliação depois. Se você discordar da aposta, o ajuste é uma linha: tornar `objetivos` obrigatório no item e assumir ~11 minutos de mediana.

**9.6 — O campo de dificuldades vai vir parcialmente mentiroso mesmo com a promessa de não passar pelo LLA.** O contexto é institucional e a assimetria de poder é real. A promessa reduz o problema; não o elimina. Coletamos o campo, não a verdade.

**9.7 — As 8 inconsistências internas da proposta não têm solução técnica.** 86 / 83 / 80 instituições; 16 / 15 / 13 países; 190 / +170 / +100 pesquisadores; 26 / 28 LLAs; indicadores 2, 11 e 12 com texto idêntico; indicadores 14 e 23 idênticos; "EE-6" grafado sem o T. O formulário resolve contando por baixo, a partir do que for declarado com ROR — e isso significa que o número apurado quase certamente virá **menor** que o do resumo da proposta. Melhor explicar uma vez, agora, do que defender um número sem lastro numa auditoria.

**9.8 — O modo de falha dominante não é técnico.** É a coleta ficar em 30% de resposta. Nenhuma decisão desta especificação salva isso sozinha: três lembretes humanos da coordenação, o convite dos LLAs primeiro, e o painel de cobertura usado semanalmente valem mais do que qualquer campo que eu tenha desenhado aqui. Software não cria hábito; ele só remove desculpas.