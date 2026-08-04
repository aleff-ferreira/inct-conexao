# PLANO DE IMPLEMENTAÇÃO — WEBINÁRIOS INCT-CONEXÃO
## Zoom (sala de produção) → RTMP → YouTube Live → embed em inct-conexao.com.br

**Documento de trabalho — 2026-08-04.** Todas as URLs de fonte foram consultadas em 2026-08-04, salvo indicação. O que não foi confirmado na fonte está marcado **NÃO CONFIRMADO** — não use esses números para decidir sozinho; execute o teste indicado.

---

## 1. VISÃO EM UMA PÁGINA

### O desenho (quem está onde no dia)

```
PALESTRANTES (até 7, cada um na sua UF)
        │ vídeo/áudio individual, upload de cada um até a nuvem Zoom
        ▼
SALA ZOOM (reunião Pro, NÃO webinar)
  Operador 1 = HOST (cabeado, tela congelada no layout, spotlights)
  Operador 2 = co-host (2ª máquina, OBS reserva, Control Room do YouTube)
  Moderador  = co-host (conduz pauta, lê perguntas com ~40 s de defasagem)
        │ RTMP empurrado PELA NUVEM DO ZOOM (não pelo PC do operador)
        ▼
YOUTUBE LIVE — evento AGENDADO na aba Manage, VIDEO ID fixo,
  auto-start OFF, auto-stop OFF, latência Normal, DVR ON
  ingest primário: rtmp://a.rtmp.youtube.com/live2 (chave nomeada "INCT-webinar")
  ingest reserva:  rtmp://b.rtmp.youtube.com/live2?backup=1 (OBS do Operador 2)
        │ mesmo ID serve: sala de espera → live → VOD
        ▼
SITE (estático, Hostinger) — página do webinário embeda
  youtube-nocookie.com/embed/<VIDEOID> via campo liveStream do CMS
  + link de escape permanente + transmissão reserva (mudanças de código, seção 4)
```

### Orçamento anual (4 eventos/ano, base)

| Item | Valor/ano | Status |
|---|---|---|
| Zoom Workplace Pro, 4 meses avulsos (R$ 90,99/mês, cancelando após cada evento) | **R$ 363,96** + impostos | Verificado: https://zoom.us/buy?product=ZOPRO&period=monthly (2026-08-04). Impostos: **NÃO CONFIRMADO** — reservar +10–25% (~R$ 400–455 total) até capturar o checkout logado |
| YouTube (canal, live, VOD, ilimitado) | R$ 0 | Verificado (docs support.google.com citadas na seção 3) |
| Site/Hostinger | R$ 0 adicional | já contratado |
| Transcrição do replay (Whisper API, 2 h/evento) | ~US$ 2,88/ano (~R$ 16) | Verificado: US$ 0,006/min, https://developers.openai.com/api/docs/pricing |
| Revisão humana de legenda (4–8 h/evento) | horas de bolsista | interno |
| **Total base** | **~R$ 380–470/ano** | |
| Libras (2 intérpretes/evento, FEBRAPILS) | **NÃO CONFIRMADO** — orçar; via UNIR pode ser R$ 0 (seção 6) | decisão pendente |
| CART ao vivo (estenotipia pt-BR) | plataforma ~US$ 10,80/evento verificado (StreamText); profissional **NÃO CONFIRMADO** | decisão pendente |
| Comparação: o que a arquitetura evita | Zoom Webinars 500 = R$ 408,33/mês anual ≈ **R$ 4.900/ano** | Verificado: https://zoom.us/pricing/events (2026-08-04) |

**Vias que podem zerar o custo Zoom (disparar antes de comprar):** (a) e-mail à Cogetic/Fiocruz RO — a Fiocruz usa Zoom institucionalmente (campusvirtual.fiocruz.br/portal/ferramentas-virtuais/zoom.html), sem contrato localizável no PNCP, 1 e-mail resolve; (b) se a fundação de apoio exigir NF-e, o custo muda de patamar: reseller nacional ≈ R$ 4.400/licença/ano (referências reais no PNCP, api pncp.gov.br, 2026-08-04) — **decidir a via de pagamento ANTES de comprar**.

### As 3 ações desta semana (até 08/08)

