# Remoção de travessões e meias-riscas do texto visível

**Data:** 11 de agosto de 2026 · **Complementa:** `docs/revisao-copy-2026-08-11.md`

## Escopo e método

Segunda passada da revisão, com uma decisão editorial explícita: **remover todos os travessões (—, U+2014) e meias-riscas (–, U+2013) do texto que o usuário lê**, substituindo cada um por pontuação natural do português brasileiro (vírgula, dois-pontos, parênteses, ponto final com maiúscula, ou "a"/"de X a Y" em intervalos), sem alterar significado, informação, hierarquia, terminologia, links ou números.

Cada arquivo foi lido por um revisor, que localizou os travessões em texto visível e propôs o substituto; um editor cético reabriu o arquivo, confirmou que cada ocorrência estava mesmo em texto renderizado (e não em comentário ou código), aplicou a troca preservando JSX/JSON/YAML válidos e fez uma varredura própria. Ao final, um verificador automático (independente dos agentes) percorreu os 115 arquivos de texto visível, removeu comentários respeitando strings e confirmou que **nenhum travessão ou meia-risca sobrou em texto renderizado**.

**Deliberadamente NÃO tocados** (não são "a página"): comentários de código (`//`, `/* */`, JSDoc), o `styles.css` inteiro (seus travessões são todos de comentário), os cabeçalhos `#` dos CSV de dados, os JSON que não renderizam (`laboratorios.json`, `taxonomia.json`, `equipe.json`, `apis-metadados.json`), o `proposta-inct-2024.json` (fonte primária), os blocos `_meta`/`_nota` internos, e **todos os hífens comuns** (`-`) de palavras compostas e do número de processo.

## Resumo

- **295 substituições aplicadas** em 37 arquivos de texto visível (292 pelo fluxo revisado + 3 à mão fora dos grupos).
- **72 ocorrências corretamente ignoradas** por serem comentário de código, string de `console`, cabeçalho de CSV gerado ou dado não-renderizado (a maioria dos ~1500 travessões do repositório está em comentários).
- **4 expectativas de teste** sincronizadas com as novas strings (sem mudança de comportamento).
- Verificação: **730/730 testes**, `tsc` limpo, build OK, JSON válidos, varredura automática com **zero** travessões visíveis, e a `inct_deploy/` regenerada com o embargo do Barco da Ciência reconferido.

---

## Substituições aplicadas, por seção

### Página inicial e metadados do site (1)

**1. `index.html`** — <head> — meta Open Graph (og:image:alt): texto alternativo da imagem exibida nos cartões de compartilhamento social e lido por leitores de tela
- Antes: “content="Floresta amazônica vista do alto ao pôr do sol — INCT-CONEXAO"”
- Depois: “content="Floresta amazônica vista do alto ao pôr do sol, INCT-CONEXAO"”
- Motivo: Texto VISÍVEL (alt de imagem em cartões sociais e para leitores de tela). O travessão separava a descrição da cena do nome da instituição, como aposto/atribuição de legenda; trocado por vírgula, que preserva exatamente a relação (cena, marca), a ordem das ideias e todas as palavras, em pontuação natural do pt-BR. YAML/HTML intactos, aspas do atributo preservadas.

### Editais, figuras citáveis e UI compartilhada (8)

**2. `src/content/editais/resultado-ic-2026.json`** — Página de Resultado (IC/CNPq) — título do processo, renderizado no lede via {resultado.titulo} em ResultadoIC2026.tsx:101
- Antes: “"titulo": "Processo Seletivo Simplificado — Bolsas de Iniciação Científica IC/CNPq",”
- Depois: “"titulo": "Processo Seletivo Simplificado: Bolsas de Iniciação Científica IC/CNPq",”
- Motivo: Dois-pontos: o travessão introduzia a especificação do que o processo concede (as bolsas de IC). Todas as palavras, números e a ordem preservados; JSON permanece válido.

**3. `src/editais/ResultadoIC2026.tsx`** — Página de Resultado — legenda (<caption class="res-tabela-cap">) de cada tabela por estado
- Antes: “                Selecionados e orientadores — {e.nome}”
- Depois: “                Selecionados e orientadores: {e.nome}”
- Motivo: Dois-pontos: rótulo seguido do complemento (o estado a que a tabela se refere). Interpolação {e.nome} intacta.

**4. `src/figuras/Figura.tsx`** — Componente Figura — linha de fonte/procedência no rodapé (.figura-fonte), entre o título linkado da fonte e o publicador
- Antes: “          {" — "}{fig.fonte.publicador} ({fig.fonte.ano}). {fig.fonte.licenca}.”
- Depois: “          {", "}{fig.fonte.publicador} ({fig.fonte.ano}). {fig.fonte.licenca}.”
- Motivo: Vírgula: liga o título da fonte ao publicador como aposto, mantendo a leitura corrida da linha de proveniência. A string literal JSX {", "} preserva o espaço à direita, que separa do publicador.

**5. `src/figuras/Figura.tsx`** — Componente Figura — legenda (<caption>) da tabela acessível (visualmente oculta, lida por leitor de tela)
- Antes:
  ```
          <caption>{fig.titulo} — {fig.subtitulo}</caption>
  ```
- Depois:
  ```
          <caption>{fig.titulo}. {fig.subtitulo}</caption>
  ```
- Motivo: Ponto: separa título e subtítulo em duas frases, exatamente como o alt da mesma figura já faz (linha 200: `${fig.titulo}. ${fig.subtitulo}.`).

**6. `public/figuras/index.html`** — Página estática de Figuras — linha de fonte da 1ª figura (Focos de queimada na Amazônia Legal), <p class="fonte"> (linha 48)
- Antes:
  ```
      <p class="fonte">Fonte: Focos de queimada por unidade federativa e ano — Instituto Nacional de Pesquisas Espaciais (INPE) (2003 a 2024).
  ```
- Depois:
  ```
      <p class="fonte">Fonte: Focos de queimada por unidade federativa e ano, Instituto Nacional de Pesquisas Espaciais (INPE) (2003 a 2024).
  ```
- Motivo: Vírgula: liga o título da fonte ao publicador (aposto), consistente com Figura.tsx:241. Aplicada via replace_all à string idêntica da 2ª figura (linha 94).

**7. `public/figuras/index.html`** — Página estática de Figuras — <caption> da tabela da 1ª figura (Focos de queimada na Amazônia Legal) (linha 54)
- Antes:
  ```
      <caption>Focos de queimada na Amazônia Legal — Detecções anuais do satélite de referência do INPE, somadas nos nove estados da Amazônia Legal</caption>
  ```
- Depois:
  ```
      <caption>Focos de queimada na Amazônia Legal. Detecções anuais do satélite de referência do INPE, somadas nos nove estados da Amazônia Legal</caption>
  ```
- Motivo: Ponto: separa título e subtítulo, igual ao padrão do alt da mesma figura (linha 45).

**8. `public/figuras/index.html`** — Página estática de Figuras — linha de fonte da 2ª figura (Focos nos estados que mais queimam), <p class="fonte"> (linha 94)
- Antes:
  ```
      <p class="fonte">Fonte: Focos de queimada por unidade federativa e ano — Instituto Nacional de Pesquisas Espaciais (INPE) (2003 a 2024).
  ```
- Depois:
  ```
      <p class="fonte">Fonte: Focos de queimada por unidade federativa e ano, Instituto Nacional de Pesquisas Espaciais (INPE) (2003 a 2024).
  ```
- Motivo: Mesma troca por vírgula (aposto) da linha 48; a string é idêntica e foi substituída no mesmo replace_all.

**9. `public/figuras/index.html`** — Página estática de Figuras — <caption> da tabela da 2ª figura (Focos nos estados que mais queimam) (linha 100)
- Antes:
  ```
      <caption>Focos de queimada nos estados que mais queimam — Detecções anuais do satélite de referência do INPE, nos quatro estados da Amazônia Legal com maior acumulado na série</caption>
  ```
- Depois:
  ```
      <caption>Focos de queimada nos estados que mais queimam. Detecções anuais do satélite de referência do INPE, nos quatro estados da Amazônia Legal com maior acumulado na série</caption>
  ```
- Motivo: Ponto: separa título e subtítulo, igual ao padrão do alt da mesma figura (linha 91).

### Plataforma — autenticação, senha e contas (5)

**10. `src/platform/auth.tsx`** — ptError() — mensagem de erro "Tentativas demais" na verificação do código de redefinição (contexto "codigo")
- Antes: “"Tentativas demais em pouco tempo. Espere alguns minutos e digite o código de novo — ele continua valendo até expirar."”
- Depois: “"Tentativas demais em pouco tempo. Espere alguns minutos e digite o código de novo. Ele continua valendo até expirar."”
- Motivo: Confirmado texto visível: string de retorno de ptError() renderizada como mensagem de erro (setMsg). O travessão separava duas orações independentes (imperativa 'digite o código de novo' + declarativa 'ele continua valendo até expirar'). Troquei por ponto final e maiúscula em 'Ele', preservando integralmente o sentido.

**11. `src/platform/NovaSenha.tsx`** — explicarErro() — ramo access_denied/unauthorized, aviso "Este link não é mais válido" (campo texto exibido em <p>{textoErro}</p>)
- Antes: “"O endereço de redefinição foi recusado pelo servidor de autenticação — normalmente porque já foi usado, expirou ou foi substituído por um pedido mais recente. Use o código numérico que veio no mesmo e-mail, no campo abaixo."”
- Depois: “"O endereço de redefinição foi recusado pelo servidor de autenticação, normalmente porque já foi usado, expirou ou foi substituído por um pedido mais recente. Use o código numérico que veio no mesmo e-mail, no campo abaixo."”
- Motivo: Confirmado texto visível: valor de 'texto' retornado por explicarErro() e renderizado no aviso do link. O travessão introduzia uma continuação explicativa ('normalmente porque...'); usei vírgula, mais natural em pt-BR e sem colidir com os dois-pontos que já aparecem adiante na mesma frase.

**12. `src/platform/NovaSenha.tsx`** — explicarErro() — ramo codeSemSessao, aviso "Este link expirou ou já foi usado" (campo texto exibido em <p>{textoErro}</p>)
- Antes: “"O link de redefinição vale por pouco tempo e só funciona uma vez. Acontece com frequência de servidores de e-mail corporativos abrirem o link antes de você, para conferir se é seguro — e aí ele já chega gasto. Não é preciso outro link: o mesmo e-mail traz um código numérico, e nenhum servidor consegue gastar um número. Digite-o no campo abaixo."”
- Depois: “"O link de redefinição vale por pouco tempo e só funciona uma vez. Acontece com frequência de servidores de e-mail corporativos abrirem o link antes de você, para conferir se é seguro, e aí ele já chega gasto. Não é preciso outro link: o mesmo e-mail traz um código numérico, e nenhum servidor consegue gastar um número. Digite-o no campo abaixo."”
- Motivo: Confirmado texto visível: valor de 'texto' retornado por explicarErro() e renderizado no aviso do link. O travessão marcava pausa enfática antes da consequência coordenada por 'e aí'; resolvi com vírgula, preservando o encadeamento causal e o tom coloquial.

