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

## ⛔ Antes de tudo: DESLIGUE O DVR

No YouTube Studio, em **Configurações da transmissão → Ativar DVR**, o botão
está **ligado** hoje. Com ele ligado, o espectador pode **rebobinar a live
enquanto ela acontece** — quem chega às 20:30 volta o vídeo e colhe todas as
palavras anteriores em três minutos. Isso anula o método inteiro.

É uma troca real, e vale saber o que se perde: o DVR ajuda quem tem conexão
ruim a recuperar 30 segundos perdidos, e 69 inscritos estão na Amazônia.
Desligado, quem cair volta ao vivo, no ponto em que a transmissão está — e a
gravação continua disponível depois, para rever com calma.

**Para o certificado significar alguma coisa, o DVR precisa estar desligado.**

E não escreva as palavras no chat: o chat é reproduzido junto com a gravação.

---

## O cronograma — duas armadilhas, não uma

Cada palavra prova presença **naquele instante**. Um conjunto de palavras
prova o **intervalo entre a primeira e a última** acertada. Isso cria dois
erros possíveis, e é preciso medir os dois:

- **falso positivo** — certificar quem ficou menos de 60 min;
- **falso negativo** — reprovar quem ficou 60 min ou mais.

Rodando força bruta sobre **todos** os intervalos de permanência possíveis:

| Arranjo | Regra | Menor permanência aprovada | Maior permanência reprovada |
|---|---|---|---|
| 4 palavras (19:10, 19:45, 20:20, 20:50) | 3 de 4 | 65 min ✅ | **98 min (82%)** ❌ |
| 5 palavras de 25 em 25 | 3 de 5 | 50 min ❌ | 73 min ❌ |
| 5 palavras de 25 em 25 | 4 de 5 | 75 min ✅ | 98 min ❌ |
| **6 palavras de 20 em 20** | **4 de 6** | **60 min ✅** | **78 min (65%)** |
| 6 palavras de 20 em 20 | 3 de 6 | 40 min ❌ | 58 min ✅ |

O arranjo de quatro palavras **garante** os 60 minutos, mas reprovaria alguém
que ficou 98 minutos — 82% do evento. Com 154 inscritos, na maioria
estudantes atrás do certificado, isso vira reclamação justa.

**Adotado: seis palavras de 20 em 20 minutos, exigindo quatro.** Ninguém com
menos de 60 min passa; quem ficar 80 min ou mais passa sempre; entre 60 e 79
depende da hora em que entrou.

> **A regra geral, para quem quiser ajustar:** com espaçamento `g` e
> exigência de `k` palavras, a menor permanência aprovada é `(k−1)·g` e a
> maior reprovada é `k·g − 1`. A folga entre as duas é **sempre** `g` — só
> encurtando o intervalo (mais interrupções) as duas pontas apertam juntas.

### As seis palavras (defina hoje e não mude)

| # | Horário (Rondônia) | Momento aproximado | Palavra |
|---|---|---|---|
| 1 | **19:05** | após a abertura | `__________` |
| 2 | **19:25** | durante a 1ª palestra | `__________` |
| 3 | **19:45** | durante a 2ª palestra | `__________` |
| 4 | **20:05** | durante a 3ª palestra | `__________` |
| 5 | **20:25** | no debate | `__________` |
| 6 | **20:45** | antes da síntese | `__________` |

Escolha palavras **sem acento**, uma só, sem espaço, e **sem relação com o
tema** — se forem termos de ofidismo, alguém adivinha. Palavras neutras
funcionam melhor: `GIRASSOL`, `TAMBOR`, `LANTERNA`, `BUSSOLA`, `VITROLA`,
`PANDEIRO`. *(Não use estas: estão publicadas aqui.)*

**Quem anuncia:** o moderador, **em voz alta**, e o operador escreve na tela
por ~20 segundos. Quem estiver ouvindo pelo celular precisa conseguir anotar.
Um cronômetro visível para o moderador evita esquecer — seis lembretes em
duas horas é fácil de perder no meio do debate.

