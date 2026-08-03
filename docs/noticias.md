# Notícias e matérias: como publicar

Módulo de reportagens do site (`#/noticias`). Foi feito para **publicação
recorrente**: cada matéria é um arquivo JSON e um conjunto de imagens. Nenhuma
linha de código muda quando uma nova matéria entra.

---

## 1. Onde as coisas ficam

| O quê | Onde |
|---|---|
| Texto da matéria | `src/content/noticias/<slug>.json` |
| Imagens da matéria | `public/assets/noticias/<slug>/` |
| Código do módulo | `src/noticias/` (tipos, carregamento, blocos, hub, página) |
| Estilos | bloco `NOTÍCIAS / MATÉRIAS` em `src/styles.css` (prefixo `art-`) |
| Painel (CMS) | coleção **Notícias / Matérias** em `public/admin/config.yml` |

O **slug** é o mesmo em três lugares: nome do arquivo JSON, nome da pasta de
imagens e endereço público (`#/noticias/<slug>`).

---

## 2. Publicar uma matéria nova

### Caminho A: pelo painel (recomendado para a redação)

1. Abrir `/admin`, entrar em **Notícias / Matérias** e clicar em **Novo**.
2. Preencher os campos. O corpo é montado em **blocos**: clique em *Adicionar*
   e escolha o tipo (Texto, Foto, Galeria, Vídeo, Citação, Cartão de destaque,
   Passo a passo, Tabela, Perguntas frequentes).
3. Salvar/publicar. O painel grava o JSON no GitHub.
4. O administrador faz `git pull`, `npm run build` e envia o `dist/`
   (ver `HOSTING.md`).

> As imagens precisam estar em `public/assets/noticias/<slug>/` **antes** de
> serem citadas nos blocos: use o passo 3 abaixo e faça o commit junto.

### Caminho B: à mão (quando já existe um pacote pronto)

1. Criar a pasta das imagens e otimizá-las:

   ```bash
   python3 scripts/optimize-article-images.py <pasta-de-origem> <slug>
   ```

   O script converte tudo para **WebP** (metade do peso), reduz o lado maior
   para 1600 px e grava em `public/assets/noticias/<slug>/`. Arquivos que
   começam com `og-` continuam em **JPEG**, porque os robôs de redes sociais
   ainda tratam WebP de forma irregular.

2. Criar `src/content/noticias/<slug>.json` (use a matéria existente como
   modelo) e rodar `npm run build`.

---

## 3. Blocos disponíveis

| Tipo | Para quê |
|---|---|
| `texto` | Parágrafos. Aceita `**negrito**`, `_itálico_` e `[texto](link)`. |
| `subtitulo` | Intertítulo que divide a matéria. |
| `imagem` | Uma foto com legenda e crédito. |
| `galeria` | De 2 a 4 fotos em grade, com legenda comum. 2 = lado a lado; 3 = uma larga em cima e duas embaixo; 4 = grade 2×2. |
| `video` | Vídeo `.mp4` hospedado no próprio site. Ver as regras abaixo. |
| `citacao` | Frase em destaque com autoria. |
| `destaque` | Cartão com lista (ex.: "Em 30 segundos"). |
| `etapas` | Passo a passo numerado. |
| `tabela` | Linhas rótulo/valor em faixa escura (ex.: "O que vem agora"). |
| `faq` | Perguntas frequentes. Também vira dados estruturados **FAQPage**. |

### Vídeo

O bloco `video` aponta para um `.mp4` em `public/assets/noticias/<slug>/`.
Três regras que o teste cobra:

- **`descricao` é obrigatória.** Vira o nome acessível do player, para quem
  navega por leitor de tela.
- **Vídeo com fala precisa de `transcricao`.** Sem ela, quem não ouve fica sem
  a informação. A transcrição aparece num "Transcrição do áudio" recolhido
  abaixo da legenda.
- **`poster` é o quadro de capa.** Sem ele o player abre preto: o vídeo usa
  `preload="none"` e só baixa o arquivo quando alguém aperta play, porque a
  matéria é lida em lugares onde a internet é cara.

**Recorte o arquivo, não só o CSS.** O player ocupa a largura da coluna numa
janela **5:4**. Vídeo de celular vem vertical (9:16), então grave o arquivo já
recortado em 5:4 no ffmpeg. Se o recorte ficar só no CSS, metade do bitrate vai
para pixels que o navegador descarta e o que sobra aparece ampliado e borrado —
foi exatamente o que aconteceu na primeira versão do sobrevoo.