1. **Confirmar com a coordenação se o evento de 27/08 é real** (o cadastro atual é semente com palestrantes-fixture). Em paralelo, enviar o e-mail à Fiocruz RO sobre licença Zoom e perguntar à fundação de apoio se aceita invoice estrangeira em BRL. A compra do Pro é não-reembolsável — só comprar com data confirmada.
2. **Criar/organizar o canal do YouTube como conta de marca com 2 donos, verificar por telefone e disparar a habilitação de live** (pode levar até 24 h — https://support.google.com/youtube/answer/9228390). Isso não custa nada e destrava tudo.
3. **Abrir o PR-1 de código** (conserto do bug live_stream + precedência do replay + config.yml + campo liveStreamBackup — seção 4) e criar a conta FTP dedicada no hPanel para o CI.

### Se 27/08 for real vs semente

- **Real (cronograma apertado):** siga os marcos D-14 = 13/08, D-7 = 20/08, D-1 = 26/08 da seção 4/5 à risca; compre o Pro até 12/08 para o ensaio técnico do dia 13 cair dentro do mês pago.
- **Semente (cronograma folgado):** o código (seção 4) e o canal YouTube seguem no mesmo ritmo — são investimento permanente. **Não compre o Zoom.** Os ensaios dos vereditos 3 e 5 (mecânica do YouTube) rodam de graça com OBS; os dos vereditos 1 e 4 (Zoom RTMP e legendas) ficam pendurados até existir data real, e aí entram no mês pago do evento. O runbook vira template com D-x relativo.

---

## 2. AS VERIFICAÇÕES QUE SUSTENTAM O PLANO

Cinco afirmações foram submetidas a verificação adversarial. **Onde o veredito corrigiu a pesquisa, este plano segue o veredito.**

### V1 — "Pro basta para Zoom→RTMP→YouTube em reunião" → **CONFIRMADA**
Custom livestreaming de REUNIÃO exige apenas conta Pro + host Licensed + app desktop Windows/macOS (KB0064210, KB0062284, KB0059839, support.zoom.com, 2026-08-04). Zoom Webinars não entra no orçamento. Condições que o plano incorpora: o **host** da transmissão é o usuário licenciado (1 licença = 1 host; co-host não inicia stream); o admin precisa ligar o toggle antes (efeito imediato); **1080p não é do Pro** (KB0066166: Business/Enterprise + suporte) — o plano assume **720p**; a conta grátis **não ensaia o RTMP** — o ensaio geral tem que cair no mês pago.

### V2 — "RTMP sai da nuvem do Zoom, então o upload do operador não importa" → **PARCIAL**
O transporte Zoom→YouTube é da nuvem do Zoom (KB0064210 exige URL pública de destino; KB0060548 não lista porta RTMP no cliente; "Live Streaming" é componente próprio em zoomstatus.com). **Mas a conclusão é falsa pela metade:** câmera, microfone e sobretudo os **slides compartilhados sobem pelo upload do operador** até a nuvem — se engasgar, o público vê slide congelado com o stream "no ar". Formulação que vale no runbook: *o RTMP sai da nuvem, mas o operador usa cabo e conexão estável mesmo assim, porque slides e controle passam por ele; e cada palestrante depende do próprio uplink.* O comportamento do RTMP numa queda TOTAL do host não é documentado — teste destrutivo obrigatório no ensaio.

### V3 — "Evento agendado tem VIDEO ID fixo que sobrevive ao ciclo inteiro" → **PARCIAL**
A mecânica é oficial: broadcast agendado E vídeo compartilham o mesmo ID, que não muda ao ir ao ar e vira o VOD (developers.google.com/youtube/v3/live/getting-started; life-of-a-broadcast). **Só vale sob 3 condições operacionais:** (1) ir ao ar **no evento agendado** — Studio > Go Live > aba **Manage** > abrir o evento > Go Live manual; usar a aba "Stream" padrão **ou o botão OAuth "Live on YouTube" do Zoom cria broadcast NOVO com ID novo**; (2) **auto-stop DESLIGADO** — com ele ligado, ~1 min sem ingest completa o broadcast, e broadcast completo não volta (invalidTransition na API): religar depois disso gera ID novo e mata o embed; (3) VOD: live < 12 h, replay não deletado. Encerramento correto: "End stream" manual. **NÃO CONFIRMADO:** o default (on/off) dos toggles auto-start/auto-stop em eventos agendados — anotar no ensaio.

### V4 — "Legenda do Zoom NÃO atravessa o RTMP" → **REFUTADA**
Atravessa. A nuvem do Zoom injeta a legenda no stream de saída (CEA-708 confirmado por staff Zoom no devforum 135393; relatos de legenda "baked into" o vídeo no YouTube em community.zoom.com threads 173881 e 210948, consultados 2026-08-04). O que o host mostra/esconde na tela dele **não** controla o stream, e em reunião não há toggle de UI "legenda só na sala". Caminhos: (a) captions desligadas durante a transmissão = stream limpo; (b) controle via API (campo `close_caption` no PATCH livestream/status); (c) encoder externo. **Consequência editorial:** como o YouTube não gera legenda automática ao vivo em pt, a legenda do Zoom atravessando pode ser *desejável* — mas é decisão consciente, sabendo que não dá para escondê-la do público do YouTube pela UI. Nenhuma fonte testou pt-BR especificamente — o ensaio decide a política (teste de 30 min abaixo).

### V5 — "Auto-stop OFF: queda de ingest não encerra e retoma no mesmo ID" → **PARCIAL**
Verdadeiro **com duas condições**: (1) só em **evento agendado** (aba Manage) com auto-start e auto-stop OFF — no fluxo rápido "Go Live", queda = broadcast encerrado = ID novo; (2) a tolerância a gap de ingest **não tem número oficial** (enableAutoStop documenta o ~1 min só com o toggle LIGADO — developers.google.com/youtube/v3/live/docs/liveBroadcasts; operadores relatam gaps de 2–5 min sobrevividos). Uma vez "complete" (auto-stop esquecido, End Stream acidental, timeout não documentado), o ID está queimado para sempre. Enquanto "live", o público vê tela congelada/"aguardando" e a volta do RTMP com a mesma key retoma no mesmo player.

### Os testes práticos que o Aleff mesmo faz (fecham os NÃO CONFIRMADOS)

| Teste | Quando | Roteiro (30 min ou menos) | Fecha o quê |
|---|---|---|---|
| **T1 — Pipeline Zoom→YouTube** | com Pro ativo + live habilitada | Admin: ligar o toggle de livestreaming (caminho na seção 3b) → agendar evento unlisted no Studio, copiar URL+chave → Zoom web portal: Meetings > reunião teste > Live Streaming > Configure custom streaming → iniciar no desktop, More > Live on Custom Live Streaming Service → confirmar imagem no Studio em ~1 min | V1 na prática; se "More" não mostrar a opção, o toggle está travado em outro nível — não é limitação do plano |
| **T2 — Origem e dependência do upload** | idem, no ensaio D-14 | 3 vídeos ligados + slide com relógio → Go Live → derrubar a internet do host 60–90 s (ingest deve seguir de pé = transporte em nuvem provado; anotar o que o público vê) → religar via hotspot fraco e conferir slide borrado/congelado no YouTube (qualidade depende do upload) | V2; documenta a lacuna da queda do host |
| **T3 — Ciclo do VIDEO ID** | grátis, com OBS, qualquer dia | Studio > Go Live > Manage > Schedule (unlisted), anotar ID → abrir youtube-nocookie.com/embed/\<ID\> (deve mostrar espera) → **anotar e desligar auto-start/auto-stop (registrar o default = dado não confirmado)** → OBS na key do evento, Go Live manual, confirmar MESMO ID → cortar ingest 2 min (evento NÃO pode completar) → religar, mesmo ID → End Stream, confirmar replay na mesma URL | V3 e V5; se o corte de 2 min completar o evento, o runbook de queda muda (religar em menos que o tempo observado) |
| **T4 — Legendas no stream** | com Pro ativo | Evento unlisted; Zoom com Automated captions pt-BR renderizando → transmitir 5 min → janela anônima: legenda queimada? botão CC? → host oculta captions na tela dele (stream muda?) → desliga captions de vez (stream limpa?) → opcional: repetir com "Embedded 608/708" no broadcast | V4; decide a política captions ON/OFF do evento |
| **T5 — Imposto do checkout** | antes de comprar | Conta grátis → iniciar compra do Pro → preencher endereço de cobrança (CEP Porto Velho) → **print da tela de revisão antes de confirmar** (não precisa pagar) | O "plus applicable taxes" vira número |

---

## 3. CONFIGURAÇÃO PASSO A PASSO

### 3a. Canal do YouTube (do zero ao habilitado)

1. **Conta Google institucional.** Use uma conta do instituto (não pessoal). Guarde as credenciais no gerenciador de senhas do projeto com recuperação (telefone + e-mail secundário) apontando para 2 pessoas distintas.
2. **Criar o canal como conta de marca** (permite múltiplos gestores sem compartilhar senha): youtube.com com a conta logada > foto do perfil > Configurações > "Criar um canal" / "Adicionar ou gerenciar seu(s) canal(is)" > **Criar um canal** com o nome "INCT-CONEXÃO" (isso cria uma conta de marca vinculada). *Caminhos de UI do Google mudam com frequência — se divergir, procurar "conta de marca" em myaccount.google.com/brandaccounts.*
3. **Governança: 2 donos.** myaccount.google.com/brandaccounts > canal do INCT > **Gerenciar permissões** > adicionar um segundo **Proprietário** (ex.: coordenador) e os operadores como **Administrador**. Regra: nenhuma pessoa única pode ser ponto de falha do canal. (Alternativa moderna: YouTube Studio > Configurações > Permissões.)
4. **Verificar o canal por telefone:** youtube.com/verify. Pré-requisito de live (https://support.google.com/youtube/answer/2474026).
5. **Habilitar transmissão ao vivo JÁ:** YouTube Studio > Criar > **Transmitir ao vivo** — dispara a habilitação, que pode levar **até 24 h** (https://support.google.com/youtube/answer/9228390). O piso de 50 inscritos vale **só para live mobile**; via encoder RTMP não há mínimo documentado (mesma fonte + answer/2474026).
6. **Padrões do canal:** Studio > Configurações > Canal > Configurações avançadas > **"Não, este canal não é destinado a crianças"** (made-for-kids mata chat, miniplayer e watch-later — https://support.google.com/youtube/answer/9527654).
7. **Criar a chave de stream nomeada:** Studio > Transmitir ao vivo > Stream settings > **Create new stream key**, nome "INCT-webinar", reutilizável em todos os eventos (https://support.google.com/youtube/answer/9854503; a key não determina o videoId — o broadcast sim).
8. **Áudio:** vinheta/música de espera SÓ da YouTube Audio Library ou composição própria — Content ID interrompe live com música comercial, mesmo "de fundo" (https://support.google.com/youtube/answer/3367684).

### 3b. Conta e sala Zoom

**Compra (só com data de evento confirmada — não-reembolsável):**
1. https://zoom.us/buy?product=ZOPRO&period=monthly → escolher a linha **"Monthly R$90.99"** — **CUIDADO:** a linha "Annual, billed monthly R$84,83" obriga as 12 parcelas mesmo cancelando (aviso literal no carrinho, 2026-08-04). Total exibido "Plus applicable taxes" (teste T5 fecha o número).
2. Pagamento: cartão ou Pix. **Pix cria mandato "Pix Automático" no app do banco — cancelar o plano no portal Zoom NÃO revoga o mandato; revogar nos dois lugares** (KB0061567/KB0084440). Sem boleto; NF-e não confirmada — invoice em Plans and Billing > Invoice History (KB0063038).
3. Provisionar a conta com endereço no Brasil (favorece o data center de São Paulo — KB0067446).
4. **Cancelamento pós-evento:** Admin > Plans and Billing > Plan Management > **Cancel Plan** (efetiva na renovação; serviço ativo até o fim do mês pago — KB0066687). **Antes de o mês acabar: baixar todas as gravações em nuvem** — somem 30 dias após o fim da assinatura, sem recuperação (KB0066687).

**Configurações da conta (uma vez, efeito imediato):**
- Admin > **Account Management > Account Settings > aba Meeting > In Meeting (Advanced)**:
  - **"Allow livestreaming of meetings"** = ON, marcar **YouTube** e **Custom Live Streaming Service** > Save (KB0059839). Se aparecer acinzentado no usuário, está travado no nível conta/grupo — destravar aqui.
  - **"Automated captions"** — decisão pós-teste T4 (V4: a legenda ATRAVESSA o RTMP). Política padrão sugerida: ON (acessibilidade > estética), revisável por evento.
  - **"Sign language interpretation view"** = ON se houver Libras (KB0058636) — mas lembrar: esse canal NÃO entra no stream nem na gravação; para o YouTube o intérprete entra como participante spotlighted (seção 6).
- Settings > Meeting > Media Settings: HD 720p (1080p exige Business + suporte — KB0066166). **Proibir virtual background dos palestrantes** (derruba a resolução).

**Reunião-modelo (salvar como template):**
- Agendada (nunca instantânea, nunca PMI — interpretação exige agendamento, KB0065246), ID "Generate Automatically", waiting room ON, mute ao entrar, gravação em nuvem + local.
- Web portal > Meetings > (reunião) > aba **Live Streaming > Configure custom streaming**: Stream URL `rtmp://a.rtmp.youtube.com/live2`, Stream Key = "INCT-webinar", Live streaming page URL = página do webinário no site, Resolução = **720p** (KB0064210). Isso é feito em D-7, casando a reunião com o evento agendado certo.
- Papéis: Operador 1 = host; Operador 2 e Moderador = co-hosts nomeados **antes** do Go Live; **host key anotada** no roteiro impresso (rejoin/reivindicação).
- Disciplina de layout: o stream segue a visão do HOST (follow_host — devforum 144402); spotlights definidos antes (até 9, exige 3+ vídeos ligados — KB0066300); o host **não navega em menus** durante a transmissão; pin não muda o stream, só spotlight.

### 3c. O elo RTMP

1. **D-14 a D-7 — agendar o evento no YouTube:** Studio > Criar > Transmitir ao vivo > aba **Manage** > **Schedule stream**. Visibilidade: **Pública** (evento real) / Unlisted (ensaios). Título, descrição, thumbnail. Vincular a chave "INCT-webinar".
2. **Toggles do evento:** **auto-start OFF, auto-stop OFF** (V3/V5 — o default de fábrica é NÃO CONFIRMADO: conferir e anotar), **latência Normal** (audiência amazônica em 3G/4G; ultra-low aumenta buffering — https://support.google.com/youtube/answer/7444635), **DVR ON**.
3. **Copiar a URL do evento** pelo botão Share: formato `https://youtube.com/live/<VIDEOID>` — é essa que entra no CMS (3d).
4. **No dia:** encoder configurado 2 h antes, sinal 15 min antes (recomendação oficial — https://support.google.com/youtube/answer/2853856). Zoom manda RTMP (More > Livestream > Live on Custom Live Streaming Service); operador confere o preview **no evento certo** do Control Room; quando o ingest marcar Excellent/OK, **Go Live manual**. **NUNCA usar o botão OAuth "Live on YouTube" do Zoom** — cria broadcast novo com ID imprevisível (V3).
5. **Ingest reserva:** Operador 2, em outra máquina/conexão, com OBS capturando a reunião Zoom (entra como participante, dual monitor, speaker view), envia para `rtmp://b.rtmp.youtube.com/live2?backup=1` com a **mesma key** (developers.google.com/youtube/v3/live/guides/rtmps-ingestion). Failover primária→backup é automático (relato consistente de fabricantes de encoder — fonte secundária, validar no ensaio). OBS: 720p30, CBR ~4 Mbps, keyframe 2 s, AAC 128 kbps, NVENC, cabo, upload ≥8 Mbps (https://support.google.com/youtube/answer/2853702).
6. **Latência total Zoom→espectador: ~30–50 s** (~20 s do Zoom, KB0062284, + buffer do YouTube). O moderador lê perguntas do chat sabendo disso.
7. **Encerramento (ordem rígida):** moderador encerra a pauta → operador: Zoom More > **Stop Live Stream** → YouTube Control Room: confirmar fim do ingest → **End Stream** manual → só então encerrar a reunião Zoom ("encerrar reunião para todos" derruba o RTMP na hora — KB0062284).

### 3d. O embed no site (CMS)

- **O que cadastrar no campo `liveStream`:** SEMPRE `https://youtube.com/live/<VIDEOID>` (ou `https://www.youtube.com/watch?v=<VIDEOID>`). O stream.ts atual já resolve as duas para youtube-nocookie/embed. **NUNCA** cadastrar `embed/live_stream?channel=...` (formato quebrado no próprio YouTube — teste empírico 2026-08-04 com live pública da NASA retornou ERROR; e cai no bug da linha 22 do stream.ts) nem `@handle/live` (vira link externo).
- **Quando:** o evento agendado já serve de "palco" — o embed mostra slate "Ao vivo em X dias" com **horário no fuso do espectador** (teste empírico 2026-08-04, embed nocookie de evento agendado). Cadastrar em **D-7**, junto com `published:true`. O player re-verifica o estado a cada 15 s (pollDelayMs:15000 observado) — as transições espera→live→VOD acontecem sem JS do site e sem redeploy.
- **Replay:** nada a fazer — o mesmo ID vira o VOD (V3). Pré-condição de código: inverter a precedência replay URL > arquivo e remover o mp4 placeholder (seção 4, item 7).
- **Teste de embed:** sempre DENTRO de uma página (vite preview) — colar a URL do iframe na barra do navegador dá Error 153 (falta Referer) e é falso negativo (teste empírico 2026-08-04).
- **Campo novo `liveStreamBackup`** (seção 4, item 2): URL de um serviço alternativo ou, no mínimo, a watch page do YouTube — aparece como rota de fuga sob o player.

---

## 4. MUDANÇAS NO CÓDIGO

Todo o código foi lido na fonte em 2026-08-04 (caminhos Windows `\\wsl.localhost\ubuntu\home\aleff\inct\...`). Ordem em 3 marcos. Esforço total honesto: **37–41 h** incluindo ensaios (33–37 h sem o item 10).

### Até D-14 (13/08) — fundação

**PR-1 (itens 1+7+5+2 juntos, ~10 h)** — stream.ts, data.ts e config.yml precisam mudar coerentes entre si:

1. **`src/webinars/stream.ts` — bug live_stream (3 h).** Confirmado: a regex da linha 22 `/\/embed\/([A-Za-z0-9_-]{11})/` casa a literal `live_stream` (11 chars válidos) e descarta `?channel=` → iframe mudo. Conserto: (a) antes da extração de ID, se `/\/embed\/live_stream/`: com `?channel=(UC[A-Za-z0-9_-]{10,})` → embed preservando o channel (com fallback comentado para host www.youtube.com — combinação nocookie+live_stream NÃO CONFIRMADA); sem channel → `{mode:'external', provider:'YouTube'}` (nunca embed mudo); (b) `youTubeId()` rejeita `id==='live_stream'`; (c) `@handle/live` → external YouTube + `console.warn` em DEV orientando colar `youtube.com/live/<id>`; (d) acrescentar **`original: string`** ao ramo embed de `ResolvedStream` — alicerce do link de escape.
   *Tipos:* `ResolvedStream = {mode:'embed'; provider; url; original} | {mode:'file'; url} | {mode:'external'; provider; url}`.
   *Testes que travam:* `embed/live_stream?channel=UC…` → embed com channel; sem channel → external; `@handle/live` → external; regressões watch/youtu.be//live//shorts; `r.original === entrada`.

2. **`src/webinars/data.ts` — precedência do replay (2 h).** Hoje o ARQUIVO vence a URL, e o teste `'replayVideo wins over a replay URL'` (tests/logic.test.ts:183-187) trava isso — com o mp4 placeholder de Instagram no evento-semente, o VOD do YouTube nunca apareceria. Inverter: URL vence; `console.warn` em DEV quando ambos definidos. **O teste existente quebra DE PROPÓSITO** — inverter a expectativa e registrar no PR (se alguém "consertar" de volta por reflexo, o placeholder volta a sequestrar a gravação). + campos `transcricaoUrl`, `audioUrl` (via assetUrl), `libras`, `legendas`.

3. **`public/admin/config.yml` — datetime (3 h).** Diagnóstico verificado (decapcms.org/docs/widgets/#datetime, 2026-08-04): o risco é PIOR que o token Z — com `picker_utc` ausente, o picker interpreta o horário digitado **no fuso do EDITOR**: um editor em SP que digita "16:00" obedecendo ao hint grava 15:00 reais em RO, silenciosamente. Correção: `startsAt`/`endsAt` viram **widget string com pattern** `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-04:00$` (offset -04:00 literal, zero interpretação). + campos novos: `liveStreamBackup`, `questionEmbed` (boolean), objeto `acessibilidade` (libras/legendas/transcricaoUrl/audioUrl), campo select "Acessibilidade desta edição" com os 3 textos-padrão (seção 6). *Validação obrigatória em 10 min antes do merge:* `npm run dev` → `http://localhost:5173/admin/` em Chrome → "Work with Local Repository" → editar, salvar, conferir o literal com `git diff` (o modo local do Sveltia não faz commit — sveltiacms.app/en/docs/workflows/local; compatibilidade exata Sveltia×format Decap: NÃO CONFIRMADO, por isso o ensaio). *Teste automatizado:* novo `tests/webinars-cms.test.ts` lê o config.yml como texto e trava a ausência de `format 'YYYY-MM-DDTHH:mm:ssZ'` + presença dos campos novos.

4. **`liveStreamBackup` ponta a ponta (2 h).** data.ts (normalização trim||undefined), config.yml (hint: "URL alternativa em OUTRO serviço; aparece como link reserva"), parts.tsx (link "Problemas com o vídeo? Assista pela transmissão reserva", só em status live com backup definido). Teste: normalização puro no logic.test.ts.

**PR-2 — `src/webinars/format.ts` fuso (3 h).** Confirmado: `EVENT_TIME_ZONE='America/Porto_Velho'` fixo — as UFs em UTC-3 leem "16:00" e perdem 1 h. Novas funções puras: `formatTimeInZone(iso, timeZone)`, `BRASILIA_TIME_ZONE='America/Sao_Paulo'`, `visitorTimeZone()`, `scheduleLines(iso, visitorZone?)` → [Rondônia 16:00, Brasília 17:00, "no seu horário" HH:mm] com dedupe. UI no hero e no dl de WebinarEvent.tsx; EventCard mantém só Rondônia. *Testes determinísticos em 4 fusos* (timeZone explícito, sem mock): Porto_Velho→16:00; Sao_Paulo→17:00; Rio_Branco→15:00; Europe/Lisbon→21:00 (cobre DST).

**Item 3 — `src/webinars/parts.tsx` link de escape (6 h com infra de teste / 4 h mínima).** Confirmado: IframePlayer (linhas 88–119) não tem estado de erro nem saída; falha de iframe cross-origin é **indetectável de verdade** (onerror não dispara em bloqueio de rede/CSP; onload dispara mesmo com erro interno do player) — a correção real é o link permanente, não a detecção. Mudanças: fachada mostra o provedor ("Assistir agora · YouTube"); **barra fixa SOB o player** "Está com problemas? Assistir no YouTube" com `href={resolved.original}` + link reserva; timeout de 15 s pós-clique apenas ESCALA a mensagem (nunca remove o iframe); `StageStatusAnnouncer` com `aria-live="polite"` para transições de status. Rota de teste recomendada: @testing-library/react + jsdom (infra reaproveitada pelo item 8).

**Item 9 — `.github/workflows/deploy.yml` CI (4 h com ensaio).** Confirmado: não existe .github/ no repo. Conteúdo: `on: push (main) + workflow_dispatch`; `concurrency {group: deploy, cancel-in-progress: false}` (nunca cancelar FTP no meio); checkout → setup-node **`node-version: 22` PINADO** (crítico: vite build em Node 18 falha exitando 0 — sem o pin o CI publica dist quebrado "com sucesso") → `npm ci` → `npm test` (gate) → `npm run build` (+ script de .ics do item 6) → `SamKirkland/FTP-Deploy-Action@v4.4.0`, `protocol: ftps`, secrets FTP_SERVER/FTP_USERNAME/FTP_PASSWORD (conta FTP dedicada: hPanel > Arquivos > Contas FTP, restrita a public_html — caminho da raiz real: **NÃO CONFIRMADO, conferir no hPanel**), `dangerous-clean-slate: false`. Tempos: primeira execução 10–20 min (sobe tudo — **nunca estrear o CI no dia do evento**); regime ~4–6 min. Regras operacionais: upload manual pelo hPanel com CI ativo dessincroniza o `.ftp-deploy-sync-state.json` (só em emergência, apagando o sync-state depois); Sveltia grava direto no main → todo save do /admin vai ao ar em ~5 min → `published:false` é o único rascunho. **PENDÊNCIA BLOQUEANTE do fluxo celular: o `base_url` do OAuth está comentado na linha 16 do config.yml — sem OAuth configurado, não há login no /admin em produção.** Primeiro deploy em `public_html/deploy-test/` antes de apontar à raiz.

**Marco D-14 (critério de saída):** PR-1, PR-2, itens 3 e 9 merged; ENSAIO TÉCNICO 1 executado (seção 5) com os 4 blocos verdes.

### Até D-7 (20/08)

**Item 6 — ICS (4 h).** `buildIcsContent` ganha `BEGIN:VALARM / TRIGGER:-PT1H / END:VALARM` (um alarme só); nova `googleCalendarUrl(event, url)` (template `calendar.google.com/calendar/render?action=TEMPLATE&dates=...Z/...Z` — github.com/InteractionDesignFoundation/add-event-to-calendar-docs); **arquivos .ics reais** gerados no build por `scripts/build-webinar-ics.mjs` (padrão exato de build-figuras.mjs com ssrLoadModule; só eventos publicados) no lugar do data:URI — data:text/calendar em Safari iOS é problemático (**NÃO CONFIRMADO em teste próprio — validar com iPhone real no ensaio D-7**); `AddType text/calendar .ics` no .htaccess. EventCard: hoje é UM `<a>` inteiro (parts.tsx:472) — botão aninhado é HTML inválido; reestruturar para `<article>` com link principal + rodapé com "Google Agenda" e ".ics". Testes: VALARM/TRIGGER no teste ICS existente (logic.test.ts:108); encoding da URL do Google.

**Item 8 — Perguntas embutidas (2 h).** Helper puro `formsEmbedUrl(url)`: aceita só `docs.google.com/forms/**/viewform`, acrescenta `embedded=true`, devolve null para forms.gle (encurtador — hint no CMS manda colar a URL completa). Componente QuestionEmbed: iframe height≈520, lazy, + link permanente "Abrir o formulário em outra aba". Integra no QuestionBlock (parts.tsx:379-405) quando `questionEmbed && status !== 'ended'`.

**Item 10 — SEO/páginas de compartilhamento (4 h) — CONDICIONAL.** Pré-render `public/webinars/<slug>/index.html` com OG/JSON-LD + meta refresh para `/#/webinars/<slug>` (scrapers de WhatsApp não executam JS e o hash nem chega ao servidor — comentário do próprio autor em seo.ts:8-14). **Entra só se itens 1–9 estiverem verdes em D-7; senão é o primeiro item do pós-evento.**

**Higiene editorial obrigatória antes de qualquer `published:true` (1 h):** remover o `replayVideo` placeholder do evento de 23/04 e substituir os palestrantes-fixture (idênticos aos de tests/logic.test.ts).

**Marco D-7 (critério de saída):** itens 6 e 8 merged; página real publicada com registrationUrl e URL do YouTube; ENSAIO 2 executado; estrutura da página congelada.

### Até D-1 (26/08)

Sem código novo. Colar URL definitiva + liveStreamBackup via /admin; **simulação cronometrada da troca de URL pelo celular** (meta: salvar → no ar em <8 min); conferir a virada automática de status na janela 16:00–17:30 (-04:00).

**Grafo de dependências:** 1→{2,3}; 5↔{2,7,8}; 3→8 (infra de teste); 6→10; 9 independente mas pré-requisito operacional dos marcos.

**Conscientemente adiado:** ver seção 8.

---

## 5. RUNBOOK DO EVENTO (D-21 a D+7)

**Papéis (mínimo 2 operadores + 1 moderador):**
- **Operador 1 (host):** máquina cabeada, layout congelado, spotlights, inicia/religa o RTMP, host key impressa. Nunca clica Leave (logs de operadores associam unpublish à saída do host — devforum 26232).
- **Operador 2 (co-host):** 2ª máquina/conexão, OBS no ingest reserva, YouTube Control Room, monitora o player público em outra rede, chat.
- **Moderador (co-host):** pauta, perguntas (com ~40 s de defasagem em mente), encerramento verbal.

| Quando | Quem | O quê | Critério de "pronto" |
|---|---|---|---|
| **D-21** (06/08) | Coordenação + Aleff | Confirmar evento real; e-mail Fiocruz RO (licença Zoom); pergunta à fundação (invoice); criar canal YouTube marca + 2 donos; verificar telefone; disparar habilitação de live; padrão "não é para crianças" | Canal habilitado para live; resposta (ou prazo de resposta) da Fiocruz; decisão de via de pagamento |
| **D-19–D-15** | Aleff | PR-1 e PR-2 merged; conta FTP criada; secrets no GitHub; primeiro run do CI em deploy-test/ | CI verde em pasta de ensaio; testes passando |
| **D-15** (12/08) | Coordenação | Comprar Zoom Pro mensal (T5 antes: print do imposto); habilitar toggles de livestreaming e captions (3b) | T1 executado com sucesso |
| **D-14** (13/08) | Op.1 + Op.2 + Aleff | **ENSAIO TÉCNICO 1 (2 h, evento unlisted, NUNCA com a chave/evento do dia real):** ① agendar evento unlisted, anotar defaults de auto-start/stop (T3), colar ID em evento de teste published:false via /admin, deploy pelo CI, validar embed nocookie + slate + links de escape + horários nos 4 fusos + aria-live com leitor de tela; ② Zoom→RTMP→Go Live manual: bitrate estável ±10% por 30 min, ingest Excellent/OK contínuo, atraso medido (alvo ≤60 s); ③ **testes destrutivos:** derrubar internet do host 60–90 s (T2: cronometrar promoção de co-host e sobrevivência do ingest), parar o RTMP 90 s (evento deve sobreviver com auto-stop OFF — **medir a tolerância real**, é o número que o runbook de queda usa), failover OBS backup (congelamento ≤20 s), cartucho "já voltamos" no OBS; ④ T4 (legendas) e decidir a política; End Stream e cronometrar até o mesmo ID tocar como VOD | 4 blocos verdes; números anotados (tolerância de gap, atraso total, tempo de failover); qualquer vermelho reabre o item |
| **D-8** | Aleff | Itens 6 e 8 merged; higiene editorial (placeholder + fixtures) | Testes verdes; conteúdo real na página |
| **D-7** (20/08) | Todos + palestrantes | Agendar o evento REAL no YouTube (Manage, público, auto ON/OFF conforme 3c, Normal, DVR); colar `youtube.com/live/<id>` no CMS + published:true; configurar a aba Live Streaming da reunião Zoom com a key; **ENSAIO 2 (1 h, com palestrantes reais):** 10 min de transmissão unlisted paralela, áudio/eco, virtual background proibido conferido, spotlights com e sem screen share (a Libras fica ilegível com share ativo — validar o arranjo), migração para sala reserva, .ics em iPhone E Android, botão Google Agenda, Forms embutido | Página pública no ar com palco de espera funcionando; palestrantes sabem entrar, mutar e compartilhar; .ics abre nos dois sistemas |
| **D-2** | Moderador | Roteiro impresso (pauta, host key, telefones de todos, URLs e chaves), termo LGPD simples enviado aos palestrantes (transmissão pública no YouTube + gravação — o aviso nativo do Zoom cobre a sala, não a publicação, KB0059819) | Termos devolvidos; roteiro nas mãos dos 3 papéis |
| **D-1** (26/08) | Op.1 + Op.2 | Simulação cronometrada: trocar liveStream via /admin pelo celular → no ar (<8 min); conferir virada de status na janela do evento; agendar o **evento reserva "parte 2"** (unlisted, mesma key) para o cenário de ID queimado; checklist de máquinas (SO atualizado ANTES, não no dia; notificações OFF) | Troca de URL cronometrada e documentada; evento reserva agendado |
| **D-0 H-2h** | Op.1 | Abrir a sala; waiting room ON; gravação nuvem+local ON; captions conforme política; cartucho carregado no OBS do Op.2 | Sala estável, 2 co-hosts nomeados |
| **D-0 H-75min** | Todos | Palestrantes entram; áudio individual; spotlights definidos (mesa + intérprete ≤9); ordem de tela ensaiada | Cada palestrante ouvido e visto no layout final |
| **D-0 H-30** | Op.1 + Op.2 | Zoom: More > Livestream > Custom (RTMP começa); conferir preview NO evento certo do Control Room; OBS reserva conectado ao backup=1 | Ingest primário e backup Excellent/OK |
| **D-0 H-15** | Op.1 | **Go Live manual** no Control Room (slate/cartucho de abertura); Op.2 confirma no player público em outra rede; link do YouTube postado nas redes junto com o do site | Live pública visível no embed do site |
| **16:00** | Moderador | Abertura. Regras durante: host não navega; perguntas lidas com defasagem; Op.2 monitora chat + saúde do ingest a cada 5 min | — |
| **Encerramento** | Moderador → Op.1 | Pauta encerrada → Zoom More > **Stop Live Stream** → Control Room: ingest zerado → **End Stream** → só então encerrar a reunião Zoom → confirmar VOD no mesmo ID | VOD tocando no embed do site |
| **D+1** | Aleff | Métricas (Studio > Content > Live > Analytics > Engagement, disponíveis minutos após o fim): pico e média de simultâneos, horário do pico, chat/min no Q&A, tempo médio, origem embed (insightPlaybackLocationDetail) vs YouTube direto; baixar gravação nuvem+local do Zoom; disparar Whisper na gravação; Trim da sala de espera no Studio (preserva URL/views — answer/9057455, vídeo <6 h) | Planilha de indicadores preenchida; .srt bruto gerado |
| **D+2–D+5** | Bolsista + Aleff | Revisão humana da legenda (4–8 h, Subtitle Edit); upload .srt: Studio > Legendas > vídeo > Adicionar; conferir qual trilha fica padrão (a automática pt do VOD mascara a ausência da revisada); transcrição .txt + MP3 (32 kbps mono) para o Internet Archive; episódio no Spotify for Creators; campos transcricaoUrl/audioUrl no CMS | Página do evento com replay + transcrição + áudio |
| **D+7** | Coordenação | Cancelar o plano Zoom (Plans and Billing > Cancel Plan) **depois** de baixar as gravações; revogar mandato Pix Automático no app do banco (se Pix); retro de 30 min: números do ensaio vs dia real, atualizar este runbook | Assinatura cancelada; runbook v2 |

### Procedimento de queda (cada elo)

| Elo que cai | Ação imediata | Fundamento |
|---|---|---|
| **Palestrante** | Nada no stream; moderador faz ponte; palestrante reentra | vídeo individual não afeta o RTMP |
| **Internet do host (breve)** | RTMP tende a seguir (nuvem — V2); co-host promovido segura a sala; host volta e reivindica com host key; se o RTMP caiu, o NOVO host religa More > Livestream > Custom com a MESMA key → mesmo evento (auto-stop OFF segura — V5); janela segura = o número medido no ensaio D-14 | V2/V5 + KB0060769; comportamento na queda total: NÃO documentado — por isso o teste |
| **Nuvem do Zoom inteira** | Palestrantes migram para a sala reserva (ConferênciaWeb RNP ou 2ª reunião); OBS do Op.2 troca a janela capturada; evento YouTube e embed intactos | ingest backup já conectado |
| **Ingest primário do YouTube** | Failover automático para o backup=1 do OBS (congelamento breve) | rtmps-ingestion + fabricantes (fonte secundária, validado no ensaio) |
| **Evento encerrado por engano (ID queimado)** | Promover o evento reserva "parte 2": Go Live nele; trocar o liveStream no CMS pelo celular (<8 min até o ar via CI); enquanto isso o público usa o link de escape/backup visível sob o player; avisar no chat da live morta | broadcast complete não reabre (invalidTransition — V3) |
| **Site/Hostinger fora** | Público segue no YouTube (o link da watch page SEMPRE acompanha a divulgação) | independência dos canais |
| **Cartucho de vídeo reserva** | Cena do OBS com mp4 "Voltamos em instantes" (áudio da YouTube Audio Library) — usado no pré-show e em qualquer buraco >30 s | Content ID proíbe música comercial (answer/3367684) |

---

## 6. ACESSIBILIDADE

### Entra JÁ (custo ~zero, sem depender de decisão)

1. **Declaração honesta na página do evento** — campo select no CMS com 3 textos-padrão (config.yml, item 5 da seção 4): **A** (com Libras + legenda ao vivo — só publicar com contrato assinado), **B** (transmissão sem recursos ao vivo; gravação com legendas revisadas e transcrição em até X dias úteis), **C** (sem recursos nesta edição + e-mail para solicitar atendimento sob demanda — espírito da LBI). Base legal: **LBI, Lei 13.146/2015, art. 63** (sítios conforme melhores práticas internacionais = WCAG na prática); eMAG só vincula órgãos SISP (Portaria nº 3/2007 — emag.governoeletronico.gov.br). **Nunca escrever "conforme eMAG/WCAG" sem auditoria** — promessa vira passivo. (Texto da LBI: conferência manual no Planalto pendente — o fetch falhou em 2026-08-04.)
2. **Legenda do Zoom no ao vivo (decisão informada por V4):** a legenda automática pt-BR do Zoom (grátis na conta paga, KB0058810) **atravessa o RTMP** e aparece no YouTube sem opção de ocultar só no stream. Como o YouTube não tem legenda automática ao vivo em pt (EN-only, 1.000+ inscritos — answer/6373554), a recomendação padrão é **deixar ON**: é a única legenda ao vivo de custo zero. O teste T4 no ensaio confirma o formato (queimada vs trilha CC) e a qualidade; se ficar ilegível, desligar e cair no texto-padrão B.
3. **Legenda revisada + transcrição do replay (compromisso padrão de TODO evento):** baixar o VOD/gravação → Whisper (local grátis, ou API US$ 0,006/min ≈ US$ 0,72/evento de 2 h — developers.openai.com/api/docs/pricing) → revisão humana 4–8 h no Subtitle Edit (Whisper alucina em silêncio/vinheta — nunca subir sem revisar) → upload .srt no Studio > Legendas → a mesma .srt vira a transcrição da página e o roteiro do MP3.
4. **Rota de baixa banda:** MP3 (~32 MB/2 h) + transcrição no **Internet Archive** (grátis, URL permanente — help.archive.org) + episódio no **Spotify for Creators** (RSS grátis). Fora do dist/ do site.
5. **Dentro da sala Zoom:** captions pt-BR para palestrantes, multi-pin liberado para participantes surdos, palestrantes instruídos a descrever slides oralmente (beneficia também o áudio).

### Depende de decisão/orçamento

1. **Libras na transmissão.** Arranjo técnico definido: o canal dedicado de interpretação do Zoom **não entra** no stream nem na gravação (KB0065246/WebAIM) — o intérprete entra como **participante comum spotlighted** junto da mesa (≤9 spotlights). Ressalva do ensaio: com screen share ativo o intérprete vira thumbnail ilegível — validar o layout em D-7; se inaceitável, a produção via OBS (cena com janela de Libras em proporção fixa, NT audiovisual da FEBRAPILS) é o caminho. **Norma:** eventos >40 min = **2 intérpretes** com revezamento ~20 min (FEBRAPILS NT 02/2017 — febrapils.org.br). **Custo:** mercado **NÃO CONFIRMADO** — orçar cedo. **Via de custo zero a explorar primeiro:** o **Decreto 5.626/2005** obriga as instituições federais de ensino a manter tradutores/intérpretes de Libras — solicitar formalmente os TILS do quadro da **UNIR** para os webinários do INCT (disponibilidade: NÃO CONFIRMADA; 1 ofício resolve a dúvida).
2. **CART/estenotipia ao vivo (qualidade superior à ASR).** Rota tecnicamente fechada: estenotipista → StreamText → HTTP POST na Captions Ingestion URL do YouTube (answer/3068031; a URL é POR transmissão — enviar ao legendista com antecedência). Plataforma: US$ 0,09/min ≈ **US$ 10,80/evento de 2 h** (streamtext.net/features-and-pricing). Honorário do profissional pt-BR: **NÃO CONFIRMADO** (Real Time Caption, STN Caption — pedir orçamento citando "entrega via StreamText na ingestion URL do YouTube"). Atenção: o delay de 30–60 s recomendado para sincronizar legenda conflita com Q&A ao vivo — decidir prioridade por evento.
3. **Duas saídas (com/sem Libras) sem dobrar infra:** live via OBS com Libras queimada (arquivada no YouTube) + cloud recording limpa do Zoom como master do replay editorial. Custa 1 upload extra; evita condenar o acervo à moldura da transmissão.

---

## 7. RISCOS RESIDUAIS

| Risco | Prob. | Impacto | Mitigação já embutida no plano |
|---|---|---|---|
| Evento do YouTube encerrado por engano → ID queimado, embed morto | Baixa | Alto | Auto-stop OFF; End Stream só com dupla confirmação e após Stop Live Stream no Zoom; evento reserva "parte 2" pré-agendado; troca de URL via CMS+CI <8 min; link de escape permanente sob o player |
| Queda total do host derruba o RTMP (comportamento não documentado) | Média | Médio | 2 co-hosts nomeados; host key impressa; religar Custom com a mesma key = mesmo evento; janela segura medida no ensaio D-14 |
| Tolerância de gap do ingest menor que o esperado | Média | Médio | Número real medido no ensaio (T3); OBS reserva no backup=1 elimina o gap na maioria dos cenários |
| Upload do operador degrada slides (stream "no ar" com slide congelado) | Média | Médio | Cabo obrigatório; slides também abertos na máquina do Op.2 (OBS reserva); teste T2 |
| Legenda do Zoom sai queimada com qualidade ruim | Média | Baixo | T4 decide ON/OFF por evento; textos-padrão B/C ajustam a promessa da página |
| Imposto do checkout Zoom acima da margem | Baixa | Baixo | Margem 10–25% no orçamento; T5 fecha o número antes da compra |
| Fundação exige NF-e → custo 4–5x (reseller) | Média | Alto (orçamento) | Pergunta disparada em D-21, ANTES da compra; alternativa Fiocruz RO |
| Habilitação de live do canal atrasa (>24 h) ou falha | Baixa | Alto | Feita em D-21, com 3 semanas de folga; ensaio D-14 depende dela |
| Content ID interrompe a live (música) | Baixa | Alto | Proibição de música comercial; vinheta da YouTube Audio Library; cartucho próprio |
| Anúncios aparecem na live (canal fora do YPP, sem opt-out — answer/2475463) | Alta | Baixo | Risco de imagem aceito e comunicado internamente na escolha da plataforma |
| Editor fora de RO corrompe horário no CMS | Alta (sem fix) | Médio | Item 5: widget string com offset -04:00 literal + teste que trava o formato |
| Sveltia/OAuth do /admin em produção não configurado a tempo | Média | Médio | Pendência nomeada no item 9; fallback: editar JSON via GitHub web + push (CI publica) |
| CI dessincronizado por upload manual | Média | Médio | Regra operacional: manual só em emergência + apagar sync-state; primeiro run em deploy-test/ |
| Palestrante com Zoom desatualizado quebra recurso de interpretação | Média | Baixo | Client ≥5.11.3 exigido no convite; conferido no ensaio D-7 |
| Zoom (nuvem) fora do ar no horário | Baixa | Alto | Sala reserva (RNP/2ª reunião) + OBS do Op.2 troca a captura; evento YouTube intacto |

---

## 8. O QUE FICOU DE FORA E POR QUE

- **Zoom Webinars 500 (R$ 4.900/ano):** desnecessário — livestream de reunião no Pro cobre a arquitetura (V1); a audiência fica no YouTube.
- **1080p:** exige Business/Enterprise + habilitação pelo suporte (KB0066166); 720p atende webinário de slides e fala.
- **StreamYard/Restream/vMix como mesa:** a arquitetura foi decidida; reavaliá-la não é escopo deste plano.
- **Translated captions do Zoom:** add-on acima do Pro, preço sob Sales (KB0059081); evento é monolíngue pt-BR.
- **Embed por playlist como antídoto de ID queimado:** substituído por CI rápido (<8 min) + evento reserva + links de escape — mesma proteção sem mudar o contrato do stream.ts.
- **hls.js/streaming próprio:** hospedagem compartilhada sem backend não sustenta; YouTube resolve distribuição e DVR de graça.
- **Chat do YouTube embutido no site:** não funciona em mobile web por limitação oficial (answer/2524549) — exatamente o dispositivo da audiência; fica o botão "Comentar no YouTube".
- **Alcance por UF no relatório:** YouTube Analytics não tem province fora dos EUA (developers.google.com/youtube/analytics/dimensions); proxy = top cidades + formulário de inscrição.
- **Descontos TechSoup/Education:** terceiro setor apenas / mínimo 20 licenças — INCT não se enquadra; anotada a hipótese futura via fundação de apoio (50% off Zoom Cares).
- **Link dedicado de internet para o operador:** o RTMP sai da nuvem (V2); o investimento certo é cabo + OBS reserva + uplink dos palestrantes.
- **Sistema de lembrete por e-mail:** sem backend; o VALARM -PT1H no .ics + botão Google Agenda cumprem o papel.
- **Item 10 (páginas de compartilhamento pré-renderizadas):** valioso mas sem dependentes — entra só se D-7 estiver verde; senão, primeiro item do pós-evento.
- **Auditoria WCAG do site inteiro:** fora do escopo do módulo webinar; a página declara apenas o que cada edição oferece (LBI art. 63).
- **Estenotipia contratada já no primeiro evento:** preço do profissional pt-BR NÃO CONFIRMADO e agenda escassa — orçamento primeiro, promessa depois (nunca publicar o texto-padrão A sem contrato assinado).

---

**Arquivos do repo referenciados (leitura, nada foi modificado):** `\\wsl.localhost\ubuntu\home\aleff\inct\src\webinars\stream.ts` (bug na linha 22, reconfirmado hoje), `data.ts`, `format.ts`, `parts.tsx`, `WebinarEvent.tsx`, `seo.ts`, `public\admin\config.yml`, `tests\logic.test.ts`, `scripts\build-figuras.mjs`; ausência de `.github/workflows` reconfirmada hoje.