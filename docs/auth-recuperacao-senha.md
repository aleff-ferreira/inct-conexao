# Recuperação de senha — diagnóstico de configuração (Supabase + Brevo)

**Para:** Aleff Ferreira — INCT-CONEXÃO BIO3TOX (CNPq 408474/2024-6)
**Sintoma relatado:** "o link de recuperação vai para o e-mail mas abre a página inicial da webpage"
**Projeto Supabase:** `ssrbepevacnxqiakykfc` (`https://ssrbepevacnxqiakykfc.supabase.co`)
**Apuração feita em:** 06/08/2026
**Escopo deste documento:** só o que se resolve **no painel** (Supabase e Brevo). O conserto de código está na tarefa A.

---

## 1. Resposta direta

### A causa

O link de recuperação **está falhando antes de você clicar**, e quando ele falha o Supabase reescreve o endereço de volta de um jeito que **apaga a rota do site**. Por isso a pessoa cai na home e nada acontece.

O mecanismo, medido e confirmado (evidência na seção 2):

1. O link do e-mail é de **uso único**. Ele é consumido no primeiro acesso HTTP — não importa se quem acessou foi um humano ou um robô.
2. Entre o Supabase e o seu olho existem **dois robôs que abrem links automaticamente**: o rastreador de cliques da **Brevo** (que reescreveu o link para `sendibt3.com`) e o **Safe Links do Microsoft Defender / Outlook** (o aviso "Some content in this message has been blocked" no print confirma que a mensagem passou pela filtragem da Microsoft).
3. Quando o token já foi gasto, o Supabase responde `303` para
   `https://inct-conexao.com.br/#error=access_denied&error_code=otp_expired&...`
   — **o `#/gestao` original é jogado fora e substituído pelo erro**. Como o site roteia por hash, `#error=...` não é rota nenhuma → `parseHash` devolve `home` → **página inicial**.

### Por que o link mágico funciona e o de senha não

Não é diferença entre os dois tipos de link. É diferença entre **sucesso e erro**:

| Caminho | O que o Supabase faz com o endereço de volta | Onde a pessoa cai |
|---|---|---|
| **Sucesso** (PKCE) | acrescenta `?code=...` na **query** e **preserva** o fragmento | `https://inct-conexao.com.br/?code=...#/gestao` → rota certa, funciona |
| **Erro** (token gasto/expirado) | **sobrescreve o fragmento inteiro** com o erro | `https://inct-conexao.com.br/#error=...` → **home** |

Ou seja: o link mágico funcionou porque **deu certo**. O de recuperação cai na home porque **deu erro** — e no erro a rota é destruída. Confirmado no código-fonte do Supabase (seção 2.3).

> **Consequência importante:** **nenhuma configuração de painel conserta o caso de erro.** Config só reduz a *frequência* do erro. Fazer o site reagir a `#error=...` / `?error=...` na raiz e mostrar uma tela de nova senha é **código** (tarefa A).

### Hipóteses da tarefa, decididas

| Hipótese | Veredito |
|---|---|
| (a) `redirect_to` fora da allowlist → cai no Site URL | **REFUTADA.** Medido: `https://inct-conexao.com.br/#/gestao` é aceito. A allowlist tem `https://inct-conexao.com.br/**`. |
| (b) o `?code=` volta dentro do fragmento e o SDK não acha | **REFUTADA no caminho de sucesso.** O GoTrue põe o `code` na query *antes* do `#`. (Ressalva na seção 4.) |
| (c) token consumido por rastreador antes do clique humano | **MAIS PROVÁVEL.** Compatível com todo o sintoma; dois rastreadores comprovadamente no caminho. Não é possível provar *qual* dos dois sem um teste controlado (seção 5.6). |
| (d) combinação | Sim: (c) dispara o erro, e o descarte do fragmento pelo GoTrue transforma o erro em "abriu a home". |

### O que fazer, nesta ordem

| # | Ação | Onde | Tempo | Efeito |
|---|---|---|---|---|
| 1 | **Traduzir e identificar o e-mail** (texto pronto na seção 6) | Supabase → Authentication → Emails → Templates → *Reset Password* | 10 min | Reduz bloqueio/phishing; e-mail em inglês sem remetente identificado é o pior cenário no Outlook |
| 2 | **Ativar "Anonymous email tracking" na Brevo** e **abrir chamado pedindo desativação do rastreamento de cliques** | Brevo → Settings → Transactional emails → Tracking | 10 min + chamado | Anonimizar **não** tira o `sendibt3.com` do caminho (seção 5.2); o chamado é o único caminho oficial |
| 3 | **Confirmar a allowlist** (já está certa — só não mexa) | Supabase → Authentication → URL Configuration | 2 min | Elimina a hipótese (a) de vez |
| 4 | **Trocar o provedor de SMTP** por um que permita desligar rastreamento de cliques (Resend, Amazon SES, Postmark, Mailgun) | Supabase → Authentication → Emails → SMTP Settings | 30 min | **Tira um dos dois robôs do caminho.** É a única ação de painel com efeito real e imediato sobre a causa |
| 5 | Ativar a página de confirmação com clique + código de 6 dígitos | Depende da tarefa A | — | Imuniza contra o robô que sobrar (Safe Links) |