**13. `src/platform/PainelContas.tsx`** — Painel Administração de Contas (#/gestao?area=contas) — hint <p className="plat-hint"> do bloco "Contas e papéis" (abertura do par de travessões)
- Antes: “Todas as contas do site e seus papéis. Ninguém altera o próprio papel — nem SuperAdministradores(as)”
- Depois: “Todas as contas do site e seus papéis. Ninguém altera o próprio papel, nem SuperAdministradores(as)”
- Motivo: Confirmado texto visível: prosa JSX renderizada no hint do painel. Travessão de ABERTURA do par que isola o aposto 'nem SuperAdministradores(as)'. Fechei o par com vírgulas dos dois lados; esta é a vírgula de abertura.

**14. `src/platform/PainelContas.tsx`** — Painel Administração de Contas (#/gestao?area=contas) — hint <p className="plat-hint"> do bloco "Contas e papéis" (fechamento do par de travessões)
- Antes: “SuperAdministradores(as) — e o banco impede rebaixar o último SuperAdministrador,”
- Depois: “SuperAdministradores(as), e o banco impede rebaixar o último SuperAdministrador,”
- Motivo: Confirmado texto visível: mesma hint JSX. Travessão de FECHAMENTO do par iniciado na linha 141. A frase final ficou 'Ninguém altera o próprio papel, nem SuperAdministradores(as), e o banco impede rebaixar o último SuperAdministrador, para o site nunca ficar sem quem possa gerir contas.', mantendo toda a informação e a hierarquia.

### Notícias (5)

**15. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json`** — Corpo da matéria, legenda do vídeo de saída de Porto Velho (bloco 'video', renderizado por BlocoView/Legenda com formatar())
- Antes: “o tempo dispara enquanto o **Maresia III** — o de convés verde — se arruma no barranco”
- Depois: “o tempo dispara enquanto o **Maresia III**, o de convés verde, se arruma no barranco”
- Motivo: Par de travessões (U+2014) isolando um aposto explicativo ('o de convés verde'). Troquei os dois travessões por vírgulas dos dois lados; aposto e sentido intactos.

**16. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json`** — Corpo da matéria, parágrafo sobre o projeto Currículo Azul, sob o subtítulo 'A viagem que o nível da água segurou' (bloco 'texto')
- Antes: “O recorte temático — água, justiça climática, Década da Ciência Oceânica, ODS 14 — combina de forma quase literal com o rio”
- Depois: “O recorte temático (água, justiça climática, Década da Ciência Oceânica, ODS 14) combina de forma quase literal com o rio”
- Motivo: Par de travessões (U+2014) isolando uma enumeração lateral que já contém vírgulas internas. Usei parênteses (e não vírgulas) para evitar ambiguidade e preservar a lista completa e sua ordem.

**17. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json`** — Corpo da matéria, Perguntas frequentes, resposta de 'Onde fica Nazaré?' (bloco 'faq')
- Antes: “situado no trecho do Madeira a jusante da capital — a região que em Rondônia se chama Baixo Madeira.”
- Depois: “situado no trecho do Madeira a jusante da capital, a região que em Rondônia se chama Baixo Madeira.”
- Motivo: Travessão (U+2014) introduzindo aposto explicativo no fim da oração. Troquei por vírgula, pontuação natural do aposto; mesma informação.

**18. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json`** — Seção 'In English', campo resumoIngles (renderizado em <section class="art-ingles"> na NoticiaPage) — glosa de tradução
- Antes: “took its Barco da Ciência — Science Boat — to Nazaré, a riverside district of Porto Velho”
- Depois: “took its Barco da Ciência (Science Boat) to Nazaré, a riverside district of Porto Velho”
- Motivo: Par de travessões (U+2014) isolando a glosa de tradução de um nome próprio ('Science Boat'). Usei parênteses, pontuação natural para glosa; nome e sentido preservados (texto visível, ainda que em inglês).

**19. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json`** — Seção 'In English', campo resumoIngles (renderizado em <section class="art-ingles"> na NoticiaPage) — frase final sobre os voos de drone
- Antes: “Drone flights were among the activities carried out — they produced the aerial footage that illustrates this story and left ready a plan for an aerial survey of the village.”
- Depois: “Drone flights were among the activities carried out: they produced the aerial footage that illustrates this story and left ready a plan for an aerial survey of the village.”
- Motivo: Achado na verificação: travessão (U+2014) não listado pelo revisor, em texto visível (resumoIngles). Cortava duas orações independentes introduzindo a elaboração do que os voos produziram; troquei por dois-pontos, que introduz a explicação e mantém o fluxo e o sentido.

### Mapa interativo — interface (16)

**20. `src/mapa/MapaPage.tsx`** — Página do Mapa, seção 'O que mudou, ano a ano' (SecaoFocos): texto de abertura (map-lede)
- Antes: “estados da Amazônia Legal — o território onde a rede atua.”
- Depois: “estados da Amazônia Legal, o território onde a rede atua.”
- Motivo: Texto visível (prosa em <p className="map-lede">). Aposto explicativo isolado por travessão trocado por vírgula, preservando a inserção parentética e todas as palavras.

**21. `src/mapa/MapaPage.tsx`** — Página do Mapa, aviso de versão beta (AvisoBeta): map-beta-texto
- Antes: “— ou use o botão “Reportar erro” ao lado da legenda, que já leva a camada, o estado e a safra do dado.”
- Depois: “ou use o botão “Reportar erro” ao lado da legenda, que já leva a camada, o estado e a safra do dado.”
- Motivo: Texto visível (JSX renderizado). A alternativa já é ligada pela conjunção 'ou' ao link anterior ('Avise a equipe'); removido o travessão enfático, lê-se 'Avise a equipe ou use o botão...', frase única e natural, sem colar orações.

**22. `src/mapa/MapaPage.tsx`** — Página do Mapa, introdução do modo Explorar (IntroExplorador): map-muted
- Antes: “parta dos exemplos — Rondônia e Amazonas (Amazônia Legal) e Ceará (fora dela).”
- Depois: “parta dos exemplos: Rondônia e Amazonas (Amazônia Legal) e Ceará (fora dela).”
- Motivo: Texto visível (prosa em <p className="map-muted">). Travessão que introduz a enumeração de exemplos trocado por dois-pontos.

**23. `src/mapa/MapaPage.tsx`** — Página do Mapa, modo Lista: nota do bloco de lacunas (map-lacunas-nota)
- Antes: “Ausência aqui significa dado ainda não cadastrado — não ausência de risco, de atividade ou de ocorrência.”
- Depois: “Ausência aqui significa dado ainda não cadastrado, não ausência de risco, de atividade ou de ocorrência.”
- Motivo: Texto visível (JSX renderizado). Construção antitética 'significa X, não Y'; vírgula antes de 'não' é o padrão do contraste. Demais vírgulas do trecho preservadas.

**24. `src/mapa/MapaPage.tsx`** — Página do Mapa, modo Lista: legenda (<caption>) da tabela de estados
- Antes: “{camada.label} — {camada.fonte.publicador ?? camada.fonte.titulo}”
- Depois: “{camada.label}: {camada.fonte.publicador ?? camada.fonte.titulo}”
- Motivo: Texto visível (<caption> da tabela). Padrão 'título — fonte'; dois-pontos apresenta a fonte/atribuição, mantendo a hierarquia rótulo/fonte e as interpolações {…} intactas.

**25. `src/mapa/MapaPage.tsx`** — Página do Mapa, modo Lista: célula 'Amazônia Legal' da tabela (placeholder de valor ausente) — CASO DESTACADO
- Antes:
  ```
  <td data-rotulo="Amazônia Legal">{u.amazoniaLegal ?? "—"}</td>
  ```
- Depois:
  ```
  <td data-rotulo="Amazônia Legal">{u.amazoniaLegal ?? "Não"}</td>
  ```
- Motivo: Texto visível (conteúdo da célula). Travessão usado como marcador de 'sem valor'; célula vazia significa que o estado NÃO pertence à Amazônia Legal. 'Não' preserva o sentido e segue a convenção já adotada no StatePanel ('Sim'/'Não' para o mesmo dado). PLACEHOLDER destacado para a coordenação.

**26. `src/mapa/MapaPage.tsx`** — Página do Mapa, modo Lista: célula 'Valor/Situação' da tabela (placeholder de valor ausente) — CASO DESTACADO
- Antes: “? rotulo ?? "—"”
- Depois: “? rotulo ?? "sem dado"”
- Motivo: Texto visível (conteúdo da célula). Travessão como placeholder de valor ausente na coluna de valor; 'sem dado' preserva o sentido e é coerente com o ramo irmão da mesma célula, que já renderiza <span className="map-sem-dado">sem dado</span>. PLACEHOLDER destacado para a coordenação.

**27. `src/mapa/StatePanel.tsx`** — Painel do estado, seção Doenças: nota do panorama de notificações (map-burden-nota)
- Antes: “o número também depende da intensidade da vigilância — use como ordem de grandeza, não como comparação exata.”
- Depois: “o número também depende da intensidade da vigilância. Use como ordem de grandeza, não como comparação exata.”
- Motivo: Texto visível (JSX renderizado). Travessão separando oração afirmativa de oração imperativa; ponto final com maiúscula em 'Use' evita a colagem e mantém as duas ideias. Quebra de linha/indentação do JSX preservada.

**28. `src/mapa/BrazilMap.tsx`** — Mapa SVG: elemento <title> (tooltip nativo e nome acessível do mapa)
- Antes:
  ```
  <title>Mapa do Brasil — unidades federativas</title>
  ```
- Depois:
  ```
  <title>Mapa do Brasil: unidades federativas</title>
  ```
- Motivo: Texto visível: o <title> do SVG é o tooltip nativo e o nome acessível. Título com subtítulo; dois-pontos apresenta a especificação 'unidades federativas', preservando todo o texto.

**29. `src/mapa/ControleAno.tsx`** — Controle de ano da camada de focos: rótulo do intervalo da série
- Antes: “{ANO_INICIAL}–{ANO_FINAL}”
- Depois: “{ANO_INICIAL} a {ANO_FINAL}”
- Motivo: Texto visível (rótulo <span> renderizado, ex.: 2003–2024). Meia-risca de intervalo numérico trocada por 'a', a forma natural em português para faixas de anos. Interpolações {…} preservadas.

**30. `src/mapa/layers.ts`** — Camada 'Vagas de IC', frase 'o que este número não mede' (naoMede, exibida no modo Lista)
- Antes: “É a oferta prevista no edital, não as bolsas efetivamente implementadas — a distribuição realizada difere.”
- Depois: “É a oferta prevista no edital, não as bolsas efetivamente implementadas: a distribuição realizada difere.”
- Motivo: Texto visível (string renderizada no escopo da lista). Travessão que introduz o esclarecimento trocado por dois-pontos; vírgulas anteriores intactas. JSON/string válido.

**31. `src/mapa/layers.ts`** — Camada 'Doenças (notificações)', frase 'o que este número não mede' (naoMede, exibida no modo Lista)
- Antes: “o total soma conjuntos diferentes de doenças em cada estado — os números não se comparam entre UFs. A malária fica de fora (é acompanhada pelo SIVEP-Malária, não pelo SINAN).”
- Depois: “o total soma conjuntos diferentes de doenças em cada estado. Os números não se comparam entre UFs. A malária fica de fora (é acompanhada pelo SIVEP-Malária, não pelo SINAN).”
- Motivo: Texto visível (string renderizada). Duas orações independentes (constatação e consequência); ponto final com maiúscula em 'Os'. Hífen de 'SIVEP-Malária' preservado.

**32. `src/mapa/layers.ts`** — Camada 'Focos de calor', descrição (exibida como title/tooltip do botão de lente no Explorador)
- Antes: “A escala de cor é a mesma em todos os anos — sem isso, cada ano pareceria igual e a tendência sumiria.”
- Depois: “A escala de cor é a mesma em todos os anos. Sem isso, cada ano pareceria igual e a tendência sumiria.”
- Motivo: Texto visível (renderizado no atributo title do botão de camada). Duas orações independentes; ponto final com maiúscula em 'Sem' separa a afirmação da justificativa.

**33. `src/mapa/reportar.ts`** — Reportar erro: assunto do e-mail gerado (mailto) — primeiro travessão
- Antes:
  ```
  `[mapa] ${rotulo} — ${c.camada.label}
  ```
- Depois:
  ```
  `[mapa] ${rotulo}: ${c.camada.label}
  ```
- Motivo: Texto de e-mail gerado, visível ao usuário (assunto do mailto). Dois-pontos apresenta a camada a que se refere o relato. Template literal e interpolações preservados.

**34. `src/mapa/reportar.ts`** — Reportar erro: assunto do e-mail gerado (mailto) — segundo travessão
- Antes:
  ```
  ${c.uf ? ` — ${c.uf.sigla}` : ""}
  ```
- Depois:
  ```
  ${c.uf ? `, ${c.uf.sigla}` : ""}
  ```
- Motivo: Texto de e-mail gerado, visível ao usuário. O travessão apenas acrescenta a sigla do estado; vírgula é a pausa natural para o acréscimo. Template literal preservado.

**35. `src/mapa/reportar.ts`** — Reportar erro: corpo do e-mail gerado (mailto)
- Antes: “Contexto preenchido automaticamente — não apague, é o que permite localizar o dado:”
- Depois: “Contexto preenchido automaticamente. Não apague, é o que permite localizar o dado:”
- Motivo: Texto de e-mail gerado, visível ao usuário. Travessão separando constatação de instrução imperativa; ponto final com maiúscula em 'Não'.

### Relato anual — formulário Meu Ano (53)

**36. `src/relato/MeuAno.tsx`** — TELAS · subtítulo da Tela 4 'Fomento e extensão'
- Antes: “Tudo opcional — sem nada a declarar, é só continuar.”
- Depois: “Tudo opcional. Sem nada a declarar, é só continuar.”
- Motivo: Travessão entre asserção e instrução condicional; ponto final com maiúscula em 'Sem'.

**37. `src/relato/MeuAno.tsx`** — Porta de entrada · aviso 'Antes de começar'
- Antes:
  ```
  <strong>Este não é o relatório de prestação de contas ao CNPq</strong> — esse só vence aos 24 meses.
  ```
- Depois:
  ```
  <strong>Este não é o relatório de prestação de contas ao CNPq</strong>. Esse só vence aos 24 meses.
  ```
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Esse'.

**38. `src/relato/MeuAno.tsx`** — Porta de entrada · 'Leva cerca de 8 minutos'
- Antes: “Você pode sair e voltar quando quiser — fica salvo no servidor, não no seu”
- Depois: “Você pode sair e voltar quando quiser: fica salvo no servidor, não no seu”
- Motivo: Travessão introduzindo explicação; dois-pontos.

**39. `src/relato/MeuAno.tsx`** — Porta de entrada · período do Ciclo 1
- Antes: “fica guardado para o próximo relatório — não some e não conta duas vezes.”
- Depois: “fica guardado para o próximo relatório: não some e não conta duas vezes.”
- Motivo: Travessão introduzindo explicação; dois-pontos.

**40. `src/relato/MeuAno.tsx`** — Porta de entrada · aviso de rateio (plat-notice)
- Antes: “demonstrou ter produzido — e a coordenação só”
- Depois: “demonstrou ter produzido, e a coordenação só”
- Motivo: Oração coordenada por 'e'; vírgula antes do 'e'.

**41. `src/relato/MeuAno.tsx`** — Guarda 'A coleta ainda não começou'
- Antes: “você recebe um e-mail — e este”
- Depois: “você recebe um e-mail, e este”
- Motivo: Oração coordenada por 'e'; vírgula.

**42. `src/relato/MeuAno.tsx`** — Gate do líder (LLA) · rotuloLab (template literal renderizado)
- Antes:
  ```
  const rotuloLab = meuLab ? `${meuLab.sigla} — ${meuLab.nome}` : "seu Laboratório Associado";
  ```
- Depois:
  ```
  const rotuloLab = meuLab ? `${meuLab.sigla}, ${meuLab.nome}` : "seu Laboratório Associado";
  ```
- Motivo: Nome é aposto da sigla; vírgula (dois-pontos colidiria com o ':' seguinte na frase da tela).

**43. `src/relato/MeuAno.tsx`** — Gate do líder (LLA) · parágrafo explicativo
- Antes: “As produções e os fatos do ciclo — expedições, parcerias, formação — se declaram lá”
- Depois: “As produções e os fatos do ciclo (expedições, parcerias, formação) se declaram lá”
- Motivo: Par de travessões isolando aposto com vírgulas internas; parênteses evitam ambiguidade.

**44. `src/relato/MeuAno.tsx`** — IdentificacaoComSessao · introdução
- Antes: “Encontre-se na lista abaixo — leva alguns segundos, e é uma vez só.”
- Depois: “Encontre-se na lista abaixo. Leva alguns segundos, e é uma vez só.”
- Motivo: Instrução + reforço; ponto final com maiúscula em 'Leva'.

**45. `src/relato/MeuAno.tsx`** — IdentificacaoComSessao · aviso de conflito de vínculo
- Antes: “escolha outro nome — ou escreva para”
- Depois: “escolha outro nome, ou escreva para”
- Motivo: Alternativa iniciada por 'ou'; vírgula.

**46. `src/relato/MeuAno.tsx`** — IdentificacaoComSessao · dica 'Não está na lista?'
- Antes: “informando o nome e este e-mail — nada do que”
- Depois: “informando o nome e este e-mail. Nada do que”
- Motivo: Instrução + reforço; ponto final com maiúscula em 'Nada'.

**47. `src/relato/MeuAno.tsx`** — Progresso · fraseDoProgresso (passo 1)
- Antes:
  ```
  `Primeiro de ${TOTAL_TELAS} passos — uns ${m} minutos ao todo`
  ```
- Depois:
  ```
  `Primeiro de ${TOTAL_TELAS} passos, uns ${m} minutos ao todo`
  ```
- Motivo: Tempo total como aposto; vírgula.

**48. `src/relato/MeuAno.tsx`** — Progresso · fraseDoProgresso (último passo, <1 min)
- Antes: “"Último passo — falta menos de um minuto"”
- Depois: “"Último passo, falta menos de um minuto"”
- Motivo: Nota de tempo como aposto; vírgula.

**49. `src/relato/MeuAno.tsx`** — Progresso · fraseDoProgresso (último passo, N min)
- Antes:
  ```
  `Último passo — uns ${m} minutos`
  ```
- Depois:
  ```
  `Último passo, uns ${m} minutos`
  ```
- Motivo: Nota de tempo como aposto; vírgula. (Mesma linha 1345 do caso anterior.)

**50. `src/relato/MeuAno.tsx`** — Tela 1 · dica do campo E-mail
- Antes:
  ```
  <strong>você escolheu</strong> ao entrar — a proposta não trouxe o e-mail de ninguém.
  ```
- Depois:
  ```
  <strong>você escolheu</strong> ao entrar: a proposta não trouxe o e-mail de ninguém.
  ```
- Motivo: Travessão introduzindo o motivo; dois-pontos.

**51. `src/relato/MeuAno.tsx`** — Tela 1 · dica de Categoria/Papel
- Antes: “só a coordenação os altera — é o que”
- Depois: “só a coordenação os altera: é o que”
- Motivo: Travessão introduzindo explicação; dois-pontos.

**52. `src/relato/MeuAno.tsx`** — Tela 1 · <option> do seletor de Laboratório
- Antes:
  ```
  {l.sigla ? `${l.sigla} — ` : ""}
  ```
- Depois:
  ```
  {l.sigla ? `${l.sigla}, ` : ""}
  ```
- Motivo: Nome como aposto da sigla; vírgula, consistente com rotuloLab.

**53. `src/relato/MeuAno.tsx`** — Tela 1 · dica do seletor de Laboratório
- Antes: “? " Veio do quadro da proposta — se não for o seu, troque aqui mesmo."”
- Depois: “? " Veio do quadro da proposta. Se não for o seu, troque aqui mesmo."”
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Se'.

**54. `src/relato/MeuAno.tsx`** — Tela 1 · dica do Grupo no Diretório CNPq (DGP)
- Antes:
  ```
  inctconexao@gmail.com</a> — só a coordenação edita o cadastro do
  ```
- Depois:
  ```
  inctconexao@gmail.com</a>. Só a coordenação edita o cadastro do
  ```
- Motivo: Após endereço de e-mail; ponto final (maiúscula em 'Só') evita ler ':' como parte do e-mail.

**55. `src/relato/MeuAno.tsx`** — Tela 1 · dica do campo Instituição (ROR)
- Antes:
  ```
  `Identificador ROR: ${membro.instituicao_ror} — é dele que sai a contagem de instituições e países da rede (Indicador nº 3).`
  ```
- Depois:
  ```
  `Identificador ROR: ${membro.instituicao_ror}. É dele que sai a contagem de instituições e países da rede (Indicador nº 3).`
  ```
- Motivo: Frase já tem dois-pontos ('ROR:'); ponto final com maiúscula em 'É' para não repetir.

**56. `src/relato/MeuAno.tsx`** — Tela 1 · dica do campo ID Lattes
- Antes: “sairá menor do que a rede produziu — vale atualizar quando puder.”
- Depois: “sairá menor do que a rede produziu. Vale atualizar quando puder.”
- Motivo: Constatação + recomendação; ponto final com maiúscula em 'Vale'.

**57. `src/relato/MeuAno.tsx`** — Tela 1 · candidato de ORCID ('Sim, sou eu')
- Antes:
  ```
  <span className="rel-item-titulo">Sim, sou eu — {c.nome || c.orcid}</span>
  ```
- Depois:
  ```
  <span className="rel-item-titulo">Sim, sou eu: {c.nome || c.orcid}</span>
  ```
- Motivo: Apresenta o nome após confirmação; dois-pontos (já há vírgula em 'Sim, sou eu').

**58. `src/relato/MeuAno.tsx`** — Tela 1 · legenda 'Pós-graduação e indicadores'
- Antes: “(opcional — pedidos do Comitê Técnico-Científico)”
- Depois: “(opcional, pedidos do Comitê Técnico-Científico)”
- Motivo: Nota aposta a 'opcional' dentro de parêntese; vírgula, padrão '(opcional, ...)' do arquivo.

**59. `src/relato/MeuAno.tsx`** — Tela 1 · dica do campo PPG (exemplo entre aspas curvas)
- Antes: “Como aparece na CAPES (ex.: “PPG em Biologia Experimental — UNIR”). Sem vínculo? Deixe em branco.”
- Depois: “Como aparece na CAPES (ex.: “PPG em Biologia Experimental, UNIR”). Sem vínculo? Deixe em branco.”
- Motivo: Instituição como aposto do programa; vírgula (parênteses ficariam aninhados no '(ex.: ...)'). Aspas curvas preservadas.

**60. `src/relato/MeuAno.tsx`** — Tela 1 · procedência dos indicadores (falha de busca)
- Antes: “"Não conseguimos buscar agora — pode digitar do seu perfil."”
- Depois: “"Não conseguimos buscar agora. Pode digitar do seu perfil."”
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Pode'.

**61. `src/relato/MeuAno.tsx`** — Tela 1 · dica de Google Acadêmico bloqueado
- Antes: “O Google Acadêmico não respondeu desta vez — o número acima é do OpenAlex.”
- Depois: “O Google Acadêmico não respondeu desta vez. O número acima é do OpenAlex.”
- Motivo: Duas orações independentes; ponto final com maiúscula em 'O'.

**62. `src/relato/MeuAno.tsx`** — Tela 1 · dica dos indicadores editáveis
- Antes: “o que você digitar passa a valer — não”
- Depois: “o que você digitar passa a valer. Não”
- Motivo: Frase já tem dois-pontos ('O número é seu:'); ponto final com maiúscula em 'Não'.

**63. `src/relato/MeuAno.tsx`** — Tela 1 · oferta de indicadores encontrados
- Antes: “Encontramos {resumoDaOferta} — {oferta.procedencia}.”
- Depois: “Encontramos {resumoDaOferta}, {oferta.procedencia}.”
- Motivo: Procedência como aposto; vírgula.

**64. `src/relato/MeuAno.tsx`** — Tela 1 · rótulo 'Página do seu Google Acadêmico'
- Antes: “(opcional — cola-se uma vez só)”
- Depois: “(opcional, cola-se uma vez só)”
- Motivo: Nota aposta a 'opcional' dentro de parêntese; vírgula, padrão do arquivo.

**65. `src/relato/MeuAno.tsx`** — Tela 1 · dica do campo Google Acadêmico
- Antes:
  ```
  <strong>copie o endereço da barra do navegador</strong> — ou use o
  ```
- Depois:
  ```
  <strong>copie o endereço da barra do navegador</strong>, ou use o
  ```
- Motivo: Alternativa iniciada por 'ou'; vírgula.

**66. `src/relato/MeuAno.tsx`** — Tela 1 · dica Google Acadêmico (status 'Guardado' + link)
- Antes: “Guardado —{" "}”
- Depois: “Guardado:{" "}”
- Motivo: Apresenta o link de conferência que segue; dois-pontos, sem exigir maiúscula no rótulo do link.

**67. `src/relato/MeuAno.tsx`** — Tela 2 · aviso para papel técnico/administrativo
- Antes: “Se você não publica, tudo bem — vá direto para a próxima tela.”
- Depois: “Se você não publica, tudo bem. Vá direto para a próxima tela.”
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Vá'.

**68. `src/relato/MeuAno.tsx`** — Tela 2 · mensagem 'sem lista' (colar DOIs)
- Antes: “Cole os DOIs — cada um leva 5”
- Depois: “Cole os DOIs. Cada um leva 5”
- Motivo: Instrução + reforço; ponto final com maiúscula em 'Cada' (dois-pontos leria como início de lista).

**69. `src/relato/MeuAno.tsx`** — Tela 2 · aviso 'sem ORCID' (colar DOIs)
- Antes: “abaixo — cada um leva 5 segundos.”
- Depois: “abaixo. Cada um leva 5 segundos.”
- Motivo: Instrução + reforço; ponto final com maiúscula em 'Cada'.

**70. `src/relato/MeuAno.tsx`** — Tela 2 · chip 'sem confirmação automática'
- Antes: “Sem confirmação automática do identificador — vale registrar assim mesmo.”
- Depois: “Sem confirmação automática do identificador. Vale registrar assim mesmo.”
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Vale'.

**71. `src/relato/MeuAno.tsx`** — Tela 2 · erro do registro manual
- Antes: “Informe um link, DOI, ISBN ou número de registro — é o que permite conferir o item depois.”
- Depois: “Informe um link, DOI, ISBN ou número de registro. É o que permite conferir o item depois.”
- Motivo: Justificativa após enumeração com vírgulas; ponto final com maiúscula em 'É' (dois-pontos leria como nova lista).

**72. `src/relato/MeuAno.tsx`** — Tela 2 · CamposArtigo · dica do campo Qualis
- Antes: “Preencha se souber — não há base pública para conferirmos por você.”
- Depois: “Preencha se souber. Não há base pública para conferirmos por você.”
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Não'.

**73. `src/relato/MeuAno.tsx`** — Tela 3 · dica 'Aconteceu algo que não está nesta lista?'
- Antes: “o laboratório as declara uma vez só — se cada participante criasse a sua”
- Depois: “o laboratório as declara uma vez só. Se cada participante criasse a sua”
- Motivo: Asserção + oração consequente; ponto final com maiúscula em 'Se'.

**74. `src/relato/MeuAno.tsx`** — Tela 3 · BlocoObjetivos · confirmação salva (plat-ok)
- Antes: “Confirmado — qualquer ajuste aqui já fica salvo.”
- Depois: “Confirmado. Qualquer ajuste aqui já fica salvo.”
- Motivo: Status + nota; ponto final com maiúscula em 'Qualquer'.

**75. `src/relato/MeuAno.tsx`** — Tela 4 · CampoValorBrl · dica 'É estimativa'
- Antes:
  ```
  <small className="rel-dica">É estimativa — sai do relatório rotulada como estimativa.</small>
  ```
- Depois:
  ```
  <small className="rel-dica">É estimativa. Sai do relatório rotulada como estimativa.</small>
  ```
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Sai'.

**76. `src/relato/MeuAno.tsx`** — Tela 6 · painel de pendências (item sem âncora)
- Antes: “na contagem — você pode enviar assim mesmo.”
- Depois: “na contagem. Você pode enviar assim mesmo.”
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Você'.

**77. `src/relato/MeuAno.tsx`** — Tela 6 · dl 'Quem é você' · dd Nome (marcador de valor vazio)
- Antes:
  ```
  <dd>{membro?.nome ?? "—"}</dd>
  ```
- Depois:
  ```
  <dd>{membro?.nome ?? "não informado"}</dd>
  ```
- Motivo: Marcador de valor vazio (não é pontuação); 'não informado', mesmo texto que o arquivo já usa para ORCID ausente. SINALIZADO à coordenação: é marcador de estado.

**78. `src/relato/MeuAno.tsx`** — Tela 6 · dl 'Quem é você' · dd Papel (marcador de valor vazio)
- Antes:
  ```
  <dd>{membro ? ROTULO_PAPEL[membro.papel] : "—"}</dd>
  ```
- Depois:
  ```
  <dd>{membro ? ROTULO_PAPEL[membro.papel] : "não informado"}</dd>
  ```
- Motivo: Marcador de valor vazio; 'não informado' segue a convenção do arquivo. SINALIZADO: marcador de estado.

**79. `src/relato/MeuAno.tsx`** — Tela 6 · dd Projetos e financiamento (marcador de valor vazio)
- Antes: “              : "—"}”
- Depois: “              : "nenhum"}”
- Motivo: Marcador de valor vazio (nenhum item de fomento); 'nenhum' preserva o sentido de ausência. SINALIZADO: marcador de estado.

**80. `src/relato/MeuAno.tsx`** — Tela 6 · dd Projeto de extensão (marcador de valor vazio)
- Antes:
  ```
  <dd>{respostas.extensao?.tem ? respostas.extensao.titulo || "sim" : "—"}</dd>
  ```
- Depois:
  ```
  <dd>{respostas.extensao?.tem ? respostas.extensao.titulo || "sim" : "nenhum"}</dd>
  ```
- Motivo: Marcador de valor vazio (nenhum projeto de extensão); 'nenhum'. SINALIZADO: marcador de estado.

**81. `src/relato/MeuAno.tsx`** — Tela 6 · dd Resultado mais importante (marcador de valor vazio)
- Antes:
  ```
  <dd>{resultado || "—"}</dd>
  ```
- Depois:
  ```
  <dd>{resultado || "não informado"}</dd>
  ```
- Motivo: Marcador de valor vazio; 'não informado' segue a convenção do arquivo. SINALIZADO: marcador de estado.

**82. `src/relato/MeuAno.tsx`** — Tela 6 · dd Texto para não especialistas (marcador de valor vazio)
- Antes:
  ```
  <dd>{narrativas.texto_nao_especialistas || "—"}</dd>
  ```
- Depois:
  ```
  <dd>{narrativas.texto_nao_especialistas || "não informado"}</dd>
  ```
- Motivo: Marcador de valor vazio; 'não informado'. SINALIZADO: marcador de estado.

**83. `src/relato/MeuAno.tsx`** — Tela 6 · dd Dificuldades (marcador de valor vazio)
- Antes: “(narrativas.dificuldades ? "preenchido" : "—")}”
- Depois: “(narrativas.dificuldades ? "preenchido" : "nenhuma")}”
- Motivo: Marcador de valor vazio (nenhuma dificuldade); 'nenhuma'. SINALIZADO: marcador de estado.

**84. `src/relato/MeuAno.tsx`** — Tela 6 · dd Oportunidades (marcador de valor vazio)
- Antes: “              "—"}”
- Depois: “              "nenhuma"}”
- Motivo: Marcador de valor vazio (nenhuma oportunidade); 'nenhuma'. SINALIZADO: marcador de estado.

**85. `src/relato/MeuAno.tsx`** — Tela 6 · aviso de rateio (plat-notice)
- Antes: “os pedidos de recurso do seu laboratório — diárias, passagens,”
- Depois: “os pedidos de recurso do seu laboratório: diárias, passagens,”
- Motivo: Travessão introduzindo enumeração; dois-pontos.

**86. `src/relato/MeuAno.tsx`** — Tela 6 · AnexoRelatorio · dica do anexo
- Antes: “relatório anual do INCT — Word (.docx) ou PDF,”
- Depois: “relatório anual do INCT: Word (.docx) ou PDF,”
- Motivo: Travessão introduzindo especificação de formatos; dois-pontos.

**87. `src/relato/MeuAno.tsx`** — Recibo · número de Protocolo (marcador de valor vazio)
- Antes:
  ```
  Protocolo <strong className="plat-protocolo">{relato.protocolo ?? "—"}</strong>
  ```
- Depois:
  ```
  Protocolo <strong className="plat-protocolo">{relato.protocolo ?? "não informado"}</strong>
  ```
- Motivo: Marcador de valor vazio (protocolo ausente); 'não informado'. SINALIZADO: marcador de estado.

**88. `src/relato/MeuAno.tsx`** — Recibo · parágrafo 'A coleta segue aberta'
- Antes:
  ```
  <p>A coleta segue aberta — você pode voltar e complementar quando quiser.</p>
  ```
- Depois:
  ```
  <p>A coleta segue aberta. Você pode voltar e complementar quando quiser.</p>
  ```
- Motivo: Duas orações independentes; ponto final com maiúscula em 'Você'.

### Relato anual — formulário Meu Laboratório (56)

**89. `src/relato/MeuLaboratorio.tsx`** — TEXTO.porQueColetivo (Porta / cabeçalho Tela Fatos)
- Antes: “expedições — e a rede pactuou “até 50 expedições”.”
- Depois: “expedições, e a rede pactuou “até 50 expedições”.”
- Motivo: Pausa enfática antes de oração coordenada por "e": vírgula preserva o encadeamento.

**90. `src/relato/MeuLaboratorio.tsx`** — TEXTO.imagem (dica do anexo de imagem)
- Antes: “termo de autorização assinado — " + "nesse caso, anexe o termo junto.”
- Depois: “termo de autorização assinado: " + "nesse caso, anexe o termo junto.”
- Motivo: Introduz condição/consequência; dois-pontos, mantendo a minúscula de "nesse".

**91. `src/relato/MeuLaboratorio.tsx`** — TEXTO.fusao (dica em TelaFatos e TelaFila)
- Antes: “grupos — é o caso de dois laboratórios”
- Depois: “grupos: é o caso de dois laboratórios”
- Motivo: Introduz exemplo/explicação; dois-pontos.

**92. `src/relato/MeuLaboratorio.tsx`** — TEXTO.projecao (aviso em TelaConferencia)
- Antes: “Projeção informativa — nenhuma meta vence no 1º ano.”
- Depois: “Projeção informativa: nenhuma meta vence no 1º ano.”
- Motivo: Rótulo seguido da explicação que o qualifica; dois-pontos.

**93. `src/relato/MeuLaboratorio.tsx`** — fraseDoProgresso (texto e aria-label do Progresso, 1ª tela)
- Antes:
  ```
  `Primeira de ${TOTAL_TELAS} telas — uns ${m} minutos ao todo`
  ```
- Depois:
  ```
  `Primeira de ${TOTAL_TELAS} telas, uns ${m} minutos ao todo`
  ```
- Motivo: Estimativa de tempo em aposto; vírgula.

**94. `src/relato/MeuLaboratorio.tsx`** — fraseDoProgresso (última tela, caso <=1 min)
- Antes: “"Última tela — falta menos de um minuto"”
- Depois: “"Última tela, falta menos de um minuto"”
- Motivo: Informação adicional após "Última tela"; vírgula. Aplicado junto com o outro travessão da mesma linha.

**95. `src/relato/MeuLaboratorio.tsx`** — fraseDoProgresso (última tela, caso >1 min)
- Antes:
  ```
  `Última tela — uns ${m} minutos`
  ```
- Depois:
  ```
  `Última tela, uns ${m} minutos`
  ```
- Motivo: Informação adicional após "Última tela"; vírgula. Aplicado junto com o outro travessão da mesma linha.

**96. `src/relato/MeuLaboratorio.tsx`** — Guarda !platformEnabled (aviso "Formulário em preparação")
- Antes: “nominal por e-mail — 15 dias antes do convite geral da rede.”
- Depois: “nominal por e-mail, 15 dias antes do convite geral da rede.”
- Motivo: Aposto temporal; vírgula.

**97. `src/relato/MeuLaboratorio.tsx`** — Guarda !ciclo (aviso "A coleta ainda não começou")
- Antes: “avise a coordenação —\n            nada do que você escrever depois se perde.”
- Depois: “avise a coordenação.\n            Nada do que você escrever depois se perde.”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "Nada".

**98. `src/relato/MeuLaboratorio.tsx`** — Coordenação escolhe laboratório ("Qual laboratório?")
- Antes: “preencher em nome do líder — o log registra quem gravou.”
- Depois: “preencher em nome do líder: o log registra quem gravou.”
- Motivo: Explica a salvaguarda seguinte; dois-pontos, mantém minúscula de "o".

**99. `src/relato/MeuLaboratorio.tsx`** — Selecao "Laboratório Associado" (rótulo das opções)
- Antes:
  ```
  `${l.sigla} — ${l.nome}`
  ```
- Depois:
  ```
  `${l.sigla}: ${l.nome}`
  ```
- Motivo: Par sigla/nome por extenso; dois-pontos.

**100. `src/relato/MeuLaboratorio.tsx`** — Aviso "...é o(a) líder" (nome do líder ausente)
- Antes:
  ```
  {carga.lab.lla_nome || "—"}
  ```
- Depois:
  ```
  {carga.lab.lla_nome || "não informado"}
  ```
- Motivo: Marcador de valor ausente exibido ao usuário; substituído por "não informado".

**101. `src/relato/MeuLaboratorio.tsx`** — Aviso "...é o(a) líder" (prosa)
- Antes:
  ```
  Relatório Anual de Atividades</a> — e, se algo não estiver
  ```
- Depois:
  ```
  Relatório Anual de Atividades</a>, e se algo não estiver
  ```
- Motivo: Pausa antes de oração coordenada por "e"; vírgula, removendo a vírgula redundante após "e".

**102. `src/relato/MeuLaboratorio.tsx`** — Shell subtitulo (cabeçalho do formulário)
- Antes:
  ```
  `${carga.lab.sigla} — ${carga.lab.nome}${carga.lab.uf ? ` · ${carga.lab.uf}` : ""}`
  ```
- Depois:
  ```
  `${carga.lab.sigla}: ${carga.lab.nome}${carga.lab.uf ? ` · ${carga.lab.uf}` : ""}`
  ```
- Motivo: Par sigla/nome por extenso; dois-pontos.

**103. `src/relato/MeuLaboratorio.tsx`** — copiarLista (texto copiado para e-mail à coordenação)
- Antes:
  ```
  `Laboratório ${ctx.lab.sigla} — alterações de equipe
  ```
- Depois:
  ```
  `Laboratório ${ctx.lab.sigla}: alterações de equipe
  ```
- Motivo: Título do bloco do e-mail gerado; dois-pontos introduz o assunto.

**104. `src/relato/MeuLaboratorio.tsx`** — TelaEquipe (instrução do cabeçalho)
- Antes: “informe quantas pessoas entraram — é exatamente o”
- Depois: “informe quantas pessoas entraram: é exatamente o”
- Motivo: Introduz explicação; dois-pontos.

**105. `src/relato/MeuLaboratorio.tsx`** — TelaEquipe (item de lista vazia)
- Antes: “nos fatos que você declarar — avise a coordenação antes de seguir.”
- Depois: “nos fatos que você declarar. Avise a coordenação antes de seguir.”
- Motivo: Corte para oração imperativa independente; ponto final e maiúscula em "Avise".

**106. `src/relato/MeuLaboratorio.tsx`** — TelaEquipe (dica "pessoas sem primeiro acesso")
- Antes: “depois do primeiro acesso — é o cadastro que”
- Depois: “depois do primeiro acesso: é o cadastro que”
- Motivo: Introduz a explicação do motivo; dois-pontos.

**107. `src/relato/MeuLaboratorio.tsx`** — TelaFatos (estado vazio "Nada declarado ainda")
- Antes: “para começar — cada item leva menos de um minuto.”
- Depois: “para começar. Cada item leva menos de um minuto.”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "Cada".

**108. `src/relato/MeuLaboratorio.tsx`** — TelaFatos (bloco "sem fatos coletivos")
- Antes: “Tudo bem — nenhuma meta vence no 1º ano.”
- Depois: “Tudo bem: nenhuma meta vence no 1º ano.”
- Motivo: "Tudo bem" seguido da explicação que o justifica; dois-pontos.

**109. `src/relato/MeuLaboratorio.tsx`** — TelaFatos (dica final sobre ajustar/apagar)
- Antes: “excluir proposta ou item rejeitado — isso fica na tela “Fila de”
- Depois: “excluir proposta ou item rejeitado. Isso fica na tela “Fila de”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "Isso".

**110. `src/relato/MeuLaboratorio.tsx`** — EditorDeFato (dica "Mês em que aconteceu")
- Antes: “entra como dia 1 — é assim que o relatório conta.”
- Depois: “entra como dia 1: é assim que o relatório conta.”
- Motivo: Introduz a explicação; dois-pontos.

**111. `src/relato/MeuLaboratorio.tsx`** — EditorDeFato (summary "Classificação")
- Antes: “Classificação (opcional — já vem do laboratório)”
- Depois: “Classificação (opcional, já vem do laboratório)”
- Motivo: Dentro de parênteses, separa duas qualificações; vírgula.

**112. `src/relato/MeuLaboratorio.tsx`** — EditorDeFato (rótulo das caixas de EET)
- Antes:
  ```
  `${e.codigo} — ${e.titulo.slice(0, 90)}...`
  ```
- Depois:
  ```
  `${e.codigo}: ${e.titulo.slice(0, 90)}...`
  ```
- Motivo: Par código/título; dois-pontos.

**113. `src/relato/MeuLaboratorio.tsx`** — CamposDoTipo/expedicao (dica "Número da autorização")
- Antes: “CEP/CONEP, SISBIO, SISGEN ou CGEN — o número do parecer, não o conteúdo dele.”
- Depois: “CEP/CONEP, SISBIO, SISGEN ou CGEN: o número do parecer, não o conteúdo dele.”
- Motivo: Especifica o que informar; dois-pontos.

**114. `src/relato/MeuLaboratorio.tsx`** — CamposDoTipo/acao_sociedade (dica "Pessoas alcançadas")
- Antes: “Estimativa — o relatório publica este número”
- Depois: “Estimativa: o relatório publica este número”
- Motivo: Rótulo seguido de explicação; dois-pontos.

**115. `src/relato/MeuLaboratorio.tsx`** — CamposDoTipo/formacao (dica "Situação atual do egresso")
- Antes: “impossível de reconstituir depois — por isso se coleta já no 1º ano”
- Depois: “impossível de reconstituir depois, por isso se coleta já no 1º ano”
- Motivo: Liga à consequência introduzida por "por isso"; vírgula.

**116. `src/relato/MeuLaboratorio.tsx`** — CamposDoTipo/bolsista (rótulo das opções de "Modalidade")
- Antes:
  ```
  `${b.sigla} — ${b.modalidade}`
  ```
- Depois:
  ```
  `${b.sigla}: ${b.modalidade}`
  ```
- Motivo: Par sigla/modalidade; dois-pontos.

**117. `src/relato/MeuLaboratorio.tsx`** — ParticipantesDoFato (texto auxiliar "Quem participou")
- Antes: “com cinco participantes — é essa a diferença”
- Depois: “com cinco participantes: é essa a diferença”
- Motivo: Enfatiza/explica a razão; dois-pontos.

**118. `src/relato/MeuLaboratorio.tsx`** — ObjetivosDoItem (texto auxiliar dos objetivos)
- Antes: “tem onde dar — e quem não quiser não perde nada”
- Depois: “tem onde dar, e quem não quiser não perde nada”
- Motivo: Separa orações coordenadas por "e"; vírgula. O dois-pontos que já existia adiante foi mantido.

**119. `src/relato/MeuLaboratorio.tsx`** — TelaFila (cabeçalho "O que a equipe propôs")
- Antes: “não conta em lugar nenhum — e a pessoa está esperando”
- Depois: “não conta em lugar nenhum, e a pessoa está esperando”
- Motivo: Orações coordenadas por "e"; vírgula.

**120. `src/relato/MeuLaboratorio.tsx`** — TelaFila (mensagem de confirmação via aria-live)
- Antes: “"Proposta rejeitada — o comentário volta para quem propôs."”
- Depois: “"Proposta rejeitada: o comentário volta para quem propôs."”
- Motivo: Mensagem de confirmação; o travessão introduz a consequência; dois-pontos.

**121. `src/relato/MeuLaboratorio.tsx`** — TelaFila (dica "corrigir proposta antes de confirmar")
- Antes: ““Fatos do laboratório” — os campos são os mesmos”
- Depois: ““Fatos do laboratório”. Os campos são os mesmos”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "Os".

**122. `src/relato/MeuLaboratorio.tsx`** — TelaFila (bloco "Rejeitadas")
- Antes: “podem ser apagados — o resto é histórico.”
- Depois: “podem ser apagados. O resto é histórico.”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "O".

**123. `src/relato/MeuLaboratorio.tsx`** — TelaConferencia (aviso para coordenação)
- Antes: “que é a rede inteira — não só este laboratório.”
- Depois: “que é a rede inteira, não só este laboratório.”
- Motivo: Aposto contrastivo; vírgula.

**124. `src/relato/MeuLaboratorio.tsx`** — TelaConferencia (parágrafo introdutório)
- Antes: “Você aprova ou aponta — não redigita.”
- Depois: “Você aprova ou aponta, não redigita.”
- Motivo: Pausa enfática/contraste; vírgula.

**125. `src/relato/MeuLaboratorio.tsx`** — TelaConferencia > tabela Cobertura ("Parágrafos prontos", valor não carregado)
- Antes: “{comTextoPublico ?? "—"}”
- Depois: “{comTextoPublico ?? "sem dados"}”
- Motivo: Marcador de valor não carregado na célula; substituído por "sem dados".

**126. `src/relato/MeuLaboratorio.tsx`** — TelaConferencia > tabela "Fatos coletivos" (Comitê ausente)
- Antes: “{l.comite ?? "—"}”
- Depois: “{l.comite ?? "não informado"}”
- Motivo: Marcador de comitê ausente na célula; substituído por "não informado".

**127. `src/relato/MeuLaboratorio.tsx`** — TelaConferencia > tabela "Fatos coletivos" (Pessoas alcançadas ausente)
- Antes:
  ```
  `aproximadamente ${l.pessoas_alcancadas_estimado}` : "—"}
  ```
- Depois:
  ```
  `aproximadamente ${l.pessoas_alcancadas_estimado}` : "não informado"}
  ```
- Motivo: Marcador de estimativa ausente na célula; substituído por "não informado".

**128. `src/relato/MeuLaboratorio.tsx`** — TelaConferencia > Projeção (rótulo da linha)
- Antes: “{l.chave} — {l.oQue}”
- Depois: “{l.chave}: {l.oQue}”
- Motivo: Par chave/descrição; dois-pontos.

**129. `src/relato/MeuLaboratorio.tsx`** — TelaConferencia > Projeção (parágrafo sobre pactuados)
- Antes: “nenhum item declarado alcança automaticamente — elas são preenchidas”
- Depois: “nenhum item declarado alcança automaticamente: elas são preenchidas”
- Motivo: Introduz a explicação; dois-pontos.

**130. `src/relato/MeuLaboratorio.tsx`** — LinhaDeContador (célula numérica não contável)
- Antes: “{contavel ? contado : "—"}”
- Depois: “{contavel ? contado : "não se aplica"}”
- Motivo: Marcador de categoria não contável na célula; substituído por "não se aplica".

**131. `src/relato/MeuLaboratorio.tsx`** — LinhaDeContador (aria-label "Valor no relatório")
- Antes:
  ```
  `Valor no relatório — ${rotulo}`
  ```
- Depois:
  ```
  `Valor no relatório, ${rotulo}`
  ```
- Motivo: Rótulo acessível; vírgula separa o campo do nome da linha para leitor de tela.

**132. `src/relato/MeuLaboratorio.tsx`** — LinhaDeContador (aria-label "Nota")
- Antes:
  ```
  `Nota — ${rotulo}`
  ```
- Depois:
  ```
  `Nota, ${rotulo}`
  ```
- Motivo: Rótulo acessível; vírgula separa o campo do nome da linha.

**133. `src/relato/MeuLaboratorio.tsx`** — ContadoresDoForms (h3 "Estudantes e pessoal formado") — intervalo numérico
- Antes: “perguntas 10 e 15–19 do questionário do CTC”
- Depois: “perguntas 10 e 15 a 19 do questionário do CTC”
- Motivo: Intervalo numérico (en-dash); substituído por "a".

**134. `src/relato/MeuLaboratorio.tsx`** — ContadoresDoForms (parágrafo de instrução)
- Antes: “e o porquê na nota — o sistema guarda a contagem”
- Depois: “e o porquê na nota: o sistema guarda a contagem”
- Motivo: Introduz a explicação; dois-pontos.

**135. `src/relato/MeuLaboratorio.tsx`** — ContadoresDoForms (caption tabela de estudantes)
- Antes: “Estudantes por nível (pergunta 10) — você confere e ajusta, não redigita.”
- Depois: “Estudantes por nível (pergunta 10): você confere e ajusta, não redigita.”
- Motivo: Introduz o esclarecimento; dois-pontos.

**136. `src/relato/MeuLaboratorio.tsx`** — ContadoresDoForms (caption tabela de formados) — intervalo + travessão na mesma linha
- Antes: “Pessoal formado no período (perguntas 15–19) — das formações concluídas.”
- Depois: “Pessoal formado no período (perguntas 15 a 19): das formações concluídas.”
- Motivo: Duas trocas na mesma linha: en-dash do intervalo vira "a" (15 a 19) e o em-dash que introduz a especificação de origem vira dois-pontos.

**137. `src/relato/MeuLaboratorio.tsx`** — ContadoresDoForms (dica sobreposição formação/bolsa)
- Antes: “numa formação E numa bolsa — o sistema não”
- Depois: “numa formação E numa bolsa: o sistema não”
- Motivo: Introduz a explicação; dois-pontos.

**138. `src/relato/MeuLaboratorio.tsx`** — ContadoresDoForms (dica formações fora dos níveis)
- Antes: “fora destes níveis do questionário — continuam contadas nos fatos acima.”
- Depois: “fora destes níveis do questionário. Continuam contadas nos fatos acima.”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "Continuam".

**139. `src/relato/MeuLaboratorio.tsx`** — ContadoresDoForms (confirmação "Ajustes salvos")
- Antes: “Ajustes salvos às {salvoEm} — vão no mesmo envio do seu relato.”
- Depois: “Ajustes salvos às {salvoEm}. Vão no mesmo envio do seu relato.”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "Vão".

**140. `src/relato/MeuLaboratorio.tsx`** — TelaRevisao > recibo (protocolo ausente)
- Antes: “{enviado.protocolo ?? "—"}”
- Depois: “{enviado.protocolo ?? "sem protocolo"}”
- Motivo: Marcador de protocolo ausente no recibo; substituído por "sem protocolo".

**141. `src/relato/MeuLaboratorio.tsx`** — TelaRevisao > "O que será enviado" (Fatos confirmados)
- Antes: “{confirmados.length} item(ns) — é esta a lista que os membros veem para marcar participação”
- Depois: “{confirmados.length} item(ns): é esta a lista que os membros veem para marcar participação”
- Motivo: Introduz a explicação; dois-pontos.

**142. `src/relato/MeuLaboratorio.tsx`** — TelaRevisao (aviso sobre propostas sem conferência)
- Antes: “Você pode enviar assim mesmo — elas simplesmente não contam enquanto isso”
- Depois: “Você pode enviar assim mesmo: elas simplesmente não contam enquanto isso”
- Motivo: Introduz a explicação/consequência; dois-pontos.

**143. `src/relato/MeuLaboratorio.tsx`** — TelaRevisao > Declarações (checkbox de veracidade)
- Antes: “consequência administrativa, civil e penal —”
- Depois: “consequência administrativa, civil e penal,”
- Motivo: Liga à consequência introduzida por "por isso" na oração seguinte; vírgula.

**144. `src/relato/MeuLaboratorio.tsx`** — TelaRevisao (dica "janela de envio fechada")
- Antes: “continua salvo, inteiro — nada se perde.”
- Depois: “continua salvo, inteiro. Nada se perde.”
- Motivo: Corte entre orações independentes; ponto final e maiúscula em "Nada".

### Relato anual — painel, busca e porta (60)

**145. `src/relato/PainelRelatorio.tsx`** — CartoesDeAcesso · aviso 'Resultados registrados aqui são a porta para novos recursos' (abertura do par)
- Antes: “As solicitações de apoio do INCT-CONEXAO — expedições, insumos, diárias, participação em”
- Depois: “As solicitações de apoio do INCT-CONEXAO (expedições, insumos, diárias, participação em”
- Motivo: Abertura de par de travessões que isola lista de exemplos (fecha na linha seguinte); como a lista tem vírgulas internas, parênteses ficam mais claros. Vira parêntese de abertura.

**146. `src/relato/PainelRelatorio.tsx`** — CartoesDeAcesso · aviso 'Resultados registrados aqui são a porta para novos recursos' (fechamento do par)
- Antes: “eventos — são avaliadas com base no que cada pesquisador(a) e laboratório”
- Depois: “eventos) são avaliadas com base no que cada pesquisador(a) e laboratório”
- Motivo: Fechamento do par de travessões. Vira parêntese de fechamento. Render final: 'INCT-CONEXAO (expedições, insumos, diárias, participação em eventos) são avaliadas...'.

**147. `src/relato/PainelRelatorio.tsx`** — CartoesDeAcesso · cartão 'Relatório Anual de Atividades'
- Antes: “relata o próprio ano — produções, participação em atividades e o resultado principal.”
- Depois: “relata o próprio ano: produções, participação em atividades e o resultado principal.”
- Motivo: Travessão que introduz enumeração do que é relatado → dois-pontos.

**148. `src/relato/PainelRelatorio.tsx`** — CartoesDeAcesso · cartão 'Relatório Anual do Laboratório'
- Antes: “coletivos do laboratório — expedições, parcerias, formação — e responde pelas perguntas de”
- Depois: “coletivos do laboratório (expedições, parcerias, formação) e responde pelas perguntas de”
- Motivo: Par de travessões isolando lista de exemplos com vírgulas internas → parênteses.

**149. `src/relato/PainelRelatorio.tsx`** — SemAcesso · mensagem para papel 'lla'
- Antes:
  ```
  <a href={RELATORIO_LAB_HREF}>Relatório Anual do Laboratório</a> — este painel, com a rede
  ```
- Depois:
  ```
  <a href={RELATORIO_LAB_HREF}>Relatório Anual do Laboratório</a>. Este painel, com a rede
  ```
- Motivo: Travessão cortando duas orações independentes → ponto final, com maiúscula em 'Este'.

**150. `src/relato/PainelRelatorio.tsx`** — SemAcesso · mensagem para papel 'membro da equipe'
- Antes:
  ```
  Você consta neste ciclo como <strong>membro da equipe</strong> — seu caminho é o
  ```
- Depois:
  ```
  Você consta neste ciclo como <strong>membro da equipe</strong>. Seu caminho é o
  ```
- Motivo: Travessão entre duas orações independentes → ponto final, com maiúscula em 'Seu'.

**151. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Cobertura por laboratório (hint)
- Antes: “direto do banco — nenhum número é digitado. Sem esta”
- Depois: “direto do banco. Nenhum número é digitado. Sem esta”
- Motivo: Travessão entre duas afirmações independentes → ponto final, com maiúscula em 'Nenhum'.

**152. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Cobertura por laboratório (estado vazio)
- Antes: “A cobertura ainda não tem linhas — o roster deste ciclo pode não ter sido importado.”
- Depois: “A cobertura ainda não tem linhas: o roster deste ciclo pode não ter sido importado.”
- Motivo: Travessão introduzindo a causa provável da ausência de linhas → dois-pontos.

**153. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Relatos recebidos (estado sem laboratório escolhido)
- Antes: “Escolha um laboratório acima — ou clique numa linha da cobertura — para ver os relatos da”
- Depois: “Escolha um laboratório acima, ou clique numa linha da cobertura, para ver os relatos da”
- Motivo: Par de travessões isolando alternativa parentética (sem vírgulas internas) → vírgulas dos dois lados.

**154. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Relatos recebidos (nenhum relato)
- Antes:
  ```
  Nenhum relato {labSelecionado ? `de ${labSelecionado.sigla}` : "deste laboratório"} ainda\n            — nem rascunho.
  ```
- Depois:
  ```
  Nenhum relato {labSelecionado ? `de ${labSelecionado.sigla}` : "deste laboratório"} ainda,\n            nem rascunho.
  ```
- Motivo: Travessão de pausa enfática → vírgula anexada a 'ainda'; a quebra de linha JSX vira espaço. Render: '...ainda, nem rascunho.'

**155. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · tabela 'Relatos recebidos', coluna Protocolo (placeholder de célula vazia)
- Antes:
  ```
  <td data-label="Protocolo">{r.protocolo ?? "—"}</td>
  ```
- Depois:
  ```
  <td data-label="Protocolo">{r.protocolo ?? "n/d"}</td>
  ```
- Motivo: Travessão como marcador de 'sem valor' em célula → 'n/d', a convenção de valor ausente já usada no arquivo (fmtData/fmtDataHora).

**156. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Relatos recebidos (hint sobre protocolo)
- Antes: “coleta segue aberta depois do envio — o número de "atualizado em" pode andar sem mudar o”
- Depois: “coleta segue aberta depois do envio: o número de "atualizado em" pode andar sem mudar o”
- Motivo: Travessão introduzindo a explicação da consequência → dois-pontos.

**157. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Satisfação (linha da média)
- Antes:
  ```
  </strong>{" "}\n                — sempre leia com o n ao lado; média sem denominador é propaganda.
  ```
- Depois:
  ```
  </strong>. Sempre leia com o n ao lado; média sem denominador é propaganda.
  ```
- Motivo: Travessão separando o valor de um alerta imperativo → ponto final, com maiúscula em 'Sempre'. O {" "} foi removido para não deixar espaço antes do ponto.

**158. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Indicadores individuais (hint procedência)
- Antes: “é passivo num relatório ao CNPq — vale pedir a fonte.”
- Depois: “é passivo num relatório ao CNPq. Vale pedir a fonte.”
- Motivo: Travessão entre constatação e recomendação independente → ponto final, com maiúscula em 'Vale'.

**159. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Fatos coletivos confirmados (hint, trecho condicional em template literal)
- Antes:
  ```
  ? ` — e ${fmtNum(fatos.propostosPendentes)} propostas aguardando a conferência dos líderes
  ```
