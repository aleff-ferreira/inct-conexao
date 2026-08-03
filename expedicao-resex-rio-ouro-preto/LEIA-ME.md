# II Expedição Científica RESEX Rio Ouro Preto — pacote para publicação

Conteúdo do pacote:

    index.html              página completa da matéria, pronta para subir
    img/                    12 imagens já otimizadas para web
    bloco-para-o-site.html  a mesma matéria como bloco de HTML, para colar no editor
    kit-divulgacao-e-seo.md carrossel, Reels, posts, e-mails e checklist de SEO

## Opção 1: subir como página própria (mais rápido)

1. Envie a pasta inteira para o servidor, em
   /expedicao-cientifica-resex-rio-ouro-preto/
2. Confira se a página abre em
   https://inct-conexao.com.br/expedicao-cientifica-resex-rio-ouro-preto/
3. Pronto. A página é autossuficiente: só carrega a fonte Figtree do Google Fonts.
   Se preferir não carregar fonte externa, apague as três linhas de <link> no
   topo do arquivo; a página passa a usar a fonte do sistema.

## Opção 2: publicar como post dentro do site

1. Envie o conteúdo de img/ para /assets/materia-resex/ no servidor.
   Os caminhos do bloco já apontam para lá.
2. Abra bloco-para-o-site.html, copie tudo e cole em um bloco de HTML
   personalizado no editor do post.
3. Defina hero-rio-ouro-preto.jpg como imagem destacada.

## Campos de SEO

    Título:    Expedição na RESEX Rio Ouro Preto: água, morcegos e Saúde Única
    Descrição: Cerca de 30 pesquisadores passaram dez dias no Rio Ouro Preto (RO)
               atendendo famílias ribeirinhas, capturando morcegos e construindo
               um saneamento de R$ 2 mil.
    Slug:      expedicao-cientifica-resex-rio-ouro-preto-saude-unica
    Categoria: Expedições · Saúde Única
    Imagem de compartilhamento: img/og-expedicao-resex.jpg (1200x630)

O index.html já traz Open Graph, Twitter Card e dados estruturados
(NewsArticle e FAQPage). Se o site usar plugin de SEO, verifique se ele não
duplica esses dados.

Se a URL final for diferente da que está no arquivo, troque estes três pontos
no index.html: a tag <link rel="canonical">, as meta og:url e os links de
compartilhamento no fim da matéria.

## Antes de publicar, confirmar com a equipe

- Nome da arquiteta responsável pelo protótipo de saneamento. Nos áudios soa
  "Jacqueline Araújo"; na lista da equipe consta Hayslla Mikaella do Couto
  Araújo. O texto hoje não a nomeia.
- Quem assina a fala citada como "coordenação da expedição" e os nomes dos
  biólogos do vídeo.
- Número de pessoas atendidas e a base de cálculo dos 90% de doenças crônicas.
- Se o teste do sistema com água do rio já foi feito e qual foi o resultado.
- Vínculo institucional de cada integrante da equipe. Onde não havia
  informação, ficou INCT-CONEXAO.
- Autorização de imagem para qualquer foto com pessoas identificáveis.
