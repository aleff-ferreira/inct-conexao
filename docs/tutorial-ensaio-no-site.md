# Ensaio de transmissão no site oficial — passo a passo

**O que este teste prova:** que a transmissão aparece e toca **na página real**,
em `inct-conexao.com.br`, no domínio de verdade, com HTTPS de verdade, no
celular de verdade. É o ensaio mais fiel possível antes do dia 18.

**Como fica no YouTube:** a transmissão será **não listada** — fora da busca,
fora do canal, e **os inscritos não são notificados** (isso é documentado pelo
próprio YouTube). Só quem tiver o link assiste.

**Como fica no site:** a página do webinário aparece "AO VIVO" para qualquer
visitante enquanto o teste durar. Você já aceitou isso; é o que torna o teste
possível.

---

## ⚠️ Três coisas para saber antes de começar

1. **Use uma transmissão descartável.** O site publica a URL em texto clicável
   embaixo do player ("assistir direto no YouTube"). Depois do ensaio esse link
   deixa de ser secreto. **Não use a mesma transmissão que vai servir o dia 18** —
   crie uma só para o teste e apague depois.
2. **O teste tem começo e fim, e o fim é obrigatório.** São dois envios da pasta:
   um para entrar no estado de teste, outro para sair. Enquanto não subir o
   segundo, o site continua "AO VIVO".
3. **Enquanto o ensaio estiver no ar**, três frases do site ficam incoerentes
   (é temporário e não quebra nada):
   - o botão **"Adicionar à agenda"** some da página do evento;
   - o hub diz *"Nenhuma transmissão agendada"* ao lado de *"Ao vivo agora"*;
   - o bloco de perguntas segue dizendo *"será aberto pouco antes"*.

   Por isso: **faça curto** (30 a 60 minutos) e evite horário de pico.

---

## Parte 1 — Preparar a transmissão no YouTube (10 min)

1. **YouTube Studio** → **Criar** → **Transmitir ao vivo**.
2. Aba **Gerenciar** → **Programar transmissão**.
3. Preencha:
   - Título: `Ensaio técnico (ignorar)`
   - **Visibilidade: Não listada** ← o ponto central
     *Não escolha "Privada": com ela o player do site simplesmente não funciona.*
   - Data/hora: agora mesmo.
4. **Confira "Permitir incorporação"** — sem isso o iframe do site dá erro.
   Procure em **Studio → Conteúdo → Ao vivo → (o evento) → Detalhes → Mostrar
   mais**. Se não achar ali, veja em **Sala de Controle → Editar →
   Personalização**.
5. Nas **Configurações avançadas** do evento, deixe:
   - **Início automático: DESLIGADO**
   - **Interrupção automática: DESLIGADO** ← impede que uma queda de rede
     encerre o evento e queime o link
6. **Copie duas coisas:**
   - a **URL** (botão Compartilhar): `https://youtube.com/live/XXXXXXXXXXX`
   - a **chave de transmissão** (Stream key)

---

## Parte 2 — Mandar o Zoom para o YouTube (10 min)

> Só se for testar com o Zoom. Para testar apenas o site, o OBS serve igual.

1. No navegador, em **zoom.us** → **Configurações da conta** → aba **Reunião** →
   **Em reunião (avançado)** → ligue **"Permitir transmissão ao vivo de
   reuniões"** e marque **Custom Live Streaming Service**. (Uma vez só; vale
   para sempre.)
2. Abra o **Zoom no computador** (o recurso não existe no celular) → **New
   meeting**.
3. Dentro da reunião: **More (…)** → **Live on Custom Live Streaming Service**.
4. Preencha:
   - **Stream URL:** `rtmp://a.rtmp.youtube.com/live2`
   - **Stream key:** a chave que você copiou
   - **Live streaming page URL:** a URL da transmissão
5. Confirme. Em ~20 segundos o YouTube Studio mostra o sinal chegando.
6. Quando o Studio disser que o sinal está **OK/Excelente**, clique
   **TRANSMITIR AO VIVO** (é manual porque o início automático está desligado).

---

## Parte 3 — Colocar o ensaio no site (5 min + upload)

No terminal do WSL, na pasta do projeto:

```bash
cd ~/inct
bash scripts/ensaio-transmissao.sh --producao https://youtube.com/live/XXXXXXXXXXX
```