Se você só puder fazer **uma** coisa hoje: **item 4** (trocar o SMTP). Se puder fazer duas: **4 + 1**.

---

## 2. A evidência (mediada, não deduzida)

Tudo abaixo foi obtido com uma sonda **sem efeito colateral**: um `GET` no endpoint público `/auth/v1/verify` com um token propositalmente inválido. Não envia e-mail, não cria nem apaga nada, não usa chave de serviço. Você pode repetir:

```sh
curl -sS -o /dev/null -D - --max-redirs 0 \
  -G "https://ssrbepevacnxqiakykfc.supabase.co/auth/v1/verify" \
  --data-urlencode "token=0000000000000000000000000000000000000000000000000000000000000000" \
  --data-urlencode "type=recovery" \
  --data-urlencode "redirect_to=https://inct-conexao.com.br/#/gestao"
```

### 2.1 O fragmento é destruído no erro

```
HTTP/1.1 303 See Other
Location: https://inct-conexao.com.br/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=
```

O `#/gestao` **sumiu**. É exatamente o sintoma relatado, reproduzido em laboratório.

### 2.2 A allowlist já está correta — e qual é o formato dela

| `redirect_to` enviado | `Location` devolvido | Leitura |
|---|---|---|
| `https://inct-conexao.com.br/#/gestao` | `https://inct-conexao.com.br/` | **aceito** |
| `https://inct-conexao.com.br/caminho-inventado` | `https://inct-conexao.com.br/caminho-inventado` | **aceito** → há curinga |
| `https://inct-conexao.com.br/a/b/c` | `https://inct-conexao.com.br/a/b/c` | **aceito** → curinga é `**` |
| `https://inct-conexao.com.br/?x=1` | `https://inct-conexao.com.br/?x=1` | **aceito**, query preservada |
| `https://inct-conexao.com.br` (sem barra) | `https://inct-conexao.com.br` | **recusado** → caiu no Site URL |
| `https://sub.inct-conexao.com.br/` | `https://inct-conexao.com.br` | **recusado** |
| `https://inct-conexao.com.br.evil.com/` | `https://inct-conexao.com.br` | **recusado** (correto) |
| `http://localhost:4173/` | `http://localhost:4173/` | **aceito** |
| `http://localhost:4173/x` | `http://localhost:4173/x` | **aceito** → também é `/**` |
| `http://localhost:5173/` | `https://inct-conexao.com.br` | **recusado** (dev do Vite não está na lista) |

Conclusões:

- **Site URL = `https://inct-conexao.com.br`** (sem barra final) — é para onde tudo que não casa é jogado.
- A allowlist contém, no mínimo, `https://inct-conexao.com.br/**` e `http://localhost:4173/**`.
- **O fallback para o Site URL é real e foi observado** — isso confirma a doutrina documentada ("Should the redirect parameter not fall in the URL allow list, the Site URL is used").
- **Hipótese (a) está refutada** para o endereço de produção.

### 2.3 O código-fonte do Supabase confirma a assimetria

`supabase/auth`, `internal/api/verify.go` (consultado em 06/08/2026, branch `master`):

```go
// SUCESSO, fluxo PKCE — o code vai na QUERY; o fragmento não é tocado
func (a *API) prepPKCERedirectURL(rurl, code string) (string, error) {
	u, err := url.Parse(rurl)
	if err != nil { return "", err }
	q := u.Query()
	q.Set("code", code)
	u.RawQuery = q.Encode()
	return u.String(), nil
}
```

```go
// ERRO — o fragmento é SOBRESCRITO, sempre
func (a *API) prepErrorRedirectURL(err *HTTPError, r *http.Request, rurl string, flowType models.FlowType) (string, error) {
	u, perr := url.Parse(rurl)
	...
	hq := url.Values{}
	hq.Set("error_code", err.ErrorCode)
	hq.Set("error_description", err.Message)
	if flowType == models.PKCEFlow {
		u.RawQuery = q.Encode()
	}
	// Left as hash fragment to comply with spec.
	hq.Set("sb", "")
	u.Fragment = hq.Encode()   // <<< aqui morre o "#/gestao"
	return u.String(), nil
}
```

Fonte: <https://github.com/supabase/auth/blob/master/internal/api/verify.go> (06/08/2026).

Nota: na sonda o erro veio **só** no fragmento porque, sem `code_challenge`, o GoTrue tratou como fluxo implícito. No fluxo real (PKCE) o erro vem **nos dois lugares** — query *e* fragmento. Isso importa para a tarefa A: o código precisa olhar `location.search` **e** `location.hash`.

---

## 3. Item 1 — Redirect URLs e Site URL no Supabase

### Como funciona

- O Supabase Auth mantém uma **allowlist** consultada **antes** de emitir o redirecionamento, para impedir *open redirect*.
- **Se o `redirect_to` não casar com nenhuma entrada, o Supabase usa o Site URL** — que aqui é a home. Foi o que mediu a tabela 2.2 (linhas "recusado").
- O Site URL também é o destino padrão quando **nenhum** `redirectTo` é passado no código.
- Curingas suportados (documentação oficial):

