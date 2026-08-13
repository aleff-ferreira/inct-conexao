# Relato anual — operação: limites reais do Supabase e o que a Gestão já oferece

**Apuração de 04/08/2026.** Este documento responde a duas perguntas que a especificação
(`docs/relato-anual.md`, §1.6 e §8.6) fazia com números não verificados: (1) quais são os
limites operacionais reais do Supabase em 2026, conferidos na página oficial de preços e na
documentação; (2) o que o painel `#/gestao` já oferece hoje, lido do código, e o que dele se
reusa no painel de relatos. Fecha com os riscos operacionais em ordem de gravidade.

Convenção: todo número traz fonte (URL) e data de consulta. O que não foi confirmado em
fonte oficial está marcado **NÃO CONFIRMADO** — sem estimativa no lugar.

---

## PARTE 1 — Limites do Supabase (consultados em 04/08/2026)

### 1.1 Plano gratuito (Free)

Fonte: <https://supabase.com/pricing> (consultada em 04/08/2026).

| Recurso | Limite Free |
|---|---|
| Banco de dados | **500 MB** de tamanho de banco (CPU compartilhada, 500 MB RAM) |
| Storage (arquivos) | **1 GB** |
| Egress (banda) | **5 GB** + 5 GB de egress cacheado |
| Usuários ativos mensais (MAU) | **50.000** |
| Projetos ativos | **Limite de 2 projetos ativos** por organização |
| Pausa | "Free projects are paused after 1 week of inactivity" (texto literal da página) |

Leitura para o nosso caso:

- **MAU é irrelevante** — a rede tem 209 membros; 50.000 MAU nunca serão tocados.
- **500 MB de banco é folga confortável para dados textuais** de 209 relatos + produções +
  fatos (avaliação minha, não da fonte: são linhas de texto e jsonb, ordens de grandeza
  abaixo de 500 MB).
- **1 GB de storage é o limite que pode apertar.** A especificação permite até 12 arquivos
  de até 1 MB por relato (`docs/relato-anual.md` §1.4): 209 relatos × 12 MB = **até ~2,5 GB
  no pior caso teórico**, acima do 1 GB do Free. Na prática a maioria não anexa nada, mas o
  teto do plano é atingível — ver risco R4.
- **2 projetos ativos:** o projeto da seleção de IC já ocupa 1. Se os relatos entrarem no
  mesmo projeto (como o rascunho `supabase/propostas/005_relatos.sql` assume), nada muda.
  Se a coordenação preferir um projeto separado (p.ex. para nascer em São Paulo — ver §1.6),
  o Free ainda comporta, mas fica no limite exato de 2.

### 1.2 Pausa por inatividade — o risco operacional nº 1, confirmado

Fontes: <https://supabase.com/pricing> e
<https://supabase.com/docs/guides/platform/free-project-pausing> (consultadas em 04/08/2026);
recuperação tardia: <https://supabase.com/docs/guides/troubleshooting/restore-project-after-90-days-pause>.

- **Quando pausa:** projeto Free com "low activity over a 7-day period" — ou seja, **~7 dias
  sem uso**. A página de preços fala em "paused after 1 week of inactivity". A documentação
  diz que "typically a few user requests to the database each day over the previous week is
  enough" para não pausar — poucas requisições por dia bastam.
- **NÃO volta sozinho.** A retomada é **manual**: entrar no dashboard do Supabase, abrir o
  projeto pausado, clicar **"Resume project"** e confirmar. Não há religamento automático no
  primeiro acesso. Enquanto pausado, a API recusa conexões — o pesquisador que abrir o link
  do convite recebe erro de rede.
- **Janela de restauração:** o projeto pausado pode ser restaurado pelo Studio por **até
  1 ano**. Depois disso, "Projects paused for more than 1 year can no longer be restored
  through Supabase Studio" — a recuperação vira processo manual: baixar o `.backup` e os
  arquivos do Storage, criar projeto novo e restaurar via `psql`/CLI. Nota: a URL da página
  de troubleshooting menciona "90 days", mas o texto atual da página diz 1 ano; o corte
  exato em 90 dias **NÃO CONFIRMADO** — planeje como se qualquer pausa longa fosse grave.
