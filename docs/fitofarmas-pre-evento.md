# Formulário pré-evento — I Workshop Conexão Fitofarmas

**Endereço:** <https://inct-conexao.com.br/#/fitofarmas>
**Evento:** 25/08/2026 (IESPRO/SESAU, Porto Velho) e 27/08/2026 (Cacoal), 08h00–17h30
**Realização:** NEv RO/IESPRO · INCT-CONEXAO · Fiocruz Rondônia · UNIR · SEMUSA PVH

---

## 1. Para que ele existe

Separar **interesse** de **intenção**, antes do encontro, para que a coordenação
chegue no dia 25 sabendo com quem sentar.

O formulário **não** pergunta satisfação, aprendizado nem aplicação do conteúdo:
ele é respondido antes do workshop, e perguntar isso a quem ainda não assistiu a
nada produziria dado falso — dado falso num instrumento de priorização é pior
que dado nenhum.

Ele é **público e sem login**: a pessoa se identifica com nome, e-mail,
instituição e, se quiser, Lattes/ORCID.

Está **no menu do cabeçalho** ("Fitofarmas"), por decisão da coordenação
(2026-08-07). Depois do evento, o item pode sair do menu (uma linha em
`navItems`, `src/App.tsx`) — a rota continua existindo para sempre, porque o QR
code impresso não sabe que o evento acabou.

---

## 2. O que fazer ANTES de divulgar o endereço

O site já está publicado com o formulário, mas o banco ainda não tem as tabelas.
Enquanto isso, quem abrir a página preenche tudo e recebe, no envio:

> *O envio ainda não está no ar do nosso lado — não é nada que você fez.*

**Dois arquivos, no SQL Editor do Supabase, nesta ordem:**

1. `supabase/migrations/008_workshop_fitofarmas.sql` — cole o arquivo inteiro e
   rode de uma vez. Ele termina com um bloco **SANIDADE**: leia o resultado.
   Todas as linhas têm o valor esperado escrito no próprio texto da checagem.
2. `supabase/seeds/003_workshop_fitofarmas.sql` — cria a edição e a abre.
   Termina mostrando a janela e um `aceitando_agora` que precisa ser `true`.

A 008 **não altera nada** das migrações 001 a 007. Ela só lê `is_admin()` e
`touch_updated_at()` — confirme que as duas existem antes:

```sql
select proname from pg_proc where proname in ('is_admin','touch_updated_at');
```

Depois disso, abra <https://inct-conexao.com.br/#/fitofarmas>, responda uma vez
com o seu próprio e-mail e confira que o protocolo aparece.

---

## 3. O fluxo, do ponto de vista de quem responde

Cinco passos, cerca de 5 minutos (3 pelo caminho curto), quase tudo em toque.

| # | Passo | O que pergunta |
|---|-------|----------------|
| 1 | Quem é você | nome, e-mail, telefone (opcional), instituição, UF, vínculo, Lattes e ORCID (opcionais) |
| 2 | Seu interesse na rede | **o portão** (4 níveis) e em qual dia estará |
| 3 | Onde pode contribuir | até 3 eixos (EET), formas de contribuição, e o que já tem para agregar — com o **“qual?”** de cada item |
| 4 | O que você assume | iniciativas conjuntas, disponibilidade, prazo, poder de decisão, colaboração anterior, próximos passos concretos, escala de chance |
| 5 | Revisão e envio | resumo, comentário livre, canal de contato, autorização LGPD |

**Lógica condicional.** Quem marca no passo 2 *“Quero só acompanhar as ações”*
**não vê os passos 3 e 4** — o formulário cai para três passos e ~3 minutos.
Perguntar quanta infraestrutura cede a quem acabou de dizer que só quer receber
notícias é o jeito mais rápido de obter uma resposta inventada.

Quem tinha respondido os passos de colaboração e depois volta para marcar “só
acompanhar” **tem essas respostas apagadas** — na tela e no servidor. Sem isso,
a pessoa enviaria, por baixo, os compromissos que acabou de renegar.

**Rascunho.** O que a pessoa digita fica salvo no navegador dela e volta se ela
fechar a aba. O **consentimento LGPD nunca é restaurado**: autorização
recuperada de um armazenamento que a pessoa não vê não é autorização.

