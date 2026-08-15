# Tutorial: o ensaio de transmissão de ponta a ponta (custo zero)

**O que este teste prova:** que a página do webinário no seu site faz o ciclo
completo — *sala de espera → ao vivo → gravação* — **sem trocar de URL**, usando
um evento agendado do YouTube. É o contrato em que todo o plano se apoia
(vereditos V3 e V5 de `docs/plano-webinario-zoom-youtube.md`). Você faz tudo com
conta gratuita do YouTube + OBS (grátis); o Zoom não participa deste ensaio.

**Tempo:** ~1 h de execução (+ até 24 h de espera única na Parte 0).
**Ninguém vê seu teste:** a transmissão será "não listada" e o site editado é o
local (`localhost:4173`) — a produção não é tocada.

---

## O mapa do que vamos montar

```
OBS (seu computador)
  │  envia o vídeo (chave de stream)
  ▼
YOUTUBE — evento AGENDADO, não listado, com um VIDEO ID fixo
  │  youtube.com/live/<ID>  ← esta URL nunca muda
  ▼
SEU SITE (local) — o campo liveStream do evento aponta para a URL acima
  → a página mostra: espera → ao vivo → replay, sozinha
```

---

## Parte 0 — Habilitar transmissão no canal (uma vez; espera de até 24 h)

> Se o canal já transmitiu ao vivo alguma vez, pule para a Parte 1.

1. Entre no YouTube com a conta do canal (idealmente a conta de marca do INCT).
2. Acesse **youtube.com/verify** e verifique por telefone (SMS).
3. Clique no ícone de câmera (canto superior direito) → **Transmitir ao vivo**.
   O YouTube dirá que a habilitação está em processamento — **pode levar até
   24 h**. Volte amanhã.

---

## Parte 1 — Agendar a transmissão de teste no YouTube

1. **YouTube Studio** → botão **Criar** → **Transmitir ao vivo**.
2. Na Sala de Controle, abra a aba **Gerenciar** (Manage) → **Programar
   transmissão** (Schedule stream).
3. Preencha:
   - Título: `Teste técnico INCT (ignorar)`
   - Visibilidade: **Não listado** ← importante
   - Data: hoje, daqui a ~30 min.
4. Salve. Na tela do evento, clique em **Compartilhar** e copie a URL — formato
   `https://youtube.com/live/XXXXXXXXXXX`. **Guarde-a**, é ela que vai no site.
5. Ainda na tela do evento, confira as duas chaves de segurança do ensaio:
   - **Início automático (auto-start): DESLIGADO**
   - **Interrupção automática (auto-stop): DESLIGADO** ← é o que impede uma
     queda de internet de "queimar" o evento para sempre.
6. Anote a **chave de transmissão** (Stream key) mostrada nessa mesma tela —
   o OBS vai precisar dela.

---

## Parte 2 — Apontar o site local para o evento

1. Abra `src/content/webinars/webinario-ofidio-venom-saude-1.json`
   e faça DUAS mudanças temporárias (não commite!):

   ```json
   "status": "live",
   "liveStream": "https://youtube.com/live/XXXXXXXXXXX",
   ```

   (`status: "live"` força o modo ao vivo sem esperar o dia 27/08; a URL é a
   que você copiou na Parte 1, item 4.)

2. Construa e sirva o site — **atenção ao Node**: o Node 18 padrão do WSL
   *falha em silêncio*; use o do projeto:

   ```bash
   cd ~/inct
   export PATH="$HOME/inct/.tools/node-v22.22.3-linux-x64/bin:$PATH"
   node --version    # tem de dizer v22.22.3
   npm run build
   npm run preview   # serve em http://localhost:4173
   ```

