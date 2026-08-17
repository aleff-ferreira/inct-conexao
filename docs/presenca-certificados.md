# Presença e certificados — 1º Webinário OFÍDIO-VENOM-SAÚDE

**Regra:** certificado de 2 horas para quem permanecer **pelo menos 50%** do
evento (60 dos 120 minutos).

---

## Por que não dá para pegar isso da plataforma

O público assiste por um **iframe do YouTube** na página do site. Nenhuma
plataforma envolvida entrega tempo de permanência **por pessoa identificada**:

- **YouTube Analytics** dá agregados (pico de simultâneos, tempo médio,
  retenção) — nunca "fulano assistiu de 19h10 às 20h30".
- **Zoom** só vê quem entra na *reunião*; o público não entra, fica no YouTube.
- **Login no site** exigiria que 154 pessoas criassem conta para assistir um
  webinário gratuito. Atrito desproporcional, e a construir em menos de um dia.

Sobra o caminho honesto: **pedir uma ação ao participante em momentos que ele
só conhece se estiver assistindo.** É o método clássico das palavras-chave, e
é robusto quando o cronograma é feito com cuidado.

---

## O cronograma — e a armadilha que ele evita

Cada palavra-chave prova presença **naquele instante**. O que um conjunto de
palavras prova é o **intervalo entre a primeira e a última** que a pessoa
acertou. Por isso o que vale é o **pior caso** de cada combinação aceita.

O arranjo intuitivo — uma palavra no início de cada palestra — **falha**,
porque as palestras se concentram na primeira hora:

| Arranjo | Palavras em | Regra | Permanência garantida |
|---|---|---|---|
| Intuitivo (uma por palestra) | 19:10, 19:30, 19:50, 20:50 | 3 de 4 | **40 min (33%)** ❌ |
| **Espalhado** | **19:10, 19:45, 20:20, 20:50** | **3 de 4** | **65 min (54%)** ✅ |
| Espalhado, exigindo todas | 19:10, 19:45, 20:20, 20:50 | 4 de 4 | 100 min (83%) — sem perdão |
| Só duas pontas | 19:15, 20:45 | 2 de 2 | 90 min (75%) — sem perdão |

**Adotado: quatro palavras espalhadas, exigindo três.** Garante 54% e ainda
tolera uma queda de conexão ou uma ida ao banheiro. Conferência combinação a
combinação:

```
19:10 + 19:45 + 20:20  ->  70 min (58%)   ok
19:10 + 19:45 + 20:50  -> 100 min (83%)   ok
19:10 + 20:20 + 20:50  -> 100 min (83%)   ok
19:45 + 20:20 + 20:50  ->  65 min (54%)   ok   <- pior caso
```

### As quatro palavras (defina hoje e não mude)

| # | Horário (Rondônia) | Momento do programa | Palavra |
|---|---|---|---|
| 1 | **19:10** | início da 1ª palestra (Bernarde) | `__________` |
| 2 | **19:45** | transição para a 3ª palestra | `__________` |
| 3 | **20:20** | durante o debate | `__________` |
| 4 | **20:50** | na síntese, antes de encerrar | `__________` |

Escolha palavras do tema, fáceis de escrever e difíceis de adivinhar
(ex.: `jararaca`, `surucucu`, `cascavel`, `coral` — mas **não use estas**,
que estão publicadas aqui). Uma palavra só, sem espaço, sem número.

**Quem anuncia:** o moderador, em voz alta **e** no chat da transmissão, e
peça ao operador para escrever também na tela por ~30 segundos. Quem está no
celular ouvindo enquanto cozinha precisa conseguir anotar.

---

## O formulário

Um único formulário do Google, preenchido **no fim** (link anunciado no
início e repetido a cada palavra).

**Campos:**
1. Endereço de e-mail — **o mesmo da inscrição** (deixe isso em negrito)
2. Nome completo
3. `1ª palavra-chave` · 4. `2ª palavra-chave` · 5. `3ª palavra-chave` ·
   6. `4ª palavra-chave` — texto curto, **nenhuma obrigatória**
   *(a pessoa que perdeu uma deixa em branco; a regra é 3 de 4)*

**Configuração:** coletar e-mail automaticamente se puder; limitar a 1
resposta por pessoa; **aceitar respostas até 22h00 de 18/08** (fecha uma hora
depois do fim, cobre quem teve problema e evita preenchimento no dia seguinte).

> Não use o recurso de "questionário com nota". A apuração é feita pelo
> script, que aceita acento, espaço, maiúscula e pontuação — o corretor
> automático do Forms reprovaria quem digitou "Jararacá!".

---

## A apuração (automática)

Terminado o evento, exporte as respostas em CSV e rode:

```bash
python3 scripts/apurar-presenca.py respostas.csv \
    --codigos palavra1 palavra2 palavra3 palavra4 \
    --minimo 3 --simular
```

O `--simular` mostra o resultado sem gravar nada. Conferido, rode de novo sem
ele: saem dois arquivos em `envio-webinario-ofidio/`:

- **`certificados-aprovados.csv`** — nome, e-mail e instituição, pronto para
  emitir.
- **`certificados-revisar.csv`** — cada caso com o motivo (acertou menos que
  o mínimo, e-mail que não bate com nenhum inscrito, resposta duplicada).

O script já resolve sozinho, testado:

- **acento, espaço, maiúscula e pontuação** — "Jararacá! " conta como acerto;
- **alias do Gmail** — `j.o.a.o+webinar@gmail.com` é reconhecido como
  `joao@gmail.com`, senão um ponto tiraria o certificado de quem assistiu;
- **resposta duplicada** — mantém a primeira e registra a segunda para revisão;
- **quem não estava inscrito** — separa em vez de aprovar ou descartar calado.

---

## O que dizer aos inscritos (já está no e-mail)

> **CERTIFICADO**
> Para receber o certificado (2 horas), você precisa acompanhar pelo menos
> metade da transmissão. Durante o webinário vamos anunciar **quatro
> palavras-chave** em momentos diferentes — no início, no meio e perto do
> fim. Anote-as.
> Ao final, preencha o formulário de presença (o link será divulgado durante
> a transmissão e enviado por e-mail logo depois). Quem informar **pelo menos
> três das quatro palavras** recebe o certificado.
> Use o **mesmo e-mail** da inscrição.

---

## Limites que vale conhecer

**Compartilhamento de palavras entre colegas.** É o vetor óbvio, e nenhum
método sem login o elimina. Mitiga-se anunciando em quatro momentos
espalhados (quem só quer a palavra precisa ficar de olho no evento inteiro,
o que já é quase assistir) e não repetindo as palavras na descrição do vídeo.
Para um webinário gratuito de divulgação científica, o risco é proporcional.

**A gravação fica pública.** Quem assistir depois vai ouvir as palavras. Por
isso o formulário **fecha às 22h00** do dia 18 — depois disso, saber a
palavra não vale mais nada.

**Quem assistir pelo YouTube direto** (não pelo site) participa igual: as
palavras são anunciadas na transmissão, não na página.

**Cheque de sanidade:** compare o número de aprovados com o **pico de
espectadores simultâneos** do YouTube Studio. Se 120 pedirem certificado e o
pico tiver sido 40, algo está errado — e aí a conversa é outra.