- **Retenção do backup do projeto pausado:** a documentação diz apenas que "backups are only
  retained for a limited period", sem número. **NÃO CONFIRMADO.**
- A documentação aponta duas saídas: gerar atividade regular ou **fazer upgrade para o
  plano Pro** — a página de preços atribui a pausa explicitamente a "free projects".

Isto confirma o desenho da especificação (§1.6): keep-alive por GitHub Action **e** Pro
durante a coleta **e** backup externo semanal. Nenhuma das três camadas é redundante.

### 1.3 Envio de e-mail — o SMTP embutido não serve para os 209 convites

Fontes: <https://supabase.com/docs/guides/auth/auth-smtp> e
<https://supabase.com/docs/guides/auth/rate-limits> (consultadas em 04/08/2026).

- **SMTP embutido: 2 e-mails por hora.** Literal da documentação de rate limits: "2 emails
  per hour with the built-in email provider. You can only change this with a custom SMTP
  setup." A documentação **não distingue plano free de pago** para esse limite — pagar o
  Pro **não** aumenta o SMTP embutido. O serviço é declarado "best-effort only", destinado
  a "exploring and getting started" e teste de templates; "we urge all customers to set up
  custom SMTP server for all other use cases".
- **Conta de padeiro:** 209 convites a 2/hora = **~4,4 dias** de disparo contínuo, num
  serviço sem garantia de entrega. Inviável — como a especificação já assumia (§1.7).
- **A saída é SMTP próprio** (Resend, AWS SES, Postmark, SendGrid — todos listados como
  compatíveis). Procedimento: configurar host/porta/usuário/senha/remetente em
  Authentication → SMTP Settings do dashboard. Ao ativar SMTP próprio, o limite de envio
  passa a ser configurável, mas **nasce em 30 mensagens/hora**: "To protect the reputation
  of your newly set up service a low rate-limit of 30 messages per hour is imposed" — e
  ajusta-se na página Rate Limits do dashboard. Teto máximo configurável: a documentação
  não especifica — **NÃO CONFIRMADO**. Mesmo a 30/h, 209 convites = ~7 h; planejar o
  disparo em lotes ou elevar o limite antes.
- **Limites correlatos que pegam o link mágico** (mesma página de rate limits): OTPs/magic
  links têm teto **padrão de 30 por hora no projeto** (customizável) e **cooldown de 60 s
  por usuário** entre reenvios (o cooldown de 60 s do botão "me mande outro link" da
  especificação vem daí). Verificação de token: 360/h com rajadas de 30 (não customizável).
- **O que isso exige do domínio:** a documentação recomenda SPF, DKIM e DMARC porque
  "significantly increase the deliverability of your messages", além de domínio de envio
  próprio separado do de marketing. Ou seja: registros DNS de `inct-conexao.com.br`
  (SPF + DKIM do provedor escolhido, política DMARC), validados **antes** do disparo, e
  teste real de entrega em `fiocruz.br`, `unir.br` e `.edu.br` — instituições federais têm
  filtros agressivos e link mágico no spam é convite perdido.

### 1.4 Plano Pro

Fonte: <https://supabase.com/pricing> (consultada em 04/08/2026).

| Recurso | Pro |
|---|---|
| Preço | **a partir de US$ 25/mês** |
| Banco | 8 GB de disco por projeto |
| Storage | 100 GB |
| Egress | 250 GB |
| MAU | 100.000 |
| Pausa por inatividade | não se aplica (a pausa é descrita como propriedade de "free projects") |
| Cobrança por excedente | sim, com **spend cap ligado por padrão** ("Spend caps are on by default on the Pro Plan"). Excedentes: US$ 0,00325/MAU, US$ 0,125/GB de disco, US$ 0,09/GB de egress |

Com o spend cap ligado, estourar um incluído não gera fatura surpresa — mas pode restringir
o serviço até o ciclo seguinte. Para a nossa escala (209 pessoas, arquivos de ≤1 MB), os
incluídos do Pro são ordens de grandeza acima do necessário. O Pro resolve simultaneamente:
a pausa (risco nº 1), o storage (1 GB → 100 GB) e destrava a operação séria de SMTP próprio
com folga. A recomendação da especificação (§8.6) — Pro durante a janela de coleta — está
confirmada como suficiente e como a menor despesa que elimina o pior risco.

