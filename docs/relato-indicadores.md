# Índice H e citações automáticos (Q14) — o que é possível, o que é proibido, como publicar

O pedido foi curto: *"índice H e citações devem ser extraídos automaticamente do
Google Scholar do pesquisador"*. Hoje esses dois campos (Q14 do Forms do CTC)
são digitados à mão na Tela 1. Este documento registra **o que a apuração
empírica permitiu construir**, **onde ela impôs fronteira**, e **como colocar a
coisa no ar**.

Tudo o que segue foi **medido em 10/08/2026**, com `curl`, contra os serviços
reais. Nenhuma afirmação aqui é suposição.

---

## 1. Os cinco fatos que decidiram o desenho

**1. O Google Scholar não tem CORS.** Testado com e sem cabeçalho `Origin`: o
`access-control-allow-origin` simplesmente **não existe** na resposta. Este site
é estático e roda no navegador do pesquisador — logo, um `fetch` direto do
Scholar é barrado pelo navegador, **sempre**. Não é política nossa; é mecânica.
Só um proxy do lado servidor consegue ler. É por isso que existe uma Edge
Function.

**2. O `robots.txt` do Scholar divide o mundo em dois.** Literal, lido no dia:

```
Disallow: /citations?
Allow:    /citations?user=
Disallow: /citations?*cstart=
Disallow: /citations?user=*@
Disallow: /citations?user=*%40
```

**Ler um perfil conhecido é permitido. Procurar autor por nome não é** —
`view_op=search_authors` cai no `Disallow: /citations?`. Esta é a **fronteira
dura** do módulo, e ela não é negociável: *nunca* implemente busca de autor por
nome no Scholar. (Por nome, só o OpenAlex responde — e ainda assim rotulado como
incerto; ver §4.)

**3. O perfil, quando lido, parseia limpo.** HTTP 200, e a tabela de indicadores
sai em `<td class="gsc_rsb_std">N</td>`, **seis células**, nesta ordem:

| posição | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|
| campo | citações (todas) | citações (desde) | **h** (todas) | h (desde) | i10 (todas) | i10 (desde) |

Nome em `id="gsc_prf_in"`; afiliação no **primeiro** `<div class="gsc_prf_il">`
(os outros dois divs da mesma classe trazem `id=`: e-mail confirmado e
interesses). Conferido contra dois perfis públicos reais — ver §6.

**4. O id do perfil (`user=…`) é opaco e não o temos para ninguém dos ~209.**
Tentou-se descobri-lo pelo ORCID: `pub.orcid.org/v3.0/<orcid>/researcher-urls` é
CORS-aberto e funciona, mas veio **vazio** nos 4 pesquisadores reais testados —
ninguém preenche esse campo. **Descoberta automática do id não existe.** Daí o
desenho: *o pesquisador cola o link do perfil UMA VEZ* (vira
`ciclo_membros.scholar_id`); daí em diante é automático, para sempre.

**5. O OpenAlex é a rede de segurança, e ela funciona hoje.** CORS aberto
(`access-control-allow-origin: *`), sem chave, e traz `summary_stats.h_index`,
`summary_stats.i10_index` e `cited_by_count`. Por ORCID:
`api.openalex.org/authors/https://orcid.org/<ORCID>` (200 com registro, 404 sem).
Como a Tela 1 já descobre o ORCID sozinha, este caminho custa **zero ação do
pesquisador e zero infraestrutura**.

**E o mais importante: as duas fontes não dão o mesmo número.** O corpus do
OpenAlex é menor e o h sai menor. Buscar `"Ana Maria Moura da Silva"` por nome no
OpenAlex devolve, em 2º lugar, **outra pessoa** — *Antônio Augusto Moura da
Sílva*, h = 56, contra h = 52 da pesquisadora certa. Aceitar o primeiro resultado
seria acertar por sorte; aceitar o de h mais alto seria errar de propósito.

### Dois achados extras, que custam caro se ignorados

* **A página vem em ISO-8859-1**, não em UTF-8:
  `content-type: text/html; charset=ISO-8859-1` com `hl=pt-BR`. Um
  `await res.text()` ingênuo devolve mojibake — e o campo que quebra é
  justamente o **nome do pesquisador brasileiro** ("João", "Conceição"). A Edge
  Function lê `arrayBuffer` e decodifica com o charset **declarado no
  cabeçalho**.
* **Id inexistente devolve HTTP 404** (medido com `user=ZZZZZZZZZZZZ`), com a
  página de erro genérica do Google. Isso é `nao_encontrado`, **não** é bloqueio,
  e não se repete a tentativa.

---

## 2. O desenho: duas fontes, degradação graciosa, fonte sempre no rótulo

