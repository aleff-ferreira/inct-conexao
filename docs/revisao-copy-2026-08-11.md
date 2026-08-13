# Revisão de texto — remoção de artefatos de escrita de IA

**Data:** 11 de agosto de 2026

## Escopo e método

Revisão de todo o texto visível ao usuário no site (páginas públicas, plataforma de seleções, relato anual, fitofármacos, mapa interativo, notícias, webinars, editais, figuras citáveis, CMS administrativo e metadados de página), em busca de artefatos típicos de texto gerado por IA: travessões e meias-riscas fora de lugar, ponto e vírgula em texto de interface, dois-pontos em excesso, frases fragmentadas de efeito, padrões retóricos repetitivos, paralelismo forçado, decalques do inglês, capitalização de título e redundâncias.

Cada arquivo foi lido integralmente por um revisor; cada proposta passou por um segundo julgamento independente e cético, que rejeitou o que era gosto pessoal ou pontuação legítima e aplicou apenas o necessário. A instrução central: **não substituir pontuação mecanicamente** — travessão, dois-pontos e ponto e vírgula foram mantidos onde são gramatical e estilisticamente justificados. Nomes próprios, termos científicos, títulos oficiais, links, slugs e valores técnicos não foram tocados. Nenhuma alteração foi feita sem registro: a lista abaixo foi gerada diretamente do log estruturado da revisão, e todas as edições reais foram conferidas contra ele.

## Resumo

- **110 correções aplicadas** em 42 arquivos, mais 1 ajuste de expectativa de teste decorrente delas.
- **3 propostas rejeitadas** na verificação (registradas ao final, com o motivo).
- **3 superfícies extras** localizadas pela varredura de completude foram revisadas e mantidas como estão (ver “Cobertura”).
- Verificação pós-edição: **730/730 testes passando**, `tsc --noEmit` limpo, build de produção OK e todos os JSONs de conteúdo válidos.

Por categoria: outro (34), ponto e vírgula (23), decalque do inglês (14), travessão (13), dois-pontos (11), capitalização (6), redundância (4), retórica (3), fragmentação (2).

---

## Correções aplicadas

### Página inicial e metadados do site

**1. `index.html` — Fallback sem JavaScript (noscript) — mensagem inicial** _(retórica)_

- **Antes:** “Este site precisa de JavaScript para navegar. Os dados, porém, não:”
- **Depois:** “Este site precisa de JavaScript para navegar, mas os dados podem ser acessados sem ele:”
- **Por quê:** Contraste elíptico de efeito ("Os dados, porém, não:") é floreio típico de texto gerado por IA numa mensagem utilitária de fallback. Aceito com ajuste: em vez das duas frases propostas pelo revisor, as orações foram unidas com "mas", que flui com mais naturalidade em pt-BR e mantém o contraste sem o corte de efeito.

**2. `src/App.tsx` — Página inicial — seção Ciência em movimento, cartão "Dados climáticos para decisão pública"** _(decalque do inglês)_

- **Antes:** “Monitoramento ambiental, modelagem preditiva e alertas precoces aproximam ciência de gestão, prevenção e cuidado.”
- **Depois:** “Monitoramento ambiental, modelagem preditiva e alertas precoces aproximam a ciência da gestão, da prevenção e do cuidado.”
- **Por quê:** A omissão dos artigos é decalque do inglês e gera ambiguidade real: "ciência de gestão" lê-se como área do conhecimento (ciência da gestão). Com os artigos, a regência de "aproximar X de Y" fica inequívoca, sem mudança de sentido.

**3. `src/App.tsx` — Página inicial — seção Gestão e governança, rotina de acompanhamento da execução (governanceCadence)** _(outro)_

- **Antes:** “Reuniões remotas tri ou semestrais entre LLAs, CTs e CGES.”
- **Depois:** “Reuniões remotas trimestrais ou semestrais entre LLAs, CTs e CGES.”
- **Por quê:** "tri ou semestrais" é coordenação truncada não padrão em texto publicado (a forma suspensa exigiria hífen e ainda assim é rara em prosa institucional); por extenso, a frase fica correta sem alterar o sentido.

### Editais, figuras citáveis e componentes de UI compartilhados

**4. `src/EditalIC2026.tsx` — Edital IC 2026 — seção Critérios de seleção, destaque "Ação afirmativa Ciência Delas"** _(fragmentação)_

- **Antes:** “Mais meninas e mulheres na ciência.”
- **Depois:** “O objetivo é ampliar a presença de meninas e mulheres na ciência.”
- **Por quê:** Fragmento de efeito sem verbo fechando um parágrafo informativo de edital — slogan típico de texto gerado por IA, destoando do registro institucional do restante do callout; a frase completa mantém a mensagem no mesmo tom do parágrafo.

**5. `src/EditalIC2026.tsx` — Edital IC 2026 — seção "Quem pode se inscrever" (título h2)** _(outro)_

- **Antes:** “Perfil do candidato(a)”
- **Depois:** “Perfil do(a) candidato(a)”
- **Por quê:** Flexão inclusiva incompleta: artigo masculino com desinência dupla. O restante da página usa consistentemente "o(a) candidato(a)", "do(a) próprio(a) bolsista", "O(A) bolsista".

**6. `src/EditalIC2026.tsx` — Edital IC 2026 — seção "Documentos para inscrição", cartão "Carta de intenção"** _(outro)_

- **Antes:** “em PDF, experiência na graduação, habilidades, motivação”
- **Depois:** “em PDF, contendo experiência na graduação, habilidades, motivação”
- **Por quê:** Lacuna sintática: a enumeração do conteúdo da carta era colada às especificações de formato sem verbo de ligação; "contendo" restaura a articulação sem alterar informação.

**7. `src/EditalIC2026.tsx` — Edital IC 2026 — seção "Documentos para inscrição", cartão "Plano de Atividades"** _(outro)_

- **Antes:** “de acordo com a linha de atuação, Objetivo, Justificativa, Metodologia e Cronograma de Execução.”
- **Depois:** “de acordo com a linha de atuação, contendo Objetivo, Justificativa, Metodologia e Cronograma de Execução.”
- **Por quê:** Sem o verbo, "Objetivo, Justificativa..." parecia continuar a locução "de acordo com", invertendo o sentido: são as seções que o plano deve conter. Mantidas as maiúsculas dos nomes de seção do documento oficial.

**8. `src/editais/ResultadoIC2026.tsx` — Resultado IC 2026 — mensagem de busca sem resultados** _(decalque do inglês)_

- **Antes:** “Confira a grafia, ou limpe a busca para ver a lista completa.”
- **Depois:** “Confira a grafia ou limpe a busca para ver a lista completa.”
- **Por quê:** Vírgula antes de "ou" ligando orações de mesmo sujeito é decalque da pontuação inglesa ("check the spelling, or..."); em pt-BR a alternativa vem sem vírgula.

**9. `src/content/rede.ts` — Página da rede — catálogo de instituições, ficha da FIOCRUZ Pantanal** _(capitalização)_

- **Antes:** “integração centro-oeste/Amazônia.”
- **Depois:** “integração Centro-Oeste/Amazônia.”
- **Por quê:** "Centro-Oeste" é nome próprio de região e leva maiúsculas em pt-BR, como nas demais menções a regiões no site ("Nordeste e Centro-Oeste" no próprio edital).

### Plataforma — autenticação, senha e contas

**10. `src/platform/AuthCard.tsx` — Tela de login da plataforma — primeiro acesso da comissão (introdução)** _(ponto e vírgula)_

- **Antes:** “Use o e-mail que a coordenação pré-autorizou; sua conta já nasce com o papel de avaliador(a).”
- **Depois:** “Use o e-mail que a coordenação pré-autorizou. Sua conta já nasce com o papel de avaliador(a).”
- **Por quê:** Ponto e vírgula unindo duas orações independentes em texto curto de interface; o ponto final é o padrão natural em pt-BR e casa com o ritmo das demais frases do parágrafo.

**11. `src/platform/AuthCard.tsx` — Tela de login da plataforma — redefinir senha (comissão, introdução)** _(travessão)_

- **Antes:** “Enviaremos um código numérico — você digita o código na tela seguinte e define a nova senha ali mesmo.”
- **Depois:** “Enviaremos um código numérico. Você digita o código na tela seguinte e define a nova senha ali mesmo.”
- **Por quê:** Travessão emendando duas orações independentes com mudança de sujeito, padrão típico de texto gerado por IA; a segunda oração é uma instrução procedural completa e pede ponto final. A repetição verbatim na variante do candidato reforça o artefato.

**12. `src/platform/AuthCard.tsx` — Tela de login da plataforma — redefinir senha (candidato, introdução)** _(travessão)_

- **Antes:** “Enviaremos um código numérico — você digita o código na tela seguinte e define a nova senha ali mesmo.”
- **Depois:** “Enviaremos um código numérico. Você digita o código na tela seguinte e define a nova senha ali mesmo.”
- **Por quê:** Mesma ocorrência da versão da comissão (aplicada em conjunto): travessão unindo orações independentes onde o ponto é a pontuação natural.

**13. `src/platform/AuthCard.tsx` — Tela de login da plataforma — primeiro acesso do candidato (introdução)** _(outro)_

