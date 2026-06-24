# Painel de conteúdo (CMS) — guia de configuração

Os webinars e os grupos agora são editados por um **painel** em `/admin`
(Sveltia CMS, compatível com Decap CMS). Os líderes de grupo abrem
`https://inct-conexao.com.br/admin`, fazem login, editam **em formulários** (sem
mexer em código) e salvam. Ao salvar, o painel **grava os arquivos JSON** em
`src/content/webinars/` e `src/content/groups/` no **repositório do GitHub**.

> **Importante — o site não se atualiza sozinho.** O painel grava no GitHub; o
> site no Hostinger só muda quando **você** (administrador) faz `git pull`,
> reconstrói (`npm run build`) e reenvia o `dist/`. Isso é proposital: você
> revisa antes de publicar. O fluxo completo está no fim deste guia.

Onde fica o conteúdo:
- Webinars: `src/content/webinars/<slug>.json` (um arquivo por webinar)
- Grupos: `src/content/groups/<slug>.json` (um arquivo por grupo)
- Imagens/vídeos enviados pelo painel: `public/assets/`

---

## Parte A — Usar o painel AGORA, só você, sem contas (modo local)

Funciona hoje, sem GitHub e sem configurar login. Ótimo para você substituir a
edição manual do JSON por uma interface amigável.

1. Rode o site localmente:
   ```
   cd /home/aleff/inct
   PATH=/home/aleff/inct/.tools/node-v22.22.3-linux-x64/bin:$PATH npm run dev
   ```
2. Abra **http://localhost:5173/admin/** no **Chrome ou Edge** (o modo local usa
   a File System Access API, que o Firefox não tem).
3. Clique em **"Work with Local Repository"** e selecione a pasta do projeto
   (`/home/aleff/inct`). Pronto: edite webinars e grupos em formulários; o painel
   grava direto nos arquivos `src/content/**`.
4. Quando terminar: `npm run build` + `python3 scripts/make-zip.py` e suba o
   `dist/` (ver `HOSTING.md`).

> Só isso já entrega o ganho de editar por formulários em vez de JSON. A Parte B
> é necessária apenas para dar acesso **remoto** aos líderes de grupo.

---

## Parte B — Colocar o painel online para os líderes de grupo

Para os líderes editarem de qualquer lugar pelo `inct-conexao.com.br/admin`, o
projeto precisa estar **no GitHub** e o painel precisa de um **login**.

### Passo 1 — Colocar o projeto no GitHub (uma vez)