**Reenvio corrige.** Responder de novo com o mesmo e-mail atualiza a resposta
anterior e devolve o mesmo protocolo. Não duplica — e a versão anterior fica
guardada (ver §6).

> A tela **não** diz “atualizamos a sua resposta”: a mensagem é a mesma da
> primeira vez. É deliberado — ver §7.

---

## 4. Como o formulário distingue interesse de intenção

A régua inteira segue um princípio: **pesa mais o que custa mais responder.**

| Pontos | Dimensão | Por quê |
|-------:|----------|---------|
| 30 | Próximos passos assumidos | Cada item tem verbo e prazo. Quem marca “carta de anuência” sabe que vai receber a cobrança. Os itens têm pesos diferentes: *carta de intenção*, *co-redigir proposta* e *sediar atividade* valem 8; *participar de uma reunião*, 5. |
| 20 | Ativos **nomeados** | Marcar “tenho base de dados” é grátis; escrever “Herbário HFSL, 12 mil exsicatas” exige ter. Nomear vale **5×** apenas marcar. |
| 18 | Disponibilidade | Em unidade de calendário (“1 dia por mês”), nunca “bastante”. |
| 12 | Prazo | “Já tenho algo pronto” ≠ “algum dia”. |
| 8 | Poder de decisão | Capacidade institucional de assinar. |
| 8 | Colaboração anterior | **Âncora comportamental** — comportamento passado prevê comportamento futuro melhor que qualquer intenção declarada, e é o único item que não depende de promessa nenhuma. |
| 8 | Iniciativas conjuntas | O que quer construir. |
| 8 | Interesse declarado | O portão. |
| **4** | **Escala de chance (1–5)** | **Autodeclaração pura.** Quatro pontos em cem, de propósito: é a pergunta que todo mundo responde bem e que por isso não separa ninguém. |

Soma dos tetos: 116, cortada em 100. **Chegar ao topo exige largura** —
compromisso + ativo + tempo + histórico —, não um único item no máximo.

O escore é calculado **no servidor**, dentro da função que grava, e nunca aceito
do navegador: um número de priorização que o cliente escolhe não prioriza nada.
**Nunca é mostrado a quem responde** — devolver “você é prioritário” ensinaria
quais caixas marcar e mataria o instrumento na segunda edição.

---

## 5. Como usar os dados

### O painel na Gestão (o caminho do dia a dia)

Em **`#/gestao?area=fitofarmas`** (ou: entre na Gestão e toque na área
**Fitofarmas**), administradores logados veem:

- **métricas de campanha**: total de respostas (e quantas foram corrigidas),
  escore médio, **cadeiras por dia** (dia 25 Porto Velho / dia 27 Cacoal — quem
  marcou "ambas" conta nos dois), ativos nomeados e quantos já colaboraram com
  a rede;
- **as quatro faixas** de priorização, com a contagem de cada uma;
- **três rankings**: compromissos assumidos (o dado mais acionável — em outubro,
  volte a ele item por item), eixos mais marcados e vínculo de quem respondeu;
- **a lista priorizada por escore**, com busca (nome, instituição, e-mail,
  protocolo — sem acento) e filtros por faixa e por dia;
- **a ficha completa de cada pessoa** ao tocar na linha: contato com link de
  e-mail, Lattes/ORCID clicáveis, tudo o que ela respondeu e as datas;
- **Exportar CSV** do que estiver filtrado — abre direto no Excel, com todos os
  ids traduzidos para rótulos.

O painel é **só leitura** de propósito: corrigir ou apagar resposta continua
sendo pelo SQL Editor (§6) — apagar dado de pessoa a um clique de distância num
painel é como acidente acontece. E ele **nunca recalcula** escore ou faixa: o
que aparece é o que o servidor gravou.

Quem não é admin vê um aviso explicando a restrição (os dados têm contato
pessoal; a regra é a RLS da 008, não a tela).

### No SQL Editor (consultas avançadas)

```sql
-- com quem sentar no dia 25
select faixa, escore_intencao, nome, instituicao, uf, email, telefone, canal,
       aportes_nomeados, compromissos, disponibilidade, horizonte, decisao
  from public.workshop_prioridade
 where edicao = 'i-workshop-conexao-fitofarmas'
 order by escore_intencao desc
 limit 30;
```