O script faz tudo sozinho: força o estado "ao vivo", roda os testes, gera a
pasta `inct_deploy/` e imprime as instruções. Ele também cria o arquivo
`inct_deploy/ENSAIO-ATIVO.txt` — um lembrete visível na listagem do hPanel de
que aquele pacote **não é o site normal**.

Depois:

1. **hPanel → Gerenciador de Arquivos → `public_html`**
2. Suba o conteúdo de `inct_deploy/` como você já faz
3. Abra o site com **Ctrl+Shift+R** (recarga forçada, senão o navegador serve o
   HTML antigo do cache)

---

## Parte 4 — O que conferir (o teste em si)

Abra **https://inct-conexao.com.br/#/webinars/webinario-ofidio-venom-saude-1**

| Confira | Esperado |
|---|---|
| Selo | **Ao vivo** (ponto vermelho pulsando) |
| Palco | fachada "Assistir agora · YouTube"; ao clicar, **o vídeo toca** |
| Sob o player | link "assistir direto no YouTube" |
| Console (F12) | sem erro vermelho |
| **No celular, no 4G** | o vídeo toca; a página rola sem estourar de lado |
| Numa **aba anônima** | funciona igual (prova que não depende de você estar logado) |
| Home e `/#/webinars` | também mostram "Ao vivo" |

**Os testes que valem mais** (fazem a diferença no dia 18):

1. **Derrube o encoder** (feche o Zoom ou o OBS) e cronometre **2 minutos**.
   O evento **não pode encerrar** no YouTube Studio — deve ficar "aguardando".
   *Se encerrar, a interrupção automática ficou ligada: corrija antes do dia 18.*
2. **Religue** com a mesma chave. A transmissão volta **no mesmo player**, sem
   ninguém mexer no site.
3. Meça o **atraso**: ponha um relógio na tela compartilhada e compare com o
   site. Normal: 20 a 40 segundos. É esse atraso que o moderador precisa ter em
   mente ao ler perguntas do público.

---

## Parte 5 — Desfazer (OBRIGATÓRIO)

```bash
cd ~/inct
bash scripts/ensaio-transmissao.sh --fim
```

E **suba `inct_deploy/` de novo**. Só isso tira o site do estado de teste.

Depois, confirme:

```bash
bash scripts/probe-live.sh
```

Por fim, duas limpezas:

- **No YouTube:** encerre a transmissão (**End Stream**) e apague o vídeo do
  ensaio (Studio → Conteúdo → Ao vivo). O link já circulou; não deixe rastro.
- **No hPanel:** apague em `public_html/assets/` os arquivos `.js` que **não
  existem** na sua `inct_deploy/` nova. Um deles é o pacote do ensaio, e ele
  continua alcançável por link direto até ser apagado — foi exatamente o que
  aconteceu com a matéria embargada antes.

---

## Se algo der errado

| Sintoma | Causa provável |
|---|---|
| Player mostra "Vídeo indisponível" | a transmissão está **Privada** (tem de ser Não listada) ou "Permitir incorporação" está desligada |
| Player fica preto e não toca | o YouTube ainda não recebeu sinal, ou você não clicou em **Transmitir ao vivo** no Studio |
| O site continua "Em breve" depois do upload | HTML em cache — **Ctrl+Shift+R**; se persistir, o upload não chegou (rode `probe-live.sh`) |
| Não aparece "Live on Custom Live Streaming Service" no Zoom | o interruptor da Parte 2, passo 1, está desligado (ou travado no nível da conta) |
| O evento encerrou sozinho na queda | interrupção automática ligada; agende **outro** evento (o encerrado não volta) e desligue |
| `build-deploy.sh` recusa rodar | há ensaio ativo — é a trava funcionando. Rode `--fim` |

---

## Um ensaio ainda mais seguro, se quiser (opcional)

Antes de mexer no site oficial, dá para testar o mesmo player **só na sua
máquina**, sem upload nenhum:

```bash
bash scripts/ensaio-transmissao.sh https://youtube.com/live/XXXXXXXXXXX
```

Abre em `http://localhost:5199`, e **Ctrl+C** desfaz. É o mesmo código do site;
só não prova o domínio real. Bom para descobrir erro de configuração do YouTube
antes de publicar qualquer coisa.