- **Antes:** “Você poderá voltar e editar seus dados até o fim do prazo, guarde bem a sua senha.”
- **Depois:** “Você poderá voltar e editar seus dados até o fim do prazo. Guarde bem a sua senha.”
- **Por quê:** Comma splice genuíno: vírgula emendando oração declarativa e oração imperativa independentes em prosa de introdução; em texto institucional o ponto final é o correto.

**14. `src/platform/AuthCard.tsx` — Tela de login da plataforma — cartão "Conta criada: confirme seu e-mail"** _(ponto e vírgula)_

- **Antes:** “e clique no link; depois é só entrar com sua senha.”
- **Depois:** “e clique no link. Depois é só entrar com sua senha.”
- **Por quê:** Ponto e vírgula em parágrafo curto e conversacional de interface; o ponto final mantém o tom do cartão e é o padrão em pt-BR.

**15. `src/platform/auth.tsx` — Mensagens de erro de autenticação — link aberto em outro navegador (PKCE)** _(travessão)_

- **Antes:** “(o mesmo aparelho e o mesmo perfil) — ou, mais simples, use o código numérico do mesmo e-mail.”
- **Depois:** “(o mesmo aparelho e o mesmo perfil). Ou, mais simples, use o código numérico do mesmo e-mail.”
- **Por quê:** Travessão logo após fechamento de parênteses acumula três sinais seguidos e trava a leitura; encerrar a frase e abrir a alternativa com "Ou, mais simples," é mais fluido, sem mudar informação nem tom.

**16. `src/platform/NovaSenha.tsx` — Página "Definir nova senha" — aviso de link expirado ou já usado** _(redundância)_

- **Antes:** “O link de redefinição vale por pouco tempo e só pode ser usado uma vez. Também vale saber: alguns servidores de e-mail corporativos abrem os links das mensagens para conferir se são seguros”
- **Depois:** “O link de redefinição vale por pouco tempo e só pode ser usado uma vez. Alguns servidores de e-mail corporativos abrem os links das mensagens para conferir se são seguros”
- **Por quê:** "Também vale saber:" é muleta introdutória da família de "vale destacar que" e ainda repete o verbo de "vale por pouco tempo" da frase anterior; a informação entra direto sem perda de sentido e o parágrafo perde um dois-pontos (há outro logo adiante).

**17. `src/platform/PainelContas.tsx` — Gestão — Administração de contas, pré-autorizar acesso (mensagem de validação)** _(dois-pontos)_

- **Antes:** “Nenhum e-mail válido: confira: ${invalid.join(", ")}”
- **Depois:** “Nenhum e-mail válido. Confira: ${invalid.join(", ")}”
- **Por quê:** Dois dois-pontos na mesma frase curta travam a leitura; o primeiro vira ponto e o segundo, que introduz a lista de e-mails ignorados, permanece. Template literal preservado.

**18. `src/platform/errors.ts` — Formulário de inscrição — mensagem de erro (falha ao gerar protocolo)** _(ponto e vírgula)_

- **Antes:** “Tente enviar novamente em instantes; se persistir, contate a coordenação.”
- **Depois:** “Tente enviar novamente em instantes. Se persistir, contate a coordenação.”
- **Por quê:** Ponto e vírgula em mensagem de erro curta de interface; o ponto final é o padrão natural e segue o estilo de frases curtas das demais mensagens do mesmo arquivo.

### Plataforma — inscrição, minha inscrição e gestão

**19. `src/platform/Inscricao.tsx` — Inscrição — aviso de falha ao carregar a inscrição** _(dois-pontos)_

- **Antes:** “com segurança: não crie uma nova inscrição para evitar duplicidade.”
- **Depois:** “com segurança. Não crie uma nova inscrição, para evitar duplicidade.”
- **Por quê:** São duas instruções independentes (recarregar; não criar nova inscrição), e os dois-pontos as fundiam. A vírgula antes de "para evitar" desfaz a leitura ambígua "não crie uma inscrição [que sirva] para evitar duplicidade".

**20. `src/platform/Inscricao.tsx` — Inscrição — aviso de inscrição recebida com edição encerrada** _(ponto e vírgula)_

- **Antes:** “O período de edição encerrou; acompanhe o resultado pelo cronograma do processo seletivo.”
- **Depois:** “O período de edição encerrou. Acompanhe o resultado pelo cronograma do processo seletivo.”
- **Por quê:** Ponto e vírgula em aviso curto de interface; duas frases simples é como um nativo escreveria.

**21. `src/platform/Inscricao.tsx` — Formulário de inscrição — etapa Documentos (arquivo já enviado)** _(dois-pontos)_

- **Antes:** “: escolha um novo para substituir”
- **Depois:** “· escolha um novo para substituir”
- **Por quê:** Renderizava "ver o arquivo : escolha um novo…" — dois-pontos soltos com espaço antes (tipografia quebrada) e segundos dois-pontos na mesma linha, após "Já enviado:". O "·" é o separador que a própria plataforma já usa (revisão, comprovante).

**22. `src/platform/Inscricao.tsx` — Comprovante de inscrição — rodapé** _(ponto e vírgula)_

- **Antes:** “Ele confirma o recebimento da sua inscrição; não representa aprovação.”
- **Depois:** “Ele confirma o recebimento da sua inscrição, mas não representa aprovação.”
- **Por quê:** O ponto e vírgula escondia a relação adversativa; "mas" faz o contraste do jeito natural, sem mudar o sentido.

**23. `src/platform/Gestao.tsx` — Gestão — aviso de painel restrito (área Contas)** _(decalque do inglês)_

- **Antes:** “Se você precisa de um acesso alterado, fale com a coordenação do projeto.”
- **Depois:** “Se você precisa de alteração de acesso, fale com a coordenação do projeto.”
- **Por quê:** "Precisa de um acesso alterado" decalca "need an access changed"; em pt-BR pede-se "alteração de acesso".

**24. `src/platform/Gestao.tsx` — Gestão — aba Classificação, alerta de avaliações pendentes** _(outro)_

- **Antes:** “todas as avaliações antes de homologar, do contrário, essas inscrições ficariam sem resultado final.”
- **Depois:** “todas as avaliações antes de homologar; do contrário, essas inscrições ficariam sem resultado final.”
- **Por quê:** "Do contrário" inicia oração independente; a vírgula criava emenda de orações. O ponto e vírgula é a pontuação correta aqui.

**25. `src/platform/Gestao.tsx` — Gestão — aba Auditoria, texto introdutório** _(outro)_

- **Antes:** “A integridade é verificada aqui, depois:”
- **Depois:** “A integridade é verificada depois, aqui:”
- **Por quê:** O contraste com a frase anterior é temporal (a avaliação é aberta; a verificação vem depois); a ordem "aqui, depois:" embaralhava a ênfase e travava a leitura antes dos dois-pontos.

**26. `src/platform/Gestao.tsx` — Gestão — aba Auditoria, texto introdutório** _(outro)_

- **Antes:**
  ```
  baixe os dois arquivos e investigue, o <strong>JSON</strong> reúne as métricas, pseudonimizado, em formato
  ```
- **Depois:**
  ```
  baixe os dois arquivos e investigue. O <strong>JSON</strong>, pseudonimizado, reúne as métricas em formato
  ```
- **Por quê:** Vírgula emendando duas orações independentes, e o aposto "pseudonimizado" longe do referente parecia concordância errada com "métricas". O ponto separa as frases e o aposto junto de "JSON" resolve a concordância.

**27. `src/platform/Gestao.tsx` — Gestão — aba Auditoria, aviso LGPD** _(dois-pontos)_

- **Antes:**
  ```
  o <em>CSV interno</em> contém nome, CPF e pareceres: é a ata da comissão,
  ```
- **Depois:**
  ```
  o <em>CSV interno</em> contém nome, CPF e pareceres. É a ata da comissão:
  ```
- **Por quê:** O parágrafo encadeava três frases apoiadas em dois-pontos (padrão típico de texto gerado) e ainda emendava "é a ata da comissão, não compartilhe" por vírgula. Desmembrar a primeira frase quebra a repetição, e os dois-pontos antes do imperativo ("É a ata da comissão: não compartilhe.") são naturais.

**28. `src/platform/Gestao.tsx` — Gestão — aba Auditoria, aviso LGPD** _(outro)_

- **Antes:** “estado + curso + sexo podem reidentificar um candidato, trate como dado pessoal e use só para auditoria.”
- **Depois:** “estado + curso + sexo podem reidentificar um candidato; trate como dado pessoal e use só para auditoria.”
- **Por quê:** Vírgula emendando uma afirmação e uma instrução independentes; o ponto e vírgula marca a fronteira sem esfriar o tom.

**29. `src/platform/audit.ts` — Auditoria — JSON exportado, glossário de métricas (flag_nota_extrema)** _(decalque do inglês)_

- **Antes:** “Todas as notas de critério no máximo ou todas em zero, possível padding para empurrar/afundar.”
- **Depois:** “Todas as notas de critério no máximo ou todas em zero, possível manobra para empurrar/afundar.”
- **Por quê:** "Padding" é anglicismo sem uso corrente em pt-BR nesse sentido; "manobra" comunica a mesma suspeita a qualquer leitor da comissão. Texto visível no JSON que o admin baixa e lê.

**30. `src/platform/audit.ts` — Auditoria — JSON exportado, roteiro de investigação (prompt lido pelo admin)** _(outro)_