- Depois:
  ```
  ? `, e ${fmtNum(fatos.propostosPendentes)} propostas aguardando a conferência dos líderes
  ```
- Motivo: Travessão antes de cláusula coordenada aditiva ('e ...') → vírgula colada à palavra anterior ('ciclo'), sem espaço antes da vírgula.

**160. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · Fatos coletivos confirmados (hint)
- Antes: “estimativa declarada — leia como "aproximadamente".”
- Depois: “estimativa declarada: leia como "aproximadamente".”
- Motivo: Travessão introduzindo instrução de como ler o dado → dois-pontos.

**161. `src/relato/PainelRelatorio.tsx`** — Aba Visão geral · tabela 'Fatos', coluna 'Pessoas alcançadas (≈)' (placeholder)
- Antes:
  ```
  {l.pessoasAlcancadasEstimado > 0 ? `≈ ${fmtNum(l.pessoasAlcancadasEstimado)}` : "—"}
  ```
- Depois:
  ```
  {l.pessoasAlcancadasEstimado > 0 ? `≈ ${fmtNum(l.pessoasAlcancadasEstimado)}` : "n/d"}
  ```
- Motivo: Travessão como marcador de 'sem estimativa' em célula → 'n/d'.

**162. `src/relato/PainelRelatorio.tsx`** — Aba Produção · hint de contagem
- Antes: “pelo menos um vínculo de membro — a mesma”
- Depois: “pelo menos um vínculo de membro, a mesma”
- Motivo: Travessão introduzindo aposto sem verbo próprio → vírgula.

**163. `src/relato/PainelRelatorio.tsx`** — Aba Produção · Por tipo de produção (hint 'Sem âmbito')
- Antes: “ainda não homologou nacional/internacional — não é "nacional”
- Depois: “ainda não homologou nacional/internacional. Não é "nacional”
- Motivo: Travessão entre duas orações independentes (contraste) → ponto final, com maiúscula em 'Não'.

**164. `src/relato/PainelRelatorio.tsx`** — Aba Produção · Qualis dos artigos (hint)
- Antes: “"artigos ainda sem Qualis"} — o”
- Depois: “"artigos ainda sem Qualis"}. O”
- Motivo: Travessão entre constatação e explicação → ponto final, com maiúscula em 'O'.

**165. `src/relato/PainelRelatorio.tsx`** — Aba Produção · título do cartão 'JCR'
- Antes:
  ```
  <h3>JCR (fator de impacto) — mediana e faixa</h3>
  ```
- Depois:
  ```
  <h3>JCR (fator de impacto): mediana e faixa</h3>
  ```
- Motivo: Travessão de subtítulo em título → dois-pontos.

**166. `src/relato/PainelRelatorio.tsx`** — Aba Produção · JCR, rótulo do Stat 'Faixa'
- Antes: “label="Faixa (mín–máx)"”
- Depois: “label="Faixa (mín a máx)"”
- Motivo: Meia-risca (–) de intervalo entre mínimo e máximo → 'a'.

**167. `src/relato/PainelRelatorio.tsx`** — Aba Produção · JCR, valor do Stat 'Faixa (mín a máx)' (template literal)
- Antes: “})} – ${producao.jcr.maximo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}”
- Depois: “})} a ${producao.jcr.maximo.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}”
- Motivo: Meia-risca (–) de intervalo numérico → 'a' (render ex.: '1,20 a 5,40').

**168. `src/relato/PainelRelatorio.tsx`** — Aba Produção · título do cartão 'Fora do período'
- Antes:
  ```
  <h3>Fora do período — não conta no ciclo</h3>
  ```
- Depois:
  ```
  <h3>Fora do período: não conta no ciclo</h3>
  ```
- Motivo: Travessão de subtítulo/qualificação em título → dois-pontos.

**169. `src/relato/PainelRelatorio.tsx`** — Aba Produção · Fora do período (hint)
- Antes: “Estão listados aqui para não sumirem — somá-los seria mentir.”
- Depois: “Estão listados aqui para não sumirem: somá-los seria mentir.”
- Motivo: Travessão introduzindo a justificativa → dois-pontos.

**170. `src/relato/PainelRelatorio.tsx`** — Aba Pessoas e RH · hint de topo
- Antes:
  ```
  ajustaram os automáticos — e o ajuste do líder <strong>vence</strong>,
  ```
- Depois:
  ```
  ajustaram os automáticos, e o ajuste do líder <strong>vence</strong>,
  ```
- Motivo: Travessão antes de cláusula coordenada aditiva ('e ...') → vírgula antes do 'e'.

**171. `src/relato/PainelRelatorio.tsx`** — Aba Pessoas e RH · tabela 'Estudantes ativos por nível', coluna 'Labs com ajuste' (placeholder)
- Antes: “{l.laboratoriosComAjuste ? fmtNum(l.laboratoriosComAjuste) : "—"}”
- Depois: “{l.laboratoriosComAjuste ? fmtNum(l.laboratoriosComAjuste) : "n/d"}”
- Motivo: Travessão como marcador de 'sem ajuste' em célula → 'n/d' (aplicado com replace_all pois a linha é idêntica à da tabela de RH formado).

**172. `src/relato/PainelRelatorio.tsx`** — Aba Pessoas e RH · tabela 'RH formado', coluna 'Contado automático' (placeholder)
- Antes: “{l.contavel ? fmtNum(l.contadoAutomatico) : "—"}”
- Depois: “{l.contavel ? fmtNum(l.contadoAutomatico) : "n/d"}”
- Motivo: Travessão como marcador de valor não contável em célula → 'n/d'.

**173. `src/relato/PainelRelatorio.tsx`** — Aba Pessoas e RH · tabela 'RH formado', coluna 'Valor final' (placeholder)
- Antes:
  ```
  {l.contavel ? <strong>{fmtNum(l.valorFinal)}</strong> : "—"}
  ```
- Depois:
  ```
  {l.contavel ? <strong>{fmtNum(l.valorFinal)}</strong> : "n/d"}
  ```
- Motivo: Travessão como marcador de valor não contável em célula → 'n/d'.

**174. `src/relato/PainelRelatorio.tsx`** — Aba Pessoas e RH · tabela 'RH formado', coluna 'Labs com ajuste' (placeholder)
- Antes: “{l.laboratoriosComAjuste ? fmtNum(l.laboratoriosComAjuste) : "—"}”
- Depois: “{l.laboratoriosComAjuste ? fmtNum(l.laboratoriosComAjuste) : "n/d"}”
- Motivo: Segunda ocorrência idêntica (tabela de RH formado) coberta pelo mesmo replace_all → 'n/d'.

**175. `src/relato/PainelRelatorio.tsx`** — Aba Pessoas e RH · RH formado (hint)
- Antes: “(técnica, comunitária…) — registradas, não somadas nestas linhas.”
- Depois: “(técnica, comunitária…): registradas, não somadas nestas linhas.”
- Motivo: Travessão introduzindo esclarecimento com vírgula interna → dois-pontos (evita confundir com as vírgulas de 'registradas, não somadas').

**176. `src/relato/PainelRelatorio.tsx`** — Aba Fomento e extensão · hint (definição Corrente/complementar)
- Antes: “= captação nova atraída pelo INCT — somados”
- Depois: “= captação nova atraída pelo INCT, somados”
- Motivo: Travessão de pausa antes de cláusula aditiva → vírgula.

**177. `src/relato/PainelRelatorio.tsx`** — Aba Fomento · tabela 'Por agência de fomento', coluna 'Sem valor' (placeholder)
- Antes: “{a.itensSemValor ? fmtNum(a.itensSemValor) : "—"}”
- Depois: “{a.itensSemValor ? fmtNum(a.itensSemValor) : "n/d"}”
- Motivo: Travessão como marcador de célula sem valor → 'n/d'.

**178. `src/relato/PainelRelatorio.tsx`** — Aba Fomento · tabela 'Processos declarados', coluna Processo (placeholder)
- Antes:
  ```
  <td data-label="Processo">{p.processo || "—"}</td>
  ```
- Depois:
  ```
  <td data-label="Processo">{p.processo || "n/d"}</td>
  ```
- Motivo: Travessão como marcador de célula vazia (processo não informado) → 'n/d'.

**179. `src/relato/PainelRelatorio.tsx`** — Aba Fomento · tabela 'Processos declarados', coluna Título (placeholder)
- Antes:
  ```
  <td data-label="Título">{p.titulo || "—"}</td>
  ```
- Depois:
  ```
  <td data-label="Título">{p.titulo || "n/d"}</td>
  ```
- Motivo: Travessão como marcador de célula vazia (título não informado) → 'n/d'.

**180. `src/relato/PainelRelatorio.tsx`** — Aba Vozes da rede · hint de topo
- Antes: “(enviados e rascunhos) — "atraso de recursos”
- Depois: “(enviados e rascunhos): "atraso de recursos”
- Motivo: Travessão introduzindo um exemplo entre aspas → dois-pontos.

**181. `src/relato/PainelRelatorio.tsx`** — Aba Vozes da rede · hint final
- Antes: “aqui — prosa não se tabula; as categorias existem exatamente para isso.”
- Depois: “aqui: prosa não se tabula; as categorias existem exatamente para isso.”
- Motivo: Travessão introduzindo a justificativa → dois-pontos.

**182. `src/relato/PainelRelatorio.tsx`** — Aba Metas e objetivos · hint (regra da casa)
- Antes: “os dois aparecem lado a lado — quem”
- Depois: “os dois aparecem lado a lado. Quem”
- Motivo: Travessão entre duas orações independentes → ponto final, com maiúscula em 'Quem'.

**183. `src/relato/PainelRelatorio.tsx`** — Aba Metas · Pactuado × declarado (hint)
- Antes: “recorte parcial lá de cima — nunca percentual, e”
- Depois: “recorte parcial lá de cima: nunca percentual, e”
- Motivo: Travessão introduzindo qualificação com vírgula interna → dois-pontos.

**184. `src/relato/PainelRelatorio.tsx`** — Aba Metas · Objetivos confirmados (hint)
- Antes:
  ```
  confirmação</strong>{" "}\n              — o buraco a resolver antes do relatório: obj.
  ```
- Depois:
  ```
  confirmação</strong>,{" "}\n              o buraco a resolver antes do relatório: obj.
  ```
- Motivo: Travessão introduzindo aposto → vírgula colada a 'confirmação'; o {" "} é mantido; dois-pontos já aparece adiante, então a vírgula evita duplicá-lo.

**185. `src/relato/PainelRelatorio.tsx`** — Aba Metas · Pactuados sem medição automática (hint)
- Antes: “direta nos dados coletados — medi-los”
- Depois: “direta nos dados coletados: medi-los”
- Motivo: Travessão introduzindo a explicação → dois-pontos.

**186. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · Documentos anexados, montagem do valor 'Laboratório' (renderizado como célula)
- Antes: “laboratorio: lab ? lab.sigla : "—",”
- Depois: “laboratorio: lab ? lab.sigla : "n/d",”
- Motivo: Travessão como marcador de 'sem laboratório' na célula renderizada → 'n/d'.

**187. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · Documentos anexados (hint de contagem, nó de texto literal)
- Antes: “{" — "}”
- Depois: “{": "}”
- Motivo: Travessão (nó de texto) separando a contagem de relatos com anexo do total de arquivos → dois-pontos, que introduz o detalhamento e evita iniciar com numeral.

**188. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · Documentos anexados (hint sobre .docx)
- Antes: “Relatório Anual de Atividades — o .doc de 2003 não é aceito; quem tiver, salva como”
- Depois: “Relatório Anual de Atividades. O .doc de 2003 não é aceito; quem tiver, salva como”
- Motivo: Travessão entre duas orações independentes → ponto final, com maiúscula em 'O'.

**189. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · Minuta (título H1 do Markdown gerado/baixado, template literal)
- Antes:
  ```
  `# Minuta do Relatório Anual — ${dados.recorte.cicloTitulo}\n\n` +
  ```
- Depois:
  ```
  `# Minuta do Relatório Anual: ${dados.recorte.cicloTitulo}\n\n` +
  ```
- Motivo: Título do documento .md gerado e baixado pelo usuário; travessão de subtítulo (título do ciclo) → dois-pontos. Conteúdo de arquivo exportado, análogo a texto gerado visível.

**190. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · hint de topo
- Antes: “exibido nas abas — e carregam o mesmo recorte de”
- Depois: “exibido nas abas, e carregam o mesmo recorte de”
- Motivo: Travessão antes de cláusula coordenada aditiva ('e carregam...') → vírgula antes do 'e'.

**191. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · Planilhas e dados (hint sobre o JSON)
- Antes:
  ```
  envelope de <code>types.ts</code> — é o que o relatório de 2027
  ```
- Depois:
  ```
  envelope de <code>types.ts</code>: é o que o relatório de 2027
  ```
- Motivo: Travessão introduzindo a explicação da importância do formato → dois-pontos.

**192. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · título do cartão 'Minuta do relatório'
- Antes: “Minuta do relatório — seção a seção”
- Depois: “Minuta do relatório: seção a seção”
- Motivo: Travessão de subtítulo em título → dois-pontos.

**193. `src/relato/PainelRelatorio.tsx`** — Aba Exportar · Minuta (hint 'Texto factual')
- Antes:
  ```
  Texto <strong>factual, sem adjetivo</strong> — o mesmo princípio do resto do módulo: os
  ```
- Depois:
  ```
  Texto <strong>factual, sem adjetivo</strong>, o mesmo princípio do resto do módulo: os
  ```
- Motivo: Travessão introduzindo aposto → vírgula; dois-pontos já aparece adiante, então a vírgula evita duplicá-lo.

**194. `src/relato/BuscaPesquisador.tsx`** — EXTRAS · notaDeOrigem (cartão do coordenador, renderizada em CartaoDoCatalogo)
- Antes: “não tem linha de coordenação — " +”
- Depois: “não tem linha de coordenação, " +”
- Motivo: Travessão antes de 'por isso...' (próxima string concatenada) → vírgula. Render: '...não tem linha de coordenação, por isso os campos abaixo...'.

**195. `src/relato/BuscaPesquisador.tsx`** — BuscaPesquisador · dica (rel-dica) abaixo do campo de busca
- Antes: “por instituição e por sigla — e não faz diferença”
- Depois: “por instituição e por sigla, e não faz diferença”
- Motivo: Travessão antes de cláusula coordenada aditiva ('e não faz diferença...') → vírgula antes do 'e'.

**196. `src/relato/BuscaPesquisador.tsx`** — CartaoDoCatalogo · montagem do valor 'Instituição' (renderizado no <Linha rotulo="Instituição">)
- Antes:
  ```
  const instituicao = [ pessoa.instituicaoNome, pessoa.instituicaoSigla ? `(${pessoa.instituicaoSigla})` : "", pessoa.instituicaoDepartamento ? `— ${pessoa.instituicaoDepartamento}` : "", ].filter(Boolean).join(" ");
  ```
- Depois:
  ```
  const instituicaoBase = [ pessoa.instituicaoNome, pessoa.instituicaoSigla ? `(${pessoa.instituicaoSigla})` : "", ].filter(Boolean).join(" "); const instituicao = pessoa.instituicaoDepartamento ? `${instituicaoBase}, ${pessoa.instituicaoDepartamento}` : instituicaoBase;
  ```
- Motivo: CASO ESPECIAL: o array era unido por .join(" "), então trocar o travessão por ', ' como item do array renderizaria '(SIGLA) , Departamento' (espaço antes da vírgula). Reestruturei em duas etapas: nome+sigla unidos por espaço em instituicaoBase, e o departamento concatenado APÓS o join com ', '. Render final correto: 'Nome (SIGLA), Departamento'. Variável final 'instituicao' preservada para o consumidor (linha 1004).

**197. `src/relato/BuscaPesquisador.tsx`** — CartaoDoCatalogo · parágrafo 'Isto veio da EQUIPE' (origem = equipe)
- Antes: “você não precisa digitar nada aqui — o que”
- Depois: “você não precisa digitar nada aqui. O que”
- Motivo: Travessão entre duas orações independentes → ponto final, com maiúscula em 'O'.

**198. `src/relato/BuscaPesquisador.tsx`** — PortaComBusca · fallback quando o catálogo não carrega
- Antes: “Você pode entrar pelo e-mail normalmente — nada do que fizer aqui depende daquela lista.”
- Depois: “Você pode entrar pelo e-mail normalmente. Nada do que fizer aqui depende daquela lista.”
- Motivo: Travessão entre duas orações independentes → ponto final, com maiúscula em 'Nada'.

**199. `src/relato/BuscaPesquisador.tsx`** — PortaComBusca · enviarLink (mensagem de erro de e-mail inválido)
- Antes: “setErro("Informe um e-mail válido — é para lá que o link vai.");”
- Depois: “setErro("Informe um e-mail válido: é para lá que o link vai.");”
- Motivo: Travessão introduzindo a justificativa da exigência → dois-pontos.

**200. `src/relato/BuscaPesquisador.tsx`** — PortaComBusca · fase 'buscando' (parágrafo de abertura)
- Antes: “registrada na proposta — o formulário se”
- Depois: “registrada na proposta. O formulário se”
- Motivo: Travessão após instrução, seguido de oração independente → ponto final, com maiúscula em 'O'.

**201. `src/relato/BuscaPesquisador.tsx`** — PortaComBusca · fase 'conflito' (parágrafo de orientação)
- Antes: “E se não é seu — se você é {fase.pessoa.nome} e outra pessoa escolheu seu nome —,”
- Depois: “E se não é seu (se você é {fase.pessoa.nome} e outra pessoa escolheu seu nome),”
- Motivo: Par de travessões isolando condição parentética → parênteses; a vírgula após o parêntese de fechamento é mantida.

**202. `src/relato/BuscaPesquisador.tsx`** — PortaComBusca · fase 'conferindo' (aviso de link enviado)
- Antes: “link — ele já cai dentro do formulário, sem tela de senha.”
- Depois: “link. Ele já cai dentro do formulário, sem tela de senha.”
- Motivo: Travessão entre duas orações independentes → ponto final, com maiúscula em 'Ele'.

**203. `src/relato/BuscaPesquisador.tsx`** — PortaComBusca · fase 'conferindo' (dica do campo de e-mail)
- Antes:
  ```
  <strong>Pode ser o institucional ou o pessoal</strong> — o que você abrir com mais facilidade. A
  ```
- Depois:
  ```
  <strong>Pode ser o institucional ou o pessoal</strong>, o que você abrir com mais facilidade. A
  ```
- Motivo: Travessão introduzindo aposto/esclarecimento → vírgula colada a 'pessoal'.

**204. `src/relato/BuscaPesquisador.tsx`** — PortaComBusca · rodapé 'Não encontrou seu nome?'
- Antes: “2024 — quem entrou na rede depois não está nela.”
- Depois: “2024. Quem entrou na rede depois não está nela.”
- Motivo: Travessão entre duas orações independentes → ponto final, com maiúscula em 'Quem'.

### Relato anual — config, narrativa, validação, exportação (29)

**205. `src/relato/config.ts`** — config.ts — MENSAGEM_PERIODO_SITUACAO.posterior (mensagem exibida ao membro quando a data do item é posterior ao período do ciclo)
- Antes: “Guardamos com a data verdadeira, para o próximo relatório — não entra na contagem agora.”
- Depois: “Guardamos com a data verdadeira, para o próximo relatório. Não entra na contagem agora.”
- Motivo: Travessão entre duas orações independentes → ponto final e maiúscula. Confirmado como valor de string renderizada (não comentário).

**206. `src/relato/config.ts`** — config.ts — avisoDoAno1() fallback (aviso antes de qualquer número/percentual na tela do LLA)
- Antes: “Este ciclo mede linha de base e andamento — todo percentual exibido é projeção informativa.”
- Depois: “Este ciclo mede linha de base e andamento. Todo percentual exibido é projeção informativa.”
- Motivo: Travessão entre duas orações independentes → ponto final e maiúscula. String literal de retorno, visível.

**207. `src/relato/validation.ts`** — validation.ts — MENSAGENS.orcidChecksum (erro do campo ORCID)
- Antes: “Esse ORCID não confere — o último dígito não bate. Confira em orcid.org.”
- Depois: “Esse ORCID não confere: o último dígito não bate. Confira em orcid.org.”
- Motivo: Travessão introduzindo a explicação do erro → dois-pontos. (O "—" nos comentários JSDoc vizinhos — linhas 96 e 99 — foi deixado intacto por não ser texto visível.)

**208. `src/relato/validation.ts`** — validation.ts — MENSAGENS.isbnDigito (erro do campo ISBN)
- Antes: “Esse ISBN não confere — o dígito verificador não bate. Confira a contracapa.”
- Depois: “Esse ISBN não confere: o dígito verificador não bate. Confira a contracapa.”
- Motivo: Travessão introduzindo a explicação do erro → dois-pontos.

**209. `src/relato/validation.ts`** — validation.ts — MENSAGENS.ror (instrução/erro do campo instituição/ROR)
- Antes: “Escolha a instituição na busca — o identificador ROR tem a forma 0xxxxxxxx e não é digitado à mão.”
- Depois: “Escolha a instituição na busca: o identificador ROR tem a forma 0xxxxxxxx e não é digitado à mão.”
- Motivo: Travessão introduzindo a justificativa da instrução → dois-pontos. Hífen comum em "0xxxxxxxx"/"à mão" não existe aqui; nada de hífen tocado.

**210. `src/relato/validation.ts`** — validation.ts — MENSAGENS.dataLinhaDeBase (aviso quando a data é anterior ao INCT)
- Antes: “Isso é de antes do INCT começar — entra como linha de base.”
- Depois: “Isso é de antes do INCT começar: entra como linha de base.”
- Motivo: Travessão introduzindo a consequência → dois-pontos; consistente com a mensagem-irmã em config.ts:383, que já usa dois-pontos.

**211. `src/relato/validation.ts`** — validation.ts — MENSAGENS.dataPosterior (aviso quando a data é posterior ao ciclo)
- Antes: “Isso é de depois do período deste ciclo — guardamos para o próximo relatório, e não entra na contagem deste.”
- Depois: “Isso é de depois do período deste ciclo: guardamos para o próximo relatório, e não entra na contagem deste.”
- Motivo: Travessão introduzindo o que o sistema faz → dois-pontos; mesmo padrão da mensagem-irmã (dataLinhaDeBase). A vírgula interna antes de "e não entra" foi preservada.

**212. `src/relato/validation.ts`** — validation.ts — MENSAGENS.titulo (erro do campo título de fato)
- Antes: “O título tem de 3 a 140 caracteres — uma linha dizendo o quê.”
- Depois: “O título tem de 3 a 140 caracteres: uma linha dizendo o quê.”
- Motivo: Travessão introduzindo o esclarecimento do que escrever → dois-pontos. O intervalo "de 3 a 140" já usa "a" (sem meia-risca); nada a converter ali.

**213. `src/relato/validation.ts`** — validation.ts — MENSAGENS.jcr (erro do campo fator de impacto)
- Antes: “O fator de impacto é um número, como 3,2 — vírgula ou ponto no decimal.”
- Depois: “O fator de impacto é um número, como 3,2 (vírgula ou ponto no decimal).”
- Motivo: Informação lateral sobre o formato aceito → parênteses (evita segundo dois-pontos, já que a frase antes traz "como 3,2"). Ponto final mantido após o parêntese.

**214. `src/relato/indicadores.ts`** — indicadores.ts — fraseDeProcedencia (caso openalex/incerto): frase ao lado do índice H e das citações (Tela 1)
- Antes: “segundo o OpenAlex, por semelhança de nome — confira se é você”
- Depois: “segundo o OpenAlex, por semelhança de nome: confira se é você”
- Motivo: Travessão introduzindo a instrução/alerta → dois-pontos (fragmento inline, sem quebra em nova frase).

**215. `src/relato/indicadores.ts`** — indicadores.ts — fraseDeProcedencia (default/sem fonte): frase quando não foi possível buscar os indicadores
- Antes: “não conseguimos buscar agora — preencha a partir do seu perfil”
- Depois: “não conseguimos buscar agora: preencha a partir do seu perfil”
- Motivo: Travessão introduzindo a alternativa/instrução → dois-pontos.

**216. `src/relato/metadados.ts`** — metadados.ts — MSG_DEGRADA_MANUAL (falha na busca de metadados por DOI/ISBN)
- Antes: “Não conseguimos buscar os dados agora — o que você digitou foi guardado. Preencha o título e seguimos.”
- Depois: “Não conseguimos buscar os dados agora. O que você digitou foi guardado. Preencha o título e seguimos.”
- Motivo: Travessão entre duas orações independentes → ponto final e maiúscula.

**217. `src/relato/narrativa.ts`** — narrativa.ts — MOTIVO_TCC (texto 'porQueNao' na linha TCC dos contadores, na Conferência do laboratório)
- Antes: “O fato de formação não tem o nível “graduação (TCC)” — informe o número à mão e avise a coordenação se ele importar.”
- Depois: “O fato de formação não tem o nível “graduação (TCC)”: informe o número à mão e avise a coordenação se ele importar.”
- Motivo: Travessão introduzindo a instrução decorrente da limitação → dois-pontos; aspas curvas “ ” preservadas.

**218. `src/relato/api.ts`** — api.ts — erroDeRelato (RLS/42501): acesso negado exibido ao pesquisador
- Antes: “Se acha que é engano, fale com a coordenação — ninguém perde o que já escreveu.”
- Depois: “Se acha que é engano, fale com a coordenação. Ninguém perde o que já escreveu.”
- Motivo: Travessão entre duas orações independentes → ponto final e maiúscula.

**219. `src/relato/api.ts`** — api.ts — erroDeRelato (constraint relatos_resultado): validação do resultado principal
- Antes: “...sobre seu resultado mais importante — ou marque “não tive produção nem atividade para relatar”.”
- Depois: “...sobre seu resultado mais importante, ou marque “não tive produção nem atividade para relatar”.”
- Motivo: Travessão antes de alternativa ("ou marque…") → vírgula. Aspas curvas preservadas.

**220. `src/relato/api.ts`** — api.ts — erroDeRelato (constraint relato_arquivos_dono): anexo pertence a relato ou a fato
- Antes: “O anexo precisa pertencer a um relato ou a um fato — não aos dois.”
- Depois: “O anexo precisa pertencer a um relato ou a um fato, não aos dois.”
- Motivo: Travessão de contraste enfático → vírgula.

**221. `src/relato/api.ts`** — api.ts — erroDeRelato (sessão/JWT): sessão expirada
- Antes: “Sua sessão expirou. Peça um novo link de entrada — nada do que você escreveu se perde.”
- Depois: “Sua sessão expirou. Peça um novo link de entrada. Nada do que você escreveu se perde.”
- Motivo: Travessão entre duas orações independentes → ponto final e maiúscula.

**222. `src/relato/agregacao.ts`** — agregacao.ts — Recorte.frase (rótulo de parcialidade exibido em toda tela do painel da coordenação)
- Antes: “Números parciais — a coleta segue aberta.”
- Depois: “Números parciais: a coleta segue aberta.”
- Motivo: Travessão introduzindo o esclarecimento após o rótulo → dois-pontos.

**223. `src/relato/agregacao.ts`** — agregacao.ts — coberturaPorLaboratorio: célula 'sigla' da linha 'Sem laboratório atribuído' na tabela de cobertura
- Antes: “sigla: "—",”
- Depois: “sigla: "",”
- Motivo: DESTAQUE / CASO ESPECIAL: o travessão era placeholder de 'sem valor' na coluna sigla, não pontuação de prosa. Apliquei string vazia (proposta primária do revisor), já que a coluna irmã 'nome' já diz 'Sem laboratório atribuído'. Se a coordenação preferir um marcador visível na célula, a alternativa permitida é hífen comum "-" (U+002D). Registro para decisão da coordenação.

**224. `src/relato/agregacao.ts`** — agregacao.ts — SatisfacaoDaRede.rotulo (rótulo de satisfação exibido no painel)
- Antes:
  ```
  Média de ${notas.length} resposta${notas.length === 1 ? "" : "s"} — ` + `${...} de ${...} membros ainda não responderam.
  ```
- Depois:
  ```
  Média de ${notas.length} resposta${notas.length === 1 ? "" : "s"}, ` + `${...} de ${...} membros ainda não responderam.
  ```
- Motivo: Travessão emendando o detalhamento ao total → vírgula. Renderiza: 'Média de N respostas, X de Y membros ainda não responderam.' Template literal e interpolações preservados.

**225. `src/relato/agregacao.ts`** — agregacao.ts — medir('M23.1') comoFoiMedido (texto 'como foi medido' exibido ao lado do pactuado no painel)
- Antes: “Formações concluídas no período nos níveis ICJ e IC — somados, como a própria meta pactua — com os ajustes declarados pelos líderes aplicados.”
- Depois: “Formações concluídas no período nos níveis ICJ e IC (somados, como a própria meta pactua) com os ajustes declarados pelos líderes aplicados.”
- Motivo: Par de travessões isolando um inciso → parênteses (informação lateral). Parênteses evitam pilha de vírgulas, pois o inciso interno já tem vírgula. Duas ocorrências nesta linha resolvidas juntas.

**226. `src/relato/agregacao.ts`** — agregacao.ts — medir('M24.6') comoFoiMedido (texto 'como foi medido' de países, exibido no painel)
- Antes: “...e nas parcerias confirmadas — contados, nunca digitados. Tende a vir MENOR...”
- Depois: “...e nas parcerias confirmadas, contados, nunca digitados. Tende a vir MENOR...”
- Motivo: Travessão introduzindo qualificação apositiva ('contados, nunca digitados') → vírgula. Restante da frase (após o ponto) intacto.

**227. `src/relato/exportar.ts`** — exportar.ts — comentariosDoRecorte (1ª linha de cabeçalho '#' de TODO CSV do painel: título do CSV + título do ciclo, lida pela coordenação no Excel)
- Antes:
  ```
  `${titulo} — ${r.cicloTitulo}`
  ```
- Depois:
  ```
  `${titulo}: ${r.cicloTitulo}`
  ```
- Motivo: Travessão entre título do CSV e subtítulo (o ciclo) → dois-pontos. DESTAQUE: aparece em linha '#' de CSV GERADO (conteúdo que a coordenação lê no Excel), não em arquivo .csv do repositório — por isso conta como texto visível e foi incluído. Interpolações preservadas.

**228. `src/relato/exportar.ts`** — exportar.ts — csvFomento (linha de cabeçalho '#' do CSV de fomento, lida no Excel)
- Antes: “Itens sem valor declarado: ${f.itensSemValor} — fora das somas. Os valores são estimativas...”
- Depois: “Itens sem valor declarado: ${f.itensSemValor}, fora das somas. Os valores são estimativas...”
- Motivo: Travessão introduzindo qualificação ('fora das somas') → vírgula (já há dois-pontos antes na frase). DESTAQUE: linha '#' de CSV gerado, mesmo critério do item anterior.

**229. `src/relato/exportar.ts`** — exportar.ts — minutaDoRelatorio (seção 'produção'): texto factual para colar no relatório do CNPq, exibido no painel
- Antes: “...contadas pela âncora única — cada trabalho conta uma vez, mesmo com coautores em laboratórios diferentes.”
- Depois: “...contadas pela âncora única: cada trabalho conta uma vez, mesmo com coautores em laboratórios diferentes.”
- Motivo: Travessão introduzindo a explicação da regra de contagem → dois-pontos.

**230. `src/relato/exportar.ts`** — exportar.ts — minutaDoRelatorio (seção 'produção'): nota de itens fora do período
- Antes: “Itens com data fora do período: ${numeroBr(d.foraDoPeriodo.length)} — listados à parte, fora destas contagens.”
- Depois: “Itens com data fora do período: ${numeroBr(d.foraDoPeriodo.length)} (listados à parte, fora destas contagens).”
- Motivo: Informação lateral após dois-pontos já existente na frase → parênteses (evita segundo dois-pontos e pilha de vírgulas); ponto final reposicionado após o parêntese.

**231. `src/relato/exportar.ts`** — exportar.ts — minutaDoRelatorio (seção 'formação de RH'): texto factual
- Antes: “estudantes ativos — ${est}. Pessoas formadas no período — ${form}.”
- Depois: “estudantes ativos: ${est}. Pessoas formadas no período: ${form}.”
- Motivo: Travessão introduzindo o valor de cada rótulo ('estudantes ativos', 'pessoas formadas') → dois-pontos. Duas ocorrências rótulo→valor na linha, ambas convertidas.

**232. `src/relato/exportar.ts`** — exportar.ts — minutaDoRelatorio (seção 'dificuldades'): item de lista 'rótulo — N relatos'
- Antes:
  ```
  `${o.rotulo} — ${contar(o.relatos, "relato", "relatos")}`
  ```
- Depois:
  ```
  `${o.rotulo}: ${contar(o.relatos, "relato", "relatos")}`
  ```
- Motivo: Travessão entre o rótulo da dificuldade e a contagem → dois-pontos. Renderiza, p.ex., 'Atraso na liberação de recursos ou de bolsas: 5 relatos'.

**233. `src/relato/exportar.ts`** — exportar.ts — minutaDoRelatorio (seção 'extensão'): campo 'fonte' exibido no painel
- Antes: “Respostas de extensão dos relatos (Q28–Q30 do formulário); ${fonteBase}.”
- Depois: “Respostas de extensão dos relatos (Q28 a Q30 do formulário); ${fonteBase}.”
- Motivo: Meia-risca de intervalo (Q28–Q30) → 'a'. Preserva a referência às perguntas do formulário.

### Fitofármacos — formulário e painel (53)

**234. `src/fitofarmas/escore.ts`** — ROTULO_FAIXA · rótulo da faixa 'prioritário' (filtro, tooltip e coluna Faixa do CSV)
- Antes: “prioritario: "Prioritário — procurar antes do evento",”
- Depois: “prioritario: "Prioritário: procurar antes do evento",”
- Motivo: Rótulo seguido de instrução; dois-pontos preserva a hierarquia. Dependência de código tratada: os .split(" — ") do painel viraram .split(": ").

**235. `src/fitofarmas/escore.ts`** — ROTULO_FAIXA · rótulo da faixa 'promissor'
- Antes: “promissor: "Promissor — convidar para o GT",”
- Depois: “promissor: "Promissor: convidar para o GT",”
- Motivo: Rótulo seguido de instrução; dois-pontos.

**236. `src/fitofarmas/escore.ts`** — ROTULO_FAIXA · rótulo da faixa 'acompanhar'
- Antes: “acompanhar: "Acompanhar — manter na lista de contatos",”
- Depois: “acompanhar: "Acompanhar: manter na lista de contatos",”
- Motivo: Rótulo seguido de instrução; dois-pontos.

**237. `src/fitofarmas/escore.ts`** — ROTULO_FAIXA · rótulo da faixa 'informativo'
- Antes: “informativo: "Informativo — só quer receber notícias",”
- Depois: “informativo: "Informativo: só quer receber notícias",”
- Motivo: Rótulo seguido de instrução; dois-pontos.

**238. `src/fitofarmas/PainelFitofarmas.tsx`** — ChipFaixa · dependência de código do delimitador de ROTULO_FAIXA (linha 86)
- Antes: “  const curto = (ROTULO_FAIXA[faixa] ?? faixa).split(" — ")[0];”
- Depois: “  const curto = (ROTULO_FAIXA[faixa] ?? faixa).split(": ")[0];”
- Motivo: Não é texto visível, mas é obrigatório: com o rótulo agora usando ': ', o split precisava passar de ' — ' para ': ' para o chip continuar mostrando só a primeira palavra ('Prioritário'). Sem isto o chip exibiria o rótulo inteiro.

**239. `src/fitofarmas/PainelFitofarmas.tsx`** — Métrica por faixa · dependência de código do mesmo delimitador (linha 219)
- Antes:
  ```
                    <span>{f.rotulo.split(" — ")[0].toLowerCase()}</span>
  ```
- Depois:
  ```
                    <span>{f.rotulo.split(": ")[0].toLowerCase()}</span>
  ```
- Motivo: Mesma dependência: o rótulo curto exibido na legenda da métrica vem de split(); trocado para ': ' para preservar a saída visível ('prioritário').

**240. `src/fitofarmas/validation.ts`** — MENSAGENS.nomeCurto · validação do nome
- Antes: “nomeCurto: "Escreva seu nome completo — é por ele que a coordenação vai te procurar.",”
- Depois: “nomeCurto: "Escreva seu nome completo: é por ele que a coordenação vai te procurar.",”
- Motivo: O travessão introduz a justificativa; dois-pontos mantém a relação de explicação.

**241. `src/fitofarmas/validation.ts`** — MENSAGENS.telefoneCurto · validação do telefone
- Antes: “telefoneCurto: "O número ficou curto. Inclua o DDD — ou deixe em branco.",”
- Depois: “telefoneCurto: "O número ficou curto. Inclua o DDD, ou deixe em branco.",”
- Motivo: Alternativa acrescentada; vírgula antes de 'ou' dá a mesma pausa.

**242. `src/fitofarmas/validation.ts`** — MENSAGENS.semInteresse · validação do interesse
- Antes: “semInteresse: "Escolha uma das quatro opções — é ela que define o resto do formulário.",”
- Depois: “semInteresse: "Escolha uma das quatro opções: é ela que define o resto do formulário.",”
- Motivo: O travessão introduz a explicação; dois-pontos.

**243. `src/fitofarmas/validation.ts`** — MENSAGENS.semAporte · validação dos aportes
- Antes: “semAporte: "Marque o que você poderia agregar — ou “Nada disso por enquanto”, que é resposta válida.",”
- Depois: “semAporte: "Marque o que você poderia agregar, ou “Nada disso por enquanto”, que é resposta válida.",”
- Motivo: Alternativa; vírgula antes de 'ou'. Aspas curvas preservadas.

**244. `src/fitofarmas/validation.ts`** — MENSAGENS.semIniciativa · validação das iniciativas
- Antes: “"Marque o que você gostaria de construir — ou “Nenhuma por enquanto”, que é resposta válida.",”
- Depois: “"Marque o que você gostaria de construir, ou “Nenhuma por enquanto”, que é resposta válida.",”
- Motivo: Alternativa; vírgula antes de 'ou'. Aspas curvas preservadas.

**245. `src/fitofarmas/validation.ts`** — MENSAGENS.semDecisao · validação da decisão
- Antes: “semDecisao: "Diga se você decide ou precisa de aval — é o que define a quem escrevemos.",”
- Depois: “semDecisao: "Diga se você decide ou precisa de aval: é o que define a quem escrevemos.",”
- Motivo: O travessão introduz a explicação; dois-pontos.

**246. `src/fitofarmas/validation.ts`** — MENSAGENS.semCompromisso · validação dos compromissos
- Antes: “semCompromisso: "Marque ao menos um passo — “Prefiro definir depois do workshop” também é um.",”
- Depois: “semCompromisso: "Marque ao menos um passo: “Prefiro definir depois do workshop” também é um.",”
- Motivo: O travessão introduz o esclarecimento/exemplo; dois-pontos. Aspas curvas preservadas.

**247. `src/fitofarmas/metricas.ts`** — rotuloDe · placeholder de valor ausente (lista, ficha e CSV)
- Antes: “  if (!id) return "—";”
- Depois: “  if (!id) return "não informado";”
- Motivo: Placeholder de campo sem valor; 'não informado' remove o travessão e mantém o sentido.

**248. `src/fitofarmas/metricas.ts`** — linhasParaCsv · cabeçalho de coluna do CSV exportado
- Antes: “    "Chance (1–5)": l.chance_1a5 ?? "",”
- Depois: “    "Chance (1 a 5)": l.chance_1a5 ?? "",”
- Motivo: Intervalo numérico; 'a' no lugar da meia-risca. Cabeçalho lido no Excel.

**249. `src/fitofarmas/api.ts`** — falhaDeRede · mensagem de envio indisponível (função ausente no schema)
- Antes: “"O envio ainda não está no ar do nosso lado — não é nada que você fez. Suas respostas " +”
- Depois: “"O envio ainda não está no ar do nosso lado. Não é nada que você fez. Suas respostas " +”
- Motivo: Duas orações independentes; ponto final e maiúscula, tudo na mesma linha.

**250. `src/fitofarmas/api.ts`** — falhaDeRede · mensagem de falha de rede
- Antes: “"Não conseguimos falar com o servidor. Confira a conexão e toque em enviar de novo — " +”
- Depois: “"Não conseguimos falar com o servidor. Confira a conexão e toque em enviar de novo: " +”
- Motivo: O travessão introduz a garantia final; dois-pontos, sem capitalizar a linha 226 concatenada ('nada do que você escreveu foi perdido.').

**251. `src/fitofarmas/api.ts`** — enviarRespostas · mensagem de plataforma não configurada
- Antes: “"O envio on-line ainda não está no ar. Suas respostas continuam salvas neste navegador — " +”
- Depois: “"O envio on-line ainda não está no ar. Suas respostas continuam salvas neste navegador: " +”
- Motivo: Dois-pontos introduz a instrução; evita capitalizar a linha 264 concatenada ('volte a esta página mais tarde…').

**252. `src/fitofarmas/PainelFitofarmas.tsx`** — Aviso 'Área restrita a administradores'
- Antes: “enxerga — a regra é do banco (migração 008), não desta tela. Peça a um administrador para”
- Depois: “enxerga. A regra é do banco (migração 008), não desta tela. Peça a um administrador para”
- Motivo: Duas orações independentes; ponto final e maiúscula.

**253. `src/fitofarmas/PainelFitofarmas.tsx`** — Título do painel (h2)
- Antes:
  ```
  <Leaf size={18} aria-hidden="true" /> {TEXTO.titulo} — respostas pré-evento
  ```
- Depois:
  ```
  <Leaf size={18} aria-hidden="true" /> {TEXTO.titulo}: respostas pré-evento
  ```
- Motivo: Título seguido de qualificador; dois-pontos.

**254. `src/fitofarmas/PainelFitofarmas.tsx`** — Parágrafo introdutório (plat-muted)
- Antes: “. O escore e a faixa são calculados pelo servidor a partir do que custa mais responder —”
- Depois: “. O escore e a faixa são calculados pelo servidor a partir do que custa mais responder:”
- Motivo: O travessão introduz a explicação da linha seguinte; dois-pontos, sem capitalizar 'compromissos assumidos…'.

**255. `src/fitofarmas/PainelFitofarmas.tsx`** — Estado vazio ('Nenhuma resposta ainda')
- Antes: “formulário — confira se a divulgação já saiu e se a edição está aberta no banco.”
- Depois: “formulário. Confira se a divulgação já saiu e se a edição está aberta no banco.”
- Motivo: Duas orações independentes; ponto final e maiúscula.

**256. `src/fitofarmas/PainelFitofarmas.tsx`** — Métrica 'escore médio'
- Antes:
  ```
  <span>escore médio (0–100)</span>
  ```
- Depois:
  ```
  <span>escore médio (0 a 100)</span>
  ```
- Motivo: Intervalo numérico; 'a' no lugar da meia-risca.

**257. `src/fitofarmas/PainelFitofarmas.tsx`** — Lista de respostas · tooltip do escore (atributo title, linha 302)
- Antes:
  ```
  <span className="plat-protocolo" title="Escore de intenção (0–100)">
  ```
- Depois:
  ```
  <span className="plat-protocolo" title="Escore de intenção (0 a 100)">
  ```
- Motivo: Intervalo numérico em tooltip; 'a' no lugar da meia-risca.

**258. `src/fitofarmas/PainelFitofarmas.tsx`** — Ficha individual · tooltip do escore (atributo title, linha 367)
- Antes:
  ```
  <span className="plat-protocolo" title="Escore de intenção (0–100)">
  ```
- Depois:
  ```
  <span className="plat-protocolo" title="Escore de intenção (0 a 100)">
  ```
- Motivo: Intervalo numérico em tooltip; 'a' no lugar da meia-risca.

**259. `src/fitofarmas/FormularioPreEvento.tsx`** — document.title via useWebinarHead
- Antes:
  ```
  title: `${TEXTO.titulo} — antes do encontro | INCT-CONEXAO`,
  ```
- Depois:
  ```
  title: `${TEXTO.titulo}: antes do encontro | INCT-CONEXAO`,
  ```
- Motivo: Título seguido de subtítulo; dois-pontos. Template literal e interpolação preservados.

**260. `src/fitofarmas/FormularioPreEvento.tsx`** — DICA_DO_PASSO[2] · dica do passo 2
- Antes: “2: "A primeira pergunta define o resto do formulário — responda com sinceridade, não com gentileza.",”
- Depois: “2: "A primeira pergunta define o resto do formulário: responda com sinceridade, não com gentileza.",”
- Motivo: O travessão introduz a instrução decorrente; dois-pontos.

**261. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 2 · dica da pergunta de interesse
- Antes: “dica="Não há resposta melhor que outra. A primeira opção encurta o formulário — e é uma escolha legítima."”
- Depois: “dica="Não há resposta melhor que outra. A primeira opção encurta o formulário, e é uma escolha legítima."”
- Motivo: Acréscimo enfático com 'e'; vírgula.

**262. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 3 · texto de ajuda dos aportes (small)
- Antes: “Toque no que existe de fato. Ao marcar, aparece um campo para nomear — e é o nome que faz a”
- Depois: “Toque no que existe de fato. Ao marcar, aparece um campo para nomear, e é o nome que faz a”
- Motivo: Acréscimo com 'e'; vírgula.

**263. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 3 · dica do campo 'qual?' do aporte
- Antes: “dica="Uma linha basta — o nome e um número, se houver."”
- Depois: “dica="Uma linha basta: o nome e um número, se houver."”
- Motivo: O travessão introduz o que a linha deve conter; dois-pontos.

**264. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · rótulo não encontrado (função rotulo)
- Antes:
  ```
  lista.find(([v]) => v === id)?.[1] ?? "—";
  ```
- Depois:
  ```
  lista.find(([v]) => v === id)?.[1] ?? "não informado";
  ```
- Motivo: Placeholder de valor vazio na tela de revisão.

**265. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · valor do Nome
- Antes:
  ```
  <dd>{f.nome || "—"}</dd>
  ```
- Depois:
  ```
  <dd>{f.nome || "não informado"}</dd>
  ```
- Motivo: Placeholder de valor vazio.

**266. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · valor do E-mail
- Antes:
  ```
  <dd>{f.email || "—"}</dd>
  ```
- Depois:
  ```
  <dd>{f.email || "não informado"}</dd>
  ```
- Motivo: Placeholder de valor vazio.

**267. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · valor da Instituição
- Antes:
  ```
  {f.instituicao || "—"}
  ```
- Depois:
  ```
  {f.instituicao || "não informado"}
  ```
- Motivo: Placeholder de valor vazio.

**268. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · lista de Eixos
- Antes:
  ```
  <dd>{f.eets.map((e) => rotulo(EETS, e)).join(" · ") || "—"}</dd>
  ```
- Depois:
  ```
  <dd>{f.eets.map((e) => rotulo(EETS, e)).join(" · ") || "nenhum"}</dd>
  ```
- Motivo: Placeholder de lista vazia; 'nenhum'. Ponto médio ' · ' preservado.

**269. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · lista de Formas
- Antes:
  ```
  <dd>{f.formas.map((x) => rotulo(FORMAS, x)).join(" · ") || "—"}</dd>
  ```
- Depois:
  ```
  <dd>{f.formas.map((x) => rotulo(FORMAS, x)).join(" · ") || "nenhum"}</dd>
  ```
- Motivo: Placeholder de lista vazia; 'nenhum'.

**270. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · lista de Aportes (fim do .map)
- Antes:
  ```
  .join(" · ") || "—"}
  ```
- Depois:
  ```
  .join(" · ") || "nenhum"}
  ```
- Motivo: Placeholder de lista vazia; 'nenhum'. Única linha que termina só com .join(" · ") || "—".

**271. `src/fitofarmas/FormularioPreEvento.tsx`** — Passo 5 (revisão) · lista de Compromissos
- Antes:
  ```
  <dd>{f.compromissos.map((c) => rotulo(COMPROMISSOS, c)).join(" · ") || "—"}</dd>
  ```
- Depois:
  ```
  <dd>{f.compromissos.map((c) => rotulo(COMPROMISSOS, c)).join(" · ") || "nenhum"}</dd>
  ```
- Motivo: Placeholder de lista vazia; 'nenhum'.

**272. `src/fitofarmas/perguntas.ts`** — TEXTO.onde · local do evento (cabeçalho do formulário)
- Antes: “onde: "IESPRO/SESAU — Porto Velho/RO · 08h00 às 17h30",”
- Depois: “onde: "IESPRO/SESAU, Porto Velho/RO · 08h00 às 17h30",”
- Motivo: Local seguido da cidade (aposto); vírgula. O ' · ' seguinte é ponto médio e permanece.

**273. `src/fitofarmas/perguntas.ts`** — TEXTO.atalhoAcompanhar · aviso do atalho 'só acompanhar'
- Antes: “"Perfeito. Como você marcou que quer acompanhar as ações, pulamos as perguntas de colaboração — " +”
- Depois: “"Perfeito. Como você marcou que quer acompanhar as ações, pulamos as perguntas de colaboração: " +”
- Motivo: Dois-pontos introduz o motivo da linha 114 ('elas não fariam sentido agora'); evita capitalizar a continuação concatenada.

**274. `src/fitofarmas/perguntas.ts`** — INSTITUICOES_SUGERIDAS · sugestão UNIR (datalist; vira valor do campo se selecionada)
- Antes: “"UNIR — Universidade Federal de Rondônia",”
- Depois: “"UNIR (Universidade Federal de Rondônia)",”
- Motivo: Sigla seguida do nome por extenso; parênteses, no mesmo padrão de 'Instituto Aggeu Magalhães (IAM/Fiocruz)' já usado na lista. Todas as palavras preservadas.

**275. `src/fitofarmas/perguntas.ts`** — INSTITUICOES_SUGERIDAS · sugestão IFRO Campus Cacoal (datalist)
- Antes: “"IFRO — Campus Cacoal",”
- Depois: “"IFRO, Campus Cacoal",”
- Motivo: Especificação do campus; vírgula.

**276. `src/fitofarmas/perguntas.ts`** — SEDES · rótulo do dia 'porto_velho' (passo 2, filtro por dia, CSV)
- Antes: “["porto_velho", "Só 25/08 — Porto Velho"],”
- Depois: “["porto_velho", "Só 25/08 (Porto Velho)"],”
- Motivo: Cidade como informação lateral; parênteses, coerente com TEXTO.quando ('25 de agosto (Porto Velho)'). O id 'porto_velho' não muda.

**277. `src/fitofarmas/perguntas.ts`** — SEDES · rótulo do dia 'cacoal'
- Antes: “["cacoal", "Só 27/08 — Cacoal"],”
- Depois: “["cacoal", "Só 27/08 (Cacoal)"],”
- Motivo: Cidade como informação lateral; parênteses, coerente com TEXTO.quando. O id 'cacoal' não muda.

**278. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-3 (checkbox do passo 3, tabela, ficha e CSV)
- Antes: “["eet3", "EET-3 — Biodiversidade e bioprospecção (plantas medicinais, toxinas)"],”
- Depois: “["eet3", "EET-3: Biodiversidade e bioprospecção (plantas medicinais, toxinas)"],”
- Motivo: Código do eixo seguido do título; dois-pontos. O hífen de 'EET-3' (U+002D) permanece; parênteses do título intactos.

**279. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-4
- Antes: “["eet4", "EET-4 — Bioeconomia e arranjos ecoprodutivos locais (AEPLs)"],”
- Depois: “["eet4", "EET-4: Bioeconomia e arranjos ecoprodutivos locais (AEPLs)"],”
- Motivo: Código seguido do título; dois-pontos. Hífen de 'EET-4' preservado.

**280. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-6
- Antes: “["eet6", "EET-6 — Biologia estrutural e química medicinal"],”
- Depois: “["eet6", "EET-6: Biologia estrutural e química medicinal"],”
- Motivo: Código seguido do título; dois-pontos. Hífen de 'EET-6' preservado.

**281. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-8
- Antes: “["eet8", "EET-8 — Políticas públicas e educação em saúde"],”
- Depois: “["eet8", "EET-8: Políticas públicas e educação em saúde"],”
- Motivo: Código seguido do título; dois-pontos. Hífen de 'EET-8' preservado.

**282. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-7
- Antes: “["eet7", "EET-7 — Formação e redes de pesquisa"],”
- Depois: “["eet7", "EET-7: Formação e redes de pesquisa"],”
- Motivo: Código seguido do título; dois-pontos. Hífen de 'EET-7' preservado.

**283. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-2
- Antes: “["eet2", "EET-2 — Diagnóstico territorial da Amazônia"],”
- Depois: “["eet2", "EET-2: Diagnóstico territorial da Amazônia"],”
- Motivo: Código seguido do título; dois-pontos. Hífen de 'EET-2' preservado.

**284. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-1
- Antes: “["eet1", "EET-1 — Clima, ambiente e Saúde Única"],”
- Depois: “["eet1", "EET-1: Clima, ambiente e Saúde Única"],”
- Motivo: Código seguido do título; dois-pontos. Hífen de 'EET-1' preservado; 'Saúde Única' intacto.

**285. `src/fitofarmas/perguntas.ts`** — EETS · rótulo do eixo EET-5
- Antes: “["eet5", "EET-5 — Bioinformática e Saúde Pública de Precisão"],”
- Depois: “["eet5", "EET-5: Bioinformática e Saúde Pública de Precisão"],”
- Motivo: Código seguido do título; dois-pontos. Hífen de 'EET-5' preservado.

**286. `src/fitofarmas/perguntas.ts`** — DISPONIBILIDADES · rótulo 'so_acompanhar' (passo 4, ficha e CSV)
- Antes: “["so_acompanhar", "Sem tempo dedicado — só acompanhar"],”
- Depois: “["so_acompanhar", "Sem tempo dedicado, só acompanhar"],”
- Motivo: Esclarecimento da opção; vírgula. O id 'so_acompanhar' não muda.

### CMS administrativo (6)

**287. `public/admin/config.yml`** — CMS · coleção "Webinars / Transmissões" · campo "Início (horário de RONDÔNIA)" (startsAt) · hint (linha 347)
- Antes: “hint: "Formato exato: 2026-08-27T16:00:00-04:00 — sempre o horário de Rondônia, com -04:00 no fim. O site converte para Brasília e para o fuso do visitante sozinho."”
- Depois: “hint: "Formato exato: 2026-08-27T16:00:00-04:00, sempre o horário de Rondônia, com -04:00 no fim. O site converte para Brasília e para o fuso do visitante sozinho."”
- Motivo: Texto visível: hint do campo no painel. Travessão de pausa enfática ("sempre o horário de Rondônia") trocado por vírgula, integrando-se às vírgulas já existentes na sequência. Os hífens de 2026-08-27, 16:00:00-04:00 e -04:00 são hífen comum (U+002D) e permaneceram intactos.

**288. `public/admin/config.yml`** — CMS · coleção "Webinars / Transmissões" · campo "Programação" (agenda) · summary (rótulo de cada item na lista) (linha 439)
- Antes: “summary: "{{fields.time}} — {{fields.title}}"”
- Depois: “summary: "{{fields.time}} · {{fields.title}}"”
- Motivo: Texto visível: summary renderizado como rótulo de cada item da programação no painel (ex.: "16:00 · Abertura"). Travessão separador substituído pelo ponto-médio (·), o mesmo separador já usado nos outros summaries do arquivo (linhas 53 e 688), garantindo consistência. As interpolações {{fields.time}} e {{fields.title}} foram preservadas exatamente.

**289. `public/admin/config.yml`** — CMS · coleção "Webinars / Transmissões" · campo "Programação" (agenda) · subcampo "Responsável" (speaker) · hint — CASO DESTACADO
- Antes: “hint: "Use “—” para debate/intervalo."”
- Depois: “hint: "Use “-” para debate/intervalo."”
- Motivo: DESTAQUE / atenção da coordenação: aqui o travessão não é apenas texto lido, é o próprio VALOR que o hint instrui o editor a digitar no campo "Responsável" quando a linha é debate/intervalo. Removê-lo do hint altera também a convenção do dado inserido no JSON dos webinars. Apliquei a troca mínima que preserva o sentido (marcar ausência de responsável com um traço): substituí o U+2014 pelo hífen comum (-) dentro das aspas curvas “ ”, que foram mantidas. RECOMENDAÇÃO: a coordenação deve confirmar se a convenção do dado GRAVADO passa mesmo a hífen (-) ou a campo vazio, para o site (webinars/router e a página do evento) renderizar a programação de forma coerente com o que o editor digitar.

**290. `public/admin/config.yml`** — CMS · coleção "Mapa · Fichas de estado" (mapa-estados) · campo "Animais peçonhentos" · subcampo imagem · label (linha 583)
- Antes: “label: "Imagem (foto CREDITADA — nunca gerada por IA)"”
- Depois: “label: "Imagem (foto CREDITADA, nunca gerada por IA)"”
- Motivo: Texto visível: rótulo do campo exibido no painel. Dentro do parêntese, o travessão faz inserção enfática reforçando a exigência ("nunca gerada por IA"); a pausa enfática vira vírgula, preservando integralmente a advertência sem abrir um segundo nível de parênteses.

**291. `public/admin/config.yml`** — CMS · coleção "Mapa · Capítulos (modo história)" (mapa-narrativa) · campo "Camada a ativar" (camada) · rótulo da opção de select (linha 709)
- Antes: “label: "Focos de calor (INPE, 2003–2024)", value: focos-calor”
- Depois: “label: "Focos de calor (INPE, 2003 a 2024)", value: focos-calor”
- Motivo: Texto visível: rótulo de opção mostrado no seletor do painel. A meia-risca (U+2013) marca intervalo de anos; convertida para "2003 a 2024", forma natural em pt-BR para faixas numéricas. O value (focos-calor) é identificador de código e não foi tocado.

**292. `public/admin/config.yml`** — CMS · coleção "Mapa · Capítulos (modo história)" (mapa-narrativa) · campo "Enquadramento inicial" (enquadrar) · hint (linha 715)
- Antes: “hint: "Deixe vazio para o Brasil inteiro. Não use junto com 'Estado em foco' — o enquadramento vence."”
- Depois: “hint: "Deixe vazio para o Brasil inteiro. Não use junto com 'Estado em foco': o enquadramento vence."”
- Motivo: Texto visível: hint do campo no painel. O travessão introduz a explicação/consequência do aviso anterior (por que não usar junto com 'Estado em foco'); travessão que introduz explicação vira dois-pontos, que apresenta com naturalidade o motivo ("o enquadramento vence").

### Correções manuais fora dos grupos (3)

**293. `src/content/relato/identificacao.json`** — Frase de agradecimento (pt) — recibo do relato e botão "copiar agradecimento", colada em artigos publicados
- Antes: “Chamada nº 46/2024 — Programa Institutos Nacionais de Ciência e Tecnologia.”
- Depois: “Chamada nº 46/2024, Programa Institutos Nacionais de Ciência e Tecnologia.”
- Motivo: Travessão trocado por vírgula (aposto). Cada palavra e o número do processo 408474/2024-6 preservados. Arquivo não estava em nenhum grupo do fluxo; corrigido à mão por ser texto visível. Se você considerar o travessão parte do título oficial da chamada CNPq, esta é a linha a reverter.

**294. `src/content/relato/identificacao.json`** — Frase de agradecimento (en) — mesma tela, versão em inglês
- Antes: “Call no. 46/2024 — National Institutes of Science and Technology Program.”
- Depois: “Call no. 46/2024, National Institutes of Science and Technology Program.”
- Motivo: Mesma troca por vírgula da versão pt.

**295. `src/mapa/lacunas.ts`** — frasePreenchimento() — sentença de legenda do mapa (helper hoje sem chamador; corrigido por precaução)
- Antes: “Ausência de ficha significa cadastro não feito — não ausência de risco ou de atividade.”
- Depois: “Ausência de ficha significa cadastro não feito, e não ausência de risco ou de atividade.”
- Motivo: Travessão trocado por vírgula + "e"; contraste preservado. Detectado pela varredura automática pós-fluxo.

---

## Expectativas de teste sincronizadas (4)

**`tests/fitofarmas-painel.test.ts`**
- Antes: expect(rotuloDe(VINCULOS, null)).toBe("—")
- Depois: expect(rotuloDe(VINCULOS, null)).toBe("não informado")
- Motivo: rotuloDe passou a devolver "não informado" para valor vazio (o "—" era placeholder visível). Título do teste também sincronizado.

**`tests/relato-exportar.test.ts`**
- Antes: ..."Atraso na liberação de recursos ou de bolsas — 2 relatos" / "... (compra ou importação) — 1 relato"
- Depois: ... com ":" no lugar do "—"
- Motivo: A minuta factual (copiada para o relatório do CNPq) passou a separar rótulo e contagem por dois-pontos.

**`tests/relato.test.ts`**
- Antes: "Esse ORCID não confere — o último dígito não bate..."
- Depois: "Esse ORCID não confere: o último dígito não bate..."
- Motivo: Mensagem de validação do ORCID: travessão → dois-pontos (igual à mensagem irmã do ISBN).

**`tests/relato.test.ts`**
- Antes: "Isso é de antes do INCT começar — entra como linha de base."
- Depois: "Isso é de antes do INCT começar: entra como linha de base."
- Motivo: Mensagem de validação de data: travessão → dois-pontos.

---

## Amostra do que foi ignorado (comentário/código, não é a página)

Para dar visibilidade ao critério, alguns exemplos de ocorrências que **permaneceram** com travessão por não serem texto renderizado:

- `src/App.tsx`: NÃO visível: dentro de comentário de bloco /* ... */ (bloco 'Relatório Anual', linhas 60-64). Comentário de código não vai para a tela.
- `src/App.tsx`: NÃO visível: dentro de comentário de bloco /* ... */ (bloco 'Formulário pré-evento', linhas 67-70).
- `src/App.tsx`: NÃO visível: dentro de comentário de bloco /* ... */ (bloco 'Definir nova senha', linhas 72-76).
- `src/App.tsx`: NÃO visível: dentro de comentário JSDoc /** ... */ do componente HeroVideo (linhas 79-87).
- `src/App.tsx`: NÃO visível: comentário de linha // dentro do useEffect de HeroVideo.
- `src/App.tsx`: NÃO visível: comentário JSDoc /** ... */ anotando o campo focal do type ResearchProgram.
- `src/App.tsx`: NÃO visível: dentro de comentário de bloco /* ... */ ('Decisão do dono', linhas 290-294) dentro de navItems.
- `src/App.tsx`: NÃO visível: dentro de comentário de bloco /* ... */ ('REDE DE SEGURANÇA DO LINK DE REDEFINIÇÃO DE SENHA', linhas 1076-1085).

Além desses, a varredura automática confirmou como não-visíveis: os 24 travessões de `src/relato/indicadores.ts`, os 5 de `src/relato/BuscaPesquisador.tsx` e os 5 de `src/figuras/desenho.ts` (todos JSDoc), o `console.warn` de `src/webinars/data.ts`, os geradores de cabeçalho de CSV em `src/figuras/csv.ts` e `src/mapa/csvCamada.ts`, e os campos `_meta`/`_nota` de `identificacao.json` e `indice-estados.json`.

## Verificação final

- Varredura automática dos 115 arquivos de texto visível: **0** travessões (—) ou meias-riscas (–) em texto renderizado.
- Suíte: **26 arquivos, 730 testes, todos verdes**. `tsc --noEmit` limpo. Build de produção OK. JSON de conteúdo válidos.
- Conciliação: **273 edições reais** dos agentes, **0 fora de escopo** (nada em `tests/`, `docs/`, `scripts/`, `.css`, `.csv`) e **0 edições** cujo alvo não fosse um travessão — nenhum hífen comum foi tocado.
- `inct_deploy/` (259 arquivos, ~85 MB) e `inct-site-2026-08-11.zip` regenerados sem a matéria embargada; `grep "barco-da-ciencia"` no deploy volta vazio.
