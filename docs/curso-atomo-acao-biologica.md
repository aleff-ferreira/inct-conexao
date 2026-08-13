# CONEXAO-BIOINFORMÁTICA (curso "Do átomo à ação biológica") — página e inscrição

Nome do evento: **CONEXAO-BIOINFORMÁTICA**; título na página:
*CONEXAO-BIOINFORMÁTICA: Do átomo à ação biológica*. Página pública em
**`#/curso`** que apresenta o curso do IFRO Campus Jaru (19–21/08/2026) e embute
a inscrição. No cabeçalho fica sob o menu suspenso **Eventos** (junto de Webinars
e Fitofarmas). Área da coordenação em **`#/gestao?area=curso`** (só admin).
Protocolo: `CBIO-####`.

O curso tem uma **parte teórica** e uma **parte prática**; o mesmo conteúdo se
repete nas duas ofertas de cada parte, e o participante monta um **percurso de 7
horas** escolhendo **um horário de cada**:

| Parte | Tema | Ofertas (mesmo conteúdo) |
| --- | --- | --- |
| Teórica (Conteúdo 1) | Estruturas 3D, visualização molecular e IA | 19/08 14h–17h30 · **ou** · 20/08 14h–17h30 |
| Prática (Conteúdo 2) | Docking, interpretação molecular e ADMET | 21/08 08h–11h30 · **ou** · 21/08 14h–17h30 |

**Vagas: 40 por turma** (dia teórico / turno prático). O formulário mostra as
vagas restantes de cada horário em tempo real e desabilita o que esgotou; a RPC
de registro reconta sob trava e recusa (`turma_lotada`) quem tenta entrar num
horário cheio. O teto vive em `curso_edicoes.config->>'max_por_turma'` (seed 004)
— mude ali e reaplique o seed para alterar sem deploy. As contagens públicas vêm
da função `curso_vagas(slug)` (só números agregados, sem dado pessoal).

## 1. Arquitetura

- **Página + formulário:** `src/curso/CursoPage.tsx` (apresentação, animações
  moleculares) e `src/curso/FormularioInscricao.tsx` (inscrição em 4 passos:
  *Monte seu percurso* → *Quem é você* → *Seu ponto de partida* → *Revisão e
  confirmação*). Conteúdo estático (datas, casos, trilhas) em
  `src/curso/conteudo.ts` — **fonte da verdade** da tela.
- **Banco:** `supabase/migrations/013_curso_atomo.sql` + seed
  `supabase/seeds/004_curso_atomo.sql`. Mesma régua de segurança da 008
  (Fitofarmas): RLS ligada, **nenhuma policy de escrita**, e uma única RPC
  `security definer` (`registrar_inscricao_curso`) aberta a `anon`. Sem escore —
  inscrição de curso é registro, não medição.
- **Painel da coordenação:** `src/curso/PainelCurso.tsx` (lazy, dentro de
  `Gestao.tsx`, área `curso`). Só leitura (view `curso_inscritos`). Abre com um
  **cartão de divulgação** (`PainelDivulgacao`) — número de inscritos, % de
  Veterinária/Agronomia e gráficos por sessão/perfil/experiência, só contagens e
  proporções, feito para **capturar e postar nas redes**; abaixo dele ficam os
  filtros, a lista com contato e o CSV (dado pessoal, nunca para print).
- **Anúncio no site:** item **Do átomo à ação biológica** no menu (título por
  extenso) e um card em destaque ("Inscrições abertas") na seção *Oportunidades*
  da home, ambos apontando para `#/curso`. Em 2026-08-12 saíram do cabeçalho os
  itens Governança, Mapa, Grupos e Contato (as seções/rotas continuam vivas — só
  o atalho saiu), o que enxugou a nav para 8 itens; com isso o menu horizontal
  volta a aparecer a partir de ~1400px (drawer abaixo) — ver o comentário da
  media query em `src/styles.css`.

## 2. Aplicar no Supabase (uma vez, no SQL Editor)

A página **renderiza sem o banco** (mostra "inscrições em breve"); mas o envio só
grava depois de aplicar a migração e o seed, **nesta ordem**, colando o arquivo
inteiro de cada um:

1. `supabase/migrations/013_curso_atomo.sql` — cria `curso_edicoes`,
   `curso_inscricoes`, o histórico, o protocolo, a RPC e a view. Idempotente. O
   bloco final de **sanidade** imprime as checagens de RLS — leia o resultado.
2. `supabase/seeds/004_curso_atomo.sql` — cria a edição
   `curso-conexao-bioinformatica` (status `aberto`, janela até 21/08 08h,
   fuso `-04` de Rondônia) com as quatro turmas em `config`.

Enquanto a 013 não roda, o formulário devolve, em português, "a inscrição ainda
não está no ar do nosso lado" — é pendência nossa, não erro de quem se inscreve.

## 3. Operar a janela de inscrição

```sql
-- fechar antes (o site passa a mostrar o aviso, sem deploy):
update public.curso_edicoes set fecha_em = '2026-08-18 23:59:00-04'
 where slug = 'curso-conexao-bioinformatica';

-- encerrar a qualquer momento:
update public.curso_edicoes set status = 'encerrado'
 where slug = 'curso-conexao-bioinformatica';
```

`abre_em`/`fecha_em` controlam **quando se pode inscrever**. As datas das turmas
(19–21/08) são texto de tela (`src/curso/conteudo.ts` + `config`) e não fecham
nada.

## 4. Apagar uma inscrição (LGPD) — no SQL Editor

```sql
delete from public.curso_inscricoes
 where lower(email) = lower('pessoa@exemplo.br')
   and edicao_id = (select id from public.curso_edicoes
                     where slug = 'curso-conexao-bioinformatica');
```

O painel **não apaga** de propósito: apagar dado de pessoa a um clique de
distância é como acidente acontece. Correção pela própria pessoa: inscrever-se de
novo com o **mesmo e-mail** substitui a resposta (o histórico anterior fica em
`curso_inscricoes_versoes`), não duplica.

## 5. Depois do curso

Remover o item **Curso** de `navItems` (`src/App.tsx`) tira o link do menu. A rota
`#/curso` permanece viva — cartaz e QR impressos não sabem que o curso acabou.
