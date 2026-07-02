# Plataforma de Seleções — guia de ativação e operação

O site tem uma plataforma completa de processos seletivos (inscrição on-line +
portal da comissão), construída sobre o [Supabase](https://supabase.com)
(Postgres + Auth + Storage, plano gratuito). **Sem configuração, o site segue
100% estático** — as rotas mostram "sistema em preparação". Este guia ativa a
plataforma em ~10 minutos.

## As rotas

| Rota | Quem usa | O quê |
|---|---|---|
| `#/inscricao/selecao-ic-2026` | Candidatos | Wizard de inscrição (login por link mágico, 4 PDFs, vídeo, LGPD, protocolo) |
| `#/minha-inscricao` | Candidatos | Acompanhar/editar a inscrição até o fim do prazo |
| `#/gestao` | Comissão | Dashboard, avaliação (notas 60/20/10/10 + bônus), classificação, CSV, homologação |

## Ativação (faça uma única vez)

### 1. Criar o projeto Supabase (~4 min)
1. Acesse **https://supabase.com** → *Start your project* → crie a conta com
   `labioprot.toxin@gmail.com` (ou entre com GitHub `aleff-ferreira`).
2. *New project* → nome `inct-conexao` → região **South America (São Paulo)** →
   defina uma senha forte do banco (guarde-a) → *Create*.

### 2. Rodar a migração (~2 min)
1. No painel do projeto: **SQL Editor** → *New query*.
2. Cole o conteúdo INTEIRO de [`supabase/migrations/001_platform.sql`](../supabase/migrations/001_platform.sql) → **Run**.
3. Deve terminar sem erros. Isso cria as tabelas, políticas RLS, o bucket
   privado `inscricoes` e já **semeia o edital 04/2026** (com a janela
   06–19/jul e os orientadores por estado, conforme a versão final do edital).

### 3. Configurar a autenticação (~2 min) + SMTP (OBRIGATÓRIO, ~1 h)
1. **Authentication → URL Configuration**:
   - *Site URL*: `https://inct-conexao.com.br`
   - *Redirect URLs*: adicione `https://inct-conexao.com.br/**` e, para testes,
     `http://localhost:4173/**`
2. **Authentication → Sign In / Up → Email**: deixe habilitado (padrão). O login
   é por **link mágico** (sem senha).
3. ⚠️ **SMTP próprio é OBRIGATÓRIO antes de abrir as inscrições.** O e-mail
   embutido do Supabase entrega **somente para os endereços da própria equipe
   do projeto** (e a 2 msgs/hora) — candidatos reais **não receberiam o link
   de login**. Configure um provedor gratuito em
   **Authentication → Emails → SMTP Settings**:
   - [Resend](https://resend.com) (3.000 e-mails/mês grátis) ou
     [Brevo](https://brevo.com) (300/dia grátis);
   - verifique o domínio `inct-conexao.com.br` no provedor (registros
     DKIM/SPF no hPanel → DNS);
   - em **Authentication → Rate Limits**, suba o limite de e-mails de
     autenticação (padrão 30/hora) para ≥120/hora, pensando no pico do
     último dia de inscrições;
   - **teste de aceitação**: envie um link mágico para um e-mail de FORA da
     equipe e confirme que chega (fora do spam).

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
1. Abra `https://inct-conexao.com.br/#/gestao`, entre com o SEU e-mail
   (você receberá o link mágico). No primeiro acesso, seu perfil nasce como
   `candidato`.
2. No **SQL Editor**, rode:
   ```sql
   update public.profiles set role = 'admin' where email = 'labioprot.toxin@gmail.com';
   ```
3. Recarregue o `#/gestao` — o portal completo aparece.

### Adicionar avaliadores (quando quiser)
Peça para cada avaliador(a) entrar UMA vez em `#/gestao` (cria o perfil) e rode:
```sql
update public.profiles set role = 'avaliador' where email = 'email@instituicao.br';
```

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
