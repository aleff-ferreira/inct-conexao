# E-mails de autenticação — templates em português, prontos para colar

**Para:** Aleff Ferreira — INCT-CONEXAO BIO3TOX (CNPq 408474/2024-6)
**Projeto Supabase:** `ssrbepevacnxqiakykfc`
**Apurado em:** 06/08/2026 · **Escrito em:** 07/08/2026
**Escopo:** só o que se faz **no painel** (Supabase e Brevo). O código do site é a tarefa A; este documento diz de que código cada template depende antes de poder ser colado.

Documento irmão, com o diagnóstico da causa: [`docs/auth-recuperacao-senha.md`](auth-recuperacao-senha.md).

---

## 1. O que muda, e por quê

O e-mail que sai hoje é o **template de fábrica do Supabase, em inglês**, sem dizer que instituição o enviou, e depende de um **link de uso único** que chega gasto porque dois robôs o abrem antes do destinatário (o rastreador de cliques da Brevo e o Safe Links da Microsoft — evidência medida em `auth-recuperacao-senha.md` §2 e §5).

Três mudanças, cada uma atacando uma coisa diferente:

| Mudança | O que resolve |
|---|---|
| **Português + identificação do remetente na primeira linha** | Um e-mail em inglês, de remetente desconhecido, para público brasileiro, reúne sinais clássicos de phishing. O Outlook do próprio destinatário já bloqueou conteúdo da mensagem. E-mail tratado como suspeito é examinado com mais agressividade pelo Defender — ou seja, **traduzir também reduz a chance de o link ser queimado**. Não é estética. |
| **Código numérico no lugar do link** | **Nenhum robô digita um número.** É a única solução imune a prefetch, e é a primeira mitigação que a própria documentação do Supabase recomenda. |
| **Explicar o porquê do e-mail e o que fazer se não foi você** | Reduz denúncia por engano ("marcar como lixo"), que envenena a reputação do domínio para todos os 209 destinatários seguintes. |

> **Ordem de aplicação — importa.** O template de recuperação abaixo **não tem link**: ele manda digitar o código em `inct-conexao.com.br/#/nova-senha`. Se a tela de digitar código ainda não estiver no ar (tarefa A), cole a **variante de transição** da §5.4, que traz link **e** código. Colar a versão só-código antes da tela existir troca um defeito por outro.

---

## 2. Onde se edita (Supabase)

**Supabase Dashboard → seu projeto → Authentication → Emails → aba _Templates_**
Link direto: `https://supabase.com/dashboard/project/ssrbepevacnxqiakykfc/auth/templates`

A página **Emails** tem duas abas: **Templates** e **SMTP Settings**. Cada template tem **dois campos**: o **assunto** e o **corpo em HTML** — ambos processados como Go Template, ou seja, ambos aceitam `{{ ... }}`.

Templates que a documentação lista: **Confirm signup**, **Invite user**, **Magic link (ou OTP)**, **Change email address**, **Reset password**, **Reauthentication**.
Fonte: <https://supabase.com/docs/guides/auth/auth-email-templates> (07/08/2026).

Detalhes que economizam tempo:

