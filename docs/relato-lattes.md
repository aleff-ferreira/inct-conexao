# Dá para puxar os dados do Lattes direto do CNPq?

**Apuração de 05/08/2026** — feita com `curl` ao vivo contra os servidores do CNPq e com
consulta às fontes oficiais (gov.br, Portal Memória CNPq, ORCID, Crossref). Tudo que está
afirmado aqui foi testado ou tem URL e data de consulta. O que não consegui provar está
marcado **NÃO CONFIRMADO**.

---

## Resposta direta

**Não, a página não pode puxar o Lattes direto do CNPq — e isso não tem conserto por
código.** Mas a pergunta de fundo ("o formulário pode vir preenchido sozinho?") tem
resposta **sim**, por outro caminho, que já está construído nesta base.

Três razões, cada uma sozinha já bastaria:

1. **O navegador é barrado.** Nenhum endereço do Lattes devolve o cabeçalho
   `Access-Control-Allow-Origin`. Sem ele o navegador *recusa a leitura da resposta* — não
   é lentidão nem bug, é o modelo de segurança da web. Reconfirmado hoje em 4 endereços.
2. **Tem CAPTCHA.** A página de visualização do currículo carrega reCAPTCHA do Google.
   Ela foi desenhada para provar que há um humano ali.
3. **O Termo de Uso proíbe.** O CNPq veda expressamente "robôs, sistemas de varredura e
   armazenamento de dados (como 'spiders' ou 'scrapers') (...) ou método coletor/extrator
   de dados automático".

O que **existe** é um web service oficial (`WSCurriculo`) — e o INCT tem direito a ele.
Mas ele é SOAP, exige **IP fixo autorizado**, e **só funciona a partir de um servidor** —
que este projeto não tem (site estático no Hostinger, sem nenhuma função de backend:
`supabase/functions` não existe no repositório).

**A recomendação está no fim: não perseguir o Lattes na v1.** O autopreenchimento que o
dono quer se obtém melhor, hoje, sem tocar no Lattes — e eu medi quanto.

---

## A prova que o dono pediu: os cabeçalhos, ao vivo

Comando (reproduzível em qualquer terminal):

```sh
curl -i -H "Origin: https://inct-conexao.com.br" \
  "https://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=K4790949Z2"
```

Resposta real, capturada em **05/08/2026 19:51 UTC**:

```
HTTP/1.1 200 OK
Server: Apache-Coyote/1.1
X-Powered-By: Servlet 2.5; JBoss-5.0/JBossWeb-2.1
Set-Cookie: JSESSIONID=6D3E1304DA0FFDDA99C8F3E7E041A284.buscatextual_0; Path=/buscatextual
Content-Type: text/html;charset=ISO-8859-1
Transfer-Encoding: chunked
Date: Wed, 05 Aug 2026 19:51:01 GMT
```

**Não há nenhuma linha `Access-Control-*`.** Contagem automática de ocorrências, nos três
endereços principais:

| Endereço testado | Linhas `access-control-*` na resposta |
|---|---|
| `buscatextual.cnpq.br/buscatextual/busca.do` | **0** |
| `buscatextual.cnpq.br/buscatextual/visualizacv.do?id=…` | **0** |
| `lattes.cnpq.br/` | **0** |

O preflight também não ajuda: `OPTIONS` em `visualizacv.do` responde `HTTP/1.1 200 OK`
com `Allow: GET, HEAD, POST, TRACE, OPTIONS` e igualmente **nenhum** `Access-Control-*` —
ou seja, o servidor sequer sabe o que é CORS. É uma aplicação Java/Struts de 2011 que
nunca foi pensada para ser consumida por outro site.

**O CAPTCHA, no mesmo corpo de resposta:**

```
5  Captchar
5  Captcha
3  captcha
1  captcha/api.js
1  captcha.render
1  captcha.getResponse
1  captcha.css
1  google.com/recaptcha
1  sitekey
```

Isso confirma e fecha o veredito já registrado em
`src/content/relato/apis-metadados.json` (`"veredito": "inviavel"`). **Nada mudou.**

---

## Caminho 1 — Por que a Plataforma Carlos Chagas consegue

**Em uma frase:** a Carlos Chagas não "puxa o Lattes de fora" — ela **é do CNPq e roda
dentro do CNPq**, lendo o mesmo banco de dados; nós somos um site de fora tentando entrar
pela porta da frente, que está fechada para todo mundo.

A evidência é de rede. Resolvi os quatro nomes:

