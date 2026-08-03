# Plataforma de Seleções — guia de ativação e operação

O site tem uma plataforma completa de processos seletivos (inscrição on-line +
portal da comissão), construída sobre o [Supabase](https://supabase.com)
(Postgres + Auth + Storage, plano gratuito). **Sem configuração, o site segue
100% estático** — as rotas mostram "sistema em preparação". Este guia ativa a
plataforma em ~10 minutos.

## As rotas

| Rota | Quem usa | Login | O quê |
|---|---|---|---|
| `#/inscricao/selecao-ic-2026` | Candidatos | Link mágico (sem senha) | Wizard de inscrição (4 PDFs, vídeo, LGPD, protocolo) |
| `#/minha-inscricao` | Candidatos | Link mágico | Acompanhar/editar a inscrição até o fim do prazo |
| `#/gestao` | Comissão | **E-mail + senha** | Dashboard, avaliação, classificação, CSV, homologação e gestão da equipe |

## Ativação (faça uma única vez)

### 1. Criar o projeto Supabase (~4 min)
1. Acesse **https://supabase.com** → *Start your project* → crie a conta com
   `labioprot.toxin@gmail.com` (ou entre com GitHub `aleff-ferreira`).
2. *New project* → nome `inct-conexao` → região **South America (São Paulo)** →
   defina uma senha forte do banco (guarde-a) → *Create*.

### 2. Rodar as migrações (~3 min)
1. No painel do projeto: **SQL Editor** → *New query*.
2. Cole o conteúdo INTEIRO de [`supabase/migrations/001_platform.sql`](../supabase/migrations/001_platform.sql) → **Run**.
3. Deve terminar sem erros. Isso cria as tabelas, políticas RLS, o bucket
   privado `inscricoes` e já **semeia o edital 04/2026** (com a janela
   06–19/jul e os orientadores por estado, conforme a versão final do edital).
4. Rode também [`002_staff_allowlist.sql`](../supabase/migrations/002_staff_allowlist.sql)
   (allowlist da comissão), [`003_protocolo_atomico.sql`](../supabase/migrations/003_protocolo_atomico.sql)
   (**obrigatório antes da abertura** — gera o protocolo de forma atômica no
   servidor; sem ele, submissões simultâneas no pico podem duplicar o protocolo
   e a segunda inscrição falha) e [`004_evaluation_audit_log.sql`](../supabase/migrations/004_evaluation_audit_log.sql)
   (log append-only das avaliações, para a auditoria de justiça — pode ser rodado
   antes da fase de avaliação). Rode 001 → 002 → 003 → 004, nessa ordem,
   **cada arquivo inteiro de uma vez**.

> **Se você já rodou uma versão anterior da 004 (escopo por estado, `evaluator_states`),**
> reverta antes com: `drop table if exists public.evaluator_states cascade;
> drop function if exists public.can_eval_app(uuid);` e recrie as políticas
> `eval_insert`/`eval_update` do 001. O modelo agora é **aberto** (todo avaliador
> pontua qualquer inscrição) — a integridade é verificada pela auditoria, não por restrição.

### Auditoria de justiça das avaliações (#/gestao → Auditoria)
A avaliação é **aberta**: qualquer avaliador pontua qualquer inscrição (avaliadores
são escassos). A integridade é verificada **depois**, na aba **Auditoria** (só admin),
que baixa dois arquivos gerados no navegador:
- **`auditoria-interna-<slug>.csv`** — identificado (nome, CPF, pareceres). É a ata
  da comissão: **dado pessoal, não compartilhe**.
- **`auditoria-analise-<slug>.json`** — **pseudonimizado** (candidatos = C001…, avaliadores
  = AV01…; sem CPF/nome/e-mail; nomes removidos dos pareceres), com um **roteiro de
  investigação embutido**. É o arquivo de análise: o administrador pode examiná-lo
  como preferir — inclusive colando numa ferramenta de IA de sua confiança (a UI não
  menciona IA; o uso é decisão da coordenação). Atenção: pseudonimização **não é
  anonimização** — em estados de 1 vaga pode reidentificar; trate como dado pessoal.

O log `evaluation_events` (migração 004) garante que a auditoria enxergue o
**histórico** de cada nota (edições, mudança após outra avaliação) — não só o valor
atual. Os sinais (conflito de interesse, outlier, decisão por avaliador único, nota
extrema sem parecer) são **pistas para revisão humana**, nunca acusação; com poucos
avaliadores, muitas inscrições têm só uma nota — a ausência de sinal **não é prova de justiça**.

### 3. Configurar a autenticação (~2 min) — LOGIN POR SENHA (sem link mágico)
Candidatos **e** comissão entram com **e-mail + senha** (a conta é criada em
“Primeiro acesso? Criar conta”). Nada precisa ser entregue ou clicado no e-mail
para entrar — então o login **não depende de SMTP** nem sofre com scanners de
e-mail institucional (que “clicam” e queimam links mágicos de uso único).
1. **Authentication → Sign In / Providers → Email**:
   - deixe **Email** habilitado;
   - **DESLIGUE “Confirm email”** (Confirmar e-mail). Assim o cadastro cria a
     sessão na hora, sem e-mail de confirmação. Os papéis são controlados pela
     allowlist (migração 002), então isto é seguro.
2. **Authentication → URL Configuration**:
   - *Site URL*: `https://inct-conexao.com.br`
   - *Redirect URLs*: `https://inct-conexao.com.br/**` e, para testes locais,
     `http://localhost:5173/**` e `http://localhost:4173/**`.
3. **SMTP é OPCIONAL agora.** Só é usado por **“Esqueci a senha”** (redefinição,
   caso raro). Se quiser habilitar o reset por e-mail, configure um provedor em
   **Authentication → Emails → SMTP** (Brevo/Resend) com o domínio verificado
   **e DESLIGUE o rastreamento de cliques** do provedor — senão scanners de
   e-mail queimam o link de redefinição (mesmo problema do link mágico).

### 4. Conectar o site (~2 min)
1. No painel: **Settings → API** → copie a *Project URL* e a *anon public key*.
2. No repositório, crie `.env` (há um `.env.example` de modelo):
   ```
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
3. `npm run build` e publique o `dist/` no Hostinger (fluxo normal).
   A anon key é pública por design — a segurança vem das políticas RLS.

### 5. Promover o administrador (~1 min)
1. Abra `https://inct-conexao.com.br/#/gestao` → “Primeiro acesso? Criar conta”
   com o SEU e-mail + senha. Se o e-mail estiver na allowlist (migração 002),
   seu perfil já nasce como `admin`; fora dela, nasce `candidato`.
2. No **SQL Editor**, rode:
   ```sql
   update public.profiles set role = 'admin' where email = 'labioprot.toxin@gmail.com';
   ```
3. Recarregue o `#/gestao` — o portal completo aparece.

### 6. Política de senhas (~1 min, uma vez)
**Authentication → Passwords** (ou *Sign In / Up → Passwords*): defina o
mínimo de **10 caracteres** e ligue a **proteção contra senhas vazadas**
(leaked-password protection). O site já valida 10+ no formulário.

### Definir a SUA senha (primeiro acesso do admin)
Sua conta foi criada via link mágico; para passar a entrar com senha:
`#/gestao` → **"Esqueci a senha"** → informe seu e-mail → abra o link
(no MESMO navegador) → defina a senha. Pronto: dali em diante o login da
gestão é e-mail + senha (sem depender de e-mail para entrar).

### Adicionar avaliadores (sem SQL!)
1. No painel do Supabase: **Authentication → Users → Add user →
   Create new user** — e-mail do(a) avaliador(a) + uma senha temporária
   forte; marque **Auto Confirm User**.
2. Envie a senha temporária por um canal seguro (WhatsApp etc.).
3. No site, `#/gestao` → aba **Equipe** → mude o papel da pessoa para
   **Avaliador(a)** (ou Administrador(a)).
4. A pessoa entra com e-mail + senha temporária e clica **"Trocar senha"**
   no topo do painel.

Observação: ninguém consegue alterar o próprio papel na aba Equipe (nem
mesmo o admin) — isso evita perda de acesso acidental; o papel dos outros
só é editável por administradores (política RLS no banco).

## Operação

- **Dashboard**: totais, inscrições por estado × vagas, % de candidatas, progresso da avaliação.
- **Avaliar**: *Inscrições* → clique na linha → PDFs abrem por URL assinada
  (15 min) → notas por critério (0–60/0–20/0–10/0–10) com total e bônus
  "Ciência Delas" (+10%) calculados ao vivo → *Enviar avaliação* (ou salvar rascunho).
  Com múltiplos avaliadores por inscrição, a nota final é a **média** dos pareceres enviados.
- **Classificação**: ranking por estado com corte pelas vagas; a regra de
  **≥50% de mulheres** promove candidatas abaixo do corte quando necessário e
  marca o ajuste com ♀ (a comissão referenda). *Exportar CSV* gera a planilha da ata.
- **Homologar** (só admin): marca aprovadas/lista de espera e trava o edital.
  O candidato vê o novo status em `#/minha-inscricao`.

## Próximas seleções (sem programar nada)

Lançar um novo edital = inserir uma linha em `editais` (SQL Editor), copiando o
JSON de `config` do 04/2026 e ajustando critérios/estados/vagas/datas. A rota
`#/inscricao/<novo-slug>` passa a funcionar imediatamente.

## Disciplina operacional do plano gratuito (importante)

O plano gratuito do Supabase tem três regras que importam para um uso sazonal
(~2 seleções/ano). Nenhuma é grave — desde que viren rotina:

1. **Pausa por inatividade**: projetos gratuitos pausam após ~7 dias sem
   atividade no banco e, se ficarem pausados por mais de 90 dias, podem ser
   **excluídos**. Rotina: enquanto houver dados que precisam ficar on-line,
   mantenha um ping semanal (um `SELECT` via GitHub Actions cron, gratuito —
   ou simplesmente abra o painel 1×/semana). **Restaure/verifique o projeto
   pelo menos 1 semana ANTES de abrir a próxima seleção**, nunca no dia.
2. **Sem backups no plano gratuito**: após o fim de cada seleção, exporte e
   guarde localmente: Dashboard → Database → *Backups/Export* (ou `pg_dump`)
   + download da pasta do bucket `inscricoes`. Durante a janela, exporte o
   CSV da classificação a cada sessão de avaliação.
3. **Tetos de armazenamento/tráfego**: 1 GB de arquivos e 5 GB de egress/mês.
   Os limites por PDF (carta/plano/Lattes 1 MB; histórico 2 MB) mantêm o pior
   caso dentro do teto. Acompanhe em **Settings → Usage**; se a seleção
   crescer ou a comissão baixar os PDFs muitas vezes, ative o **Pro
   (US$ 25/mês) apenas nos meses da seleção** — ganha 100 GB de arquivos,
   250 GB de egress e backups diários.

## Segurança e LGPD

- RLS: candidato só vê a própria inscrição; avaliadores/admin veem tudo;
  ninguém anônimo lê nada. PDFs em bucket **privado** (2 MB, só PDF), lidos por
  URL assinada temporária.
- O wizard exige o aceite LGPD com finalidade específica. Para atender a um
  pedido de exclusão: delete a linha de `applications` (os arquivos e
  avaliações caem em cascata) e os objetos da pasta do usuário no bucket.
- **Backups: o plano gratuito NÃO tem backup automático** — siga a rotina de
  exportação da seção "Disciplina operacional" acima (Pro tem backup diário).
- LGPD: crie o projeto na região **São Paulo (sa-east-1)** — os dados ficam
  fisicamente no Brasil; aceite o DPA padrão do Supabase (Settings → Legal) e
  mencione no aviso de privacidade do edital a residência dos dados em São
  Paulo e o uso de operador internacional com salvaguardas (LGPD, art. 33).
