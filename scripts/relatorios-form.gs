/**
 * ============================================================================
 *  INCT-CONEXAO — Formulário ÚNICO de relatórios de resultados por meta
 * ============================================================================
 *
 *  O QUE ESTE SCRIPT FAZ
 *  ---------------------
 *  Cria UM formulário Google só, para todos os grupos. O líder:
 *    1) escreve nome e e-mail,
 *    2) escolhe o SEU grupo,
 *    3) o formulário pula automaticamente para a seção daquele grupo, mostrando
 *       as METAS do grupo,
 *    4) para cada meta, escreve os resultados e cola o link do PDF do relatório,
 *    5) envia.
 *  As respostas caem numa planilha PRIVADA no seu Drive (só você vê). Um líder
 *  nunca vê as respostas de outro.
 *
 *  POR QUE "LINK DO PDF" E NÃO ENVIO DIRETO DO ARQUIVO?
 *  ---------------------------------------------------
 *  O campo "envio de arquivo" do Google Forms só existe em contas Google
 *  Workspace (pagas) — numa conta @gmail comum ele não aparece (verificado, 2026).
 *  Então o formulário pede o LINK do PDF: o líder sobe o PDF no Drive dele,
 *  marca "compartilhar com a coordenação" (ou "qualquer pessoa com o link"), e
 *  cola o link. (Se um dia o INCT tiver uma conta Workspace, dá para trocar o
 *  campo de link por um campo de upload de verdade.)
 *
 *  COMO USAR (uma vez, ~10 min)
 *  ----------------------------
 *  1. Abra https://script.google.com → "Novo projeto".
 *  2. Apague o código padrão e cole TODO este arquivo.
 *  3. Edite a lista GRUPOS abaixo com os grupos e as METAS reais do projeto.
 *  4. Menu "Executar" → função "criarFormulario" → Autorize.
 *  5. No painel "Execução / Logs" aparecem dois links:
 *       • "ENVIAR aos líderes"  → o link que você manda para todos os líderes.
 *       • "EDITAR o formulário"  → caso queira ajustar algo à mão depois.
 *  6. (Opcional) Abra o formulário em "Editar", aba "Respostas" → ícone de
 *     planilha → cria a planilha privada que reúne tudo.
 *
 *  Para mudar metas/grupos depois: edite GRUPOS e rode "criarFormulario" de novo
 *  (gera um formulário novo) — ou ajuste o formulário existente à mão.
 * ============================================================================
 */

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  EDITE DAQUI...                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

var TITULO_FORM = 'INCT-CONEXAO — Relatório de Resultados por Meta';

var INTRO = 'Selecione o seu grupo de pesquisa, veja as metas e envie os '
  + 'resultados alcançados em cada uma. Para o relatório em PDF, suba o arquivo '
  + 'no seu Google Drive e cole o link no campo indicado.';

// Um item por grupo, com as METAS reais (do projeto).
var GRUPOS = [
  {
    nome: 'CONEXAO-Clima & Saúde Única',
    metas: [
      { codigo: 'M1', titulo: 'TÍTULO DA META 1', descricao: 'Descreva aqui a meta assumida no projeto.' },
      { codigo: 'M2', titulo: 'TÍTULO DA META 2', descricao: 'Descreva aqui a meta assumida no projeto.' },
    ],
  },
  {
    nome: 'CONEXAO-Bioprospecção e Bioeconomia',
    metas: [
      { codigo: 'M1', titulo: 'TÍTULO DA META 1', descricao: 'Descreva aqui a meta assumida no projeto.' },
      { codigo: 'M2', titulo: 'TÍTULO DA META 2', descricao: 'Descreva aqui a meta assumida no projeto.' },
    ],
  },
];

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ...ATÉ AQUI. Não precisa mexer abaixo.                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function criarFormulario() {
  var form = FormApp.create(TITULO_FORM);
  form.setDescription(INTRO);
  form.setCollectEmail(false);     // não força login; pedimos nome/e-mail como campos
  form.setProgressBar(true);
  form.setAllowResponseEdits(true); // o líder pode reabrir e corrigir depois

  // ---- Página inicial: identificação + escolha do grupo (último item da página) ----
  form.addTextItem().setTitle('Nome do líder').setRequired(true);
  form.addTextItem().setTitle('E-mail para contato').setRequired(true);

  var grupoItem = form.addMultipleChoiceItem();
  grupoItem.setTitle('Selecione o seu grupo de pesquisa').setRequired(true);

  // ---- Uma seção (página) por grupo, com as metas ----
  var choices = [];
  GRUPOS.forEach(function (g) {
    var pagina = form.addPageBreakItem().setTitle(g.nome);
    pagina.setGoToPage(FormApp.PageNavigationType.SUBMIT); // após preencher o grupo, vai ao envio

    (g.metas || []).forEach(function (m) {
      form.addSectionHeaderItem()
        .setTitle('Meta ' + m.codigo + ' — ' + m.titulo)
        .setHelpText(m.descricao || '');
      form.addParagraphTextItem()
        .setTitle('Resultados alcançados — ' + m.codigo)
        .setRequired(false);
      form.addTextItem()
        .setTitle('Link do relatório em PDF — ' + m.codigo)
        .setHelpText('Suba o PDF no seu Google Drive, marque "compartilhar com a '
          + 'coordenação" (ou "qualquer pessoa com o link pode ver") e cole o link aqui.')
        .setRequired(false);
    });

    choices.push(grupoItem.createChoice(g.nome, pagina)); // escolher o grupo pula para a seção dele
  });
  grupoItem.setChoices(choices);

  Logger.log('Formulário criado com sucesso!');
  Logger.log('--------------------------------------------------');
  Logger.log('Link para ENVIAR aos líderes:');
  Logger.log('  ' + form.getPublishedUrl());
  Logger.log('Link para VOCÊ editar o formulário:');
  Logger.log('  ' + form.getEditUrl());
  Logger.log('--------------------------------------------------');
  Logger.log('Dica: abra o formulário em "Editar" → aba "Respostas" → ícone de '
    + 'planilha, para reunir tudo numa planilha privada.');
}