1. Crie um repositório vazio no GitHub chamado **`inct-conexao`** na sua conta
   (**https://github.com/aleff-ferreira**), **privado** de preferência. O caminho
   será `aleff-ferreira/inct-conexao` (já preenchido no `config.yml`).
2. O git local já está inicializado e com o primeiro commit. Só falta apontar
   para o GitHub e enviar:
   ```
   cd /home/aleff/inct
   git remote add origin https://github.com/aleff-ferreira/inct-conexao.git
   git push -u origin main
   ```
   (O `.gitignore` já exclui `node_modules/`, `dist/`, `.tools/`, zips e logs.)
   Atalho com a CLI do GitHub (cria o repo e envia de uma vez):
   ```
   gh repo create aleff-ferreira/inct-conexao --private --source=. --push
   ```

### Passo 2 — Apontar o painel para o seu repositório

Já está feito — o `public/admin/config.yml` aponta para
`aleff-ferreira/inct-conexao`:
```yaml
backend:
  name: github
  repo: aleff-ferreira/inct-conexao
  branch: main
```
(Se você criar o repositório com outro nome, ajuste essa linha.)

### Passo 3 — Configurar o login

Escolha **uma** das opções abaixo.

**Opção 1 (RECOMENDADA p/ líderes não técnicos) — DecapBridge.**
Os líderes entram com **e-mail/senha ou Google**, **sem precisar de conta no
GitHub**. O DecapBridge comita no seu repo em nome deles.
1. Crie uma conta em **https://decapbridge.com**, conecte o repositório
   `aleff-ferreira/inct-conexao` e siga as instruções.
2. O DecapBridge fornece um trecho para o `config.yml` (define `backend.base_url`
   e um `site_id`/`auth_endpoint`). Cole-o no `public/admin/config.yml`.
3. Convide cada líder pelo painel do DecapBridge (por e-mail). Plano gratuito:
   ~10 colaboradores por site.

**Opção 2 (auto-hospedada, 100% sua) — Cloudflare Workers + GitHub OAuth.**
Os líderes entram com **conta do GitHub** (precisam ter acesso de escrita ao
repo). Sem terceiros, tudo seu, gratuito.
1. No GitHub: **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - Homepage URL: `https://inct-conexao.com.br`
   - Authorization callback URL: a URL do worker (passo 2) + `/callback`
   - Anote o **Client ID** e **Client Secret**.
2. Faça deploy do worker de OAuth do Sveltia (gratuito):
   `https://github.com/sveltia/sveltia-cms-auth` (botão de deploy para Cloudflare;
   configure `GITHUB_CLIENT_ID` e `GITHUB_CLIENT_SECRET`). Anote a URL
   `https://SEU-AUTH.workers.dev`.
3. No `public/admin/config.yml`, descomente e ajuste:
   ```yaml
   backend:
     name: github
     repo: aleff-ferreira/inct-conexao
     branch: main
     base_url: https://SEU-AUTH.workers.dev
   ```
4. Dê acesso a cada líder como **colaborador** do repositório (GitHub → Settings →
   Collaborators), com permissão de escrita.

> **Para você (admin)**, a "Opção 3" é sempre o modo local da Parte A — não
> precisa de login nenhum.

### Passo 4 — Publicar o painel

O `/admin` é estático e já vai junto no build. Após editar o `config.yml`:
```
npm run build
python3 scripts/make-zip.py
```
e suba o `dist/` ao Hostinger. O painel fica em `https://inct-conexao.com.br/admin`
(marcado como `noindex`, fora dos buscadores).

---

## Fluxo do dia a dia

```
Líder edita em inct-conexao.com.br/admin  ──►  painel comita no GitHub (src/content/**)
                                                        │
        você recebe/vê o commit no GitHub  ◄───────────┘
                    │
                    ▼
   git pull   →   npm run build   →   python3 scripts/make-zip.py   →   upload do dist/ ao Hostinger
```

1. O líder salva uma alteração no painel → vira um **commit** no seu repositório.
2. Você revisa o commit (no GitHub) e faz **`git pull`** na sua máquina.
3. **`npm run build`** + **`python3 scripts/make-zip.py`**.
4. Suba o `dist/` ao Hostinger (ver `HOSTING.md`). A alteração entra no ar.

Como **tudo** que os líderes salvam fica retrievável no seu repositório (e na sua
cópia local após o `pull`), você sempre tem o conteúdo localmente para continuar
os updates — exatamente o objetivo.

---

## Observações e limites

- **Escopo de acesso.** No modelo git, quem tem acesso de escrita ao repositório
  (ou é convidado no DecapBridge) pode editar **qualquer** webinar/grupo, não só
  o do seu grupo. O controle real é o seu **review dos commits** antes de buildar
  + o histórico do GitHub (cada alteração fica registrada com autor). Se um dia
  precisar de isolamento estrito por grupo, aí sim seria preciso um backend com
  login e permissões (ver `docs/group-autonomy-plan.md`).
- **Imagens/vídeos** enviados pelo painel vão para `public/assets/`. Vídeos
  grandes incham o repositório — para gravações longas, prefira subir no
  YouTube/Vimeo e colar a URL no campo "URL da gravação".
- **Trocar para o Decap CMS clássico:** basta trocar o `<script>` em
  `public/admin/index.html` pela versão do Decap; o `config.yml` é compatível.
- **Datas:** o painel grava a data com fuso; oriente os líderes a usarem o
  horário de Rondônia (UTC-4). O texto do fuso é o campo "Texto do fuso horário".