| Padrão | Significado |
|---|---|
| `*` | "matches any sequence of non-separator characters" |
| `**` | "matches any sequence of characters" |
| `?` | "matches any single non-separator character" |
| `\c` | casa o caractere `c` literalmente |
| `[!{range}]` | casa qualquer sequência **fora** do intervalo |

  E, textualmente: *"The separator characters in a URL are defined as `.` and `/`."*
  Fonte: <https://supabase.com/docs/guides/auth/redirect-urls> (consultado 06/08/2026).

### O fragmento (`#`) participa do casamento?

**NÃO CONFIRMADO.** A documentação não diz nada sobre fragmento. O que foi **medido**:

- `https://inct-conexao.com.br/#/gestao` **passa** pela allowlist;
- não dá para distinguir "o fragmento foi descartado antes de comparar" de "o `**` engoliu o `#/gestao`", porque a entrada em uso já é `/**`, que casa qualquer coisa.

Na prática **dá no mesmo**: com `https://inct-conexao.com.br/**` cadastrado, qualquer rota por hash passa. Não invente uma entrada com `#` — não há fonte que garanta o comportamento.

### O que preencher

**Supabase Dashboard → seu projeto → Authentication → URL Configuration**
(link direto: `https://supabase.com/dashboard/project/ssrbepevacnxqiakykfc/auth/url-configuration`)

| Campo | Valor |
|---|---|
| **Site URL** | `https://inct-conexao.com.br` |
| **Redirect URLs** | `https://inct-conexao.com.br/**` |
| | `http://localhost:4173/**` |
| | `http://localhost:5173/**` ← **acrescentar** (dev do Vite; hoje não está) |

Detalhes que custam caro se esquecidos:

- **A barra antes do `**` é obrigatória.** Medido: `https://inct-conexao.com.br` (sem barra) **não** casa com `https://inct-conexao.com.br/**` e cai no Site URL.
- Não use `https://**.inct-conexao.com.br/**` — abre a porta para subdomínios que você não controla. Medido: hoje subdomínio é (corretamente) recusado.
- Depois de salvar, **repita a sonda da seção 2** para conferir.

---

## 4. Item 2 — PKCE e o retorno do `code`

O cliente do site está em `flowType: "pkce"` (`src/platform/supabaseClient.ts`). O que a documentação oficial diz:

- No PKCE, "a redirect is made to your app, with an Auth Code contained in the URL"; o `code` é trocado por sessão com `exchangeCodeForSession(code)`; **"the code has a validity of 5 minutes and can only be exchanged for an access token once"**.
  Fonte: <https://supabase.com/docs/guides/auth/sessions/pkce-flow> (06/08/2026).
- O PKCE usa **query string**; o fluxo implícito é que usa fragmento.

### E se o `code` vier no fragmento?

Duas respostas, e as duas importam:

1. **No caminho normal ele não vem.** Medido/confirmado no fonte: `prepPKCERedirectURL` põe o `code` em `u.RawQuery`, e o `u.String()` do Go monta `esquema://host/caminho?query#fragmento` — **a query vem antes do `#`**. Então o retorno de um reset bem-sucedido é
   `https://inct-conexao.com.br/?code=...#/gestao` — `location.search` enxerga o `code` normalmente. **Foi por isso que o link mágico funcionou.**

2. **Se viesse, quebraria.** O SDK instalado (`@supabase/auth-js` 2.110.0) lê parâmetros **da query e do fragmento**:

   ```js
   /** Extracts parameters encoded in the URL both in the query and fragment. */
   export function parseParametersFromURL(href) { ... new URLSearchParams(url.hash.substring(1)) ... }
   ```

   Só que ele trata o fragmento como **uma query string inteira**. Com roteamento por hash, o fragmento é `#/gestao?code=abc` — e `new URLSearchParams("/gestao?code=abc")` produz a chave **`/gestao?code`**, não `code`. Resultado: `params.code` fica `undefined`, `_isPKCECallback()` devolve `false` e **nada acontece, sem erro nenhum na tela**.
   (Arquivos: `node_modules/@supabase/auth-js/dist/module/lib/helpers.js:66` e `.../GoTrueClient.js:3271`.)

   Isto é matéria da tarefa A, mas registre-se: **não confie no fragmento para carregar o `code`.**

### O outro modo de falhar em silêncio (vale um aviso aos usuários)

O PKCE guarda um `code-verifier` no `localStorage` **do navegador que pediu o reset**:

```js
async _isPKCECallback(params) {
  const currentStorageContent = await getItemAsync(this.storage, `${this.storageKey}-code-verifier`);
  return !!(params.code && currentStorageContent);
}
```

Se a pessoa **pede o reset no computador e abre o e-mail no celular** (ou em outro navegador, ou numa aba anônima), o verifier não existe lá e o `code` é **ignorado sem mensagem**. É um segundo caminho para "não aconteceu nada".

**Ação de painel:** nenhuma — não há configuração que resolva. **Ação de texto:** o e-mail proposto na seção 6 já avisa "abra este link **no mesmo navegador** em que você pediu a troca".

---

## 5. Item 3 — O rastreador de e-mail (a hipótese principal)

### 5.1 O que os robôs fazem, com fonte

**Microsoft Defender / Safe Links** — documentação oficial (atualizada em 22/05/2026):

- *"Safe Links provides URL scanning and rewriting of inbound email messages during mail flow, and time-of-click verification of URLs…"*
- *"As long as Safe Links protection is turned on, **URLs are scanned prior to message delivery**, regardless of whether the URLs are rewritten or not."*
- *"URLs that don't have a valid reputation are **detonated asynchronously in the background**."*