- **Antes:**
  ```
  Priorize, nesta ordem: (1) DECISÕES SEM CONTRADITÓRIO (inscrições com decidida_por_avaliador_unico=true, sobretudo perto do corte de vagas; é o risco dominante aqui. (2) CONFLITO DE INTERESSE) flag_coi_orientador=true; veja se a nota do COI está acima da dos demais. (3) OUTLIERS (flag_outlier=true (só existe quando a inscrição teve >=3 avaliações); separe outliers altos (inflam) de baixos (afundam), com peso extra se vier sem parecer (flag_parecer_vazio) ou com nota extrema. (4) LINGUAGEM do parecer) leia o texto e sinalize linguagem depreciativa, preconceituosa ou dupla-medida entre candidatos parecidos. (5) EDIÇÃO TARDIA: editada_apos_outra_submissao=true (mudou a nota depois de ver outra).
  ```
- **Depois:**
  ```
  Priorize, nesta ordem: (1) DECISÕES SEM CONTRADITÓRIO: inscrições com decidida_por_avaliador_unico=true, sobretudo perto do corte de vagas; é o risco dominante aqui. (2) CONFLITO DE INTERESSE: flag_coi_orientador=true; veja se a nota do COI está acima da dos demais. (3) OUTLIERS: flag_outlier=true (só existe quando a inscrição teve >=3 avaliações); separe outliers altos (inflam) de baixos (afundam), com peso extra se vier sem parecer (flag_parecer_vazio) ou com nota extrema. (4) LINGUAGEM DO PARECER: leia o texto e sinalize linguagem depreciativa, preconceituosa ou com dois pesos e duas medidas entre candidatos parecidos. (5) EDIÇÃO TARDIA: editada_apos_outra_submissao=true (mudou a nota depois de ver outra).
  ```
- **Por quê:** Parênteses desbalanceados e trocados: os abertos nos itens 1 e 3 nunca fechavam, e os fechados caíam depois dos títulos dos itens 2 e 4. Padronizado no formato "TÍTULO: descrição" que o item 5 já usava (com LINGUAGEM DO PARECER em caixa alta como os demais títulos). "Dupla-medida" é decalque de "double standard": em pt-BR, "dois pesos e duas medidas". Nomes de flags e conteúdo intactos.

**31. `src/platform/Inscricao.tsx` — Formulário de inscrição — etapa Documentos, erro de PDF acima do limite** _(outro)_

- **Antes:** “O PDF de "..." deve ter no máximo ${docMaxLabel(d.kind)}, comprima o arquivo (ex.: ilovepdf.com/compress_pdf) e tente de novo.”
- **Depois:** “O PDF de "..." deve ter no máximo ${docMaxLabel(d.kind)}; comprima o arquivo (ex.: ilovepdf.com/compress_pdf) e tente de novo.”
- **Por quê:** Achado na verificação: mesma vírgula emendando afirmação e instrução independentes que o revisor corrigiu duas vezes no Gestao.tsx; o ponto e vírgula marca a fronteira entre o diagnóstico e a instrução. URL e interpolações intactas.

### Notícias — módulo e artigos publicados

**32. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json` — Matéria 'Barco da Ciência' — bloco 'Em 30 segundos'** _(travessão)_

- **Antes:** “A parada tinha sido remarcada por causa do nível da água — só saiu quando a navegação permitiu.”
- **Depois:** “A parada tinha sido remarcada por causa do nível da água e só saiu quando a navegação permitiu.”
- **Por quê:** Travessão emendando oração independente num bullet curto, num arquivo com alta densidade desse padrão (linhas 65, 142 e 267); a conjunção 'e' liga as orações com naturalidade e preserva o sentido. Os pares parentéticos legítimos do arquivo foram mantidos.

**33. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json` — Matéria 'Barco da Ciência' — bloco 'Em 30 segundos'** _(ponto e vírgula)_

- **Antes:** “o projeto Sementes Crioulas tratou da guarda de sementes e da agricultura familiar; em 2025, a mesma série já havia levado robótica ao trecho.”
- **Depois:** “o projeto Sementes Crioulas tratou da guarda de sementes e da agricultura familiar. Em 2025, a mesma série já havia levado robótica ao trecho.”
- **Por quê:** Ponto e vírgula unindo dois fatos distintos num cartão de resumo rápido; o quinto bullet da mesma lista já usa duas frases separadas por ponto, então a mudança segue o padrão interno do próprio cartão.

**34. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json` — Matéria 'Barco da Ciência' — corpo, seção 'Um dia inteiro de rio'** _(travessão)_

- **Antes:** “é a diferença entre chegar e não chegar — foi por isso que a data mudou.”
- **Depois:** “é a diferença entre chegar e não chegar. Foi por isso que a data mudou.”
- **Por quê:** Travessão colando oração independente como arremate numa frase já longa (com 'porém' intercalado); o ponto final fecha melhor e mantém o efeito.

**35. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json` — Matéria 'Barco da Ciência' — Perguntas frequentes ('Onde fica Nazaré?')** _(outro)_

- **Antes:** “O acesso ordinário é fluvial.”
- **Depois:** “O acesso habitual é fluvial.”
- **Por quê:** 'Ordinário' no sentido de 'usual' é registro jurídico e, no pt-BR corrente, carrega conotação pejorativa; 'habitual' é o termo natural numa FAQ para público geral, sem mudança de sentido.