```bash
# 1. descubra a resolução da origem
ffmpeg -i origem.mp4 2>&1 | grep Stream          # ex.: 576x1024

# 2. corte central 5:4 (altura = largura / 1.25, arredondada para par)
#    576 / 1.25 = 460 ; deslocamento = (1024 - 460) / 2 = 282
ffmpeg -i origem.mp4 -vf "crop=576:460:0:282" \
  -c:v libx264 -preset slow -crf 22 -profile:v high -pix_fmt yuv420p \
  -movflags +faststart -an \
  public/assets/noticias/<slug>/<nome>.mp4

# 3. capa a partir do arquivo já recortado, para bater com o player
ffmpeg -ss 6 -i public/assets/noticias/<slug>/<nome>.mp4 -frames:v 1 capa.png
```

`-crf 22` na resolução nativa dá um arquivo limpo; `-crf 30` deixa marca de
compressão visível quando o navegador amplia. Troque `-an` por
`-c:a aac -b:a 64k -ac 1` quando houver fala. Antes de fechar o recorte, extraia
alguns quadros ao longo do clipe e confira que o assunto não cai fora.

**Segurança:** o texto das matérias nunca é interpretado como HTML. A
formatação simples vira elementos React em `src/noticias/blocks.tsx`; não há
`dangerouslySetInnerHTML` no módulo, então uma matéria não injeta script no
site. Links só são aceitos se começarem com `http(s)`, `/` ou `#`.

---

## 4. Cada fato, uma vez só (a regra que evita o texto soar automático)

O defeito mais grave que uma matéria daqui pode ter não é erro de português: é
**dizer a mesma coisa em todas as camadas**. Quando título, linha-fina, box,
abertura, corpo e FAQ repetem o mesmo enunciado com as mesmas palavras, o leitor
sente redundância mecânica, e o texto passa a parecer gerado por máquina.

**Divisão de trabalho entre as camadas:**

| Camada | Função | Nunca deve |
|---|---|---|
| Título | Afirma **o** achado, com verbo | Enumerar substantivos sem verbo |
| Linha-fina | Acrescenta o que não coube no título (promessa, contexto) | Reformular o título |
| Box "Em 30 segundos" | Telegrama dos fatos, com **palavras próprias** | Copiar frases do corpo |
| Abertura | Narra uma cena, cria a pergunta | Resumir a matéria |
| Corpo | Desenvolve cada fio uma vez | Reafirmar o box |
| FAQ | Responde o que o corpo **não** respondeu | Repetir a definição já dada |

Há um **teste automático** que quebra a build se qualquer sequência de 6 ou mais
palavras se repetir entre camadas (`tests/noticias.test.ts`, bloco "redação ·
cada fato dito uma vez"). Nomes próprios longos estão liberados na lista
`REPETICAO_PERMITIDA`.

**Voz.** Prefira o vernáculo ao institucional: "o achado mais duro" é melhor que
"o achado mais grave"; "segue de pé" é melhor que "continua instalado". Varie o
ritmo das frases, evite tríades ("A, B e C") em série, evite simetrias do tipo
"não X, mas Y", e não termine seções resumindo o que acabou de ser dito. Detalhe
concreto vale mais que adjetivo: a seringa de insulina, a maca improvisada, a
brita que veio de fora.

## 5. Regras da casa

- **Texto alternativo é obrigatório** em toda imagem. Há um teste que quebra o
  build se faltar (`tests/noticias.test.ts`).
- **Toda imagem citada precisa existir** na pasta da matéria. Também é testado.
- **Não invente nomes nem números.** Quando a fonte não confirmou quem falou,
  use uma atribuição genérica ("Coordenação da expedição") em vez de arriscar.
- **Rascunho:** `"publicado": false` tira a matéria do site sem apagar o texto.
- A **imagem de compartilhamento** (`seo.ogImage`) deve ficar em `.jpg`,
  1200x630. Há teste para isso.

---

## 6. Desempenho

O módulo inteiro (hub, página, chamada da home e o conteúdo das matérias) é
carregado **sob demanda** (`React.lazy`). Publicar matérias **não** engorda o
pacote inicial do site: quando a primeira matéria entrou, o bundle eager subiu
apenas ~0,3 kB gzip, enquanto o texto e os blocos foram para um chunk próprio.

As imagens são servidas em WebP com `loading="lazy"`, exceto a foto de topo.

---

## 7. Limitação conhecida (cartões de redes sociais)

O site é uma SPA estática com rotas em hash. Os robôs do WhatsApp, Facebook e
LinkedIn **não executam JavaScript**, então leem apenas as metatags do
`index.html`: o cartão compartilhado mostra os dados padrão do site, não os da
matéria. O título, a descrição e o JSON-LD por matéria são atualizados no
cliente e **funcionam para o Google**, que renderiza JS.

Resolver isso exige pré-renderização (gerar um HTML por matéria no build) —
está no backlog e vale a pena quando a publicação virar rotina.