Faixas: **prioritário** (≥70) · **promissor** (≥45) · **acompanhar** (≥25) ·
**informativo** (<25).

Outras consultas úteis:

```sql
-- quem se comprometeu com carta de intenção institucional
select nome, instituicao, email from public.workshop_prioridade
 where 'carta_intencao' = any(compromissos);

-- quem tem base de dados/coleção, e qual
select nome, instituicao, aportes_detalhe ->> 'dados' as base
  from public.workshop_prioridade
 where aportes_detalhe ? 'dados';

-- quem vai a Cacoal e topa entrar no GT da redesFITO
select nome, instituicao, telefone from public.workshop_prioridade
 where sede in ('cacoal','ambas') and 'gt_redesfito' = any(compromissos);

-- distribuição por eixo
select unnest(eets) as eixo, count(*) from public.workshop_respostas group by 1 order by 2 desc;
```

**Re-pontuar com outra régua**, sem reperguntar a ninguém (as respostas cruas
ficam guardadas em `respostas`): mude a função `escore_intencao_workshop` na 008
e rode

```sql
update public.workshop_respostas
   set escore_intencao = public.escore_intencao_workshop(respostas);
```

> Se mudar os pesos no SQL, mude também `src/fitofarmas/escore.ts` — os dois são
> gêmeos e `tests/fitofarmas.test.ts` falha se divergirem. É de propósito.

---

## 6. Operação

**Fechar o formulário** (o site passa a mostrar o aviso, sem deploy):

```sql
update public.workshop_edicoes set status = 'encerrado'
 where slug = 'i-workshop-conexao-fitofarmas';
```

**Mudar o prazo** (o padrão fecha em 27/08 às 08h00 — ver a justificativa no
cabeçalho do seed):

```sql
update public.workshop_edicoes set fecha_em = '2026-08-24 23:59:00-04'
 where slug = 'i-workshop-conexao-fitofarmas';
```

**Ver o histórico de uma resposta** (toda versão anterior é guardada antes de
ser substituída — nenhuma correção, nem legítima nem indevida, destrói o que
estava lá):

```sql
select v.substituida_em, v.escore_intencao, v.respostas
  from public.workshop_respostas_versoes v
  join public.workshop_respostas r on r.id = v.resposta_id
 where lower(r.email) = lower('pessoa@exemplo.br')
 order by v.substituida_em desc;
```

**Restaurar uma versão** (cole o `respostas` da consulta acima):

```sql
update public.workshop_respostas
   set respostas = '<o jsonb da versão>'::jsonb,
       escore_intencao = public.escore_intencao_workshop('<o mesmo jsonb>'::jsonb)
 where lower(email) = lower('pessoa@exemplo.br');
```

> Isso restaura o cru e o escore. As colunas derivadas (`eets`, `compromissos`…)
> continuam com o valor substituído — restaure-as à mão se precisar, ou peça à
> pessoa que responda de novo, que é mais rápido.

**Apagar uma resposta a pedido da pessoa (LGPD):**

```sql
delete from public.workshop_respostas
 where lower(email) = lower('pessoa@exemplo.br')
   and edicao_id = (select id from public.workshop_edicoes
                     where slug = 'i-workshop-conexao-fitofarmas');
```

**Um próximo workshop** é uma linha nova em `workshop_edicoes` (copie o seed 003,
troque slug, título e datas) e uma constante nova em `src/fitofarmas/api.ts`. As
perguntas não mudam sozinhas: elas são estrutura, e estrutura que muda por dado
vira formulário sem esquema.

---

## 7. Segurança — por que este é o primeiro formulário sem login do projeto

Nas migrações 001 a 007 não existe **uma** policy `for insert to anon`, e não é
esquecimento: `create policy … to anon with check (true)` entrega a chave
anônima — que é pública por design, está no JavaScript do site e qualquer pessoa
lê no DevTools — como caneta de escrita direta no PostgREST.

O desenho aqui é o mesmo da 006:

```
tabela  → RLS ligada, ZERO policies de escrita, revoke all … from anon
função  → revoke … from public  e SÓ ENTÃO  grant … to anon
```