```
                      tem scholar_id?
                     /              \
                  sim                não
                   |                  |
      Edge Function `indicadores`     |
        (Scholar, cache 7 dias)       |
           /            \             |
        deu            não deu        |
         |            (bloqueado,     |
   fonte='scholar'     404, função    |
                       não publicada) |
                            \         /
                             OpenAlex por ORCID
                              (CORS-ok, direto do navegador)
                                     |
                              fonte='openalex'
                                     |
                        nada? → campo manual, como hoje
```

**O campo nunca deixa de ser editável.** O número entra como **sugestão**, com a
fonte dita em português — *"do seu Google Acadêmico, atualizado em 10/08"*,
*"segundo o OpenAlex (a base é menor que a do Google Acadêmico; o número costuma
ser mais baixo)"* — e a pessoa pode sobrepor. Sobrepôs? A procedência vira
`manual`.

**Nunca, em hipótese alguma, apresentar número do OpenAlex como se fosse do
Scholar.** É por isso que a frase de procedência é uma **função**
(`fraseDeProcedencia`) e não uma disciplina de quem escreve JSX.

### Por que a procedência virou coluna

A migração 010 acrescenta a `ciclo_membros`:

| coluna | para quê |
|---|---|
| `scholar_id` | o `user=` do perfil, colado uma vez |
| `indicadores_fonte` | `'scholar'` \| `'openalex'` \| `'manual'` |
| `indicadores_atualizado_em` | **quando o número foi apurado** |

Um relatório de agência com "h = 52" sem dizer de onde veio é **passivo**: não se
sabe se é comparável ao do colega da linha de cima, e não há como reproduzir a
apuração. Guardar a procedência custa duas colunas.

---

## 3. Publicar a Edge Function

Esta é a **primeira Edge Function do projeto**. Não há `supabase/functions/`
anterior; o CLI do Supabase é o único pré-requisito.

```bash
# uma vez, na máquina de quem publica
npm i -g supabase          # ou: brew install supabase/tap/supabase
supabase login

# na raiz do repositório
supabase functions deploy indicadores --project-ref <ref-do-projeto>
```

O `<ref-do-projeto>` é o identificador que aparece na URL do painel
(`https://supabase.com/dashboard/project/<ref>`).

**Não passe `--no-verify-jwt`.** O padrão (`verify_jwt` ligado) é o que impede a
função de virar um proxy público para o Scholar: só chega nela quem tem sessão no
site. Isso é decisão de segurança, não de conveniência.

**Nenhum segredo precisa ser configurado.** `SUPABASE_URL` e
`SUPABASE_SERVICE_ROLE_KEY` são injetados pelo próprio runtime do Supabase, e são
o que dá à função permissão de gravar o cache (a tabela não tem policy de
escrita — ver §5).

**Antes do deploy, rode a migração 010** no SQL Editor. Sem a tabela
`indicadores_cache` a função ainda responde (ela trata a falha de cache em
silêncio), mas leria o Scholar toda vez, que é exatamente o que o cache existe
para evitar.

### Conferir que subiu

No console do navegador, já logado no site:

```js
const { data, error } = await supabase.functions.invoke("indicadores", {
  body: { scholar_id: "https://scholar.google.com/citations?user=SEU_ID&hl=pt-BR" },
});
console.log(data, error);
// esperado: { ok: true, fonte: "scholar", h_index: …, citacoes: …, do_cache: false }
// segunda chamada: do_cache: true
```

### E se ninguém publicar?

**Nada quebra, e ninguém vê mensagem de erro.** O cliente
(`buscarNoScholar`) traduz "função não publicada" (404 do gateway), "plataforma
sem `.env`" e "rede caída" para o mesmo motivo — `indisponivel` — e a
orquestração cai no **OpenAlex por ORCID**, em silêncio. O pesquisador vê o
número com o rótulo "segundo o OpenAlex". Foi assim de propósito: dá para
entregar o autopreenchimento **antes** de a função existir.

---

## 4. Os limites éticos adotados — que são código, não intenção

| limite | como está implementado |
|---|---|
| **robots.txt ao pé da letra** | a função só monta `/citations?user=<id>&hl=pt-BR`. Não pagina (`cstart`), não busca autor por nome, e o regex do id (`^[A-Za-z0-9_-]{8,20}$`) exclui `@` — que é justamente o que o `Disallow: /citations?user=*@` proíbe. O mesmo regex está no CHECK da migração, no cliente e na função. |
| **User-Agent honesto** | `INCT-CONEXAO-BIO3TOX/1.0 (+https://inct-conexao.com.br; inctconexao@gmail.com)`. Identifica o instituto, com URL e contato. **Nenhum disfarce de navegador.** Se o Google quiser nos barrar, tem como — e é assim que deve ser. |
| **CAPTCHA/403/429 = parar** | vira `motivo: 'bloqueado'`, o cliente cai no OpenAlex. Não se resolve, não se contorna, não se insiste. |
| **Sem retry agressivo** | no máximo **uma** repetição, com 1,5 s de espera, e **só** para falha de rede ou 5xx — que é falha nossa, não recusa deles. Bloqueio e 404 nunca são repetidos. |
| **Cache ≥ 7 dias por perfil** | são ~209 perfis, uma leitura cada por semana no pior caso. O cache não é otimização: é a contrapartida de quem lê a página de outra pessoa. |
| **Só o próprio perfil, a pedido do dono** | não há rota de varredura, não há lote, não há lista. Uma chamada = um perfil, pedido por quem está logado. |