Fonte: <https://learn.microsoft.com/en-us/defender-office-365/safe-links-about> (06/08/2026).

"Escanear antes da entrega" e "detonar em segundo plano" significam, em português claro: **a Microsoft abre o link antes de você.** Um link de uso único, aberto pela Microsoft, já era.

O print do Outlook ("Some content in this message has been blocked because the sender isn't in your Safe senders list") mostra que a mensagem **passou pela filtragem da Microsoft e foi tratada como não-confiável** — que é exatamente a condição que dispara o exame mais agressivo do link.

**Brevo** — reescreveu o link para `sendibt3.com`. O tracker é um redirecionador: quando *qualquer coisa* abre a URL da Brevo, ela repassa para o destino real, ou seja, **consome o token do Supabase**. Um único robô que abra o link `sendibt3.com` gasta o token.

**Supabase reconhece o problema** na própria documentação:

- *"Certain email providers may have spam detection or other security features that prefetch URL links from incoming emails (e.g. Safe Links in Microsoft Defender for Office 365)."*
  Fonte: <https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching> (06/08/2026).
- Página de solução de problemas: *"email prefetching is a mechanism used by email clients or security tools to automatically scan and sometimes access URLs embedded in emails"* → produz `otp_expired`.
  Fonte: <https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0> (06/08/2026).

Relatos idênticos ao seu:

- "Outlook Safelink invalidates login token" — supabase/discussions **#28903** (27/08/2024): o Outlook embrulha a URL, o token é invalidado no redirecionamento e a pessoa vai parar numa página de erro. O colaborador do Supabase (GaryAustin1) aponta o *email prefetching* como a solução documentada.
  <https://github.com/orgs/supabase/discussions/28903>
- "Magic links and password reset tokens consumed by email scanners in institutional environments" — supabase/discussions **#41618** (última movimentação em 14/01/2026): *"instead, we wrap it inside the URL fragment of an intermediate landing page, for example: `/auth/reset_password/start#confirm={{ .ConfirmationURL }}`"* — porque fragmentos não são baixados por scanners.
  <https://github.com/orgs/supabase/discussions/41618>

### 5.2 (a) Como desligar o rastreamento de cliques na Brevo — passo a passo

**A verdade desconfortável primeiro:** na Brevo, **não existe botão para desligar rastreamento de cliques em e-mail transacional** nos planos comuns. Resposta oficial da equipe da Brevo no fórum:

> *"Disabling tracking will be available, upon request and to our Enterprise plans."*

E, antes disso: *"Link tracking enables us to keep the platform secure and prevent fraudulent sending."* (Adam, Brevo, 04/10/2025). A thread segue aberta e sem solução — último post em 12/02/2026.
Fonte: <https://community.brevo.com/t/no-way-to-disable-by-option-tracking-in-transactional-e-mail/201> (06/08/2026).

O que **existe** e o que **cada coisa resolve**:

**Passo 1 — Ativar a anonimização (5 min, faça, mas não espere milagre)**

1. Entre em <https://app.brevo.com>.
2. Clique no **nome da sua conta** (canto superior direito) → **Settings**.
3. Vá em **Transactional emails** → aba **Tracking**.
   (Em contas mais antigas o caminho aparece como *Settings → Automations → Transactional emails → Tracking*.)
4. Em **Anonymous email tracking**, marque **Yes**.
5. Leia o aviso, clique em **Activate** e depois em **Save** (canto superior direito).

Fonte do caminho: <https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails> (06/08/2026 — a página bloqueia leitura automatizada; o caminho acima foi obtido do resumo indexado e **deve ser conferido na tela**: marque como **NÃO CONFIRMADO** até você ver com os próprios olhos).

> **Atenção — isto NÃO resolve o seu problema.** Anonimizar muda **o que é registrado**, não **o formato do link**. O link continua sendo reescrito para `sendibt3.com`, e continua sendo consumível por qualquer robô. Um usuário da própria thread aponta isso: os links rastreados continuam passando pelo domínio da Brevo antes de chegar ao destino. Faça mesmo assim (é higiene de privacidade, e o público é de pesquisadores), mas **não conte com isso**.

**Passo 2 — Abrir chamado pedindo a desativação (10 min, é o caminho oficial)**

1. Em <https://app.brevo.com>, menu de ajuda → **Contact support** (ou <https://help.brevo.com> → *Submit a request*).
2. Texto sugerido:

   > Assunto: Desativar o rastreamento de cliques (click tracking) em e-mails transacionais
   >
   > Nossa conta envia exclusivamente e-mails transacionais de autenticação (redefinição de senha e link de acesso) gerados pelo Supabase Auth. São links de **uso único**. A reescrita dos links para o domínio de rastreamento (`sendibt3.com`) faz com que scanners de segurança de e-mail (Microsoft Defender Safe Links) consumam o token antes do destinatário clicar, e o usuário recebe "link inválido ou expirado". Solicito a desativação do rastreamento de cliques para esta conta, conforme indicado pela equipe da Brevo no tópico https://community.brevo.com/t/no-way-to-disable-by-option-tracking-in-transactional-e-mail/201 ("Disabling tracking will be available, upon request").