### 1.5 Desconto acadêmico / sem fins lucrativos / pesquisa

**Nenhum programa institucional encontrado em fonte oficial.** A página de preços
(<https://supabase.com/pricing>, 04/08/2026) não menciona desconto para organizações sem
fins lucrativos, acadêmicas ou de pesquisa. O que existe oficialmente é voltado a
**estudantes individuais**: o Supabase integra o GitHub Student Developer Pack
(<https://education.github.com/pack>) e teve parceria educacional com a Strive School
(<https://supabase.com/blog/supabase-striveschool>, 2021, com menção a "2 years of base
tier usage" para universitários) — nada disso se aplica a um projeto institucional de um
INCT. Sites de terceiros alegam descontos de 40–80% para ONGs; **NÃO CONFIRMADO** em
qualquer página oficial do Supabase. Se a coordenação quiser tentar, o caminho é contato
comercial direto — sem contar com isso no orçamento. A despesa a orçar é o preço cheio:
US$ 25/mês durante a coleta.

### 1.6 Região: São Paulo existe; migrar depois é caro

Fontes: <https://supabase.com/docs/guides/platform/regions>,
<https://supabase.com/docs/guides/platform/migrating-within-supabase> e
<https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore>
(consultadas em 04/08/2026).

- **São Paulo está disponível:** a lista oficial de regiões inclui "South America
  (São Paulo), `sa-east-1`". Criar o projeto lá atende a LGPD (dado no Brasil, sem
  transferência internacional a declarar) e reduz latência para a Amazônia.
- **A região é escolhida na criação e não muda em place.** A documentação trata mudança de
  região como **migração de projeto**: "Project migration is primarily for changing
  regions". O procedimento é backup/restore para um projeto novo — e é manual e parcial:
  - o dump via CLI cobre roles, schema e dados;
  - **arquivos do Storage não vão junto** — exigem script Node próprio (a documentação
    fornece um);
  - senhas de roles Postgres customizadas precisam ser redefinidas à mão ("you must
    manually set their passwords in the new project");
  - chaves do Vault/colunas criptografadas: "Backup files never contain the root key" —
    a chave precisa ser copiada por API antes de desligar o projeto velho;
  - Edge Functions, Database Webhooks e publicações do Realtime exigem reativação manual.
- **Região do projeto atual do INCT: NÃO CONFIRMADO** — só o dashboard do projeto diz (a
  URL `*.supabase.co` não revela). Verificar em Settings → General antes de qualquer
  decisão. Se o projeto da seleção de IC não estiver em `sa-east-1`, há uma decisão a
  tomar **antes** de aplicar a migração 005 e semear o roster: (a) aceitar a região atual e
  declarar transferência internacional no aviso de privacidade (a especificação §6.2 já
  prevê exatamente isso); ou (b) criar o projeto dos relatos em São Paulo — pagando o custo
  de operar dois projetos (auth separado, allowlist separada) ou de migrar a plataforma de
  IC junto. Migrar **depois** de a coleta começar é o pior cenário: é o processo manual
  acima com dados de produção em movimento.

---

## PARTE 2 — O que a coordenação já consegue fazer (lido do código)

### 2.1 `src/platform/Gestao.tsx` — inventário do que existe

O arquivo tem 1.032 linhas e é o portal da comissão em `#/gestao`. O que ele oferece hoje:

**Estrutura e guarda de acesso**
- Cinco abas: `type Tab = "visao" | "inscricoes" | "classificacao" | "auditoria" | "equipe"`
  (`src/platform/Gestao.tsx:64`); as duas últimas só para admin (linhas 221–230).
- Gate de papel: `isStaff = role === "admin" || role === "avaliador"` (linha 84) e
  `isAdmin` (linha 85), lidos de `profiles.role`. Cadeia de guardas: plataforma não
  configurada (131–143) → carregando (144–152) → recuperação de senha (153–159) → sem
  sessão → `AuthCard` (160–166) → sem papel → "Acesso restrito à comissão" (167–182).
- Seletor de processo seletivo no topo (linhas 200–210): um `<select>` sobre `listEditais()`,
  pré-escolhendo o primeiro não arquivado (linha 91). É o padrão "configuração em jsonb,
  uma linha por edital" em ação na UI.

**Listagem, filtro e busca**
- Aba Inscrições (`ListaView`, linhas 356–436): busca textual por nome/protocolo/orientador
  (input na linha 380, filtro na 375) + filtro por UF (select nas linhas 381–388). Tabela
  clicável (linhas 394–431) com colunas Protocolo, Candidato(a), UF, Orientador(a), Nota
  final, Minha avaliação; Enter abre a linha (navegável por teclado, linha 410).
- Aba Visão geral (`DashboardView`, linhas 285–344): cartões de indicadores — Inscrições,
  Vagas, % de candidatas, Avaliadas, Pareceres enviados (linhas 303–309) — e tabela
  "Inscrições por estado × vagas" (310–341). O componente de cartão é o `Stat`
  (linhas 346–353), trivialmente reutilizável.

**Avaliação individual**
- `AvaliacaoView` (linhas 439–600): ficha do candidato, documentos abertos por URL assinada
  temporária (`signedUrl`, chamada nas linhas 531–535 — nada é público), notas por critério
  vindas do `edital.config` (554–568), parecer, salvar rascunho/enviar (467–488).

**Exportação**
- **CSV, gerado no cliente, sem backend.** Na aba Classificação (`RankingView`), o botão
  "Exportar CSV (ata)" (`exportCsv`, linhas 625–646): monta linhas com colunas `estado,
  posicao, protocolo, nome, sexo, orientador, nota_final, dentro_das_vagas, ajuste_genero,
  status`, serializa com `toCsv` (separador `;`, escaping de aspas — `src/platform/api.ts:253–261`),
  prefixa BOM `﻿` (para o Excel em português abrir com acentos), e baixa via
  `Blob` + `URL.createObjectURL` + clique programático, nome `classificacao-<slug>.csv`.
  **Não há XLSX em lugar nenhum** — só CSV e JSON.
- Na aba Auditoria, o botão "Baixar auditoria" (linhas 767–769) baixa **dois arquivos** de
  uma vez via `downloadAuditFiles` (ver §2.2): CSV interno identificado + JSON
  pseudonimizado, com aviso LGPD em tela (linhas 771–777).

**Visão agregada**
- Os `Stat`s do dashboard e a tabela estado × vagas são a única agregação visual. **As
  células não são clicáveis** — não há drill-down de número para lista de itens (que a
  especificação dos relatos exige no painel "Números").

**Gestão de equipe**
- `EquipeView` (linhas 826–991), só admin: colar e-mails num textarea (880–886), escolher
  papel (888–896) e pré-autorizar via `addToAllowlist` (chamada na 849) — quem está na
  allowlist cria a própria conta já com o papel certo, e quem já tinha conta é promovido na
  hora. Lista da allowlist com remoção (902–924); tabela de perfis com busca (933–935) e
  troca de papel por select (960–979), com a trava "ninguém altera o próprio papel"
  (957–959).

**Homologação com trava de integridade**
- `onHomologar` (linhas 265–277) marca aprovadas/lista de espera e muda o status do edital;
  o botão fica desabilitado enquanto houver inscrição válida sem nota (guarda nas linhas
  648–653, aviso em 676–681) — o padrão "estado terminal só quando tudo está decidido".

**O que se reusa tal e qual no painel de relatos**
- O `Shell` (linhas 994–1031) — com uma ressalva: o `<h1>` "Avaliação de inscrições" está
  fixo (linha 1010); precisa parametrizar título/eyebrow para a aba de relatos.
- A cadeia de guardas (131–182), `AuthCard`/`PasswordCard`, o componente `Stat`, as classes
  CSS `edital-table*`/`plat-*`, o padrão busca+filtro da `ListaView`, a mecânica de export
  CSV no cliente (BOM + Blob), o `signedUrl` para comprovantes, e o padrão do seletor de
  edital (que vira seletor de ciclo).
- O padrão da `EquipeView` (colar lista → upsert em lote → promover existentes) é o molde
  do import do roster de 209 membros para `ciclo_membros`.

**O que teria de ser novo**
- **O gate.** A linha 84 é exatamente a armadilha já identificada: `isStaff` inclui
  `avaliador`, e os avaliadores da seleção de IC **não** podem ler relatos da rede. A aba
  "Relatos" precisa de guarda própria via papel no ciclo (`is_coordenacao()`), não via
  `profiles.role`.
- Painel de **cobertura** (convidados/entraram/enviaram/nada a declarar/silenciosos, por
  laboratório e UF, com reenvio de convite) — não existe nada análogo.
- Painel de **pendências** roteado por comitê — não existe fila de trabalho no código atual.
- **Números com drill-down** (célula → lista de itens) — o dashboard atual não faz.
- Export **JSON integral do ciclo** e **CSV por tabela oficial do CNPq** (A/B/C/D etc., com
  cabeçalhos literais e múltiplos arquivos) — o export atual é um CSV único de ranking.

### 2.2 `src/platform/audit.ts` — o padrão de auditoria e como herdá-lo

O módulo (437 linhas) tem um desenho explícito, documentado no cabeçalho
(`src/platform/audit.ts:4–18`):

1. **Funções puras, sem Supabase.** Todo o cálculo (`buildRows` 114–236, estatísticas por
   avaliador 238–259, `summarize` 261–273, `buildAudit` 346–423) recebe arrays já
   carregados e devolve estruturas — nada de rede. Por isso é testável no vitest sem mock.
   O único efeito colateral é isolado no fim: `downloadAuditFiles` (426–436) dispara os
   downloads no browser.
2. **A matéria-prima é um log append-only.** Os `EvaluationEvent`s vêm da tabela
   `evaluation_events` (migração 004), gravada por trigger `SECURITY DEFINER` e legível só
   por admin (`listEvaluationEvents`, `src/platform/api.ts:239–250`). É isso que permite
   sinais como "editada após outra submissão" (linhas 176–183) sem confiar no cliente.
3. **Dois artefatos com regimes de privacidade distintos:** CSV interno **identificado**
   (ata da comissão, com nome/CPF — linhas 294–321) e JSON **pseudonimizado** para análise
   por IA (aliases estáveis `C001`/`AV01`, linhas 357–360; nomes removidos do texto livre
   por `scrubNames`, 277–285). O envelope do JSON embute o próprio aviso de privacidade
   (403–404), o glossário das métricas (`GLOSSARIO`, 323–336) e o roteiro de investigação
   (`PROMPT`, 338–343) — o arquivo é autoexplicativo.
4. **Honestidade estatística como regra de código:** métricas indefinidas saem como `null`
   explícito (nunca `NaN`) quando há menos de 3 avaliações (156–166), e os sinais são
   "pistas para revisão humana", não acusações.
5. **CSV canônico importado, não duplicado:** a linha 1 importa `csvEscape`/`toCsv` de
   `src/figuras/csv.ts`, e o comentário das linhas 287–292 explica por quê — havia duas
   implementações, a sem teste diverge, então a versão coberta por `tests/figuras.test.ts`
   virou a canônica (separador `;` e BOM mantidos por causa do Excel em português).

**Como o módulo de relatos herda isso:** a especificação já prevê `relato_eventos` como
cópia do padrão 004 (trigger `SECURITY DEFINER`, leitura só coordenação). Em cima dele, um
`src/relato/` análogo: função pura que recebe (`relatos`, `producoes`, `fatos`, eventos) e
devolve as views de cobertura/números + os artefatos de export, com o download isolado numa
função final. Importar `toCsv` de `src/figuras/csv.ts` (a canônica testada), **não** a
cópia de `api.ts`. O padrão dos dois regimes (interno identificado × publicável
pseudonimizado) transfere-se direto para o export dos relatos, onde `dificuldades` nunca
pode vazar para o artefato compartilhável.

### 2.3 `src/platform/api.ts` — o padrão de chamada que o módulo novo deve seguir

O arquivo declara a doutrina na linha 15: *"Camada de dados da plataforma. Toda a
autorização real está nas políticas RLS."* O cliente não decide permissão — só reflete o
que o banco deixa passar.

O padrão, função por função:

- **Forma canônica** (ex.: `fetchEdital`, linhas 18–22):
  `const { data, error } = await supabase().from(...).select(...); if (error) throw new
  Error(error.message); return (data as T) ?? fallback;`. **Sem retry, sem wrapper de
  resultado, sem logging** — erro vira `throw` com a mensagem crua do PostgREST.
- **Tratamento de erro em duas camadas:** a camada de dados lança; quem exibe decide. Na
  UI pública, a mensagem crua passa por `friendlyError()`
  (`src/platform/errors.ts:7–39`), que traduz por casamento de substring os casos
  conhecidos (duplicate key, not-null do protocolo, janela do edital, falha de rede, cache
  de schema do PostgREST, payload too large) para PT-BR acionável — o cabeçalho do arquivo
  proíbe renderizar `error.message` direto. Na Gestão (interna), há degradação graciosa
  pontual: `listProfiles().catch(() => setProfiles([]))` quando o RLS nega
  (`src/platform/Gestao.tsx:104–107`), e `try/catch` com `setMsg` nos fluxos de escrita.
- **Tipagem por cast:** os retornos são `data as Tipo` contra os tipos manuais de
  `src/platform/types.ts` — não há geração de tipos do schema. `maybeSingle()` para
  0-ou-1 linha (linhas 19, 41).
- **Escritas idempotentes por `upsert` com `onConflict`:** avaliação por
  `application_id,evaluator_id` (linhas 147–166), arquivo por `application_id,kind`
  (96–103), allowlist por `email` (216). É o que torna o autosave seguro contra repetição.
- **Joins com filtro por relação:** `select("*, applications!inner(edital_id)")` +
  `.eq("applications.edital_id", ...)` para filtrar por edital através da FK, descartando
  o objeto aninhado usado só no filtro (`listEvaluationEvents`, 239–250).
- **Números de série nunca no cliente:** o protocolo é gerado por trigger `BEFORE INSERT`
  com contador atômico (comentário nas linhas 67–69, migração 003) — o comentário registra
  a corrida de `count(*)+1` que motivou isso. O módulo de relatos repete a mecânica
  (`CNX-R1-0001`).
- **Semântica preservada em update:** editar inscrição não altera `submitted_at`
  (comentário 55–57) porque o desempate usa a data da primeira submissão — o análogo nos
  relatos é o reenvio não regravar `submitted_at` original sem decisão explícita.
- **Storage:** validação client-side de tipo/tamanho antes do upload (87–89), caminho
  `${userId}/${editalSlug}/${kind}.pdf` casando com a política RLS por prefixo de pasta
  (92–93), `upsert: true`, e leitura só por `createSignedUrl` com expiração de 3600 s
  (118–122).
- **Cliente gated e singleton:** `supabase()` só existe se `VITE_SUPABASE_URL` e
  `VITE_SUPABASE_ANON_KEY` estiverem no build (`src/platform/supabaseClient.ts:16–27`);
  `platformEnabled` (linha 19) é o interruptor que mantém o site 100% estático sem as
  variáveis. Auth com `flowType: "pkce"` para o retorno do link mágico vir em `?code=` sem
  conflitar com o roteamento por hash (comentário 34–37) — **não mexer**.
- **Uma duplicação a não propagar:** `api.ts` mantém um `toCsv` próprio (253–261) enquanto
  a versão canônica e testada vive em `src/figuras/csv.ts` (ver §2.2). O `src/relato/api.ts`
  novo deve importar a canônica e não criar uma terceira.

O `src/relato/api.ts` previsto na especificação deve ser uma cópia deste estilo: funções
finas por tabela, erro lançado, `friendlyError` (ou um irmão com os casos novos — âncora
duplicada, janela de envio, fora do período) na borda da UI, upsert idempotente para o
autosave, e RPC (`checar_ancora`) onde a RLS precisa esconder colunas.

---

## RISCOS OPERACIONAIS — em ordem de gravidade

**R1 — Pausa por inatividade no plano Free (derruba a coleta inteira).**
Projeto Free pausa após ~7 dias de baixa atividade e **só volta com clique manual no
dashboard** (§1.2). Numa coleta aberta o ano todo, com semanas mortas garantidas, o membro
que abrir o link durante uma pausa recebe erro — e o sênior que desiste não volta.
*Mitigação (as três camadas da especificação §1.6, todas):* (a) assinar **Pro
(US$ 25/mês)** durante a janela de coleta — elimina a pausa na raiz; (b) keep-alive por
GitHub Action a cada 8 h contra `relatorio_ciclos` — cinto de segurança para quando voltar
ao Free, com abertura de issue em falha; (c) tratar falha de rede no `#/meu-ano` como
estado com retry, não como tela de erro.

**R2 — E-mail: o convite não chega (a coleta não começa).**
SMTP embutido = **2 e-mails/hora**, best-effort, igual em qualquer plano (§1.3): 209
convites levariam ~4,4 dias e chegariam mal. Mesmo com SMTP próprio, o limite nasce em
**30/h** e os magic links têm teto padrão de 30 OTPs/h no projeto.
*Mitigação:* SMTP dedicado (Resend/SES/SendGrid) configurado no dashboard; **SPF + DKIM
(+ DMARC) de `inct-conexao.com.br` validados antes do disparo**; elevar os limites de
e-mail e OTP na página Rate Limits; disparo em lotes com teste prévio de entrega em
`fiocruz.br`, `unir.br` e `.edu.br`. Pré-requisito humano: a lista dos 209 e-mails não
existe na proposta e precisa ser montada pela coordenação primeiro.

**R3 — Região errada = passivo LGPD + migração dolorosa depois.**
`sa-east-1` (São Paulo) existe, mas região não se troca em place: mudar = projeto novo +
backup/restore manual em que Storage, senhas de roles, chaves do Vault e funções não vão
sozinhos (§1.6). A região do projeto atual do INCT está **NÃO CONFIRMADA**.
*Mitigação:* verificar a região no dashboard **antes** de aplicar a migração 005. Se não
for São Paulo, decidir agora entre declarar transferência internacional no aviso de
privacidade (caminho de menor atrito, já previsto na especificação §6.2) ou criar o
projeto de relatos em `sa-east-1` — nunca migrar com a coleta em andamento.

**R4 — Storage do Free (1 GB) pode ser atingido pelos uploads.**
Teto teórico de ~2,5 GB (209 relatos × 12 arquivos × 1 MB) contra 1 GB do Free (§1.1).
*Mitigação:* Pro (100 GB) durante a coleta resolve por completo; manter a compressão
client-side (1600 px, JPEG q0.8) e os tetos por item/relato da especificação; monitorar o
uso no dashboard ao cruzar 50%.

**R5 — Pausa longa ou acidente sem backup externo = perder o ciclo.**
Projeto pausado >1 ano não restaura mais pelo Studio; retenção de backup pós-pausa não é
especificada; delete é irrecuperável (§1.2).
*Mitigação:* a Action semanal de backup (JSON de cada tabela do 005 num repositório
**privado**, retenção de 12 semanas) prevista na especificação §1.6 — é a única cópia fora
do Supabase e deve entrar em produção junto com a migração, não depois.

**R6 — Custo/limites do Pro mal geridos.**
O spend cap vem ligado por padrão: sem fatura surpresa, mas estourar um incluído pode
restringir serviço no meio da coleta (§1.4). Improvável nesta escala, porém possível se
alguém subir arquivos fora do fluxo.
*Mitigação:* manter spend cap ligado, conferir a página de uso mensalmente durante a
coleta, e não desligar o Pro antes de fechar a janela de envio.

**R7 — Limite de 2 projetos ativos no Free.**
Com a plataforma de IC ocupando 1 projeto, criar um segundo para os relatos esgota a cota
(§1.1). Não bloqueia o desenho atual (que usa o mesmo projeto), mas elimina folga para
experimentos.
*Mitigação:* preferir o projeto único, como o rascunho 005 assume; qualquer projeto de
teste/staging deve ser pausado ou pago.

**R8 — Descontos que não existem entrando no orçamento.**
Nenhum desconto institucional acadêmico/sem fins lucrativos confirmado em fonte oficial
(§1.5); alegações de terceiros não se sustentam.
*Mitigação:* orçar preço cheio (US$ 25/mês × meses de coleta); se quiser tentar desconto,
contato comercial com o Supabase em paralelo, sem depender disso.