- **Salve template por template.** Cada aba tem seu próprio botão de salvar; trocar de aba sem salvar perde o texto.
- **Não existe suporte a mais de um idioma.** É um template por ação. Como todo o público é brasileiro, isso não é limitação — é só escrever em português. (Pedido aberto desde 2021: supabase/auth issue #80.)
- **Não há campo de versão em texto puro.** O editor só tem corpo HTML. **NÃO CONFIRMADO** se o GoTrue gera sozinho a parte `text/plain` do multipart. Por isso as versões em texto puro da §5–§8 servem para: (a) mala direta feita fora do Supabase — que é o caso provável dos 209 convites, ver §9.4; (b) conferência de leitura; (c) referência caso se troque de provedor. Independentemente disso, **o HTML aqui é deliberadamente simples**, que é o que faz o cliente de e-mail gerar uma versão de texto decente sozinho.

---

## 3. As variáveis, e quais valem onde

Documentação oficial (<https://supabase.com/docs/guides/auth/auth-email-templates>, 07/08/2026), transcrita:

| Variável | O que a doc diz |
|---|---|
| `{{ .ConfirmationURL }}` | "Contains the confirmation URL. For example, a signup confirmation URL would look like: `https://project-ref.supabase.co/auth/v1/verify?token=...`" |
| `{{ .Token }}` | "Contains a 6-digit One-Time-Password (OTP) that can be used instead of the `{{ .ConfirmationURL }}`" |
| `{{ .TokenHash }}` | "Contains a hashed version of the `{{ .Token }}`. This is useful for constructing your own email link" |
| `{{ .SiteURL }}` | "Contains your application's Site URL. This can be configured in your project's authentication settings" |
| `{{ .RedirectTo }}` | "Contains the redirect URL passed when signUp, signInWithOtp, signInWithOAuth, resetPasswordForEmail or inviteUserByEmail is called" |
| `{{ .Email }}` | "Contains the original email address of the user" |
| `{{ .Data }}` | "Contains metadata from `auth.users.user_metadata`. Use this to personalize the email message" |
| `{{ .NewEmail }}` | "Contains the new email address of the user. **This variable is only supported in the 'Change email address' template**" |

### Quais valem em QUAL template

**A documentação não faz esse recorte.** O único limite explícito que ela dá é o do `{{ .NewEmail }}` (só em *Change email address*). Para os demais, o que se pode afirmar com base na fonte:

| Variável | Confirm signup | Invite user | Magic link | Reset password | Observação |
|---|---|---|---|---|---|
| `{{ .ConfirmationURL }}` | sim | sim | sim | sim | é o corpo do template de fábrica dos quatro |
| `{{ .Token }}` | provável | provável | **confirmado** | **confirmado** | ver abaixo |
| `{{ .TokenHash }}` | provável | provável | provável | **confirmado** | |
| `{{ .SiteURL }}` `{{ .Email }}` `{{ .Data }}` `{{ .RedirectTo }}` | sim | sim | sim | sim | são de projeto/usuário, não de fluxo |

Onde está escrito **confirmado**:

- `{{ .Token }}` no **Magic link**: a doc mostra o template literal
  `<h2>One time login code</h2><p>Please enter this code: {{ .Token }}</p>`
  Fonte: <https://supabase.com/docs/guides/auth/auth-email-passwordless> (07/08/2026).
- `{{ .Token }}` / `{{ .TokenHash }}` no **Reset password**: a doc de senha mostra
  `href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/account/update-password"`
  e a verificação com `supabase.auth.verifyOtp({ type, token_hash })`, "`type` should be set to `'recovery'`".
  Fonte: <https://supabase.com/docs/guides/auth/passwords> (07/08/2026).
- O SDK instalado aceita `recovery` como tipo de OTP por e-mail (`EmailOtpType` em `@supabase/auth-js` 2.110.0 inclui `'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'`). Verificado no `node_modules` do projeto — registrado em `auth-recuperacao-senha.md` §5.3.

Os "provável" acima são **NÃO CONFIRMADOS**. Teste antes de confiar, e o teste leva 3 minutos: §11.

---

## 4. As regras de redação, e o motivo de cada uma

Todos os textos das §5–§8 seguem isto. Se você reescrever algum, mantenha as regras.

| Regra | Motivo |
|---|---|
| **Remetente na primeira linha visível: `INCT-CONEXAO BIO3TOX`** | Sem isso o destinatário não sabe de onde veio e o caminho mais curto é o botão de lixo. É também o que faz o Outlook parar de tratar a mensagem como desconhecida depois que ele adiciona o remetente à lista segura. |
| **Grafia `INCT-CONEXAO BIO3TOX`, sem acento** | É a forma da fonte única do projeto: `src/content/relato/identificacao.json` → `"sigla"`. Esse arquivo diz, textualmente, que nenhum desses valores deve ser redigitado em outro lugar. Não "corrija" para CONEXÃO. |
| **Nome por extenso pelo menos uma vez** | "INCT-CONEXAO" sozinho não diz nada a quem não é da rede — e parte dos 209 vai receber isto sem contexto. Fica no rodapé, uma vez, sem poluir o topo. |
| **Número do processo CNPq no rodapé** | É o que torna a mensagem verificável: quem desconfiar pesquisa `408474/2024-6` e acha o INCT. |
| **Dizer por que a pessoa recebeu** | "Alguém pediu X para este endereço" — e-mail transacional sem causa declarada parece disparo em massa. |
| **Dizer o que fazer se não foi ela** | Obrigação de honestidade e reduz denúncia por engano. Nunca peça ação de quem não pediu nada ("clique aqui para cancelar") — isso, sim, é padrão de phishing. |
| **Sem urgência artificial, sem CAIXA ALTA, sem exclamações** | São gatilhos clássicos de filtro de spam e de desconfiança humana. "O código vale por 1 hora" é fato; "AJA AGORA" é gatilho. |
| **Sem "clique aqui"** | Texto de link genérico é sinal de spam e é ruim de acessibilidade. O link diz para onde vai. |
| **Poucos links, e todos para `inct-conexao.com.br`** | Quantidade de links e diversidade de domínios contam contra na pontuação de spam. |
| **Nada de imagem hospedada, fonte remota ou CSS externo** | O print mostrou o Outlook bloqueando conteúdo remoto. Um logo hospedado viraria um retângulo vazio no topo — pior do que não ter logo. Todo o estilo é em linha; a identidade vem de texto e cor de fundo, que sempre renderizam. |
| **Tabelas, não `div` com flex/grid** | O Outlook para Windows renderiza com o motor do Word. Tabela com `padding` no `<td>` funciona em todos os clientes; `padding` em `<div>` e qualquer layout moderno, não. |
| **Cores do próprio site** | `#0d302b` (forest), `#f4f6ef` (paper), `#11211f` (ink), `#5d6c69` (muted) — lidas de `src/styles.css`. Coerência visual com o site também é sinal de legitimidade. |

**Sobre acentos:** os templates abaixo usam acentuação normal (UTF-8), que é o esperado. Se em algum cliente os acentos chegarem trocados (`cÃ³digo`), substitua pelas entidades HTML — `á` = `&aacute;`, `ã` = `&atilde;`, `â` = `&acirc;`, `é` = `&eacute;`, `ê` = `&ecirc;`, `í` = `&iacute;`, `ó` = `&oacute;`, `õ` = `&otilde;`, `ç` = `&ccedil;`, `ú` = `&uacute;`. Entidades funcionam sob qualquer codificação.

---

## 5. Template 1 — RECUPERAÇÃO DE SENHA (o principal)

Painel: **Authentication → Emails → Templates → _Reset Password_**

**Depende de:** tela onde se digita o código, chamando `verifyOtp({ email, token, type: 'recovery' })` — tarefa A. Enquanto ela não existir, use a variante da §5.4.

### 5.1 Assunto

```
INCT-CONEXAO BIO3TOX — código para redefinir sua senha
```

Alternativas, com o custo de cada uma:

- Se a acentuação do assunto chegar quebrada: `INCT-CONEXAO BIO3TOX - codigo para redefinir sua senha`.
- Colocar o código no assunto (`... sua senha: {{ .Token }}`) é cômodo no celular, mas expõe o código na notificação da tela bloqueada. Além disso, **NÃO CONFIRMADO** que o campo de assunto processe `{{ .Token }}` (a doc diz que os templates são Go Template, mas não dá exemplo de variável no assunto). Se quiser usar, teste primeiro — §11.

### 5.2 Corpo (HTML)

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dfe4dc;">

        <tr>
          <td style="border-top:4px solid #0d302b;padding:20px 24px 10px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#5d6c69;">
            <span style="font-size:16px;font-weight:bold;color:#0d302b;">INCT-CONEXAO BIO3TOX</span><br>
            Instituto Nacional de Ciência e Tecnologia &mdash; CNPq 408474/2024-6
          </td>
        </tr>

        <tr>
          <td style="padding:6px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.3;font-weight:bold;color:#11211f;">
            Código para redefinir sua senha
          </td>
        </tr>

        <tr>
          <td style="padding:14px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#11211f;">
            Você está recebendo esta mensagem porque foi solicitada a redefinição da senha
            da conta <strong>{{ .Email }}</strong> na plataforma do INCT-CONEXAO BIO3TOX.
            Para concluir, digite o código abaixo na página de nova senha.
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:20px 24px 6px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="background:#f4f6ef;border:1px solid #cfd8cc;padding:18px 10px;font-family:'Courier New',Courier,monospace;font-size:34px;line-height:1.2;font-weight:bold;color:#0d302b;letter-spacing:10px;text-indent:10px;">
                  {{ .Token }}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:0 24px 4px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#5d6c69;">
            O código vale por 1 hora e só pode ser usado uma vez.
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:18px 24px 6px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0d302b" style="padding:13px 24px;">
                  <a href="https://inct-conexao.com.br/#/nova-senha" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Abrir a página de nova senha</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:6px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#5d6c69;">
            Se o botão não abrir, digite este endereço no navegador:<br>
            <span style="color:#0d302b;">inct-conexao.com.br/#/nova-senha</span>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 24px 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;">
              <tr>
                <td style="border-left:3px solid #0d302b;padding:12px 14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#11211f;">
                  <strong>Se não foi você quem pediu</strong>, não é preciso fazer nada: sua senha
                  continua a mesma. Nenhuma alteração acontece sem que alguém digite o código acima.
                  Se isso se repetir sem motivo, avise a coordenação do Instituto.
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 22px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5d6c69;border-top:1px solid #e6eae2;">
            Mensagem automática da plataforma do <strong>INCT-CONEXAO BIO3TOX</strong> &mdash;
            Instituto Nacional de Ciência e Tecnologia de Pesquisa e Conhecimento de Excelência
            da Amazônia Ocidental/Oriental em Biodiversidade, Biotecnologia, Biometeorologia e
            Toxicologia Aplicadas à Saúde Única. CNPq, processo nº 408474/2024-6, Chamada nº 46/2024.
            Instituição executora: FIOCRUZ Rondônia; sede: LABOGEOPA/UNIR.<br><br>
            Não responda a este endereço. Informações em inct-conexao.com.br.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
```

### 5.3 Versão em texto puro

```
INCT-CONEXAO BIO3TOX
Instituto Nacional de Ciencia e Tecnologia - CNPq 408474/2024-6

CODIGO PARA REDEFINIR SUA SENHA

Voce esta recebendo esta mensagem porque foi solicitada a redefinicao da
senha da conta {{ .Email }} na plataforma do INCT-CONEXAO BIO3TOX.

Seu codigo:  {{ .Token }}

Sao seis digitos. O codigo vale por 1 hora e so pode ser usado uma vez.
Digite-o em: inct-conexao.com.br/#/nova-senha

Se nao foi voce quem pediu, nao e preciso fazer nada: sua senha continua a
mesma. Nenhuma alteracao acontece sem que alguem digite o codigo acima.

--
Mensagem automatica da plataforma do INCT-CONEXAO BIO3TOX - Instituto
Nacional de Ciencia e Tecnologia de Pesquisa e Conhecimento de Excelencia da
Amazonia Ocidental/Oriental em Biodiversidade, Biotecnologia, Biometeorologia
e Toxicologia Aplicadas a Saude Unica. CNPq, processo 408474/2024-6, Chamada
46/2024. Executora: FIOCRUZ Rondonia; sede: LABOGEOPA/UNIR.
Nao responda a este endereco. Informacoes em inct-conexao.com.br.
```

*(Sem acentos de propósito: a versão de texto puro é a que costuma ser lida por sistemas antigos e por leitores de tela mal configurados, onde acento quebrado atrapalha mais do que a falta dele. Se seu envio for todo UTF-8, pode acentuar.)*

### 5.4 Variante de transição — enquanto a tela de código não existir

Substitua o **bloco do botão e do endereço** (as duas `<tr>` que vêm depois da linha "O código vale por 1 hora…") por este, que oferece o link **e** mantém o código como plano B:

```html
        <tr>
          <td align="center" style="padding:18px 24px 6px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0d302b" style="padding:13px 24px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Definir uma nova senha</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:14px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#5d6c69;">
            Abra este link <strong>no mesmo navegador</strong> em que a redefinição foi pedida, e
            use-o uma única vez. Se aparecer “link inválido ou expirado”, peça um novo em
            inct-conexao.com.br &mdash; alguns servidores de e-mail institucionais abrem os links
            das mensagens para conferir se são seguros, e o link chega gasto.
          </td>
        </tr>
```

Assim que a tarefa A publicar a tela de código, volte para a §5.2 — e aí o e-mail deixa de depender de link, que é o ponto.

---

## 6. Template 2 — LINK MÁGICO (entrada sem senha)

Painel: **Authentication → Emails → Templates → _Magic Link_**

**Quando dispara:** `signInWithOtp` — hoje, o botão "Receber meu link de entrada" do Relatório Anual (`src/platform/auth.tsx` → `signIn`).

**Atenção de escopo:** é **um template para toda a plataforma**. Ele não pode falar "Relatório Anual" e ao mesmo tempo servir a outro uso. O texto abaixo é institucional e serve sempre. Para uma mensagem específica dos 209 convites, use o template **Invite user** (§7) ou a mala direta da §9.4 — não este.

### 6.1 Assunto

```
INCT-CONEXAO BIO3TOX — seu acesso à plataforma
```

### 6.2 Corpo (HTML)

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dfe4dc;">

        <tr>
          <td style="border-top:4px solid #0d302b;padding:20px 24px 10px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#5d6c69;">
            <span style="font-size:16px;font-weight:bold;color:#0d302b;">INCT-CONEXAO BIO3TOX</span><br>
            Instituto Nacional de Ciência e Tecnologia &mdash; CNPq 408474/2024-6
          </td>
        </tr>

        <tr>
          <td style="padding:6px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.3;font-weight:bold;color:#11211f;">
            Seu acesso à plataforma
          </td>
        </tr>

        <tr>
          <td style="padding:14px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#11211f;">
            Você está recebendo esta mensagem porque foi solicitada uma entrada sem senha
            para <strong>{{ .Email }}</strong> na plataforma do INCT-CONEXAO BIO3TOX, onde a
            rede registra suas informações de pesquisa e acompanha os editais do Instituto.
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:20px 24px 6px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0d302b" style="padding:13px 24px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Entrar na plataforma</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:12px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#5d6c69;">
            Abra o link <strong>no mesmo navegador</strong> em que a entrada foi pedida. Ele vale
            por 1 hora e funciona uma única vez.
          </td>
        </tr>

        <tr>
          <td style="padding:20px 24px 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;">
              <tr>
                <td style="padding:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#11211f;">
                  <strong>Se o link não funcionar</strong> &mdash; alguns servidores de e-mail
                  institucionais abrem os links das mensagens antes do destinatário, e o link
                  chega gasto &mdash; use o código abaixo na página de entrada:
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                    <tr>
                      <td align="center" style="background:#ffffff;border:1px solid #cfd8cc;padding:14px 10px;font-family:'Courier New',Courier,monospace;font-size:30px;line-height:1.2;font-weight:bold;color:#0d302b;letter-spacing:9px;text-indent:9px;">
                        {{ .Token }}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#11211f;">
            Se não foi você quem pediu este acesso, ignore esta mensagem. Sem o link ou o código
            acima, ninguém entra na sua conta.
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 22px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5d6c69;border-top:1px solid #e6eae2;">
            Mensagem automática da plataforma do <strong>INCT-CONEXAO BIO3TOX</strong> &mdash;
            Instituto Nacional de Ciência e Tecnologia de Pesquisa e Conhecimento de Excelência
            da Amazônia Ocidental/Oriental em Biodiversidade, Biotecnologia, Biometeorologia e
            Toxicologia Aplicadas à Saúde Única. CNPq, processo nº 408474/2024-6, Chamada nº 46/2024.
            Instituição executora: FIOCRUZ Rondônia; sede: LABOGEOPA/UNIR.<br><br>
            Não responda a este endereço. Informações em inct-conexao.com.br.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
```

> **Remova o bloco do código** (a `<tr>` da caixa cinza com `{{ .Token }}`) enquanto o site não tiver a tela que aceita código de link mágico — `verifyOtp({ email, token, type: 'magiclink' })`. Um código que a pessoa não tem onde digitar gera ligação para a coordenação, não solução. **Tarefa A.**

### 6.3 Versão em texto puro

```
INCT-CONEXAO BIO3TOX
Instituto Nacional de Ciencia e Tecnologia - CNPq 408474/2024-6

SEU ACESSO A PLATAFORMA

Voce esta recebendo esta mensagem porque foi solicitada uma entrada sem senha
para {{ .Email }} na plataforma do INCT-CONEXAO BIO3TOX.

Entre por este endereco (abra no mesmo navegador em que o acesso foi pedido;
vale por 1 hora e funciona uma unica vez):

{{ .ConfirmationURL }}

Se o link nao funcionar - alguns servidores de e-mail institucionais abrem os
links das mensagens antes do destinatario, e o link chega gasto - use este
codigo na pagina de entrada:  {{ .Token }}

Se nao foi voce quem pediu este acesso, ignore esta mensagem. Sem o link ou o
codigo acima, ninguem entra na sua conta.

--
Mensagem automatica da plataforma do INCT-CONEXAO BIO3TOX - Instituto
Nacional de Ciencia e Tecnologia de Pesquisa e Conhecimento de Excelencia da
Amazonia Ocidental/Oriental em Biodiversidade, Biotecnologia, Biometeorologia
e Toxicologia Aplicadas a Saude Unica. CNPq, processo 408474/2024-6, Chamada
46/2024. Executora: FIOCRUZ Rondonia; sede: LABOGEOPA/UNIR.
Nao responda a este endereco. Informacoes em inct-conexao.com.br.
```

---

## 7. Template 3 — CONVITE (Invite user) — os 209 do Relatório Anual

Painel: **Authentication → Emails → Templates → _Invite user_**

**Quando dispara:** `inviteUserByEmail` (API de administração). É o template certo para uma campanha nominal, porque é o único que só sai quando a coordenação dispara — dá para escrever o texto do Relatório Anual sem afetar quem usa a plataforma no dia a dia.

Duas diferenças deliberadas em relação ao link mágico:

1. **Não diz "abra no mesmo navegador".** Quem recebe convite não pediu nada, então não existe "o navegador em que foi pedido". O aviso técnico correto aqui é outro: abra no aparelho em que você vai preencher. *(O convite disparado pelo servidor não passa pelo PKCE do navegador; **NÃO CONFIRMADO** por medição neste projeto — ver §12.)*
2. **Diz para que serve e quanto tempo leva.** É o que separa "convite institucional" de "spam de formulário".

### 7.1 Assunto

```
INCT-CONEXAO BIO3TOX — convite para o Relatório Anual do Instituto
```

### 7.2 Corpo (HTML)

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dfe4dc;">

        <tr>
          <td style="border-top:4px solid #0d302b;padding:20px 24px 10px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#5d6c69;">
            <span style="font-size:16px;font-weight:bold;color:#0d302b;">INCT-CONEXAO BIO3TOX</span><br>
            Instituto Nacional de Ciência e Tecnologia &mdash; CNPq 408474/2024-6
          </td>
        </tr>

        <tr>
          <td style="padding:6px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.3;font-weight:bold;color:#11211f;">
            Convite para o Relatório Anual do Instituto
          </td>
        </tr>

        <tr>
          <td style="padding:14px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#11211f;">
            Você está recebendo esta mensagem porque o endereço <strong>{{ .Email }}</strong>
            consta da equipe do INCT-CONEXAO BIO3TOX na proposta aprovada pelo CNPq. O Instituto
            precisa reunir, uma vez por ano, o que cada integrante produziu &mdash; é o que
            compõe o relatório entregue ao CNPq e o documento de prestação de contas à sociedade.
          </td>
        </tr>

        <tr>
          <td style="padding:14px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#11211f;">
            O formulário é curto, aceita “nada a declarar” e salva sozinho: dá para começar agora
            e terminar depois, no mesmo aparelho.
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:20px 24px 6px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0d302b" style="padding:13px 24px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Abrir meu Relatório Anual</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:12px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#5d6c69;">
            Abra o link no aparelho em que você vai preencher o formulário. Ele vale por 1 hora
            e funciona uma única vez &mdash; se expirar, é só pedir outro em
            inct-conexao.com.br/#/relatorio-anual.
          </td>
        </tr>

        <tr>
          <td style="padding:20px 24px 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;">
              <tr>
                <td style="padding:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#11211f;">
                  <strong>Se o link não funcionar</strong> &mdash; servidores de e-mail de
                  universidades e institutos costumam abrir os links das mensagens para conferir
                  se são seguros, e o link chega gasto &mdash; use este código na página de entrada:
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                    <tr>
                      <td align="center" style="background:#ffffff;border:1px solid #cfd8cc;padding:14px 10px;font-family:'Courier New',Courier,monospace;font-size:30px;line-height:1.2;font-weight:bold;color:#0d302b;letter-spacing:9px;text-indent:9px;">
                        {{ .Token }}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#11211f;">
            Se você não faz parte da equipe do Instituto, ou acredita ter recebido esta mensagem
            por engano, ignore-a &mdash; nenhuma conta é criada sem que alguém abra o link ou
            digite o código acima. Se puder, avise a coordenação para corrigirmos a lista.
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 22px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5d6c69;border-top:1px solid #e6eae2;">
            <strong>INCT-CONEXAO BIO3TOX</strong> &mdash; Instituto Nacional de Ciência e
            Tecnologia de Pesquisa e Conhecimento de Excelência da Amazônia Ocidental/Oriental em
            Biodiversidade, Biotecnologia, Biometeorologia e Toxicologia Aplicadas à Saúde Única.
            CNPq, processo nº 408474/2024-6, Chamada nº 46/2024 &mdash; Programa Institutos
            Nacionais de Ciência e Tecnologia. Instituição executora: FIOCRUZ Rondônia;
            sede: LABOGEOPA/UNIR.<br><br>
            Mensagem automática. Não responda a este endereço &mdash; fale com a coordenação
            pelos canais em inct-conexao.com.br.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
```

### 7.3 Versão em texto puro

```
INCT-CONEXAO BIO3TOX
Instituto Nacional de Ciencia e Tecnologia - CNPq 408474/2024-6

CONVITE PARA O RELATORIO ANUAL DO INSTITUTO

Voce esta recebendo esta mensagem porque o endereco {{ .Email }} consta da
equipe do INCT-CONEXAO BIO3TOX na proposta aprovada pelo CNPq. O Instituto
precisa reunir, uma vez por ano, o que cada integrante produziu - e o que
compoe o relatorio entregue ao CNPq e o documento de prestacao de contas a
sociedade.

O formulario e curto, aceita "nada a declarar" e salva sozinho: da para
comecar agora e terminar depois, no mesmo aparelho.

Abra seu relatorio por este endereco (vale por 1 hora, uma unica vez):

{{ .ConfirmationURL }}

Se o link nao funcionar - servidores de e-mail de universidades e institutos
costumam abrir os links das mensagens para conferir se sao seguros, e o link
chega gasto - use este codigo na pagina de entrada:  {{ .Token }}

Se voce nao faz parte da equipe do Instituto, ignore esta mensagem: nenhuma
conta e criada sem que alguem abra o link ou digite o codigo. Se puder, avise
a coordenacao para corrigirmos a lista.

--
INCT-CONEXAO BIO3TOX - Instituto Nacional de Ciencia e Tecnologia de Pesquisa
e Conhecimento de Excelencia da Amazonia Ocidental/Oriental em Biodiversidade,
Biotecnologia, Biometeorologia e Toxicologia Aplicadas a Saude Unica. CNPq,
processo 408474/2024-6, Chamada 46/2024 - Programa Institutos Nacionais de
Ciencia e Tecnologia. Executora: FIOCRUZ Rondonia; sede: LABOGEOPA/UNIR.
Mensagem automatica. Nao responda a este endereco.
```

---

## 8. Template 4 — CONFIRMAÇÃO DE CADASTRO (Confirm signup)

Painel: **Authentication → Emails → Templates → _Confirm signup_**

**O projeto usa?** **Sim.** `signUp` existe em `src/platform/auth.tsx` e o `AuthCard.tsx` tem a tela "Conta criada: confirme seu e-mail" (`mode === "signup-sent"`), que só aparece quando o Supabase devolve sessão vazia — isto é, quando a confirmação de e-mail está ligada no projeto. É o caminho do "Primeiro acesso? Criar conta" da comissão e dos candidatos.

### 8.1 Assunto

```
INCT-CONEXAO BIO3TOX — confirme seu e-mail para ativar a conta
```

### 8.2 Corpo (HTML)

```html
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dfe4dc;">

        <tr>
          <td style="border-top:4px solid #0d302b;padding:20px 24px 10px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#5d6c69;">
            <span style="font-size:16px;font-weight:bold;color:#0d302b;">INCT-CONEXAO BIO3TOX</span><br>
            Instituto Nacional de Ciência e Tecnologia &mdash; CNPq 408474/2024-6
          </td>
        </tr>

        <tr>
          <td style="padding:6px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:21px;line-height:1.3;font-weight:bold;color:#11211f;">
            Confirme seu e-mail para ativar a conta
          </td>
        </tr>

        <tr>
          <td style="padding:14px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#11211f;">
            Uma conta foi criada com o endereço <strong>{{ .Email }}</strong> na plataforma do
            INCT-CONEXAO BIO3TOX. Falta um passo: confirmar que este endereço é seu. Depois disso
            você entra normalmente com e-mail e senha, sem depender de e-mail nenhum.
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:20px 24px 6px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" bgcolor="#0d302b" style="padding:13px 24px;">
                  <a href="{{ .ConfirmationURL }}" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;">Confirmar meu e-mail</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:12px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#5d6c69;">
            Abra o link <strong>no mesmo navegador</strong> em que a conta foi criada. Ele vale
            por 1 hora e funciona uma única vez.
          </td>
        </tr>

        <tr>
          <td style="padding:20px 24px 0 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6ef;">
              <tr>
                <td style="padding:14px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#11211f;">
                  <strong>Se o link não funcionar</strong>, use este código na página de
                  confirmação &mdash; servidores de e-mail institucionais às vezes abrem os links
                  antes do destinatário e o link chega gasto:
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
                    <tr>
                      <td align="center" style="background:#ffffff;border:1px solid #cfd8cc;padding:14px 10px;font-family:'Courier New',Courier,monospace;font-size:30px;line-height:1.2;font-weight:bold;color:#0d302b;letter-spacing:9px;text-indent:9px;">
                        {{ .Token }}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 24px 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#11211f;">
            Se não foi você quem criou esta conta, ignore esta mensagem: sem a confirmação, a
            conta não é ativada e ninguém a utiliza.
          </td>
        </tr>

        <tr>
          <td style="padding:22px 24px 22px 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#5d6c69;border-top:1px solid #e6eae2;">
            Mensagem automática da plataforma do <strong>INCT-CONEXAO BIO3TOX</strong> &mdash;
            Instituto Nacional de Ciência e Tecnologia de Pesquisa e Conhecimento de Excelência
            da Amazônia Ocidental/Oriental em Biodiversidade, Biotecnologia, Biometeorologia e
            Toxicologia Aplicadas à Saúde Única. CNPq, processo nº 408474/2024-6, Chamada nº 46/2024.
            Instituição executora: FIOCRUZ Rondônia; sede: LABOGEOPA/UNIR.<br><br>
            Não responda a este endereço. Informações em inct-conexao.com.br.
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
```

> Mesma regra do §6: **o bloco do código só entra depois** que existir tela para digitá-lo (`verifyOtp({ email, token, type: 'signup' })` — **tarefa A**, e **NÃO CONFIRMADO** que `{{ .Token }}` renderize neste template; teste pelo §11).

### 8.3 Versão em texto puro

```
INCT-CONEXAO BIO3TOX
Instituto Nacional de Ciencia e Tecnologia - CNPq 408474/2024-6

CONFIRME SEU E-MAIL PARA ATIVAR A CONTA

Uma conta foi criada com o endereco {{ .Email }} na plataforma do
INCT-CONEXAO BIO3TOX. Falta um passo: confirmar que este endereco e seu.
Depois disso voce entra normalmente com e-mail e senha.

Confirme por este endereco (abra no mesmo navegador em que a conta foi
criada; vale por 1 hora, uma unica vez):

{{ .ConfirmationURL }}

Se o link nao funcionar, use este codigo na pagina de confirmacao:
{{ .Token }}

Se nao foi voce quem criou esta conta, ignore esta mensagem: sem a
confirmacao, a conta nao e ativada.

--
Mensagem automatica da plataforma do INCT-CONEXAO BIO3TOX - Instituto
Nacional de Ciencia e Tecnologia de Pesquisa e Conhecimento de Excelencia da
Amazonia Ocidental/Oriental em Biodiversidade, Biotecnologia, Biometeorologia
e Toxicologia Aplicadas a Saude Unica. CNPq, processo 408474/2024-6, Chamada
46/2024. Executora: FIOCRUZ Rondonia; sede: LABOGEOPA/UNIR.
Nao responda a este endereco. Informacoes em inct-conexao.com.br.
```

**Os outros dois templates** (*Change email address*, *Reauthentication*) o projeto não usa hoje. Deixá-los em inglês é um risco pequeno mas gratuito: se um dia forem acionados, sai o texto de fábrica. Traduza-os na mesma sessão, reaproveitando o cabeçalho e o rodapé daqui.

---

## 9. O remetente: nome, endereço e autenticação de domínio

O print mostra apenas **"INCT-"** no campo de remetente. Isso é o **nome de exibição** — configurado no Supabase, entregue pela Brevo, e possivelmente truncado pelo cliente. Três coisas separadas, na ordem em que se resolvem.

### 9.1 Nome e endereço do remetente — no Supabase

**Authentication → Emails → aba _SMTP Settings_**
Link direto: `https://supabase.com/dashboard/project/ssrbepevacnxqiakykfc/auth/smtp`

Os campos, conforme a documentação (nomes da API de gestão entre parênteses):

| Campo | Valor recomendado | Por quê |
|---|---|---|
| **Sender email** (`smtp_admin_email`) | `nao-responda@inct-conexao.com.br` | Precisa ser do **domínio autenticado na Brevo** (§9.2). Endereço em domínio de terceiros derruba o alinhamento de DMARC. |
| **Sender name** (`smtp_sender_name`) | `INCT-CONEXAO BIO3TOX` | 20 caracteres. Alguns clientes móveis cortam por volta de 20–25; por isso a sigla vem primeiro e o nome por extenso fica no corpo. Não use nome que comece por hífen ou pontuação. |
| **Host** (`smtp_host`) | o host SMTP da Brevo | **NÃO CONFIRMADO** aqui — a central de ajuda da Brevo recusa leitura automatizada (HTTP 403). Copie do painel da Brevo, em *SMTP & API → SMTP*. |
| **Port** (`smtp_port`) | conforme a Brevo | idem |
| **Username / Password** (`smtp_user` / `smtp_pass`) | login e **chave SMTP** da Brevo | a chave SMTP não é a senha da conta Brevo |

Fonte dos nomes de campo: <https://supabase.com/docs/guides/auth/auth-smtp> (07/08/2026).

Da mesma página, textualmente: *"Setting up a custom domain will reduce the likelihood of your messages being picked up as spam"* e *"Work with your email sending service to configure DKIM, DMARC and SPF for your sending domain."*

**Não há campo de _Reply-To_ documentado** — **NÃO CONFIRMADO** que exista. Por isso os templates trazem, no rodapé, "não responda a este endereço" e apontam para os canais do site: é a única forma honesta de tratar resposta quando não há para onde responder.

### 9.2 Autenticar o domínio na Brevo — SPF, DKIM, DMARC

Sem isto, a mensagem sai assinada por um domínio que não é o seu, e o provedor do destinatário tem todo o direito de tratá-la como não verificada. Em rede federal (`fiocruz.br`, `unir.br`, `.edu.br`) isso é caixa de lixo com frequência.

**Por que é obrigatório, com fonte:** o Google exige, desde **1º de fevereiro de 2024**, que *todo* remetente configure **SPF ou DKIM** para seus domínios de envio; quem envia mais de **5.000 mensagens por dia** precisa também de **DMARC** e de alinhamento entre o domínio do `From:` e o do SPF ou do DKIM.
Fonte: <https://support.google.com/a/answer/81126> (07/08/2026).
Os 209 convites ficam **abaixo** do limiar de 5.000/dia, então DMARC não é exigido pelo Google nesse caso — **mas configure assim mesmo**: a Brevo pede o registro DMARC no próprio fluxo de autenticação de domínio, e é o que dá visibilidade de quem está usando seu domínio.

**CONFIRMADO NA TELA (07/08/2026).** A conta abre a página em **português**:
"Remetentes, Domínios e IPs dedicados", com as abas **Remetentes | Domínios |
IPs dedicados | Cadência de envio**. O único remetente cadastrado é
`inct-conexao <labioprot.toxin@gmail.com>` ("Verificado"), com dois avisos:
*Assinatura DKIM: Padrão ⚠* e *DMARC: O domínio Freemail não é recomendado ⚠*,
mais o banner "Um ou mais dos seus remetentes não estão em conformidade com
novos requisitos do Google, Yahoo e Microsoft para remetentes".

**O diagnóstico que a tela entrega:** não há o que "consertar" nesse remetente.
Ele é `@gmail.com`, e **não existe registro DNS que autentique o gmail.com** —
a zona é do Google. O *Editar* do remetente nunca vai oferecer a autenticação;
ela mora na aba **Domínios**, e o desfecho não é autenticar o Gmail — é
**aposentá-lo como remetente** depois que o domínio próprio estiver no ar.

**O estado atual do DNS (medido em 07/08/2026, `nslookup -q=TXT`):**

| Registro | Valor hoje | Consequência |
|---|---|---|
| `inct-conexao.com.br` (SPF) | `v=spf1 include:_spf.mail.hostinger.com ~all` | Já existe **um** SPF (e-mail da Hostinger). Se a Brevo pedir SPF, **edite este** acrescentando o include dela — um segundo `v=spf1` invalida os dois. |
| `_dmarc.inct-conexao.com.br` | `v=DMARC1; p=none` | **Já existe DMARC.** Se a Brevo pedir um, **edite o existente** (ou deixe como está, se o verificador aceitar) — nunca crie um segundo `_dmarc`. |
| `mail._domainkey.inct-conexao.com.br` | *(não existe)* | O DKIM da Brevo é o que de fato falta criar. |

**Passo a passo (nomes conforme a tela em português):**

1. Em <https://app.brevo.com>, na página **Remetentes, Domínios e IPs
   dedicados** → aba **Domínios** → adicionar o domínio `inct-conexao.com.br`.
2. Escolha o caminho **manual** (o DNS está na Hostinger e você controla a
   zona). A Brevo mostra os registros dela — tipicamente **Brevo code** (TXT na
   raiz), **DKIM** (TXT em `mail._domainkey`) e **DMARC** (TXT em `_dmarc`).
   Copie o *nome* e o *valor* exatos de cada um; não invente prefixo.
3. No **hPanel da Hostinger → DNS Zone Editor** de `inct-conexao.com.br`:
   **crie** o Brevo code e o DKIM; para o DMARC, lembre da tabela acima — o
   registro **já existe**, então é *editar*, não criar.
4. Volte à Brevo e mande **autenticar/verificar o domínio**. O esperado é
   marcador verde nos três registros. Propagação: de minutos a algumas horas.
5. **Crie o remetente novo** na aba **Remetentes** → *Adicionar remetente*:
   `nao-responda@inct-conexao.com.br` (nome: `INCT-CONEXAO BIO3TOX`). Em
   domínio autenticado, o remetente não depende de clique de confirmação numa
   caixa postal. *(Se quiser que respostas não se percam, crie a caixa ou um
   redirecionamento no hPanel → E-mails — opcional; os templates já dizem "não
   responda".)*
6. **Troque o Sender email no Supabase** (tabela da §9.1) para o endereço novo.
   Enquanto o Supabase continuar enviando como `labioprot.toxin@gmail.com`,
   nada do que foi feito acima tem efeito: o alinhamento DMARC é do remetente,
   e o remetente continuaria sendo o Gmail.
7. O remetente antigo pode permanecer cadastrado (não atrapalha), mas não deve
   mais ser usado em envio nenhum.

> **O que segue NÃO CONFIRMADO na fonte primária:** os nomes e valores exatos
> dos registros que a Brevo vai exibir no passo 2 (a central de ajuda devolve
> **HTTP 403** a leitura automatizada; artigo oficial:
> <https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC>).
> Copie da tela — ela é a autoridade. O restante do roteiro está confirmado por
> observação direta da conta (print de 07/08/2026) e medição do DNS.

### 9.3 Depois de autenticar, teste com quem importa

Mande um de cada template para: um `@gmail.com`, um `@outlook.com` e **pelo menos dois institucionais da rede** (`@fiocruz.br`, `@unir.br`). Em cada um, verifique:

- caiu na entrada ou no lixo;
- o nome do remetente aparece inteiro;
- os acentos estão certos;
- o Outlook bloqueou algo (não deve: não há imagem remota);
- **o código está legível e TODOS os dígitos aparecem** (o projeto envia 8) (se o `letter-spacing` for ignorado, ainda tem que dar para ler).

### 9.4 Um alerta sobre os 209: o template do Supabase pode não ser o veículo certo

`docs/relato-anual.md` §4.6 prevê convite com pré-preenchimento por `#/relatorio-anual?m=<token>`, **nominal e por laboratório**. Isso implica um texto por pessoa (nome, laboratório, prazo) que **nenhum template do Supabase produz**: `{{ .Data }}` só alcança o que estiver em `auth.users.user_metadata`, e a lista de 209 ainda nem existe (§1.7: "a proposta não tem e-mails").

Duas saídas, e a escolha é da coordenação:

1. **Tudo pelo Supabase (`inviteUserByEmail`)** — usa o template da §7, exige gravar nome/laboratório em `user_metadata` antes, e o texto sai igual para todos.
2. **Mala direta própria** (a versão em texto puro da §7.3 serve de base) com o link do convite, deixando a autenticação para quando a pessoa chegar no site. Mais trabalho, texto muito melhor, e **é onde a versão em texto puro deste documento é aproveitada de verdade**.

Não decido isso aqui — só registro que a decisão existe e que ela muda qual template você precisa.

---

## 10. Prazos e limites que afetam o disparo

### 10.1 Validade do código / do link — 1 hora, e onde se muda

- **Padrão: 3600 segundos (1 hora).** A referência de configuração do Supabase diz, do campo `otp_expiry`: *"The expiry time for an OTP code in seconds. Default is 3600 seconds (1 hour)."*
- A doc de login sem senha confirma em prosa: *"By default, a user can only request an OTP once every 60 seconds, and they expire after 1 hour"* — e o mesmo para link mágico.
- **Esse ajuste vale para tudo:** confirmação de cadastro, link mágico, recuperação de senha, troca de e-mail e convite. Não dá para dar validade diferente só para a recuperação.
- **Onde se ajusta:** **Authentication → Sign In / Providers → Auth Providers → Email → Email OTP expiration** (`https://supabase.com/dashboard/project/ssrbepevacnxqiakykfc/auth/providers`).
- Valores acima de **86.400 s (um dia)** são desaconselhados e só se configuram pela API de gestão.
- **Tamanho do código:** `otp_length`, aceita de 6 a 10 dígitos. **MEDIDO EM
  07/08/2026: este projeto está em 8** (o e-mail real entregou `01438947`), e a
  primeira versão da tela — dimensionada para 6 — truncava a colagem e recusava
  o código certo. Desde então o site aceita a faixa inteira (6–10) e **nenhum
  texto promete um comprimento**: nem os templates ("São seis dígitos" saiu do
  corpo do e-mail), nem a tela. Pode deixar o painel em 8 ou mudar para 6 —
  os dois funcionam; só não reintroduza número fixo em texto nenhum.
- **Intervalo mínimo entre e-mails para o mesmo endereço:** `max_frequency`, padrão **1 minuto**. É por isso que apertar "enviar" duas vezes seguidas dá erro; o texto do site já cobre isso.

Fontes: <https://supabase.com/docs/guides/local-development/cli/config> e <https://supabase.com/docs/guides/auth/auth-email-passwordless> (07/08/2026).

> **Recomendação:** mantenha **1 hora**. É a folga que absorve o e-mail que demora a chegar em servidor institucional, sem virar janela larga de risco. Não aumente para "resolver" link queimado por scanner — scanner queima em segundos, e mais validade não conserta isso; o código numérico conserta.

### 10.2 Limite de e-mails por hora — **isto trava os 209 convites**

| Situação | Limite | Fonte |
|---|---|---|
| Remetente embutido do Supabase (sem SMTP próprio) | **"2 emails per hour with the built-in email provider. You can only change this with a custom SMTP setup."** | <https://supabase.com/docs/guides/auth/rate-limits> |
| **Com SMTP próprio (o caso deste projeto)** | **"To protect the reputation of your newly set up service a low rate-limit of 30 messages per hour is imposed. To adjust this to an acceptable value for your use case head to the Rate Limits configuration page."** | <https://supabase.com/docs/guides/auth/auth-smtp> |
| Verificação de token (`/auth/v1/verify`) | **"360 requests per hour (with bursts up to 30 requests)"**, não ajustável | <https://supabase.com/docs/guides/auth/rate-limits> |

**Consequência aritmética, e ela é grande:** a 30 mensagens por hora, **209 convites levam 7 horas** — e qualquer reenvio, qualquer "esqueci a senha" e qualquer confirmação de cadastro disputa a mesma cota. Na prática, sem mexer nisso a campanha se arrasta por um dia inteiro e alguns convites simplesmente falham.

**O que fazer, antes de disparar:**

1. **Authentication → Rate Limits** (`https://supabase.com/dashboard/project/ssrbepevacnxqiakykfc/auth/rate-limits`) → elevar o limite de envio de e-mails para um valor compatível (250–300/h cobre os 209 com folga para reenvios).
2. Conferir **na Brevo** o limite do plano — o limite do Supabase não substitui o da Brevo, e o menor dos dois é o que vale. **NÃO CONFIRMADO** qual é o limite do plano em uso.
3. Disparar em lotes (um laboratório por vez) e olhar a taxa de rejeição antes do lote seguinte. Domínio novo que dispara 209 mensagens de uma vez é o retrato do que os filtros chamam de *snowshoe*.
4. Lembrar de `max_frequency` = 1 min **por endereço**: reenviar para a mesma pessoa duas vezes no mesmo minuto falha, e não é bug.

---

## 11. Como testar um template em 3 minutos (e provar o que está NÃO CONFIRMADO)

Serve para responder, com evidência, se `{{ .Token }}` funciona em cada template e se o assunto aceita variável.

1. Crie um endereço de teste que você controle (ex.: um Gmail e um Outlook).
2. Cole o template, salve.
3. Dispare **o fluxo real**, não um "send test":
   - *Reset password*: no site, "Esqueci a senha" com o endereço de teste.
   - *Confirm signup*: "Primeiro acesso? Criar conta".
   - *Magic link*: "Receber meu link de entrada".
   - *Invite user*: só pela API de administração — se ainda não houver rotina, deixe este por último.
4. No e-mail recebido, confira: (a) apareceu **o código numérico completo** (8 dígitos neste projeto) onde está `{{ .Token }}`? Se aparecer o texto `{{ .Token }}` cru ou um espaço vazio, **a variável não vale naquele template** — remova o bloco. (b) O assunto veio como escrito?
5. **Anote o resultado na tabela da §12.** É o que transforma "provável" em "confirmado" e evita refazer esta apuração daqui a seis meses.

---

## 12. Checklist

**No painel do Supabase**

- [ ] *Reset password*: colar assunto (§5.1) e corpo (§5.2, ou §5.4 se a tela de código ainda não existir).
- [ ] *Magic link*: colar §6.1 e §6.2 (removendo o bloco do código se ainda não houver tela).
- [ ] *Invite user*: colar §7.1 e §7.2.
- [ ] *Confirm signup*: colar §8.1 e §8.2.
- [ ] *Change email address* e *Reauthentication*: traduzir reaproveitando cabeçalho/rodapé.
- [ ] **SMTP Settings**: *Sender name* = `INCT-CONEXAO BIO3TOX`; *Sender email* no domínio autenticado.
- [ ] **Sign In / Providers → Email**: conferir *Email OTP expiration* = 3600 e *OTP length* = 6.
- [ ] **Rate Limits**: elevar o envio de e-mails **antes** dos 209 convites (§10.2).

**Na Brevo**

- [ ] Autenticar `inct-conexao.com.br` (Brevo code + DKIM + DMARC) e conferir os três marcadores verdes.
- [ ] Conferir que existe **um só** registro SPF na zona da Hostinger.
- [ ] Conferir o limite de envio do plano.

**Testes**

- [ ] Um envio de cada template para Gmail, Outlook e dois institucionais da rede.
- [ ] Registrar abaixo o que se provar.

**O que continua NÃO CONFIRMADO neste documento**

| Ponto | Como sai desta lista |
|---|---|
| `{{ .Token }}` funciona em *Confirm signup* e *Invite user* | teste da §11 |
| O campo de **assunto** processa variáveis (`{{ .Token }}`) | teste da §11 |
| O GoTrue envia parte `text/plain` junto do HTML | inspecionar o fonte da mensagem recebida ("mostrar original") |
| Existe campo *Reply-To* nas SMTP Settings | olhar a tela |
| Host/porta SMTP da Brevo e limite do plano | painel da Brevo (a central de ajuda devolve 403 para leitura automatizada) |
| Nomes exatos de menu da Brevo para autenticação de domínio | conferir na tela; corrigir a §9.2 |
| Convite disparado pelo servidor não usa PKCE (por isso não se diz "mesmo navegador" na §7) | medir um convite real e olhar se o retorno vem em `?code=` ou em `#access_token=` |

---

## 13. Fontes

Consultadas em **07/08/2026**, salvo indicação.

**Supabase — documentação**
- Email Templates (tabela de variáveis, seção *Email prefetching*, mitigação por `{{ .Token }}` e `{{ .TokenHash }}`): <https://supabase.com/docs/guides/auth/auth-email-templates>
- Passwordless email logins (`{{ .Token }}` no Magic Link; "expire after 1 hour"; "once every 60 seconds"; caminho *Authentication > Sign In / Providers > Auth Providers > Email > Email OTP expiration*; teto de 86.400 s): <https://supabase.com/docs/guides/auth/auth-email-passwordless>
- Password-based Auth (`token_hash` + `type=recovery`; `verifyOtp({ type, token_hash })`; `updateUser({ password })`): <https://supabase.com/docs/guides/auth/passwords>
- Custom SMTP (campos `smtp_admin_email`, `smtp_sender_name`, `smtp_host`, `smtp_port`, `smtp_user`, `smtp_pass`; "low rate-limit of 30 messages per hour"; recomendação de DKIM/DMARC/SPF): <https://supabase.com/docs/guides/auth/auth-smtp>
- Rate limits ("2 emails per hour with the built-in email provider"; `/auth/v1/verify` "360 requests per hour (with bursts up to 30 requests)"; página *Authentication > Rate Limits*): <https://supabase.com/docs/guides/auth/rate-limits>
- CLI config (`otp_length` padrão 6, 6–10; `otp_expiry` padrão 3600 s; `max_frequency` 1m; tipos de template `invite`, `confirmation`, `recovery`, `magic_link`, `email_change`): <https://supabase.com/docs/guides/local-development/cli/config>
- Troubleshooting `otp_expired` (definição de *email prefetching* e as quatro mitigações): <https://supabase.com/docs/guides/troubleshooting/otp-verification-failures-token-has-expired-or-otp_expired-errors-5ee4d0>

**Google**
- Email sender guidelines — SPF ou DKIM obrigatório desde 01/02/2024; DMARC e alinhamento acima de 5.000 mensagens/dia: <https://support.google.com/a/answer/81126>

**Brevo** *(central de ajuda devolve HTTP 403 a leitura automatizada — tudo daqui está marcado NÃO CONFIRMADO na §9.2)*
- Authenticate your domain with Brevo (Brevo code, DKIM, DMARC): <https://help.brevo.com/hc/en-us/articles/12163873383186-Authenticate-your-domain-with-Brevo-Brevo-code-DKIM-DMARC>
- Troubleshooting domain authentication: <https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-issues-with-domain-authentication-Brevo-code-DKIM-DMARC>

**Documentos e código deste projeto**
- `docs/auth-recuperacao-senha.md` — diagnóstico medido do link queimado (Brevo + Safe Links), `prepErrorRedirectURL` do GoTrue, allowlist, e a impossibilidade de desligar o rastreamento de cliques da Brevo fora do plano Enterprise.
- `docs/relato-anual.md` §1.7, §4.6 — os 209 convites, a exigência de SMTP próprio com SPF/DKIM, e o convite com `?m=<token>`.
- `src/content/relato/identificacao.json` — fonte única da sigla, do título por extenso, do processo CNPq, da chamada, da executora e da sede.
- `src/platform/auth.tsx` — `signIn` (link mágico), `signUp` (confirmação de cadastro), `resetPassword` (recuperação), `ptError`.
- `src/platform/AuthCard.tsx` — telas "Esqueci a senha", "Link de redefinição enviado" e "Conta criada: confirme seu e-mail"; é a prova de que o *Confirm signup* está em uso.
- `src/platform/NovaSenha.tsx` e `src/webinars/router.ts` — a rota `#/nova-senha` que o template de recuperação manda digitar o código.
- `src/styles.css` — as cores usadas nos templates.
