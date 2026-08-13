# O que aplicar no Supabase — 10/08/2026

Roteiro na ordem exata. Tudo aqui é **idempotente**: rodar de novo algo que já
foi aplicado não duplica nem quebra nada — na dúvida sobre um passo, rode-o.
Cada arquivo se cola inteiro no **SQL Editor** (Dashboard → SQL Editor → New query).

**A regra que não pode inverter:** o banco muda ANTES de o site novo subir.
A Tela 1 do relato grava as colunas da 009/010 na primeira abertura; publicar
o `dist` novo com o banco velho derruba o autosave de todo mundo que abrir o
formulário ("Não conseguimos salvar agora", para os 209).

## 1. Migrações do Relatório Anual (SQL Editor, nesta ordem)

| # | Arquivo | O que faz | Como conferir |
|---|---------|-----------|---------------|
| 1 | `migrations/006_identificacao.sql` | A porta de identificação: RPCs `reivindicar_cadastro` / `vincular_meu_cadastro` (o pesquisador acha o próprio nome e vincula o e-mail) | O bloco final da migração lista as funções criadas |
| 2 | `migrations/007_laboratorio_editavel.sql` | O membro pode corrigir o próprio laboratório (com log em `relato_eventos`) | — |
| 3 | `migrations/008_sigla_opcional.sql` | `laboratorios.sigla` deixa de ser obrigatória (pré-requisito da seed 003) | — |
| 4 | `migrations/009_gforms.sql` | As colunas do Forms do CTC: `ppg`, `indice_h`, `total_citacoes`, `satisfacao`, `dgp_nome/url`, `jcr`, `qualis`, `relatos.respostas` | O SELECT de sanidade no fim devolve **9 linhas, todas `existe = true`** |
| 5 | `migrations/010_indicadores.sql` | Indicadores automáticos: `scholar_id`, `indicadores_fonte`, `indicadores_atualizado_em` + tabela `indicadores_cache` | O SELECT de sanidade devolve **5/5 `true`** |
| 5b | `migrations/011_anexo_docx.sql` | Anexo `.docx` (documento com dados da pesquisa): CHECKs de mime/bytes (docx até 10 MB; demais seguem 1 MB), bucket `relatos` com teto 10 MB, `anexos.max_bytes_docx` no config e a policy de leitura da coordenação reafirmada | O SELECT de sanidade devolve **6 linhas, todas `ok = true`** |
| 5c | `migrations/012_superadmin.sql` | Papel **SuperAdministrador**: a gerência de contas (pré-autorização + papéis) sai do admin comum e vira exclusiva dos 5 superadmins (labioprot.toxin, alefffx, andreimarsoares, akayano, mateus.sousa@fiocruz.br), no painel **Administração de Contas** (`#/gestao?area=contas`). `is_admin()` passa a incluir superadmin — herda toda edição do site. Trava: o último superadmin não pode ser rebaixado | O SELECT de sanidade devolve **5 linhas, todas `ok = true`** |
| 5c | `migrations/012_lla_vinculo.sql` | Vínculo automático do líder: trigger que preenche `laboratorios.lla_user_id` no instante em que o líder se identifica (exige papel `lla` + laboratório da proposta + grafia do nome conferindo; nunca sobrescreve valor não-nulo; trocar de laboratório ou renomear depois não redispara) + normalização dos 2 acentos que o roster perdeu (LabLat/Estevão, DCDIA/Mariúba — seção 1b) + backfill de quem já entrou. É ela que faz o líder ver o Formulário do LLA | Sanidade no fim: **28 de 28** formais com grafia casada e a lista de divergências **VAZIA** (a seção 1b normaliza as 2 conhecidas). Qualquer linha na lista é novidade — investigue antes de seguir |
| 5d | `migrations/013_identidade.sql` | Identidade por e-mail pré-autorizado (o incidente de 11/08: o coordenador barrado no próprio painel): (1) a linha do **coordenador** (andreimarsoares@gmail.com, papel `coordenacao`) entra no roster do ciclo 1, com `user_id` casado na hora se a conta já existir; (2) `reivindicar_cadastro` passa a **recusar** linha de gestão (`coordenacao`/`cges`) com o estado novo `papel_protegido` — gestão vincula pelo e-mail pré-autorizado, nunca pela busca de nome (senão qualquer logado escolheria o nome do coordenador e ganharia o painel); (3) **restaura** em `guard_membro_self` as exceções 1 e 2 da 006 que a **007 reverteu sem perceber** — sem elas, `vincular_meu_cadastro()` e a reivindicação com sessão aberta morrem em "Estes campos do cadastro só a coordenação altera", e esse é exatamente o caminho legítimo dos e-mails pré-autorizados (mantém o laboratório livre com log, da 007, e devolve as travas de `catalogo_id`/`email_pendente`). **Se um dia reaplicar a 006 ou a 007, reaplique a 013 em seguida** | O SELECT de sanidade devolve **6 linhas, todas `ok = true`**, e a lista de papéis protegidos mostra as 2 linhas de coordenação do ciclo 1 (Andreimar + labioprot.toxin) |

## 2. Seeds (depois das migrações)

| # | Arquivo | O que faz |
|---|---------|-----------|
| 6 | `seeds/002_equipe.sql` | Os 209 da proposta em `ciclo_membros`, com e-mail-placeholder que a RPC da 006 troca pelo real quando a pessoa se identifica |
| 7 | `seeds/003_laboratorios_expandidos.sql` | Os 70 laboratórios da busca extensiva (total 98) — id determinístico, `on conflict` |
| 8 | `patch-2026-08-laboratorios-nomes.sql` | Nomes e siglas reais dos 28 laboratórios formais. Casa por `lla_nome` **e `ordem < 200`** — o guard existe porque dois líderes (Cangussu, Doria) também têm laboratório na seed 003, e sem ele o update poria a mesma sigla nas duas linhas. Se já rodou, não faz nada; funciona antes ou depois da seed 003 |

## 3. Edge Function (terminal, não SQL Editor)

```bash
supabase functions deploy indicadores --project-ref <ref-do-projeto>
```

- O `<ref>` é o id do projeto (Dashboard → Settings → General).
- **Nunca** com `--no-verify-jwt` — viraria proxy público do Google Acadêmico
  com o IP do projeto (o `supabase/config.toml` já declara `verify_jwt = true`).
- Nenhum segredo a configurar; a função usa as envs que o Supabase injeta.
- **Se pular este passo, nada quebra**: índice H e citações vêm do OpenAlex
  em silêncio. A função só acrescenta a fonte Google Acadêmico.

## 4. Fora deste roteiro

- `migrations/008_workshop_fitofarmas.sql` — é do módulo **Fitofármacos**
  (formulário pré-evento), independente do relato. Aplicar quando esse módulo
  for ao ar. Atenção: há uma tarefa em andamento renumerando-a por colidir com
  a 008 da sigla; o nome do arquivo pode mudar.
- Seeds `001` e migrações `001..005`: **já aplicadas** (o ciclo 1, os 28
  laboratórios e a seleção de IC estão em produção sobre elas).

## 5. Depois do banco: o site

Só então publicar o `dist/` novo na Hostinger (o de hoje inclui formulários,
painel da coordenação e indicadores). Conferência pós-deploy: abrir
`#/relatorio-anual`, identificar-se, e ver a Tela 1 buscar os indicadores
sozinha com a fonte escrita ao lado.