3. Abra `http://localhost:4173/#/webinars/webinario-ofidio-venom-saude-1`.
   Você deve ver o selo **AO VIVO** e a fachada "Assistir agora". Clique nela:
   o player carrega com a **tela de espera** do evento agendado ("A transmissão
   começará em breve"). Isso já prova metade do contrato.

   > Nunca teste colando a URL de embed direto na barra do navegador — o
   > YouTube bloqueia por falta de Referer e mostra um ERRO que não existe
   > dentro da página.

---

## Parte 3 — Transmitir com o OBS

1. Instale o OBS Studio (obsproject.com, grátis).
2. Em **Configurações → Transmissão**: Serviço = *YouTube - RTMPS*; clique em
   **Usar chave de transmissão** e cole a chave da Parte 1, item 6.
3. Monte qualquer cena (a captura da tela serve; melhor ainda: uma janela com
   um **relógio visível** — ajuda a medir o atraso).
4. Clique **Iniciar transmissão** no OBS.
5. Volte à Sala de Controle do YouTube: o preview do SEU evento deve aparecer
   com sinal "Excelente/OK". Clique **TRANSMITIR AO VIVO** (Go Live) — o passo
   manual existe porque o auto-start está desligado, de propósito.
6. Recarregue a página do seu site local: **o embed toca a transmissão**.
   Atraso normal: 10–30 s (compare com o relógio da cena).

---

## Parte 4 — Os testes de queda (a parte mais valiosa)

Com a live rolando no seu site:

1. **Feche o OBS abruptamente** (simule a queda). Cronometre **2 minutos**.
   - ✔ esperado: o player mostra tela de espera/congelada, mas o evento **não
     encerra** (auto-stop desligado). No Studio, o evento segue "ao vivo".
   - ✘ se o evento encerrar sozinho: anote o tempo — esse número muda o
     runbook do dia (significa religar em menos que isso).
2. **Reabra o OBS e transmita de novo** com a MESMA chave.
   - ✔ esperado: a live volta **no mesmo player, na mesma URL** — o site não
     precisou de nenhuma mudança. É isso que salva o evento real de uma queda.
3. Ao terminar, encerre NA ORDEM: pare o OBS → no Studio, **Encerrar
   transmissão** (End Stream).
4. Espere 1–5 min e recarregue a página do site:
   - Troque no JSON `"status": "live"` → `"status": "ended"` e rode
     `npm run build` de novo.
   - ✔ esperado: o palco agora toca o **replay** — mesma URL, sem editar o
     campo `liveStream`. O ciclo inteiro aconteceu num único endereço.

---

## Parte 5 — Limpeza (2 min)

```bash
cd ~/inct
git checkout -- src/content/webinars/
npm run build
```

No YouTube Studio, apague o vídeo de teste (Conteúdo → Transmissões ao vivo),
ou deixe-o não listado como registro do ensaio.

---

## O que você acabou de provar

| Observação no teste | O que garante no evento real |
|---|---|
| A URL agendada funcionou antes, durante e depois | Você cadastra o `liveStream` no CMS **dias antes**, com calma |
| Queda de 2 min não encerrou o evento | Uma instabilidade no dia não "queima" o link do site |
| Religar com a mesma chave voltou no mesmo player | O público não precisa de link novo após um susto |
| O replay tocou na mesma URL | Ninguém edita nada às pressas depois do evento |

## Se algo der errado

- **O embed mostra erro dentro do site** → confira se a URL no JSON é
  `youtube.com/live/<id>` (nunca `embed/live_stream?...` nem `@canal/live`).
- **"Transmitir ao vivo" não aparece no Studio** → a habilitação da Parte 0
  ainda não concluiu (até 24 h).
- **O OBS não conecta** → chave errada (cada evento agendado tem a sua) ou
  firewall; confira em Configurações → Transmissão.
- **O evento encerrou na queda** → o auto-stop estava ligado. Agende OUTRO
  evento (o ID encerrado não volta), desligue o auto-stop e repita a Parte 4.
- **`npm run build` termina "ok" mas o site fica velho** → você está no Node
  18 (a armadilha clássica); repita o `export PATH` da Parte 2.

**Próximo ensaio depois deste:** o mesmo fluxo com o Zoom Pro no lugar do OBS
(More → Livestream → Custom Live Streaming Service) — é o teste T1/T2 do
plano, no mês pago do evento real.