Uma consequência elegante do cache: **quando o Scholar bloqueia, a função devolve
o cache velho** em vez de nada — rotulado com a data verdadeira, que a tela
mostra ("atualizado em 03/08"). O h de sete dias atrás é o mesmo h de hoje em
quase todos os casos, e isso tira pressão do serviço num dia em que ele já disse
não.

---

## 5. A tabela de cache e a policy que **não** existe

`indicadores_cache` (migração 010) tem RLS ligada e **uma só policy**: leitura
para autenticado. **Não há policy de INSERT/UPDATE, e isso é a regra, não o
esquecimento** — com RLS ligada e nenhuma policy de escrita, todo `INSERT` vindo
do navegador falha. Quem grava é a Edge Function com a `service_role`, que passa
por cima da RLS por definição.

Se houvesse escrita para `authenticated`, qualquer pessoa logada poderia
`PATCH`ear o cache e plantar o h que quisesse no perfil de um colega — e o número
entraria na tela dele rotulado *"do seu Google Acadêmico"*, que é o pior rótulo
possível para um dado forjado.

Conferência (deve devolver `0`):

```sql
select count(*) from pg_policies
 where schemaname='public' and tablename='indicadores_cache' and cmd <> 'SELECT';
```

---

## 6. A prova empírica do parser

O parser é uma função **pura** (`parsearPerfilScholar`), rodada contra HTML real
baixado com `curl`. Saída da prova:

```
-- JicYPdAAAAAJ  (Geoffrey Hinton)
   citações 1070076 / 607406 · h 194 / 133 · i10 539 / 397
-- kukA0LcAAAAJ  (Yoshua Bengio)
   citações 1134910 / 751556 · h 259 / 207 · i10 1092 / 939
```

Os 12 números conferem, célula a célula, com o que o `grep` mostra no HTML bruto;
nome e afiliação saem limpos ("Emeritus Prof. Computer Science, University of
Toronto" — remontado de dentro de um `<a>`). O HTML de **404** e uma página que
tenha só o CSS com o nome da classe devolvem `null` — nunca um número inventado.

**Armadilha que o HTML real ensinou:** os nomes de classe (`gsc_rsb_std`,
`gsc_prf_il`) aparecem **também na folha de estilo embutida da própria página**.
Todo regex ancora na **tag** (`<td class=`, `<div class=`), nunca no nome da
classe solto — um `indexOf("gsc_rsb_std")` casa com o CSS e lê lixo.

### O parser está duplicado, de propósito

A mesma lógica existe em dois lugares:

* `src/relato/indicadores.ts` — o cliente (bundle do Vite);
* `supabase/functions/indicadores/index.ts` — a Edge Function (Deno).

Deno não compartilha módulo com o bundle do Vite (o arquivo do cliente importa o
cliente Supabase, que só existe sob `import.meta.env`), e publicar um pacote só
para 40 linhas de regex seria infraestrutura maior que o problema. **As duas
cópias devem andar juntas.** Elas são hoje **literalmente idênticas** (89 linhas,
`diff` vazio), o que torna a regra verificável por máquina:

```bash
extrai() { awk '/^(export )?function (parsearPerfilScholar|inteiroDe|textoLimpo|decodificarEntidades|extrairScholarId|decodeURIComponentSeguro)\(/,/^}/' "$1" | sed 's/^export //'; }
diff <(extrai src/relato/indicadores.ts) <(extrai supabase/functions/indicadores/index.ts) && echo IDENTICAS
```

---

## 7. Operação do dia a dia

**O pesquisador não vê nada disso.** Ele cola o link do perfil uma vez, num campo
que diz o que é. Se não colar, o número vem do OpenAlex pelo ORCID que ele já
informou. Se nada vier, ele digita — como hoje.

**A coordenação** ganha duas perguntas respondíveis por SQL, que antes não eram:

```sql
-- de onde vieram os indicadores deste ciclo?
select indicadores_fonte, count(*) from public.ciclo_membros group by 1;

-- quem está com número velho?
select nome, indice_h, indicadores_fonte, indicadores_atualizado_em
  from public.ciclo_membros
 where indicadores_atualizado_em < now() - interval '90 days'
 order by indicadores_atualizado_em;
```

**Se o Scholar passar a bloquear sistematicamente:** não faça nada de esperto.
O sistema já degrada sozinho para o OpenAlex, e o rótulo na tela muda junto. A
resposta correta a um bloqueio é **ser bloqueado**.
