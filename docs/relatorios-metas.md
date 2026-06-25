# Relatórios de resultados por meta (formulário único, privado)

Sistema para os **líderes de grupo** verem as **metas** que assumiram e enviarem
os **resultados** de cada uma. **Um único formulário** para todos os grupos: o
líder escolhe o grupo, vê as metas dele e envia. As respostas caem numa
**planilha privada** no seu Google Drive (só a coordenação vê; um líder nunca vê
as respostas de outro). Sem servidor, sem banco de dados.

## Como o líder usa (intuitivo)

1. Abre **o link do formulário** (um só, igual para todos).
2. Escreve nome e e-mail e **escolhe o seu grupo**.
3. O formulário **pula automaticamente** para a seção do grupo, mostrando **as
   metas** daquele grupo.
4. Em cada meta: escreve os **resultados** e cola o **link do PDF** do relatório.
5. Envia. (Pode reabrir e corrigir depois.)

## O arquivo PDF: por que "link" e não envio direto

O campo de **envio de arquivo** do Google Forms só existe em contas **Google
Workspace (pagas)** — numa conta `@gmail` comum ele nem aparece (verificado em
2026). Então o formulário pede o **link** do PDF: o líder sobe o PDF no Drive
dele, compartilha (com a coordenação, ou "qualquer pessoa com o link pode ver") e
cola o link. Simples e funciona em qualquer conta.

> Quer que o líder **anexe o arquivo de verdade** dentro do formulário? Só com
> uma conta **Google Workspace** (aí dá para trocar o campo de link por um campo
> de upload) **ou** com a alternativa de **pastas** abaixo.

## Criar o formulário (uma vez, ~10 min)

Um script monta o formulário inteiro (seções por grupo, metas, campos) para você.

1. Abra **https://script.google.com** → **Novo projeto**.
2. Apague o código padrão e **cole o conteúdo de
   [`scripts/relatorios-form.gs`](../scripts/relatorios-form.gs)**.
3. No topo, edite **`GRUPOS`** com os grupos e as **metas reais** (código, título,
   descrição) do projeto.
4. Menu **Executar** → função **`criarFormulario`** → **Autorizar**.
5. No painel **Execução / Logs** aparecem dois links:
   - **ENVIAR aos líderes** → mande este para todos os líderes (é o mesmo para todos).
   - **EDITAR o formulário** → caso queira ajustar algo à mão.
6. A **planilha privada de respostas** é criada automaticamente (o link aparece
   nos Logs) — é nela que você acompanha os envios. Só você a vê.

Para mudar metas/grupos depois: edite `GRUPOS` e rode `criarFormulario` de novo
(gera um formulário novo), ou ajuste o formulário existente à mão.

## Pontos de atenção

- **Privacidade:** as respostas ficam só com você (na planilha/numa conta sua).
  Um líder não vê as respostas de outro. Para o PDF ficar realmente restrito,
  oriente o líder a **compartilhar o PDF com o e-mail da coordenação** em vez de
  "qualquer pessoa com o link".
- **Identificação:** o formulário pede nome e e-mail (não força login), então o
  link só deve ser enviado aos líderes.
- **Espaço:** os PDFs ficam no Drive de **quem os subiu** (o líder), não no seu —
  o seu Drive guarda só as respostas (texto + links). Bom para a sua cota.

## Alternativa: pastas privadas por grupo (se quiser o arquivo de verdade)

Se preferir que os líderes **arrastem o PDF** (em vez de colar link) e não tiver
Workspace, use a abordagem de **uma pasta privada por grupo**:
[`scripts/relatorios-drive.gs`](../scripts/relatorios-drive.gs) cria uma pasta por
grupo (compartilhada só com o líder), com uma subpasta por meta e um documento de
resultados; o líder escreve os resultados e solta o PDF na subpasta. Mais privado
para o arquivo (fica no **seu** Drive), porém não é um formulário único — é uma
pasta por grupo. Escolha o que preferir; os dois funcionam em conta `@gmail`.