`registrar_intencao_workshop` é a **única** superfície aberta a quem não tem
sessão. Ela é `security definer`, valida tudo do lado do servidor, e devolve
sempre um desfecho tratado — nunca uma exceção crua.

Defesas, todas do servidor e proporcionais a uma rede acadêmica sem dinheiro em
jogo (não há CAPTCHA e não haverá — num formulário institucional ele custa mais
respostas legítimas do que bloqueia robô):

1. **um e-mail por edição** (índice único) — reenviar corrige, inundar exige
   inventar endereços;
2. **isca** (campo escondido) e **tempo mínimo** de 4 s de preenchimento — quem
   cai recebe `ok` e nada é gravado, porque dizer “recusado” ensina o robô a
   corrigir e voltar;
3. **freio de enxurrada**: no máximo 40 *escritas* por minuto na edição — conta
   `updated_at`, não `created_at`, senão o caminho de correção passa por baixo
   do freio reescrevendo a mesma linha para sempre;
4. **vocabulário fechado e teto** em toda coluna, inclusive as de array, e teto
   de 64 kB no jsonb cru — o que a tela oferece é o que o banco aceita;
5. **coerência do caminho curto** garantida por constraint, e não só pela tela —
   um cliente adulterado que mandasse `interesse='acompanhar'` junto com
   `disponibilidade='ate_1_dia_semana'` ganharia 18 pontos que ninguém deu; o
   servidor ainda poda as respostas de colaboração antes de pontuar;
6. **toda versão anterior arquivada** em `workshop_respostas_versoes`
   (append-only, por gatilho) — sobrescrever nunca destrói;
7. **nada apagável pela API** — engano é visível e reversível no SQL Editor.

### O que continua possível, e é aceito

Sem login, o e-mail **não prova nada**. Quem tiver a chave anônima (que é
pública por design, está no JavaScript do site) e o endereço de outra pessoa
pode responder no lugar dela; quem tiver a lista de convidados pode criar linhas
com endereços que ainda não responderam. As duas coisas são inerentes a um
formulário aberto e só desaparecem com login — que custaria mais respostas do
que protege, num público convidado por ofício.

O que se garante: **nada disso apaga nada** (defesa 6); a resposta da RPC **não
distingue** “já respondeu” de “é a primeira vez” — por isso os três desfechos de
sucesso trazem exatamente a mesma frase, e por isso a tela não diz “atualizamos
a sua resposta”; e o volume tem freio.

O bloco **SANIDADE** no fim da 008 prova cada um desses fechamentos. Não existe
teste automatizado de RLS neste repositório: **leia o resultado do bloco.**

---

## 8. Arquivos

| Arquivo | O que é |
|---------|---------|
| `src/fitofarmas/perguntas.ts` | as perguntas, as opções e os textos de tela |
| `src/fitofarmas/types.ts` | as uniões de id — gêmeas dos `check` da 008 |
| `src/fitofarmas/validation.ts` | validação pura, bloqueante por passo |
| `src/fitofarmas/escore.ts` | a régua **explicada** (o cálculo que vale é o do banco) |
| `src/fitofarmas/rascunho.ts` | rascunho no navegador, sem o consentimento |
| `src/fitofarmas/api.ts` | a chamada da RPC; nunca lança |
| `src/fitofarmas/FormularioPreEvento.tsx` | a tela |
| `src/fitofarmas/metricas.ts` | métricas do painel — funções puras, testadas |
| `src/fitofarmas/PainelFitofarmas.tsx` | a área "Fitofarmas" da Gestão (admin) |
| `src/ui/campos.tsx` | controles compartilhados (`Texto`, `Escolha`, `Caixas`, `Escala`, …) |
| `supabase/migrations/008_workshop_fitofarmas.sql` | tabelas, RLS, RPC, escore, histórico de versões, view |
| `supabase/seeds/003_workshop_fitofarmas.sql` | a edição |
| `tests/fitofarmas.test.ts` | 73 testes, incluindo a paridade cliente↔banco |

Tabelas criadas pela 008: `workshop_edicoes` (a configuração),
`workshop_respostas` (uma linha por pessoa), `workshop_respostas_versoes`
(append-only), `workshop_protocolo_seq` (o contador), e a view
`workshop_prioridade`.