3. Guarde o número do chamado. **Não pare aqui** — siga para o passo 3, porque a resposta pode ser "só no Enterprise".

**Passo 3 — Trocar o provedor de SMTP (a ação que realmente resolve)**

Provedores em que desligar o rastreamento de cliques é uma opção de painel/API, com plano gratuito suficiente para o volume de um edital:

| Provedor | Situação do rastreamento de cliques |
|---|---|
| **Resend** | não reescreve links por padrão |
| **Amazon SES** | *configuration set* sem *click tracking* — padrão é não rastrear |
| **Postmark** | `TrackLinks` desligável por mensagem/stream |
| **Mailgun** / **SendGrid** | *click tracking* é chave liga/desliga na conta |

*(Estas capacidades são de conhecimento geral do setor; **NÃO CONFIRMADO** por consulta às páginas de documentação de cada um nesta apuração. Confira na documentação do escolhido antes de migrar.)*

Como trocar:

1. Crie a conta no provedor e **valide o domínio** `inct-conexao.com.br` (SPF/DKIM/DMARC nos registros DNS — na Hostinger, hPanel → *DNS Zone Editor*).
2. Supabase → **Authentication → Emails → SMTP Settings**
   (`https://supabase.com/dashboard/project/ssrbepevacnxqiakykfc/auth/smtp`).
3. Preencha host, porta, usuário e senha do novo provedor. Em **Sender email** use algo como `nao-responda@inct-conexao.com.br`; em **Sender name**, `INCT-CONEXAO BIO3TOX`.
4. **Desligue o rastreamento de cliques** no painel do novo provedor.
5. Teste com um endereço `@outlook.com` **e** um institucional (`@ufmg.br`, `@usp.br`…), que são os mais protegidos por Safe Links.
6. Só depois desative a Brevo.

> Deixar o SMTP em branco não é opção: o remetente padrão do Supabase é fortemente limitado em taxa e não serve para um edital.

### 5.3 (b) O Supabase tem OTP numérico para recuperação, imune a prefetch?

**Sim.** Está confirmado em dois lugares:

1. A variável **`{{ .Token }}`** existe e é *"6-digit One-Time-Password"* — documentação oficial de templates.
   <https://supabase.com/docs/guides/auth/auth-email-templates> (06/08/2026).
2. O SDK instalado aceita `recovery` como tipo de verificação por e-mail. Nos tipos do `@supabase/auth-js` 2.110.0 (`dist/module/lib/types.d.ts:693`):

   ```ts
   export type EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email' | (string & {});
   ```

   e `VerifyEmailOtpParams` = `{ email, token, type }`. Ou seja, `supabase.auth.verifyOtp({ email, token, type: 'recovery' })` é uma chamada válida.

Um código de 6 dígitos **não é um link**: nenhum scanner o "clica". É a única solução **totalmente imune** ao prefetch. A própria documentação do Supabase lista essa como a **primeira** mitigação recomendada: usar `{{ .Token }}` e mandar a pessoa para uma página onde ela digita e-mail + código.

**Limitação honesta:** hoje o site **não tem** essa tela. Colocar `{{ .Token }}` no e-mail sem a tela correspondente não serve para nada. Isto é **tarefa A**. O que você faz no painel é: (i) manter o `{{ .Token }}` no template desde já, para que o e-mail já saia com o código, e (ii) ativar a tela quando a tarefa A entregar.

Um alerta de expectativa: já se leu por aí que "`{{ .Token }}` só serve para cadastro e telefone". **É falso** para a versão em uso — o tipo `recovery` está explicitamente no SDK, como transcrito acima.

### 5.4 (c) O que o Supabase recomenda oficialmente

Da seção *Email prefetching* da documentação (transcrição condensada, 06/08/2026):

1. **OTP:** usar `{{ .Token }}` e criar uma página própria onde a pessoa digita e-mail + código, verificando com `supabase.auth.verifyOtp`.
2. **Página intermediária com botão:** apontar o e-mail para uma página sua, passando o link real como parâmetro — por exemplo `{{ .SiteURL }}/confirm-signup?confirmation_url={{ .ConfirmationURL }}` — e exigir um clique humano no botão para só então consumir o token.
3. **Endpoint próprio com `token_hash`:** apontar o link para uma página/endpoint seu com `?token_hash={{ .TokenHash }}&type=recovery`, e chamar `verifyOtp` a partir dali.

E, da página de solução de problemas do `otp_expired`: revisar as opções do provedor de e-mail para impedir o prefetch, redesenhar o link para que o token só seja consumido **depois** de uma ação explícita, e orientar os usuários a não encaminhar o e-mail.