| Host | IP |
|---|---|
| `carloschagas.cnpq.br` | 200.130.33.4 |
| `buscatextual.cnpq.br` | 200.130.33.2 |
| `servicosweb.cnpq.br` | 200.130.33.33 |
| `lattes.cnpq.br` | 200.130.33.112 |

Mesma faixa `200.130.33.0/24` — mesma infraestrutura, mesma instituição. E a própria
documentação do CNPq diz que a Carlos Chagas "é acessada com a mesma senha do Currículo
Lattes", com os dados dos bolsistas e coordenadores "já integrados" à plataforma
([Informações importantes — Plataforma Carlos Chagas](https://carloschagas.cnpq.br/ajuda/informacoesImportantes.html),
consultado 05/08/2026).

A diferença arquitetural, então, não é de tecnologia, é de **posição**: o preenchimento
automático da Carlos Chagas é uma consulta interna (banco a banco, dentro do datacenter,
com o usuário já autenticado pelo login único do CNPq). Não existe API pública que
reproduza isso, porque nunca houve uma — o "integrado" ali é literalmente "está no mesmo
servidor".

**Veredito:** não replicável. Não é falta de chave nem de convênio: é que o mecanismo que
a Carlos Chagas usa não é exposto ao mundo em nenhuma forma.

---

## Caminho 2 — O web service oficial: `WSCurriculo` / Extrator Lattes

**Ele existe, é real, e o INCT tem direito a ele.** Isso é mais do que eu esperava
encontrar, então vale detalhar — inclusive porque muda a resposta para o *futuro*, ainda
que não para a v1.

### Ele existe — e eu falei com ele

O WSDL é público. Baixei e listei as operações:

```sh
curl -s "https://servicosweb.cnpq.br/srvcurriculo/WSCurriculo?wsdl"
```

```
getCurriculoCompactado
getCurriculoCompactadoPorUsuario
getDataAtualizacaoCV
getDataAtualizacaoCVPorUsuario
getIdentificadorCNPq
getIdentificadorCNPqPorUsuario
getOcorrenciaCV
getOcorrenciaCVPorUsuario
```

`getCurriculoCompactado` é exatamente o que o dono imaginou: **devolve o currículo inteiro
em XML compactado, a partir do ID Lattes de 16 dígitos** — os mesmos 16 dígitos que já
temos para 189 pessoas da equipe, extraídos do PDF da proposta.

Fiz uma chamada SOAP de verdade, do nosso IP, para ver o que acontece:

```xml
<env:Body><ws:getDataAtualizacaoCVResponse …><return>
  <MENSAGEM><ERRO>Serviço negado.IP:45.190.140.159.</ERRO></MENSAGEM>
</return></ws:getDataAtualizacaoCVResponse></env:Body>
```

**"Serviço negado. IP: 45.190.140.159."** — a porta existe, está funcionando, e é trancada
por endereço IP. Não é 404 ("não existe"), é recusa nominal. Melhor prova impossível.

### O trâmite: quem consegue, como e em quanto tempo

A carta de serviços oficial do governo lista o público-alvo, e o INCT está **nomeado**:

> Instituições Científicas, Tecnológicas e de Inovação (ICT); Fundações de apoio; Agências
> de fomento; Núcleo de Inovação Tecnológica (NIT); **Institutos Nacionais de Ciência e
> Tecnologia (INCT)**; Órgãos de pesquisa

— [Obter acesso ao Extrator da Plataforma Lattes, gov.br](https://www.gov.br/pt-br/servicos/obter-acesso-ao-extrator-da-plataforma-lattes) (consultado 05/08/2026)

| Item | Valor |
|---|---|
| **Uma universidade consegue?** | Sim — é o caso típico |
| **Um INCT consegue?** | **Sim, está listado explicitamente** |
| **Custo** | **Gratuito** |
| **Prazo** | Etapa 2: até 72 h · **serviço total: até 5 dias úteis** |
| **Canal** | atendimento@cnpq.br · (61) 3211-4000 |
| **Exige convênio?** | Não necessariamente — formulário + **termo de responsabilidade** com responsável técnico e legal. Quem já tem Protocolo de Cooperação Técnica com o CNPq só manda e-mail |
| **Exige certificado digital?** | Não encontrei exigência de certificado. **NÃO CONFIRMADO** |
| **Exige IP autorizado?** | **Sim — e apenas UM por instituição** |

Requisitos técnicos, nas palavras do CNPq: "Ser Instituição de Ensino e Pesquisa; Possuir
um IP dedicado; Desenvolver solução tecnológica para integração com o Webservice"
([Extrações de dados, Portal Memória CNPq](https://memoria.cnpq.br/web/portal-lattes/extracoes-de-dados)).
Para acordo novo, exige-se "ofício à Presidência do CNPq, devidamente assinado pelo seu
Dirigente máximo, contendo a exposição de motivos"
([Acordos Institucionais](https://memoria.cnpq.br/web/portal-lattes/acordos-institucionais)).

> Uma fonte secundária atribui a regulação à Resolução Normativa nº 01/2023 do CNPq. **Não
> li o texto da resolução — NÃO CONFIRMADO.**

### Por que isso NÃO resolve o formulário

Três obstáculos, em ordem de dureza:

1. **É SOAP servidor-a-servidor, nunca navegador.** Mesmo com o IP liberado, um `fetch()`
   da página continuaria barrado por CORS. O Extrator exige um backend. **Este projeto não
   tem backend:** o site é estático (Hostinger, build local + upload de `dist/`) e não há
   `supabase/functions` no repositório.
2. **Um único IP por instituição.** É restrição documentada e conhecida — a UFSCar
   publicou um proxy com cache justamente para contornar isso internamente
   ([cnpqwsproxy](https://github.com/nitmateriais/cnpqwsproxy/blob/master/README.pt_BR.md)):
   "cada instituição só pode solicitar a liberação de acesso para um único endereço IP".
   Hospedagem compartilhada e funções serverless em geral **não** dão IP de saída fixo.
   *(Se o IP de saída de uma Edge Function do Supabase é fixo: **NÃO CONFIRMADO** — teria
   de ser verificado antes de qualquer plano nessa direção.)*
3. **É responsabilidade institucional, não de um desenvolvedor.** O termo é assinado pelo
   dirigente máximo, e vincula a instituição ao uso dos dados. Não é algo que se ativa numa
   tarde.

**Veredito:** viável institucionalmente (5 dias úteis, grátis, INCT elegível), **inviável
arquiteturalmente na v1** — exigiria criar e manter um servidor com IP fixo que hoje não
existe. Guardar como opção para uma v2, se um dia houver backend.

---

## Caminho 3 — O próprio pesquisador baixa seu XML e sobe no formulário

**Sim, é possível — e é o único caminho que traz o Lattes de verdade para dentro da página
sem servidor nenhum.**

O pesquisador consegue exportar o próprio currículo: entra em `lattes.cnpq.br` → "Atualizar
currículo" → login gov.br (ou CPF+senha) → menu **Exportar** → XML. O arquivo baixa
**compactado em `.zip`**, contendo um XML em ISO-8859-1. Procedimento documentado por
várias instituições, entre elas a
[UFJF/PROPP](https://www2.ufjf.br/propp/wp-content/uploads/sites/20/2024/11/PROPP-Como-gerar-o-arquivo-XML-do-Curr%C3%ADculo-Lattes.pdf)
e a [PUC-Goiás](https://www.pucgoias.edu.br/wp-content/uploads/2023/09/Passo-a-Passo-XML.pdf)
(consultados 05/08/2026).

Tecnicamente o resto é trivial e **100% no navegador, sem servidor**: um `<input
type="file">`, descompactar o zip e ler o XML — a estrutura é conhecida
(`PRODUCAO-BIBLIOGRAFICA` → `ARTIGO-PUBLICADO`, com ano e campo de DOI), e há um ecossistema
maduro de leitores dessa árvore (pacotes `getLattes`, `ChocoLattes`, `scriptLattes`).
Isso **não é scraping** — é o titular exportando o próprio dado e entregando por vontade
própria, o que o Termo de Uso não veda em lugar nenhum.

**Os poréns, que são sérios:**

- **Atrito alto.** São ~6 passos e um login gov.br *antes* de o formulário começar. O dono
  pediu um formulário "mais inteligente e intuitivo"; exigir upload de zip na Tela 1 é o
  oposto disso.
- **O DOI no Lattes é digitado à mão pelo pesquisador.** Se ele não preencheu, não vem — e
  aí o item não pode ser enriquecido por nenhuma API. **Quanto da produção brasileira no
  Lattes traz DOI preenchido: NÃO MEDIDO.** Seria preciso um XML real para dizer, e eu não
  tenho nenhum.
- **Encoding e formato legados.** ISO-8859-1 e DTD antiga; dá trabalho, mas é trabalho
  conhecido.

**Veredito:** tecnicamente viável, sem servidor, juridicamente limpo. **Recomendo como
recurso opcional ("já tenho meu XML do Lattes, quero subir"), nunca como porta de entrada
obrigatória.** Custo: alto (parser de XML legado + descompactação). Prazo: não é caminho
crítico — deixar para depois de a v1 estar no ar.

---

## Caminho 4 — Sincronizar Lattes → ORCID resolveria?

**Aqui eu preciso corrigir uma suposição do enunciado, e ela é importante.**

O que se chama de "integração Lattes–ORCID" **não é uma sincronização de produção**. É
apenas o registro do *número* do ORCID dentro do Lattes: Dados gerais → Identificação →
Outras bases bibliográficas → digitar o ORCID → Validar ID. Como resume a
[Biblioteca do ICBS-UFRGS](https://www.ufrgs.br/bibicbs/integracao-do-orcid-com-o-curriculo-lattes/)
(consultado 05/08/2026): "A integração ocorre pela inclusão do identificador do autor no
Currículo, que gera link direto para a página do autor no site do ORCID."

E onde há transferência de fato, **ela vai na direção contrária à que nos interessa**: o
CNPq oferece importar do ORCID **para dentro** do Lattes. Não há caminho oficial
Lattes → ORCID; o que existe são conversores de terceiros e a rota manual de gerar um
`.bib` e importar no ORCID como BibTeX.

**Conclusão:** pedir "sincronize seu Lattes com o ORCID" **não** faria a produção aparecer
no ORCID. O pedido estaria tecnicamente errado e o pesquisador não conseguiria cumprir.

### Mas existe o caminho certo — e ele é ótimo

O que de fato popula um registro ORCID **não é o Lattes: são as editoras**, via
**Crossref/DataCite auto-update**. O autor informa o ORCID na submissão do artigo e
autoriza o Crossref uma única vez; a partir daí, "o Crossref atualizará automaticamente o
registro com qualquer publicação futura que contenha seu ORCID iD", e a permissão é de
longa duração, revogável a qualquer momento
([Crossref — ORCID auto-update](https://www.crossref.org/community/orcid/), consultado
05/08/2026; serviço lançado em
[26/10/2015](https://www.crossref.org/news/2015-10-26-orcid-launches-crossref-and-datacite-auto-update/)).

**Passo a passo real para o pesquisador (este funciona):**

1. Ter ORCID iD em <https://orcid.org>.
2. **Usar o ORCID na submissão** de cada artigo, no sistema da revista.
3. Ao publicar, chega uma notificação no e-mail e na caixa do ORCID pedindo permissão ao
   Crossref → **conceder permissão duradoura** (uma vez só, para sempre).
4. Opcional, para o passivo antigo: ORCID → Works → *Search & link* (Crossref Metadata
   Search, DataCite, Scopus) e importar o que já existe.

Note que **nada disso passa pelo Lattes** — e é exatamente por isso que funciona.

**Veredito:** o ORCID é um bom canal, mas *não* por sincronia com o Lattes (que não
existe). E, como mostro abaixo, **o registro ORCID do pesquisador é a pior das três
fontes** — então nem ele deve ser o alicerce.

---

## Caminho 5 — OpenAlex e Crossref, sem tocar no Lattes: quanto se recupera de verdade

Medi com **dois pesquisadores reais do INCT**, tirados da seção EQUIPE do PDF da proposta
(190 URLs de Lattes, 189 distintas, extraídas com pypdf):

| Pesquisador | ID Lattes (do PDF) | ORCID (achado via OpenAlex) |
|---|---|---|
| **Alice Maria Costa Martins** (UFC) | `7532334620264577` | `0000-0001-8160-2027` |
| **Marcos Roberto de Mattos Fontes** (UNESP) | `4320362411241786` | `0000-0002-4634-6221` |

Detalhe que já responde meia pergunta: **eu descobri o ORCID dos dois partindo apenas do
nome**, com `api.openalex.org/authors?search=…` — 28 candidatos para a primeira (o correto
em 1º, com instituição "Universidade Federal do Ceará", 200 trabalhos, 2801 citações) e 2
para o segundo. Ou seja, **a busca por nome da Tela 1 pode devolver o ORCID sozinha**, sem
o pesquisador saber o que é ORCID.

### Produção recuperada na janela do Ciclo 1 (2025-05-01 → 2026-04-30)

| Fonte | Alice (UFC) | Marcos (UNESP) |
|---|---|---|
| Registro ORCID do próprio pesquisador | 3 | 4 |
| **Crossref** filtrado por ORCID | 6 | 2 |
| **OpenAlex** filtrado por ORCID | **18** | 2 |
| **UNIÃO das três** | **20** | **6** |
| Interseção Crossref ∩ OpenAlex | 4 | **0** |

### Três achados que mudam o desenho

**1. O registro ORCID do pesquisador é a PIOR fonte.** Para a Alice, o ORCID dela tem 3
itens na janela; o OpenAlex encontra 18 — **seis vezes mais**. Confiar no ORCID como fonte
de descoberta é jogar fora a maior parte da produção. Isso refina o achado AC-2 do
`apis-metadados.json`: o problema não é só que o ORCID vem magro — é que **existe muito
mais disponível, em outro lugar, de graça**.

**2. Crossref e OpenAlex podem ser DISJUNTOS.** No caso do Marcos, cada um devolveu 2
itens e **a interseção foi ZERO** — quatro DOIs diferentes. Nenhum provedor sozinho está
correto. **Consultar os dois e unir é obrigatório**, não é redundância.

**3. Nenhuma fonte contém as outras.** O registro ORCID do Marcos tinha 2 DOIs que nem
Crossref nem OpenAlex trouxeram (`10.1016/j.phymed.2025.156615`,
`10.1016/j.phytochem.2025.114446`). Ou seja: as três somam, e a união (6) é maior que
qualquer uma (4, 2, 2).

> **Ressalva metodológica, para não inflar o resultado:** minha contagem no registro ORCID
> **excluiu** trabalhos com data só de ano, porque não dá para saber se caem na janela.
> Isso é muito: 9 de 32 (28%) na Alice e **138 de 198 (70%)** no Marcos. Portanto os
> números da linha "registro ORCID" são **piso, não valor exato**. A conclusão de que o
> ORCID é a fonte mais fraca continua de pé (a comparação Alice 3 vs 18 é grande demais
> para se explicar por isso), mas a magnitude exata é incerta.

**Veredito:** **este é o caminho que funciona hoje.** CORS aberto, sem chave, sem convênio,
sem servidor — e `src/relato/metadados.ts` já fala Crossref, OpenAlex, DataCite, ORCID e
doi.org. O que falta não é infraestrutura nova: é **passar a consultar por ORCID/nome
(descoberta), unindo Crossref + OpenAlex**, em vez de só resolver DOI colado.

---

## Caminho 6 — Scraping de `lattes.cnpq.br`: a situação e a conclusão

**Não testei nenhuma forma de burlar nada, e não recomendo que se teste.** Registro apenas
o que é observável e o que dizem os termos.

**Situação técnica:** há reCAPTCHA do Google na visualização de currículo (evidência no
corpo da resposta: `google.com/recaptcha`, `sitekey`, `captcha.render`,
`captcha.getResponse`). A busca depende de sessão (`JSESSIONID`) e devolve HTML em
ISO-8859-1. Não há `robots.txt` em `lattes.cnpq.br`, `buscatextual.cnpq.br` nem
`servicosweb.cnpq.br` — os três voltaram vazios. **A ausência de `robots.txt` não é
permissão**: o Termo de Uso é o documento que rege, e ele é explícito.

**Situação jurídica** — [Termo de Uso da Plataforma Lattes](https://memoria.cnpq.br/web/portal-lattes/termo-de-uso)
(consultado 05/08/2026):

> "o usuário se obriga a não utilizar robôs, sistemas de varredura e armazenamento de dados
> (como 'spiders' ou 'scrapers'), links escondidos ou qualquer outro recurso escuso,
> ferramenta, programa, algoritmo ou método coletor/extrator de dados automático."

E ainda: "é vedada a utilização do serviço para finalidades comerciais, publicitárias ou
qualquer outra que contrarie a finalidade para a qual foi concebido", com responsabilidade
do usuário por "todo e qualquer dano, direto ou indireto" ao CNPq.

**Conclusão:** proibido por escrito, protegido por CAPTCHA, e — o agravante que decide a
questão — **o INCT é financiado pelo próprio CNPq** (processo 408474/2024-6). Violar o
termo de uso da plataforma do financiador, num sistema construído com dinheiro dele, é um
risco institucional desproporcional a qualquer economia de digitação. **Não fazer. Em
nenhuma variante.**

---

## Quadro-resumo

| # | Caminho | Funciona? | Custo | Prazo | Veredito |
|---|---|---|---|---|---|
| 1 | Como a Carlos Chagas faz | **Não** | — | — | Não replicável: ela roda *dentro* do CNPq |
| 2 | WSCurriculo / Extrator Lattes | **Sim, mas** | Backend + IP fixo (não existem hoje) | 5 dias úteis, grátis | INCT é elegível; inviável sem servidor. **v2** |
| 3 | XML do próprio currículo, por upload | **Sim** | Parser XML legado + unzip | — | Opcional, nunca obrigatório |
| 4 | Sincronia Lattes → ORCID | **Não existe** | — | — | A sincronia oficial é ORCID→Lattes. Use Crossref auto-update |
| 5 | **OpenAlex + Crossref por ORCID/nome** | **Sim** | Baixo — o módulo já existe | Imediato | ✅ **É o caminho** |
| 6 | Scraping | **Não** | — | — | Proibido pelo Termo de Uso + CAPTCHA |

---

## Recomendação

**Seguir o caminho 5, e desenhar a Tela 1 em torno dele.** Concretamente:

1. **A busca do dono não precisa do Lattes para nada.** O roster das 209 pessoas sai do PDF
   da proposta — nome, titulação, instituição, área, carga horária, responsabilidade e ID
   Lattes já estão lá, em estrutura regular. A busca com dropdown que ele pediu é uma busca
   **local**, instantânea, sem rede. É melhor que qualquer API: não falha, não tem cota,
   funciona offline.

2. **Depois de identificado, buscar a produção por ORCID — unindo Crossref e OpenAlex.**
   Foi o que a medição mostrou: a união recupera 20 itens onde o ORCID sozinho dava 3. Se a
   pessoa não souber o ORCID, achar pelo nome no OpenAlex (funcionou para os dois testados)
   e pedir confirmação humana antes de aceitar.

3. **Guardar o ID Lattes como campo declarado** — ele vem de graça do PDF e é o ponteiro
   para conferência humana e para a prestação de contas ao CNPq. Manter o aviso de que é do
   Lattes que o CNPq vai contar a produção. **Nunca** usá-lo como fonte de autopreenchimento.

4. **Oferecer o upload do XML do Lattes como atalho opcional**, depois da v1, para quem
   quiser. Nunca como porta de entrada.

5. **Escrever ao CNPq pedindo o Extrator?** Vale — é grátis, são 5 dias úteis, e o INCT é
   elegível. Mas **como aposta de longo prazo, desacoplada do formulário**: só passa a ter
   utilidade no dia em que existir um servidor com IP fixo. Não deixar a Tela 1 esperando
   por isso.

**O ponto que eu levaria ao dono:** ele pediu que os dados viessem do Lattes porque o
Lattes é o que ele conhece. Mas para o que a Tela 1 precisa — *quem é você* — a resposta
**já está no PDF da proposta que ele mesmo submeteu**, e é mais confiável que o Lattes,
porque é o que foi oficialmente declarado ao CNPq neste projeto. E para *o que você
produziu*, Crossref+OpenAlex recuperam mais do que o próprio ORCID do pesquisador. O
Lattes, aqui, não é a fonte que falta: é a fonte que dá mais trabalho e entrega menos.

---

## O que NÃO consegui confirmar

- **Texto da Resolução Normativa nº 01/2023 do CNPq** que regeria o Extrator — veio de
  fonte secundária, não li o original.
- **Exigência (ou não) de certificado digital** no trâmite do Extrator — não encontrei
  menção; ausência de menção não é prova de ausência.
- **Se uma Edge Function do Supabase tem IP de saída fixo** — decisivo para o caminho 2, e
  precisaria ser verificado antes de qualquer plano nessa direção.
- **Percentual de itens do Lattes que trazem DOI preenchido** — não tenho nenhum XML real
  para medir; é o que decide se o caminho 3 vale a pena.
- **Projeto "CONECTI BRASIL"** (interoperabilidade CNPq/CAPES/ORCID) — apareceu em busca,
  sem fonte primária. Se for real e entrar em produção, muda o caminho 4. Vale reavaliar
  em 2027.
- **Comportamento do `WSCurriculo` com IP autorizado** — obviamente não testável daqui.
  Sabemos que a porta existe e recusa por IP; não sabemos a qualidade nem a latência do
  que ela devolve quando aberta.
- **A amostra do caminho 5 é de 2 pesquisadores**, escolhidos por serem sêniores e de alta
  produção. Não é uma amostra da rede: os 13 alunos de ensino médio e graduação do roster
  terão comportamento muito diferente (provavelmente zero em todas as fontes).
