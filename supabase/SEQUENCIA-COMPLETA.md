# Sequência completa de SQL — Supabase (13/08/2026)

Esta é a ordem **única e canônica** para colar no **SQL Editor** do Supabase.
Foi **provada de ponta a ponta num Postgres limpo**: aplica na ordem abaixo sem
um erro, roda de novo sem duplicar nada (idempotente), e as sanidades batem.

**Regra de ouro:** rode o **banco inteiro ANTES** de subir o site novo. E cole
**um arquivo por vez, inteiro**, na ordem numerada — não pule, não reordene.

> **Por que há números repetidos (008, 012, 013)?** Módulos diferentes foram
> numerados em paralelo. Como aqui a gente aplica à mão, o número é só rótulo;
> o que importa é **esta ordem**. Cada arquivo é idempotente: se já rodou antes,
> rodar de novo não faz mal — na dúvida, rode.

## A ordem

| # | Arquivo | Já aplicado? | Confere assim |
|---|---------|--------------|---------------|
| 1 | `migrations/006_identificacao.sql` | provavelmente | lista as funções no fim |
| 2 | `migrations/007_laboratorio_editavel.sql` | provavelmente | — |
| 3 | `migrations/008_sigla_opcional.sql` | provavelmente | — |
| 4 | `migrations/008_workshop_fitofarmas.sql` | se Fitofármacos no ar | bloco SANIDADE no fim |
| 5 | `seeds/001_ciclo_1.sql` | sim (ciclo 1) | — |
| 6 | `seeds/002_equipe.sql` | verifique | os 209 da proposta |
| 7 | `patch-2026-08-laboratorios-nomes.sql` | verifique | nomes/siglas dos 28 labs |
| 8 | `seeds/003_laboratorios_expandidos.sql` | verifique | 98 labs no total |
| 9 | `seeds/003_workshop_fitofarmas.sql` | se Fitofármacos no ar | — |
| 10 | `migrations/009_gforms.sql` | verifique | sanidade **9× true** |
| 11 | `migrations/010_indicadores.sql` | verifique | sanidade **5× true** |
| 12 | `migrations/011_anexo_docx.sql` | **NÃO** | sanidade **6× true** |
| 13 | `migrations/012_superadmin.sql` | **NÃO** | sanidade **5× true** |
| 14 | `migrations/012_lla_vinculo.sql` | **NÃO** | **28/28**, lista de divergências VAZIA |
| 15 | `migrations/013_curso_atomo.sql` | **NÃO** (se o Curso for ao ar) | reaplicar não duplica |
| 16 | `seeds/004_curso_atomo.sql` | **NÃO** (idem) | abre a edição do curso |
| 17 | `migrations/013_identidade.sql` | **NÃO** | sanidade **6× true** + 2 linhas de coordenação |
| 18 | `migrations/014_documento_obrigatorio.sql` | **NÃO** | sanidade **2× true**. Torna verdade DO BANCO a decisão de 13/08: relato não vira "enviado" sem o documento da pesquisa anexado (a tela já barra; o trigger fecha o caminho por fora dela) |

### As dependências que fixam a ordem (por que é assim)

- **As seeds (5–9) entram no MEIO**, entre a 008 e a 009: a 009 (colunas do
  Forms), a 010 e a 012_lla_vinculo precisam do roster (seed 002) e dos labs
  (seeds 001/003) já presentes para trabalhar em cima deles.
- O **patch de nomes (7)** vem antes da seed 003 por segurança (casa por
  `lla_nome` **e** `ordem < 200`; funciona antes ou depois, mas antes é o
  provado).
- A **013_identidade é a ÚLTIMA** de propósito: ela dá `create or replace` em
  funções da 006 e da 007 (`reivindicar_cadastro`, `guard_membro_self`). Se
  vier algo depois que reescreva essas funções, apaga o conserto. **Regra
  permanente: se um dia reaplicar a 006 ou a 007, reaplique a 013_identidade
  logo em seguida.**
- **012_superadmin, 013_curso e Fitofármacos** são módulos independentes (não
  tocam nada do relato). Estão na ordem por conveniência; se você **não** for
  ao ar com o Curso agora, pode pular os passos **15 e 16** sem quebrar nada —
  mas a 013_identidade (17) continua obrigatória.

## Depois do banco: a Edge Function (opcional, terminal — não SQL Editor)

```bash
supabase functions deploy indicadores --project-ref <ref-do-projeto>
```

Sem ela, índice H e citações vêm do OpenAlex em silêncio. **Nunca** com
`--no-verify-jwt`.

**Republicar mesmo se já publicou antes**: em 13/08 a função ganhou a lista
de artigos do período (a busca do Google Acadêmico na Tela 2). Com a versão
antiga no ar, o índice H segue funcionando e a busca de artigos simplesmente
não aparece — nada quebra, mas a feature só liga com o redeploy.

## Só então: o site

Subir o conteúdo de **`inct_deploy/`** (ou extrair `inct-site-2026-08-13.zip`)
para `public_html/`, com o `index.html` na raiz. Conferência pós-deploy
(Ctrl+Shift+R): abrir `#/relatorio-anual`, identificar-se; e o coordenador
abrir `#/gestao?area=relatorio` — o painel abre sem erro (a 013_identidade já
vinculou o e-mail dele).

## O que NÃO está aqui

- Migrações **001–005**: já em produção (plataforma, seleção de IC, relatos).
- `013_identidade` **conserta um defeito ativo hoje**: a 007 apagou sem querer
  duas exceções da 006, e por isso o vínculo por e-mail (o caminho do
  coordenador e de quem já tinha conta) está quebrado em produção. É mais um
  motivo para aplicá-la já.