A comunidade acrescenta uma quarta, mais forte que a (2): **esconder o link dentro do fragmento** da página intermediária — `.../recuperar#confirm={{ .ConfirmationURL }}` — porque fragmentos não trafegam na requisição HTTP e nenhum scanner os busca (discussão #41618).

> **Ressalva importante para o seu caso, e é NÃO CONFIRMADA:** com a Brevo no caminho, **não se sabe se o rastreador preserva o fragmento** ao reescrever o link. Se a Brevo descartar o `#...`, o truque do fragmento morre. Por isso, entre as opções, a mais robusta **na sua configuração atual** é a combinação: **página própria com `token_hash` na query + botão de clique explícito + código de 6 dígitos como alternativa digitável**. Nenhuma delas depende do fragmento sobreviver.

### 5.5 Um efeito colateral que você deve conhecer

Se o robô da Brevo/Microsoft **consumir** o token, ele não só invalida o link: em alguns cenários ele **completa a autenticação** do lado do servidor. Não há vazamento de sessão para o robô no fluxo PKCE (o robô não tem o `code_verifier`), mas o registro de "clique" no painel da Brevo vai mostrar cliques que nenhum humano deu. Não se assuste com isso nos relatórios.

### 5.6 Como provar qual dos dois robôs é o culpado (teste controlado, 15 min)

Se quiser certeza antes de trocar de provedor:

1. Peça uma recuperação para um endereço **Gmail** (Gmail não faz prefetch de links; faz proxy de imagens).
2. Peça outra para um endereço **Outlook/institucional**.
3. Não clique em nenhum dos dois por 10 minutos.
4. Depois clique nos dois.
   - Gmail funciona e Outlook falha → **Safe Links** é o culpado principal.
   - Os dois falham → **Brevo** já consumiu antes, e trocar o SMTP é obrigatório.
   - Os dois funcionam → o problema é de janela de tempo/expiração; reveja a validade do OTP.

Registre o resultado neste documento.

---

## 6. Item 4 — O template do e-mail: onde editar e o que colocar

### Onde se edita

**Supabase Dashboard → Authentication → Emails → aba Templates → *Reset Password***
Link direto: `https://supabase.com/dashboard/project/ssrbepevacnxqiakykfc/auth/templates`

A página **Emails** tem duas abas: **Templates** e **SMTP Settings**. Cada template tem **Subject** (assunto) e o corpo em HTML, processados como Go Template.

> Nota (**NÃO CONFIRMADO na documentação oficial**, visto em fontes secundárias): a partir de 03/06/2026, projetos novos no plano gratuito que usam o remetente padrão do Supabase deixaram de poder editar os templates; configurar SMTP próprio restaura a edição. **Como este projeto já usa SMTP próprio (Brevo), a edição está disponível.**

### Variáveis disponíveis (documentação oficial, 06/08/2026)

| Variável | O que é |
|---|---|
| `{{ .ConfirmationURL }}` | a URL de confirmação completa (aponta para `.../auth/v1/verify?...&redirect_to=...`) |
| `{{ .Token }}` | **código de 6 dígitos** |
| `{{ .TokenHash }}` | o hash do token, para montar links próprios |
| `{{ .SiteURL }}` | o Site URL configurado |
| `{{ .RedirectTo }}` | o `redirectTo` passado na chamada |
| `{{ .Email }}` | o e-mail do destinatário |
| `{{ .Data }}` | metadados de `auth.users.user_metadata` |

### `{{ .ConfirmationURL }}` × `{{ .TokenHash }}` — o trade-off, sem maquiagem

| | `{{ .ConfirmationURL }}` (hoje) | `{{ .TokenHash }}` + página própria |
|---|---|---|
| **Quem consome o token** | **o primeiro que abrir o link** — humano ou robô | só quando **o seu JavaScript** chama `verifyOtp` |
| **Sobrevive a prefetch?** | **Não.** Um `GET` do scanner já queima o token | **Sim, na prática.** O scanner baixa um HTML estático; ele não executa o seu JS |
| **Sobrevive à Brevo?** | Não | Sim — a Brevo reescreve o link, mas o destino é a sua página, não o endpoint de verificação |
| **Erro apaga a rota?** | **Sim** — é o bug de hoje (seção 2.1) | **Não** — o erro fica sob o seu controle, você nunca passa pelo redirecionador do GoTrue |
| **Trabalho** | zero | precisa de rota + tela (**tarefa A**) |
| **Risco novo** | — | o `token_hash` fica visível na URL (histórico do navegador, `Referer`). Mitiga-se limpando a URL após o uso |
| **Ressalva honesta** | — | **não é imunidade absoluta**: um scanner que execute JavaScript ainda queimaria o token. Por isso o botão de clique explícito antes de chamar `verifyOtp` |

**Recomendação:** sim, **convém trocar**, mas só depois que a tarefa A entregar a página. Trocar o template antes da página existir transforma "cai na home" em "erro 404" — pior.

O formato recomendado pela documentação, adaptado ao roteamento por hash do site (a rota exata é decisão da tarefa A):

```html
<a href="{{ .SiteURL }}/recuperar-senha?token_hash={{ .TokenHash }}&type=recovery">Definir nova senha</a>
```

> Note: **query, não fragmento**. Isso é deliberado — a query é a única parte da URL que sobrevive tanto ao roteador por hash quanto a uma eventual reescrita da Brevo. Confirme com a tarefa A o caminho exato antes de colar isto no painel.

---

## 7. Item 5 — O e-mail está em inglês. Traduzir.

### Confirmado: é o template padrão do Supabase, em inglês

O texto do print ("Reset your password" / "We received a request…") é o **template padrão de fábrica** do Supabase para *Reset Password*. Ninguém o traduziu.

### Por que isso é um problema de segurança, não de estética

O público é brasileiro. Um e-mail que chega **em inglês**, **sem dizer de que instituição é**, **com um link que aponta para um domínio estranho** (`sendibt3.com`, e não `inct-conexao.com.br`) reúne, de uma vez, três dos sinais clássicos de phishing. O próprio Outlook já reagiu bloqueando conteúdo da mensagem ("the sender isn't in your Safe senders list"). Traduzir e assinar **reduz a probabilidade de o e-mail ser tratado como suspeito** — e um e-mail tratado como suspeito é exatamente o que o Defender examina com mais agressividade, o que **aumenta** a chance de o link ser queimado. Ou seja: **traduzir também ataca a causa raiz**, não só a experiência.

### Onde traduzir

**Authentication → Emails → Templates → Reset Password.** Há dois campos: **Subject heading** e o corpo. Traduza **os dois**. Não existe suporte nativo a múltiplos idiomas — há um pedido aberto desde 2021 (supabase/auth issue #80 e discussão #953); o painel guarda **um único template por ação**. Como todo o público do INCT é brasileiro, isso não é limitação: basta escrever em português.

### Texto proposto — **versão 1** (aplicável HOJE, sem depender da tarefa A)

**Assunto:**

```
INCT-CONEXAO BIO3TOX — redefinicao de senha
```

**Corpo:**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">

  <p style="font-size:14px;color:#555;margin:0 0 24px">
    <strong>INCT-CONEXÃO BIO3TOX</strong><br>
    Instituto Nacional de Ciência e Tecnologia — CNPq 408474/2024-6
  </p>

  <h2 style="font-size:20px;margin:0 0 16px">Redefinição de senha</h2>

  <p>Olá,</p>

  <p>
    Recebemos um pedido para redefinir a senha da conta
    <strong>{{ .Email }}</strong> na plataforma do INCT-CONEXÃO BIO3TOX
    (<a href="https://inct-conexao.com.br">inct-conexao.com.br</a>).
  </p>

  <p style="margin:28px 0">
    <a href="{{ .ConfirmationURL }}"
       style="background:#0b5c4a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:600">
      Definir uma nova senha
    </a>
  </p>

  <p style="font-size:14px;color:#444">
    Se o botão não funcionar, copie e cole este endereço no seu navegador:<br>
    <span style="word-break:break-all;color:#0b5c4a">{{ .ConfirmationURL }}</span>
  </p>

  <p style="font-size:14px;background:#f4f6f5;border-left:3px solid #0b5c4a;padding:12px 14px;margin:24px 0">
    <strong>Importante:</strong> abra este link <strong>no mesmo navegador</strong> em que você
    pediu a troca de senha, e use-o <strong>uma única vez</strong>. Se aparecer
    “link inválido ou expirado”, peça um novo em
    <a href="https://inct-conexao.com.br">inct-conexao.com.br</a>.
  </p>

  <p style="font-size:14px;color:#444">
    Se não foi você quem pediu, ignore este e-mail — sua senha continua a mesma.
  </p>

  <hr style="border:0;border-top:1px solid #e3e3e3;margin:28px 0">

  <p style="font-size:12px;color:#777;margin:0">
    Mensagem automática do INCT-CONEXÃO BIO3TOX. Não responda a este e-mail.<br>
    Em caso de dúvida, procure a coordenação do Instituto pelos canais oficiais em
    <a href="https://inct-conexao.com.br" style="color:#777">inct-conexao.com.br</a>.
  </p>

</div>
```

### Texto proposto — **versão 2** (depois que a tarefa A entregar a tela de código)

Troque o bloco do botão pelo par **link + código**. Basta acrescentar, logo abaixo do botão:

```html
  <p style="font-size:15px;margin:24px 0 8px">
    Ou, se o link não funcionar, digite este código na página de redefinição:
  </p>
  <p style="font-size:30px;letter-spacing:6px;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#f4f6f5;padding:14px 18px;border-radius:6px;text-align:center;margin:0 0 8px">
    {{ .Token }}
  </p>
  <p style="font-size:13px;color:#666;margin:0">O código vale por 1 hora e só pode ser usado uma vez.</p>
```

O código de 6 dígitos é o **plano B imune a scanner**: se o robô queimar o link, a pessoa ainda entra digitando o número.

*(Ajuste "1 hora" ao valor real de expiração do OTP configurado no projeto — Authentication → Sign In / Providers → Email. **NÃO CONFIRMADO** qual valor está configurado hoje; conferir na tela.)*

### Aplique o mesmo tratamento aos outros templates

Os mesmos problemas (inglês, sem identificação) valem para **Magic Link**, **Confirm signup** e **Invite user**. Traduza todos na mesma sessão — é a mesma tela.

---

## 8. Checklist

### No painel (você faz, hoje)

- [ ] **Supabase → Authentication → URL Configuration**: conferir Site URL = `https://inct-conexao.com.br` e Redirect URLs com `https://inct-conexao.com.br/**`; **acrescentar `http://localhost:5173/**`**.
- [ ] **Supabase → Authentication → Emails → Templates → Reset Password**: colar o assunto e o corpo da versão 1 (seção 7).
- [ ] Traduzir também **Magic Link**, **Confirm signup** e **Invite user**.
- [ ] **Brevo → Settings → Transactional emails → Tracking**: ativar **Anonymous email tracking** (paliativo).
- [ ] **Brevo → Support**: abrir chamado pedindo a desativação do rastreamento de cliques (texto na seção 5.2).
- [ ] **Avaliar a troca do SMTP** para um provedor sem reescrita de links (Resend/SES/Postmark) — **é a ação de painel com maior efeito**.
- [ ] Rodar o teste controlado da seção 5.6 e anotar o resultado aqui.
- [ ] Repetir a sonda da seção 2 depois de mexer na allowlist.

### No código (tarefa A — **não é configuração**)

- [ ] Tratar `#error=...` **e** `?error=...` na **raiz** do site, mostrando "o link expirou, peça outro" em vez da home muda.
- [ ] Ter uma tela de nova senha alcançável **na raiz**, não só dentro de `Gestao`/`Inscricao`/`MinhaInscricao`/`MeuLaboratorio`/`MeuAno`.
- [ ] Não depender de o fragmento carregar o `code` (seção 4).
- [ ] Página de recuperação com `token_hash` na **query** + botão de clique explícito.
- [ ] Campo para digitar o código de 6 dígitos (`verifyOtp({ email, token, type: 'recovery' })`).
- [ ] Mensagem clara quando o `code_verifier` não existe no navegador (link aberto em outro aparelho).

---

## 9. Fontes

Todas consultadas em **06/08/2026**.

**Supabase — documentação**
- Redirect URLs (allowlist, curingas, separadores `.` e `/`): <https://supabase.com/docs/guides/auth/redirect-urls>
- Email Templates + seção *Email prefetching* + variáveis: <https://supabase.com/docs/guides/auth/auth-email-templates>
- PKCE flow (code na URL, validade de 5 min, uso único): <https://supabase.com/docs/guides/auth/sessions/pkce-flow>
- Password-based Auth (fluxo de reset, `/auth/confirm` com `token_hash`): <https://supabase.com/docs/guides/auth/passwords>
- Troubleshooting `otp_expired` (prefetch, Safe Links, mitigações): <https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0>
- Troubleshooting redirectTo: <https://supabase.com/docs/guides/troubleshooting/why-am-i-being-redirected-to-the-wrong-url-when-using-auth-redirectto-option-_vqIeO>

**Supabase — código-fonte e discussões**
- `internal/api/verify.go` (`prepPKCERedirectURL`, `prepErrorRedirectURL`): <https://github.com/supabase/auth/blob/master/internal/api/verify.go>
- Discussão #28903 — "Outlook Safelink invalidates login token" (27/08/2024): <https://github.com/orgs/supabase/discussions/28903>
- Discussão #41618 — tokens consumidos por scanners institucionais (até 14/01/2026): <https://github.com/orgs/supabase/discussions/41618>
- Issue supabase/auth #80 e discussão #953 — i18n de templates (aberto desde 2021): <https://github.com/supabase/auth/issues/80>

**Microsoft**
- Safe Links overview (varredura antes da entrega, detonação assíncrona) — atualizado 22/05/2026: <https://learn.microsoft.com/en-us/defender-office-365/safe-links-about>

**Brevo**
- "No Way to Disable by Option tracking in Transactional E-Mail" — resposta oficial "upon request and to our Enterprise plans"; posts até 12/02/2026: <https://community.brevo.com/t/no-way-to-disable-by-option-tracking-in-transactional-e-mail/201>
- "Can I anonymize the tracking of opens and clicks for my emails?" (a página recusa leitura automatizada — caminho de menu **NÃO CONFIRMADO** na tela): <https://help.brevo.com/hc/en-us/articles/11643306229906-Can-I-anonymize-the-tracking-of-opens-and-clicks-for-my-emails>

**Código local verificado**
- `src/platform/auth.tsx:136` — `resetPasswordForEmail(clean, { redirectTo: window.location.href })`
- `src/platform/supabaseClient.ts:37` — `flowType: "pkce"`, `detectSessionInUrl: true`
- `node_modules/@supabase/auth-js/dist/module/lib/helpers.js:66` — `parseParametersFromURL`
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:3271` — `_isPKCECallback`
- `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:693` — `EmailOtpType` inclui `'recovery'`

---

## 10. O que este documento NÃO conseguiu provar

Registrado para honestidade e para orientar o próximo passo:

| Ponto | Estado |
|---|---|
| Qual robô consumiu o token no caso relatado (Brevo ou Safe Links) | **NÃO CONFIRMADO** — precisa do teste da seção 5.6 |
| Se o fragmento (`#`) participa do casamento da allowlist do Supabase | **NÃO CONFIRMADO** — sem fonte; irrelevante na prática com `/**` |
| Se a Brevo preserva o fragmento ao reescrever links | **NÃO CONFIRMADO** — por isso a solução recomendada não depende disso |
| Caminho de menu exato do *Anonymous email tracking* na Brevo | **NÃO CONFIRMADO** — a página de ajuda bloqueia leitura automatizada |
| Capacidade de desligar *click tracking* em Resend/SES/Postmark/Mailgun | **NÃO CONFIRMADO** nesta apuração — conferir na documentação do escolhido |
| Valor atual de expiração do OTP no projeto | **NÃO CONFIRMADO** — conferir em Authentication → Sign In / Providers → Email |
| Se o e-mail de recuperação chegou num endereço Outlook e o link mágico num Gmail | **NÃO CONFIRMADO** — explicaria integralmente a assimetria relatada; vale checar |