---

## O formulário

Um único formulário do Google, preenchido **no fim** (link anunciado no
início e repetido a cada palavra).

**Campos:**
1. Endereço de e-mail — **o mesmo da inscrição** (deixe isso em negrito)
2. Nome completo
3 a 8. `1ª palavra-chave` … `6ª palavra-chave` — texto curto, **nenhuma
   obrigatória** *(quem perdeu uma deixa em branco; a regra é 4 de 6)*

**Configuração:**

- **Coletar e-mails: "entrada do respondente"** (digitado), **não** o
  "verificado". O verificado exige conta Google e excluiria participantes —
  e excluir quem assistiu é o erro mais caro aqui. O script cuida da
  digitação.
- **Não** limite a 1 resposta: essa opção também exige login Google. A
  duplicata é tratada na apuração (vale a **primeira** resposta — anuncie
  isso, senão alguém responde de novo depois de perguntar a um colega).
- **Fechamento programado para 18/08 às 21h30** (Rondônia). O Google Forms
  ganhou fechamento nativo por data e hora em janeiro de 2026, disponível
  também para contas pessoais: *Publicado → Aceitando respostas → Definir
  data de fechamento*. **Confira o fuso da planilha** (Arquivo →
  Configurações da planilha): o padrão costuma vir São Paulo (UTC−3), e
  Rondônia é UTC−4.

> **Não use o modo "questionário com nota".** Duas páginas oficiais do Google
> se contradizem sobre resposta curta ser autocorrigível, e **nenhuma**
> documenta se a correção ignora acento e maiúscula. A apuração fica com o
> script, que aceita "Jararacá! " como acerto e você pode conferir e corrigir
> em segundos se algo sair errado às 21h05.

---

## A apuração (automática)

Terminado o evento, exporte as respostas em CSV e rode:

```bash
python3 scripts/apurar-presenca.py respostas.csv \
    --codigos palavra1 palavra2 palavra3 palavra4 palavra5 palavra6 \
    --minimo 4 --simular
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
> metade da transmissão. Durante o webinário vamos anunciar **seis
> palavras-chave**, espalhadas do começo ao fim. Anote-as.
> Ao final, preencha o formulário de presença (o link será divulgado durante
> a transmissão e enviado por e-mail logo depois). Quem informar **pelo menos
> quatro das seis palavras** recebe o certificado.
> Use o **mesmo e-mail** da inscrição.

---

## Limites que vale conhecer

**Compartilhamento de palavras entre colegas.** É o vetor óbvio, e nenhum
método sem login o elimina. Mitiga-se anunciando em seis momentos espalhados
(quem só quer as palavras precisa ficar de olho no evento inteiro, o que já é
quase assistir) e não repetindo as palavras na descrição do vídeo. Para um
webinário gratuito de divulgação científica, o risco é proporcional.

**A gravação fica pública.** Quem assistir depois vai ouvir as palavras. Por
isso o formulário **fecha às 21h30** do dia 18 — meia hora depois do fim,
antes de a gravação estar confortavelmente navegável.

**Entre 60 e 79 minutos, o resultado depende da hora de entrada.** É
consequência aritmética, não defeito: a folga é sempre igual ao espaçamento
entre as palavras. Quem reclamar nessa faixa tem um argumento razoável — vale
ter em mãos a regra escrita e, se a coordenação quiser, aprovar no caso a
caso pelo arquivo `certificados-revisar.csv`, que traz quantas cada um
acertou.

**Quem assistir pelo YouTube direto** (não pelo site) participa igual: as
palavras são anunciadas na transmissão, não na página.

**Cheque de sanidade:** compare o número de aprovados com o **pico de
espectadores simultâneos** do YouTube Studio. Se 120 pedirem certificado e o
pico tiver sido 40, algo está errado — e aí a conversa é outra.