**36. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json` — Matéria 'Barco da Ciência' — Perguntas frequentes ('Por que o rio aparece tão baixo nas imagens?')** _(outro)_

- **Antes:** “aparecem praias que o resto do ano fica submerso”
- **Depois:** “aparecem praias que no resto do ano ficam submersas”
- **Por quê:** Erro real de concordância: verbo e adjetivo devem concordar com 'praias' (ficam submersas); 'no resto do ano' torna o adjunto adverbial fluente.

**37. `src/content/noticias/expedicao-barco-da-ciencia-nazare.json` — Matéria 'Barco da Ciência' — SEO (descrição de compartilhamento)** _(travessão)_

- **Antes:** “mais de 300 ações em 16 municípios — numa viagem adiada pela seca, feita num rio no ponto mais baixo do ano.”
- **Depois:** “mais de 300 ações em 16 municípios, numa viagem adiada pela seca, feita num rio no ponto mais baixo do ano.”
- **Por quê:** Travessão fazendo papel de vírgula antes de adjunto explicativo; o campo 'resumo' da mesma matéria trata a mesma informação sem travessão, e a vírgula é a pontuação natural aqui.

### Webinars, transmissões e grupos de conexão

**38. `src/content/groups/conexao-clima-saude-unica.json` — Grupos de conexão — cartão do grupo e cabeçalho da página do grupo (instituição da líder)** _(dois-pontos)_

- **Antes:** “UEMA: Universidade Estadual do Maranhão”
- **Depois:** “UEMA (Universidade Estadual do Maranhão)”
- **Por quê:** Padrão mecânico "SIGLA: nome completo" confirmado no contexto de renderização: o cartão do grupo concatena "Dra. Helena Marques · UEMA: Universidade Estadual do Maranhão", misturando dois separadores na mesma linha. Em pt-BR a expansão de sigla vai entre parênteses. Nomes próprios preservados; só a pontuação mudou e o JSON permanece válido.

**39. `src/content/groups/conexao-bioprospeccao-bioeconomia.json` — Grupos de conexão — cartão do grupo e cabeçalho da página do grupo (instituição do líder)** _(dois-pontos)_

- **Antes:** “IKIAM: Universidad Regional Amazónica”
- **Depois:** “IKIAM (Universidad Regional Amazónica)”
- **Por quê:** Mesmo padrão "SIGLA: nome completo" exibido ao lado do nome do líder no cartão ("Dr. Mateus Vasconcelos · IKIAM: …") e no herói da página do grupo. Expansão entre parênteses é a forma natural; nome da instituição intacto e JSON válido.

**40. `src/webinars/WebinarHub.tsx` — Hub de webinars — seção em destaque (botão do evento agendado)** _(redundância)_

- **Antes:** “Ver detalhes e se preparar”
- **Depois:** “Ver detalhes”
- **Por quê:** Rótulo composto redundante: o título da seção logo acima já diz "Prepare-se para a próxima mesa-redonda", e os cartões de evento do mesmo módulo (EventCard em parts.tsx) usam "Ver detalhes" para eventos futuros. O corte remove o eco do CTA em inglês e uniformiza os botões sem perder informação — o destino do link é a página de detalhes.

### Mapa interativo — interface do módulo

**41. `src/mapa/MapaPage.tsx` — Mapa interativo — título da aba do navegador (estado selecionado)** _(dois-pontos)_

- **Antes:**
  ```
  `${ufSel.nome} · Mapa Interativo (beta): INCT-CONEXAO`
  ```
- **Depois:**
  ```
  `${ufSel.nome} · Mapa interativo (beta) | INCT-CONEXAO`
  ```
- **Por quê:** Dois-pontos de manchete antes da marca destoava do padrão " | INCT-CONEXAO" usado em todos os demais document.title do site (Gestao.tsx, MinhaInscricao.tsx, NovaSenha.tsx, EditalIC2026.tsx, Inscricao.tsx, WebinarEvent.tsx, GroupsHub.tsx); e a caixa alta "Mapa Interativo" contradiz o h1 da própria página ("Mapa interativo da rede") e o assunto do mailto ("Mapa interativo (beta)"). Nenhum teste referencia a string antiga.

**42. `src/mapa/MapaPage.tsx` — Mapa interativo — título da aba do navegador (visão nacional)** _(dois-pontos)_

- **Antes:** “"Mapa Interativo (beta): INCT-CONEXAO"”
- **Depois:** “"Mapa interativo (beta) | INCT-CONEXAO"”
- **Por quê:** Mesmo caso da linha anterior: separador " | " para alinhar com todos os outros títulos de aba do site e caixa de frase ("Mapa interativo") conforme o h1 e o padrão pt-BR.

**43. `src/mapa/StatePanel.tsx` — Ficha do estado — seção Animais peçonhentos, texto de abertura** _(ponto e vírgula)_

- **Antes:**
  ```
  Animais <em>peçonhentos</em> inoculam veneno (picada/ferrão); diferentes de <em>venenosos</em> (tóxicos se ingeridos/tocados).
  ```
- **Depois:**
  ```
  Animais <em>peçonhentos</em> inoculam veneno (picada/ferrão), diferentes dos <em>venenosos</em> (tóxicos se ingeridos/tocados).
  ```
- **Por quê:** O ponto e vírgula emendava a oração a um fragmento sem verbo ("diferentes de venenosos"), leitura telegráfica típica de texto gerado. A vírgula com "diferentes dos" integra o aposto à sintaxe sem alterar o conteúdo didático nem as ênfases em <em>.

**44. `src/mapa/StatePanel.tsx` — Ficha do estado — seção Doenças tropicais e negligenciadas, aviso educativo** _(ponto e vírgula)_

- **Antes:**
  ```
  Conteúdo <strong>educativo</strong>. Não substitui avaliação profissional; o site não diagnostica nem prescreve.
  ```
- **Depois:**
  ```
  Conteúdo <strong>educativo</strong>. Não substitui avaliação profissional. O site não diagnostica nem prescreve.
  ```
- **Por quê:** Ponto e vírgula entre duas orações curtas num aviso de interface; o próprio lede já separa a primeira afirmação por ponto, e as três frases curtas em sequência mantêm o mesmo peso de advertência com pontuação consistente.

**45. `src/mapa/StatePanel.tsx` — Ficha do estado — seção Serviços & emergência, nota final** _(outro)_

- **Antes:** “A rede de referência para soroterapia varia por município, confirme com a Vigilância em Saúde local.”
- **Depois:** “A rede de referência para soroterapia varia por município. Confirme com a Vigilância em Saúde local.”
- **Por quê:** Vírgula emendando oração declarativa a um imperativo (comma splice), não padrão em texto institucional revisado. A instrução vira frase própria, sem mudança de conteúdo.

**46. `src/mapa/StatePanel.tsx` — Ficha de doença — nota "Nos serviços de saúde"** _(outro)_

- **Antes:**
  ```
  <em>(informação geral, não é orientação de tratamento individual.)</em>
  ```
- **Depois:**
  ```
  <em>(informação geral, não é orientação de tratamento individual).</em>
  ```
- **Por quê:** Parêntese que começa em minúscula integra a frase anterior, então o ponto final pertence fora do parêntese. Correção tipográfica mínima, padrão pt-BR.

**47. `src/mapa/BrazilMap.tsx` — Mapa SVG — aria-label do mapa (instruções de uso)** _(ponto e vírgula)_

- **Antes:** “Mapa do Brasil por unidade federativa. Use Tab para percorrer os estados e Enter para abrir. Roda do mouse aproxima; arraste para deslocar.”
- **Depois:** “Mapa do Brasil por unidade federativa. Use Tab para percorrer os estados e Enter para abrir. Roda do mouse aproxima. Arraste para deslocar.”
- **Por quê:** As instruções anteriores do mesmo rótulo já se separam por ponto; o ponto e vírgula final destoava, e em texto falado por leitor de tela o ponto marca a pausa esperada entre duas instruções independentes.

**48. `src/mapa/layers.ts` — Camada "Focos de calor" — descrição (tooltip da lente e bloco de escopo)** _(ponto e vírgula)_

- **Antes:** “A série cobre ${ANO_INICIAL} a ${ANO_FINAL}; use o controle de ano para percorrê-la.”
- **Depois:** “A série cobre ${ANO_INICIAL} a ${ANO_FINAL}. Use o controle de ano para percorrê-la.”
- **Por quê:** Ponto e vírgula colando declaração a instrução em texto curto de interface; as frases vizinhas da mesma descrição usam ponto, e a separação lê com naturalidade sem perder nada.

**49. `src/mapa/ranking.ts` — Régua de posição do estado — frase para leitor de tela (sr-only)** _(travessão)_

- **Antes:** “${p.posicao}º entre os ${p.de} estados com dado publicado ${onde} — ${camada.label}.”
- **Depois:** “${p.posicao}º entre os ${p.de} estados com dado publicado ${onde}, em ${camada.label}.”
- **Por quê:** O travessão apendava o rótulo da camada mecanicamente ao fim de uma frase falada por leitor de tela. ", em" integra o rótulo à sintaxe e espelha o título visível "Posição em {camada}". Verifiquei que só camadas comparáveis chegam aqui ("Vagas de IC (Edital 04/2026)", "Instituições da rede", "Focos de calor (ano)") e todas leem bem com "em"; o único teste sobre a frase (tests/mapa.test.ts, toContain) continua passando — 63/63 verdes.

**50. `src/mapa/viz.tsx` — Ficha do estado — linha do tempo climatológica, nota de rodapé** _(travessão)_

- **Antes:** “Referência: climatologia/INMET — não é previsão nem indica risco de doença.”
- **Depois:** “Referência: climatologia/INMET. Não é previsão nem indica risco de doença.”
- **Por quê:** Dois-pontos e travessão empilhados na mesma nota curta (rótulo: valor — ressalva) é compressão típica de texto gerado; a ressalva em frase própria lê com naturalidade e preserva o termo técnico "climatologia/INMET" intacto.

### Mapa interativo — narrativa e conteúdo dos estados

**51. `src/content/mapa/narrativa/04-formacao.json` — Mapa interativo — narrativa, etapa 4 (Formar cientistas em todo o país)** _(retórica)_

- **Antes:** “É formação de novos pesquisadores conectando as regiões do Brasil.”
- **Depois:** “A formação de novos pesquisadores conecta as regiões do Brasil.”
- **Por quê:** Fecho enfático truncado (sem artigo, gerúndio pendurado), padrão de frase de efeito de texto gerado; a forma declarativa direta soa natural e preserva o sentido.

**52. `src/content/mapa/estados/ce.json` — Mapa interativo — ficha do Ceará, animais peçonhentos: cascavel (prevenção)** _(ponto e vírgula)_

- **Antes:** “Atenção ao som do guizo; afastar-se sem tentar manejar o animal.”
- **Depois:** “Ficar atento ao som do guizo e afastar-se sem tentar manejar o animal.”
- **Por quê:** Ponto e vírgula emendando um fragmento nominal a um infinitivo num bullet curto; a coordenação com "e" no estilo infinitivo dos demais itens da lista é a forma natural.

**53. `src/content/mapa/estados/ce.json` — Mapa interativo — ficha do Ceará, animais peçonhentos: escorpião-amarelo-do-nordeste (prevenção)** _(ponto e vírgula)_

- **Antes:** “Vedar frestas e ralos; afastar entulho das paredes; controlar baratas.”
- **Depois:** “Vedar frestas e ralos, afastar entulho das paredes e controlar baratas.”
- **Por quê:** Cadeia telegráfica de ponto e vírgula dentro de um único bullet curto sem vírgulas internas; enumeração com vírgulas e "e" final é o pt-BR natural.

**54. `src/content/mapa/estados/ce.json` — Mapa interativo — ficha do Ceará, doenças: leishmaniose visceral (prevenção)** _(ponto e vírgula)_

- **Antes:** “Uso de coleiras repelentes em cães e telas; manejo ambiental para reduzir o vetor.”
- **Depois:** “Usar coleiras repelentes nos cães, instalar telas e fazer manejo ambiental para reduzir o vetor.”
- **Por quê:** Bullet telegráfico com ponto e vírgula e leitura ambígua ("coleiras... em cães e telas"); a forma verbal alinha o item ao bullet vizinho ("Evitar acúmulo...") e desfaz a ambiguidade sem alterar o conteúdo.

**55. `src/content/mapa/estados/ce.json` — Mapa interativo — ficha do Ceará, doenças: leishmaniose visceral (sinais de alerta)** _(outro)_

- **Antes:** “Quadro arrastado que exige avaliação, pode ser grave se não tratado.”
- **Depois:** “Quadro arrastado, que exige avaliação e pode ser grave se não tratado.”
- **Por quê:** Vírgula emendando duas orações (comma splice), construção que não ocorre em pt-BR editado; a coordenação com "e" resolve com mudança mínima.

**56. `src/content/mapa/estados/ce.json` — Mapa interativo — ficha do Ceará, doenças: dengue, zika e chikungunya (sinais de alerta)** _(outro)_

- **Antes:** “Sinais de alarme (dengue): dor abdominal intensa, vômitos, sangramentos, atendimento imediato.”
- **Depois:** “Sinais de alarme (dengue): dor abdominal intensa, vômitos e sangramentos exigem atendimento imediato.”
- **Por quê:** Lista telegráfica que misturava sintomas com a conduta ("atendimento imediato" como quarto item), artefato de anotação comprimida; a redação espelha o fecho "exigem atendimento imediato" usado nas demais fichas (RO, MA, AC, AP, PA, RR, TO).

**57. `src/content/mapa/estados/ma.json` — Mapa interativo — ficha do Maranhão, doenças: dengue (como reconhecer)** _(outro)_

- **Antes:** “dores musculares e nas articulações intensas”
- **Depois:** “dores musculares e articulares intensas”
- **Por quê:** O adjetivo "intensas" ficava desgarrado após a locução "nas articulações", construção travada; a forma paralela "musculares e articulares intensas" é a natural e já usada nas fichas de PA, MT e RR.

**58. `src/content/mapa/estados/ro.json` — Mapa interativo — ficha de Rondônia, doenças: dengue (como reconhecer)** _(outro)_

- **Antes:** “dores musculares e nas articulações intensas”
- **Depois:** “dores musculares e articulares intensas”
- **Por quê:** Mesmo problema da ficha do Maranhão: "intensas" desgarrado depois de "nas articulações"; a forma paralela "musculares e articulares" já aparece nas fichas de PA, MT e RR.

**59. `src/content/mapa/estados/ac.json` — Mapa interativo — ficha do Acre, doenças: leptospirose (prevenção)** _(outro)_

- **Antes:** “eliminar a presença de ratos dentro de casa e controlá-la nos arredores”
- **Depois:** “eliminar a presença de ratos dentro de casa e controlá-los nos arredores”
- **Por quê:** O pronome "controlá-la" retomava "presença" e produzia construção artificial; retomar "ratos" ("controlá-los") é a leitura natural, já usada na ficha do Amazonas ("eliminar a presença de ratos em casa, controlá-los nos arredores").

**60. `src/content/mapa/estados/ap.json` — Mapa interativo — ficha do Amapá, doenças: leptospirose (prevenção)** _(outro)_

- **Antes:** “eliminar a presença de ratos dentro de casa e controlá-la nos arredores”
- **Depois:** “eliminar a presença de ratos dentro de casa e controlá-los nos arredores”
- **Por quê:** Mesmo caso da ficha do Acre: "controlá-la" retomando "presença" soa artificial; "controlá-los" (os ratos) é a leitura natural, consistente com a ficha do Amazonas.

**61. `src/content/mapa/estados/pa.json` — Mapa interativo — ficha do Pará, doenças: leptospirose (prevenção)** _(outro)_

- **Antes:** “eliminar a presença de ratos dentro de casa e controlá-la nos arredores”
- **Depois:** “eliminar a presença de ratos dentro de casa e controlá-los nos arredores”
- **Por quê:** Mesmo caso das fichas do Acre e do Amapá: "controlá-la" retomando "presença" soa artificial; "controlá-los" (os ratos) é a leitura natural, consistente com a ficha do Amazonas.

### Relato anual — formulário Meu Ano

**62. `src/relato/MeuAno.tsx` — Relatório Anual de Atividades — barra de salvamento automático (mensagem de erro)** _(ponto e vírgula)_

- **Antes:** “Não conseguimos salvar agora; seu texto está aqui e vamos tentar de novo.”
- **Depois:** “Não conseguimos salvar agora. Seu texto está aqui e vamos tentar de novo.”
- **Por quê:** Ponto e vírgula em mensagem curta de status de interface; o ponto final entre as duas orações é o natural no pt-BR de UI.

**63. `src/relato/MeuAno.tsx` — Relatório Anual de Atividades — envio do relato (aviso de falha ao salvar)** _(ponto e vírgula)_

- **Antes:** “Não conseguimos salvar o que você escreveu antes de enviar. Seu texto continua aqui; tente de novo em instantes.”
- **Depois:** “Não conseguimos salvar o que você escreveu antes de enviar. Seu texto continua aqui. Tente de novo em instantes.”
- **Por quê:** Ponto e vírgula em mensagem curta de erro; a instrução final é oração independente e pede ponto, alinhando com a primeira frase da própria mensagem.

**64. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 1 (campo Instituição, dica sobre o ROR)** _(ponto e vírgula)_

- **Antes:** “Sem identificador ROR ainda. A coordenação completa esse campo; ele é o que faz sua instituição contar no Indicador nº 3.”
- **Depois:** “Sem identificador ROR ainda. A coordenação completa esse campo. Ele é o que faz sua instituição contar no Indicador nº 3.”
- **Por quê:** Ponto e vírgula em dica curta de campo; as frases vizinhas da mesma dica já usam ponto final e o ponto e vírgula destoava.

**65. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 1 (campo Idioma do formulário, dica)** _(ponto e vírgula)_

- **Antes:** “A versão em inglês das telas está em preparação; por ora sua escolha fica registrada e vale para os avisos que a coordenação enviar.”
- **Depois:** “A versão em inglês das telas está em preparação. Por ora, sua escolha fica registrada e vale para os avisos que a coordenação enviar.”
- **Por quê:** Ponto e vírgula em texto curto de interface; ponto final e vírgula depois de "Por ora" dão o ritmo natural da dica.

**66. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 2 (lista de produções, aviso de item sem confirmação automática)** _(ponto e vírgula)_

- **Antes:** “Sem confirmação automática do identificador — vale registrar assim mesmo; a coordenação confere depois.”
- **Depois:** “Sem confirmação automática do identificador — vale registrar assim mesmo. A coordenação confere depois.”
- **Por quê:** Travessão e ponto e vírgula empilhados num aviso de uma linha; o ponto final desfaz o acúmulo sem perder informação e o travessão restante fica bem empregado.

**67. `src/relato/MeuAno.tsx` — Formulário Relato anual — título da Tela 2 (cabeçalho do assistente)** _(dois-pontos)_

- **Antes:** “Sua produção: confira o que encontramos”
- **Depois:** “Confira a produção que encontramos”
- **Por quê:** Padrão de manchete "Algo: outra coisa" era o único título do assistente com dois-pontos; verificado que os outros cinco ("Confirme quem é você", "Revise e envie" etc.) são frases diretas, e a forma imperativa alinha o conjunto sem perder informação — o subtítulo já detalha o conteúdo.

**68. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 2 (confirmação de coautoria, mensagem de sucesso)** _(fragmentação)_

- **Antes:** “Coautoria confirmada: dois vínculos, uma contagem. O trabalho conta uma vez para a rede.”
- **Depois:** “Coautoria confirmada. O trabalho conta uma vez para a rede.”
- **Por quê:** Fragmento-slogan sem verbo que apenas repete a frase seguinte; verificado que o cartão de coautoria logo acima (linha 2695) já apresenta a fórmula "dois vínculos, uma contagem", tornando-a redundante na mensagem de sucesso.

**69. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 3 (contar atividades, mensagem de envio)** _(capitalização)_

- **Antes:** “Enviada! Os campos ficaram prontos para você contar OUTRA atividade. Quando terminar, toque em Fechar.”
- **Depois:** “Enviada! Os campos ficaram prontos para você contar outra atividade. Quando terminar, toque em Fechar.”
- **Por quê:** Caixa alta de ênfase em texto visível ao usuário lê como grito; é o tique dos comentários internos do arquivo (que usam CAPS livremente) vazando para a tela.

**70. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 3 (lista de atividades do laboratório)** _(redundância)_

- **Antes:** “Marque aquelas de que você participou — nada para digitar.”
- **Depois:** “Marque aquelas de que você participou.”
- **Por quê:** Redundância confirmada: o casco do assistente renderiza o subtítulo "Nada para digitar: marque de quais atividades você participou." logo acima deste parágrafo na mesma tela; repetir a fórmula invertida com travessão é acúmulo que um editor cortaria.

**71. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 3 (aviso quando o laboratório não registrou atividades)** _(outro)_

- **Antes:** “O que você contar aqui vai para a conferência dele(a).”
- **Depois:** “O que você contar aqui vai para a conferência do(a) líder.”
- **Por quê:** O pronome "dele(a)" não tinha antecedente possível no feminino (o antecedente na frase é "Seu laboratório", masculino); nomear o(a) líder corrige a referência e casa com o restante da tela ("o(a) líder confirma").

**72. `src/relato/MeuAno.tsx` — Formulário Relato anual — Tela 3 (bloco de objetivos da proposta, texto de abertura)** _(travessão)_

- **Antes:**
  ```
  Estes são os objetivos que <strong>parecem</strong> corresponder às frentes (EETs) do seu laboratório — um palpite nosso para poupar sua leitura, não uma classificação oficial: a proposta lista as frentes e os objetivos separadamente, sem dizer quais vão com quais.
  ```
- **Depois:**
  ```
  Estes são os objetivos que <strong>parecem</strong> corresponder às frentes (EETs) do seu laboratório. É um palpite nosso para poupar sua leitura, não uma classificação oficial: a proposta lista as frentes e os objetivos separadamente, sem dizer quais vão com quais.
  ```
- **Por quê:** Período de 40+ palavras empilhando travessão, contraste "X, não Y" e dois-pontos; quebrar no travessão devolve o fôlego sem alterar informação, e o dois-pontos restante segue bem empregado.

### Relato anual — formulário Meu Laboratório

**73. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — tela Equipe, aviso de equipe vazia** _(decalque do inglês)_

- **Antes:** “Nenhuma pessoa está ligada a este laboratório no cadastro. Sem roster, ninguém consegue marcar participação”
- **Depois:** “Nenhuma pessoa está ligada a este laboratório no cadastro. Sem equipe cadastrada, ninguém consegue marcar participação”
- **Por quê:** "Roster" é anglicismo sem uso corrente em pt-BR e destoa do restante da interface, que fala em "equipe", "lista" e "cadastro"; "equipe cadastrada" ainda amarra a frase à anterior ("no cadastro").

**74. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — tela Equipe, dica do campo "Pessoas excluídas no período"** _(ponto e vírgula)_

- **Antes:** “Preenchido pelas marcas acima; você pode corrigir.”
- **Depois:** “Preenchido pelas marcas acima. Você pode corrigir.”
- **Por quê:** Ponto e vírgula em microtexto de dica de campo, unindo duas afirmações independentes e pouco conectadas; em pt-BR de interface, duas frases curtas com ponto são o padrão. (Semicolons em antíteses deliberadas do mesmo arquivo, como "O sistema conta; você explica", foram mantidos.)

**75. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — tela Conferência, aviso para quem entrou como coordenação** _(decalque do inglês)_

- **Antes:** “as views abaixo devolvem tudo o”
- **Depois:** “as tabelas abaixo mostram tudo o”
- **Por quê:** "Views" é jargão de banco de dados e "devolvem" é decalque de "return" da programação; para o usuário, o que existe na tela são tabelas que mostram números. Sentido preservado (o aviso continua explicando que o acesso da coordenação alcança a rede inteira).

**76. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — tela Conferência, resumo do que o sistema contou** _(outro)_

- **Antes:** “Nada disto foi digitado:”
- **Depois:** “Nada disso foi digitado:”
- **Por quê:** "Disto" anafórico soa lusitano/formal; o pt-BR contemporâneo usa "disso". Confirmado contra o próprio arquivo, que usa "isso/disso" em todo o texto visível e reserva "isto" só ao uso catafórico correto ("Falta isto para enviar:").

**77. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — tela Conferência, legenda da tabela "Estudantes por nível"** _(ponto e vírgula)_

- **Antes:** “Estudantes por nível (pergunta 10) — você confere e ajusta; não redigita.”
- **Depois:** “Estudantes por nível (pergunta 10) — você confere e ajusta, não redigita.”
- **Por quê:** No contraste "X, não Y" o pt-BR usa vírgula; o ponto e vírgula somado ao travessão sobrecarrega uma legenda curta. Alinha com a frase análoga do próprio arquivo ("Você aprova ou aponta — não redigita.").

**78. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — tela Governança, mensagem após copiar os textos** _(decalque do inglês)_

- **Antes:** “Texto copiado, com os títulos do PICC. É colável no sistema do CNPq sem reescrever.”
- **Depois:** “Texto copiado, com os títulos do PICC. Dá para colar no sistema do CNPq sem reescrever.”
- **Por quê:** "Colável" é decalque de "pasteable", forma inexistente no uso corrente; "dá para colar" diz o mesmo e mantém o registro coloquial da mensagem de sucesso.

**79. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — tela Governança, introdução da tela** _(decalque do inglês)_

- **Antes:** “o texto será colável no sistema do CNPq em 2027, sem reescrita.”
- **Depois:** “o texto poderá ser colado no sistema do CNPq em 2027, sem reescrita.”
- **Por quê:** Segunda ocorrência do decalque "colável"; "poderá ser colado" é a forma natural em pt-BR e preserva exatamente a promessa (colar em 2027 sem reescrever).

**80. `src/relato/MeuLaboratorio.tsx` — Formulário do laboratório — editor de fato, dica do campo "Modalidade" da bolsa** _(decalque do inglês)_

- **Antes:** “As modalidades ainda não foram semeadas no ciclo; escreva a sigla no título do item.”
- **Depois:** “As modalidades ainda não foram cadastradas no ciclo; escreva a sigla no título do item.”
- **Por quê:** Achado na verificação: "semeadas" é decalque do jargão de banco de dados "seeded" em texto visível a líderes de laboratório, que não têm como decifrá-lo; "cadastradas" comunica o mesmo estado sem jargão. O ponto e vírgula foi mantido por ligar causa e instrução de forma coesa.

### Relato anual — painel da coordenação, busca e porta de entrada

**81. `src/relato/PainelRelatorio.tsx` — Painel do Relatório Anual — aviso-incentivo sobre solicitações de recurso** _(decalque do inglês)_

- **Antes:** “são avaliadas contra o que cada pesquisador(a) e laboratório”
- **Depois:** “são avaliadas com base no que cada pesquisador(a) e laboratório”
- **Por quê:** "Avaliar contra" é decalque de "evaluated against"; em pt-BR natural avalia-se "com base em" algo. O comentário de código acima, que usa a mesma expressão, foi preservado por não ser texto visível.

**82. `src/relato/PainelRelatorio.tsx` — Painel do Relatório Anual — aviso-incentivo sobre solicitações de recurso** _(outro)_

- **Antes:** “Os ~10 minutos deste formulário”
- **Depois:** “Os cerca de 10 minutos deste formulário”
- **Por quê:** O til como abreviação de "aproximadamente" é convenção de texto técnico; em prosa corrida de site institucional a aproximação se escreve por extenso. O "~209" do comentário de cabeçalho não foi tocado.

**83. `src/relato/PainelRelatorio.tsx` — Painel do Relatório Anual — botão Copiar (estado de falha)** _(travessão)_

- **Antes:** “Não deu — copie à mão”
- **Depois:** “Não deu, copie à mão”
- **Por quê:** Travessão fazendo papel de vírgula em rótulo de botão de quatro palavras; em microtexto de interface pt-BR a vírgula é a pontuação natural. Os travessões da prosa longa do painel, estilisticamente justificados, foram mantidos.

**84. `src/relato/PainelRelatorio.tsx` — Painel do Relatório Anual — aba Exportar, botão Baixar anexo (estado de falha)** _(travessão)_

- **Antes:** “Não deu — tente de novo”
- **Depois:** “Não deu, tente de novo”
- **Por quê:** Mesmo padrão do botão Copiar: travessão como pausa em rótulo curtíssimo de botão, onde a vírgula é o uso natural.

**85. `src/relato/PainelRelatorio.tsx` — Painel do Relatório Anual — aba Produção, nota explicativa da contagem** _(capitalização)_

- **Antes:** “Conta aqui só o que tem competência neste ciclo E pelo menos um vínculo de membro”
- **Depois:** “Conta aqui só o que tem competência neste ciclo e pelo menos um vínculo de membro”
- **Por quê:** Caixa alta de ênfase é estilo de comentário de código vazando para o texto do usuário; a própria frase seguinte usa <strong> para ênfase, e a conjunção minúscula preserva o sentido cumulativo (o "só" já delimita as duas condições).

**86. `src/relato/PainelRelatorio.tsx` — Painel do Relatório Anual — aba Exportar, nota introdutória** _(capitalização)_

- **Antes:** “Todos os arquivos saem do MESMO agregado exibido nas abas”
- **Depois:** “Todos os arquivos saem do mesmo agregado exibido nas abas”
- **Por quê:** Caixa alta de ênfase em prosa visível destoa do padrão do painel (que usa <strong>) e soa como grito; a repetição "mesmo agregado … mesmo recorte" na frase já carrega a ênfase retórica.

**87. `src/relato/PainelRelatorio.tsx` — Painel do Relatório Anual — aba Metas e objetivos, nota introdutória** _(outro)_

- **Antes:** “visível, não somido”
- **Depois:** “visível, não sumido”
- **Por quê:** "Somido" não existe em português; o particípio de "sumir" é "sumido" — o próprio arquivo usa "para não sumirem" corretamente em outra nota. O "somidos" do comentário de cabeçalho não foi tocado por não ser texto visível.

**88. `src/relato/BuscaPesquisador.tsx` — Identificação do pesquisador — tela de conflito de cadastro já vinculado** _(outro)_

- **Antes:** “Se ele se parece com o seu mas tem um erro de digitação”
- **Depois:** “Se ele se parece com o seu, mas tem um erro de digitação”
- **Por quê:** A norma do pt-BR pede vírgula antes da adversativa "mas" ligando orações coordenadas; sem ela a frase soa não revisada.

### Relato anual — configuração, narrativa gerada, validação e exportação

**89. `src/relato/api.ts` — Formulário do relato — mensagens de erro traduzidas do banco (identificador ROR)** _(decalque do inglês)_

- **Antes:** “O ROR id tem o formato 0xxxxxxxx (9 caracteres, sem o https://ror.org/).”
- **Depois:** “O identificador ROR tem o formato 0xxxxxxxx (9 caracteres, sem o https://ror.org/).”
- **Por quê:** "ROR id" é decalque da ordem nominal do inglês em mensagem visível ao usuário; o próprio módulo já consagra "o identificador ROR" (validation.ts:100, MeuAno.tsx, MeuLaboratorio.tsx), então a correção também restaura a consistência terminológica.

**90. `src/relato/api.ts` — Formulário do relato — mensagens de erro traduzidas do banco (tamanho de anexo)** _(dois-pontos)_

- **Antes:** “O arquivo passa do limite: 1 MB (documento Word .docx: até 10 MB). Reduza e tente de novo.”
- **Depois:** “O arquivo passa do limite de 1 MB (documento Word .docx: até 10 MB). Reduza e tente de novo.”
- **Por quê:** Dois dois-pontos na mesma frase curta de interface criam ritmo telegráfico artificial; "passa do limite de 1 MB" elimina o primeiro sem perder informação — a exceção do .docx continua dita no parêntese.

**91. `src/relato/api.ts` — Envio de anexos do relato — mensagem de tipo de arquivo aceito** _(travessão)_

- **Antes:** “Envie PDF, JPEG, PNG ou — para o documento da pesquisa — Word (.docx).”
- **Depois:** “Envie PDF, JPEG ou PNG. Word (.docx) entra só como documento da pesquisa.”
- **Por quê:** O par de travessões interrompendo a enumeração entre o "ou" e seu complemento é inserção parentética fora de lugar. Redação ajustada em relação à proposta do revisor: "Para o documento da pesquisa, envie Word (.docx)" sugeriria que o Word é obrigatório nesse caso; a forma aplicada preserva o sentido exato (docx aceito só como documento da pesquisa) e ecoa a mensagem-irmã da linha 1022 ("Documento Word (.docx) entra só como documento da pesquisa").

**92. `src/relato/indicadores.ts` — Tela 1 do relato — frase de procedência do índice H e citações (fonte OpenAlex)** _(ponto e vírgula)_

- **Antes:** “segundo o OpenAlex (a base é menor que a do Google Acadêmico; o número costuma ser mais baixo)”
- **Depois:** “segundo o OpenAlex (a base é menor que a do Google Acadêmico, e o número costuma ser mais baixo)”
- **Por quê:** Ponto e vírgula dentro de parêntese curto de interface soa duro; vírgula com "e" liga as duas orações com naturalidade sem alterar o sentido. Os testes de fraseDeProcedencia usam regex ("^segundo o OpenAlex") e continuam passando.

**93. `src/relato/indicadores.ts` — Tela 1 do relato — frase de procedência do índice H e citações (busca sem resultado)** _(outro)_

- **Antes:** “não conseguimos buscar agora — preencha do seu perfil”
- **Depois:** “não conseguimos buscar agora — preencha a partir do seu perfil”
- **Por quê:** "Preencha do seu perfil" tem regência truncada que nenhum nativo escreveria; "a partir do seu perfil" corrige a construção mantendo a instrução mínima. O travessão da frase é legítimo e foi mantido.

**94. `src/relato/exportar.ts` — Painel da coordenação — minuta do relatório, seção "Parcerias e rede de instituições"** _(decalque do inglês)_

- **Antes:** “Somando o roster ativo e as parcerias confirmadas, a rede reúne”
- **Depois:** “Somando o quadro de membros ativos e as parcerias confirmadas, a rede reúne”
- **Por quê:** "Roster" é anglicismo em prosa feita para ser colada no relatório oficial ao CNPq (a minuta declara esse destino no próprio código); "quadro de membros ativos" diz o mesmo em português corrente e harmoniza com o vocabulário da própria minuta ("membros ativos" na frase seguinte). As duas ocorrências da minuta foram corrigidas juntas, mantendo-a internamente consistente.

**95. `src/relato/exportar.ts` — Painel da coordenação — minuta do relatório, linha de fonte da seção "Parcerias e rede de instituições"** _(decalque do inglês)_

- **Antes:** “Fatos de parceria confirmados e roster ativo; instituições contadas por ROR declarado, nunca digitado”
- **Depois:** “Fatos de parceria confirmados e quadro de membros ativos; instituições contadas por ROR declarado, nunca digitado”
- **Por quê:** Mesmo anglicismo na linha de fonte que viaja junto quando a seção da minuta é copiada para o relatório; corrigido em par com a frase da seção para a minuta não usar dois nomes para a mesma coisa.

### Fitofármacos — formulário pré-evento e painel

**96. `src/fitofarmas/FormularioPreEvento.tsx` — Formulário Fitofarmas — dica do passo 1 (Quem é você)** _(outro)_

- **Antes:** “Só o necessário para a coordenação te encontrar depois do encontro.”
- **Depois:** “Só o necessário para a coordenação te procurar depois do encontro.”
- **Por quê:** O eco "encontrar… encontro" na mesma frase é real e desagradável; "procurar" é o verbo já consagrado no módulo ("a coordenação vai te procurar" no recibo e nas mensagens de validação) e preserva o sentido.

**97. `src/fitofarmas/FormularioPreEvento.tsx` — Formulário Fitofarmas — dica do passo 3 (Onde você pode contribuir)** _(outro)_

- **Antes:** “Marque o que é verdade hoje. Não há resposta certa, e “nada por enquanto” é uma delas.”
- **Depois:** “Marque o que é verdade hoje. Não há resposta certa, e “nada por enquanto” também é resposta.”
- **Por quê:** "É uma delas" fica sem referente plural depois de a frase negar que exista resposta certa — lê como descuido, não como piada. A forma nova ainda casa com o padrão do próprio módulo ("que é resposta válida", "Resposta legítima").

**98. `src/fitofarmas/FormularioPreEvento.tsx` — Formulário Fitofarmas — título principal (H1) da página** _(dois-pontos)_

- **Antes:** “Antes do encontro: como você quer se conectar à rede”
- **Depois:** “Antes do encontro, diga como você quer se conectar à rede”
- **Por quê:** Padrão de manchete "Algo: outra coisa" no elemento mais visível da página. A forma imperativa é a que o próprio módulo documenta como diretriz ("frases escritas para dizer à pessoa o que fazer em seguida") e já é usada na meta description ("diga como você quer colaborar").

**99. `src/fitofarmas/FormularioPreEvento.tsx` — Formulário Fitofarmas — aviso de formulário fora do ar** _(travessão)_

- **Antes:** “Guarde este endereço — ele continua valendo — ou escreva para…”
- **Depois:** “Guarde este endereço, que continua valendo, ou escreva para…”
- **Por quê:** A intercalação com travessões duplos quebra a alternativa "guarde… ou escreva" — o segundo travessão colado no "ou" trava a leitura. A oração explicativa entre vírgulas flui sem perder nada.

**100. `src/fitofarmas/FormularioPreEvento.tsx` — Formulário Fitofarmas — passo 1, dica do campo E-mail** _(capitalização)_

- **Antes:** “Responder de novo com o mesmo e-mail CORRIGE a resposta anterior, não duplica.”
- **Depois:** “Responder de novo com o mesmo e-mail corrige a resposta anterior, não duplica.”
- **Por quê:** Caixa alta de ênfase é o estilo dos comentários internos do código (e da migração 008) vazando para texto de interface; em UI profissional soa como grito e a frase já carrega a ênfase pela oposição "corrige, não duplica".

**101. `src/fitofarmas/FormularioPreEvento.tsx` — Formulário Fitofarmas — passo 3, instrução do bloco de aportes** _(capitalização)_

- **Antes:** “Ao marcar, aparece um campo para NOMEAR — e é o nome que faz a coordenação conseguir usar a informação.”
- **Depois:** “Ao marcar, aparece um campo para nomear — e é o nome que faz a coordenação conseguir usar a informação.”
- **Por quê:** Mesmo caso do "CORRIGE": caixa alta de ênfase herdada dos comentários internos, em texto visível ao usuário. A frase seguinte ("é o nome que faz…") já entrega a ênfase.

**102. `src/fitofarmas/perguntas.ts` — Formulário Fitofarmas — passo 4, opção de compromisso** _(outro)_

- **Antes:** “Co-redigir uma proposta para edital”
- **Depois:** “Coescrever uma proposta para edital”
- **Por quê:** "Co-redigir" com hífen não segue a ortografia vigente (o prefixo co- aglutina; a forma correta seria "corredigir", inusual). "Coescrever" é corrente, tem o mesmo sentido e é a forma que o id da opção (coescrever_proposta) já usa. Só o rótulo mudou; o id, que é contrato com o banco, ficou intacto, e os testes que comparam ids com o .sql seguem passando.

**103. `src/fitofarmas/validation.ts` — Formulário Fitofarmas — mensagem de erro (interesse na rede)** _(outro)_

- **Antes:** “Escolha uma das quatro linhas — é ela que define o resto do formulário.”
- **Depois:** “Escolha uma das quatro opções — é ela que define o resto do formulário.”
- **Por quê:** "Linhas" não é como ninguém chama alternativas de um grupo de rádio, e a dica do mesmo campo já fala em "A primeira opção encurta o formulário" — a mensagem de erro deve usar o mesmo termo.

**104. `src/fitofarmas/validation.ts` — Formulário Fitofarmas — mensagem de erro (eixos)** _(outro)_

- **Antes:** “Marque ao menos um eixo. Se nenhum servir, volte e marque “Ainda preciso entender melhor”.”
- **Depois:** “Marque ao menos um eixo. Se nenhum servir, volte e marque “Tenho interesse, mas preciso entender melhor como funciona”.”
- **Por quê:** O texto entre aspas não correspondia a nenhum rótulo real do passo 2; quem voltasse procurando "Ainda preciso entender melhor" não encontraria nada. Agora a citação bate letra por letra com o rótulo da opção "entender", claramente a que o autor tinha em mente.

**105. `src/fitofarmas/validation.ts` — Formulário Fitofarmas — mensagem de erro (teto de eixos)** _(retórica)_

- **Antes:** “Escolha no máximo ${LIMITES.eetsMax}. Priorizar é a resposta.”
- **Depois:** “Escolha no máximo ${LIMITES.eetsMax} eixos.”
- **Por quê:** A dica exibida junto ao mesmo campo já diz "Escolher poucos é a resposta"; erro e dica aparecem na tela ao mesmo tempo e a fórmula aforística "X é a resposta" duplicada lê como texto de modelo. Acrescentar "eixos" ainda completa o numeral solto.

**106. `src/fitofarmas/validation.ts` — Formulário Fitofarmas — mensagem de erro (disponibilidade)** _(redundância)_

- **Antes:** “Diga quanto tempo consegue dedicar. Estimativa honesta vale mais que otimismo.”
- **Depois:** “Diga quanto tempo consegue dedicar.”
- **Por quê:** A segunda frase repetia literalmente a dica do próprio campo ("Estimativa honesta vale mais que otimismo: é com ela que a coordenação monta os grupos"), visível na mesma tela que o erro. A frase restante continua dizendo o que falta e o caminho de saída, como o contrato do arquivo exige.

**107. `src/fitofarmas/validation.ts` — Formulário Fitofarmas — mensagem de erro (Currículo Lattes)** _(outro)_

- **Antes:** “O ID Lattes tem 16 números. Cole o endereço inteiro do currículo que a gente extrai.”
- **Depois:** “O ID Lattes tem 16 números. Cole o endereço inteiro do currículo, que a gente extrai o número.”
- **Por quê:** Sem a vírgula, "que a gente extrai" virava oração restritiva de "currículo" e o "extrai" ficava sem complemento — a frase lia truncada. A forma explicativa com "o número" diz exatamente o que acontece, no mesmo registro coloquial ("a gente") do original.

**108. `src/fitofarmas/api.ts` — Formulário Fitofarmas — mensagem de falha no envio (função ainda não publicada)** _(ponto e vírgula)_

- **Antes:** “…continuam salvas neste navegador; tente de novo mais tarde ou escreva para a coordenação.”
- **Depois:** “…continuam salvas neste navegador. Tente de novo mais tarde ou escreva para a coordenação.”
- **Por quê:** Ponto e vírgula em mensagem curta de interface é artefato típico de texto gerado; o ponto final é a fronteira natural entre a constatação e a instrução.

**109. `src/fitofarmas/api.ts` — Formulário Fitofarmas — mensagem de falha genérica no envio** _(ponto e vírgula)_

- **Antes:** “Não foi possível enviar agora. Suas respostas continuam salvas neste navegador; tente novamente em instantes.”
- **Depois:** “Não foi possível enviar agora. Suas respostas continuam salvas neste navegador. Tente novamente em instantes.”
- **Por quê:** Mesmo caso: ponto e vírgula em aviso curto de interface. As duas partes da string concatenada foram ajustadas ("navegador. " + "Tente…") e o resultado renderizado inicia frase corretamente.

**110. `src/fitofarmas/PainelFitofarmas.tsx` — Gestão — painel Fitofarmas, tabela Compromissos assumidos** _(decalque do inglês)_

- **Antes:** “O dado mais acionável: em outubro, volte a esta lista item por item.”
- **Depois:** “O dado mais útil para agir: em outubro, volte a esta lista item por item.”
- **Por quê:** "Acionável" é decalque de "actionable", jargão de BI que destoa da voz do módulo, que evita anglicismos. "Útil para agir" diz a mesma coisa em português corrente. O comentário de código com o mesmo termo em metricas.ts não foi tocado (não é visível ao usuário).

### Ajuste decorrente em teste

**111. `tests/relato-anexo-docx.test.ts` — expectativa de mensagem de erro**

- **Antes:** `rejects.toThrow(/PDF, JPEG, PNG/)`
- **Depois:** `rejects.toThrow(/PDF, JPEG ou PNG/)`
- **Por quê:** a mensagem de erro de anexo em `src/relato/api.ts` ganhou a conjunção “ou” na enumeração (ver a correção correspondente na seção do relato anual, acima) e o teste que verificava o texto antigo foi sincronizado. Não há mudança de comportamento.

---

## Propostas rejeitadas na verificação

**R1. `src/content/editais/resultado-ic-2026.json`** _(Editais, figuras citáveis e componentes de UI compartilhados)_

- **Trecho:** “o processo seletivo publica o resultado, não os pareceres.”
- **Motivo da rejeição:** O contraste aqui não é retórica vazia: informa um fato administrativo real (os pareceres existem e não são publicados), fechando a frase que lista o que a página não inclui. "Publica-se o resultado, não os pareceres" é construção corrente em prosa administrativa brasileira, e os dois-pontos que a introduzem são explicativos e gramaticais. A reformulação proposta é equivalente, não superior — é troca de gosto, não correção.

**R2. `src/platform/auth.tsx`** _(Plataforma — autenticação, senha e contas)_

- **Trecho:** “Espere alguns minutos e digite o código de novo — ele continua valendo até expirar.”
- **Motivo da rejeição:** Uso legítimo do travessão em pt-BR: "ele continua valendo até expirar" é um aposto explicativo curto, de tom tranquilizador, colado à instrução anterior — exatamente o tipo de aparte que o travessão marca bem. A mensagem já abre com frase própria ("Tentativas demais em pouco tempo."), então trocar o travessão por ponto a fragmentaria em três frases curtas sem ganho de clareza. Diferente do caso das introduções do AuthCard, aqui não há emenda de duas orações procedurais com mudança de assunto.

**R3. `src/relato/agregacao.ts`** _(Relato anual — configuração, narrativa gerada, validação e exportação)_

- **Trecho:** “Países distintos declarados no roster (país da instituição) e nas parcerias confirmadas — contados, nunca digitados.”
- **Motivo da rejeição:** Rejeitada por consistência terminológica: esta nota de metodologia é exibida no painel da coordenação, onde "roster" é o termo estabelecido em vários rótulos visíveis de PainelRelatorio.tsx ("Membros ativos no roster", "Sem vínculo no roster", "Contado por ROR declarado (roster + parcerias confirmadas)") — arquivo fora do escopo deste grupo. Trocar só esta ocorrência faria a mesma tela chamar o mesmo conceito por dois nomes, o que é pior que o anglicismo consistente. Diferente da minuta (que sai do painel rumo ao relatório oficial e foi corrigida por inteiro), aqui a troca parcial criaria inconsistência dentro de uma mesma tela.

---

## Cobertura: superfícies extras examinadas e mantidas

A varredura final de completude procurou texto visível fora dos arquivos revisados. Três superfícies reais foram encontradas, examinadas uma a uma e **mantidas sem alteração**:

1. **`src/styles.css` — rótulo móvel da tabela de resultado** (`content: "Orientador(a): "`): confere exatamente com o cabeçalho `Orientador(a)` da tabela em `ResultadoIC2026.tsx`; texto funcional correto.
2. **`src/styles.css` — carimbo de impressão do painel do mapa** (`content: "INCT-CONEXAO · " attr(data-procedencia)`): carimbo de procedência para PDF/impressão; o separador “·” é elemento gráfico, não pontuação de prosa.
3. **`src/content/dados/focos-por-uf-ano.json` — nota metodológica e créditos das figuras**: a nota de três frases lê-se natural; os dois-pontos em “incêndio confirmado: é uma detecção…” são explicativos e corretos.

## Fora do alcance da revisão (decisão documentada)

- **`src/content/relato/identificacao.json` — frase de agradecimento (pt/en)**: aparece no recibo do relato e é copiada para artigos publicados. Examinada e **mantida**: o travessão em “Chamada nº 46/2024 — Programa Institutos Nacionais de Ciência e Tecnologia” reproduz a grafia oficial da chamada, e o próprio arquivo registra que a frase é deliberadamente curta e está pendente de conferência contra o Termo de Outorga. Reescrever aqui seria risco, não melhoria.
- **`src/content/relato/proposta-inct-2024.json`**: transcrição da proposta submetida ao CNPq (fonte primária). Trechos dela aparecem na interface do relato, mas o critério aqui é fidelidade ao documento, não fluência — o arquivo não foi editado. Se algum dia for revisado, deve ser contra o PDF da proposta.
- **Dados e cadastros** (`src/content/relato/equipe.json`, `laboratorios.json`, `taxonomia.json`, `apis-metadados.json`, `src/content/dados/`): nomes, sementes de banco e dados numéricos; `taxonomia.json` e `apis-metadados.json` contêm prosa que hoje não renderiza (helpers sem chamador), mas virarão superfície visível se esses helpers forem ligados — vale revisar nesse momento.
- **E-mails de autenticação** (templates em `supabase/`): são texto visível ao usuário, mas não fazem parte da página; ficam como sugestão de revisão futura.

## Verificação final

- Suíte completa: **26 arquivos de teste, 730 testes, todos passando** (mesma contagem da linha de base medida antes das edições).
- `tsc --noEmit`: sem erros. Build de produção (`vite build`): OK.
- Todos os JSONs de conteúdo editados validados com `JSON.parse`.
- **Conciliação da trilha de auditoria**: as edições reais registradas nos transcritos dos agentes foram comparadas uma a uma com o log acima — toda edição tem entrada correspondente e todo texto revisado consta do arquivo final. Não há alteração não documentada.
