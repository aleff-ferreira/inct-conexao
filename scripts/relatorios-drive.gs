/**
 * ============================================================================
 *  INCT-CONEXAO — Relatórios de resultados por meta (Google Drive, privado)
 * ============================================================================
 *
 *  O QUE ESTE SCRIPT FAZ
 *  ---------------------
 *  Cria, no SEU Google Drive, uma pasta por grupo de pesquisa e, dentro dela,
 *  uma subpasta por META. Compartilha cada pasta de grupo SOMENTE com o líder
 *  daquele grupo (privacidade: um líder nunca vê os arquivos de outro). Em cada
 *  subpasta de meta coloca um documento "RESULTADOS (preencher)" com a descrição
 *  da meta. O líder abre a pasta dele, escreve os resultados e arrasta o PDF do
 *  relatório para a subpasta. Tudo fica privado, no seu Drive, organizado por
 *  grupo e por meta. Sem servidor, sem backend.
 *
 *  POR QUE PASTAS, E NÃO UM GOOGLE FORM?
 *  -------------------------------------
 *  O recurso de "envio de arquivo" do Google Forms só existe em contas Google
 *  Workspace (pagas) — não funciona numa conta @gmail comum. Pastas privadas
 *  do Drive resolvem o mesmo problema, funcionam no Gmail comum e mantêm cada
 *  grupo isolado.
 *
 *  COMO USAR (uma vez)
 *  -------------------
 *  1. Abra https://script.google.com → "Novo projeto".
 *  2. Apague o conteúdo padrão e cole TODO este arquivo.
 *  3. Edite a lista GRUPOS abaixo: nome do grupo, e-mail Google do líder e as
 *     metas reais (do projeto). Pode começar com poucos e rodar de novo depois.
 *  4. Menu "Executar" → função "criarEstrutura". Autorize quando pedir
 *     (é a sua conta acessando o seu próprio Drive).
 *  5. Veja o menu "Execução" / "Logs": ele imprime o LINK da pasta de cada
 *     grupo. Envie a cada líder o link da pasta do grupo dele.
 *
 *  Rodar de novo é seguro: não duplica pastas nem sobrescreve documentos já
 *  preenchidos — só cria o que ainda não existe. Assim você pode adicionar
 *  novos grupos/metas a qualquer momento.
 * ============================================================================
 */

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  EDITE DAQUI...                                                           ║
// ╚══════════════════════════════════════════════════════════════════════════╝

// Nome da pasta-raiz que será criada no seu "Meu Drive".
var PASTA_RAIZ = 'INCT-Relatorios';

// Um item por grupo. Troque os exemplos pelos grupos, e-mails e METAS REAIS.
var GRUPOS = [
  {
    nome: 'CONEXAO-Clima & Saúde Única',
    liderEmail: '', // e-mail Google do líder, ex.: 'fulano@gmail.com' (deixe '' para compartilhar à mão depois)
    metas: [
      { codigo: 'M1', titulo: 'TÍTULO DA META 1', descricao: 'Descreva aqui a meta assumida no projeto.' },
      { codigo: 'M2', titulo: 'TÍTULO DA META 2', descricao: 'Descreva aqui a meta assumida no projeto.' },
    ],
  },
  {
    nome: 'CONEXAO-Bioprospecção e Bioeconomia',
    liderEmail: '',
    metas: [
      { codigo: 'M1', titulo: 'TÍTULO DA META 1', descricao: 'Descreva aqui a meta assumida no projeto.' },
      { codigo: 'M2', titulo: 'TÍTULO DA META 2', descricao: 'Descreva aqui a meta assumida no projeto.' },
    ],
  },
];

// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  ...ATÉ AQUI. Não precisa mexer abaixo.                                   ║
// ╚══════════════════════════════════════════════════════════════════════════╝

function criarEstrutura() {
  var raiz = pastaPorNome(DriveApp.getRootFolder(), PASTA_RAIZ) || DriveApp.getRootFolder().createFolder(PASTA_RAIZ);
  Logger.log('Pasta-raiz: ' + raiz.getUrl());
  Logger.log('--------------------------------------------------');

  GRUPOS.forEach(function (g) {
    var pastaGrupo = pastaPorNome(raiz, g.nome) || raiz.createFolder(g.nome);

    // Privacidade: compartilha a pasta do grupo SOMENTE com o líder daquele grupo.
    if (g.liderEmail) {
      try {
        pastaGrupo.addEditor(g.liderEmail);
      } catch (e) {
        Logger.log('  AVISO: não consegui compartilhar com "' + g.liderEmail + '". Verifique o e-mail. (' + e + ')');
      }
    }

    criarDocSeNaoExiste(pastaGrupo, 'LEIA-ME — como enviar relatórios', instrucoesGrupo(g));

    (g.metas || []).forEach(function (m) {
      var nomeMeta = m.codigo + ' — ' + m.titulo;
      var pastaMeta = pastaPorNome(pastaGrupo, nomeMeta) || pastaGrupo.createFolder(nomeMeta);
      criarDocSeNaoExiste(pastaMeta, m.codigo + ' — RESULTADOS (preencher)', textoMeta(g, m));
    });

    Logger.log('• ' + g.nome);
    Logger.log('  Líder: ' + (g.liderEmail || '⚠ SEM e-mail — compartilhe a pasta à mão'));
    Logger.log('  Link para enviar ao líder: ' + pastaGrupo.getUrl());
    Logger.log('--------------------------------------------------');
  });

  Logger.log('Pronto! Envie a cada líder o link da pasta do grupo dele (acima).');
}

/** Retorna a subpasta com esse nome, ou null se não existir. */
function pastaPorNome(pai, nome) {
  var it = pai.getFoldersByName(nome);
  return it.hasNext() ? it.next() : null;
}

/** Cria um Google Doc na pasta só se ainda não houver um com esse nome (idempotente). */
function criarDocSeNaoExiste(pasta, nome, conteudo) {
  if (pasta.getFilesByName(nome).hasNext()) return; // já existe: não sobrescreve o que o líder preencheu
  var doc = DocumentApp.create(nome);
  doc.getBody().setText(conteudo);
  doc.saveAndClose();
  DriveApp.getFileById(doc.getId()).moveTo(pasta);
}

function instrucoesGrupo(g) {
  return [
    'INCT-CONEXAO — Relatórios de resultados por meta',
    '',
    'Grupo: ' + g.nome,
    '',
    'Como enviar (passo a passo):',
    '1. Esta pasta tem uma subpasta para cada META do seu grupo.',
    '2. Entre na subpasta da meta correspondente.',
    '3. Abra o documento "RESULTADOS (preencher)" e escreva os resultados alcançados.',
    '4. Arraste para dentro da MESMA subpasta o arquivo do relatório (PDF) com as evidências.',
    '',
    'Somente você e a coordenação têm acesso a esta pasta.',
    'Dúvidas? Fale com a coordenação do INCT-CONEXAO.',
  ].join('\n');
}

function textoMeta(g, m) {
  return [
    'META ' + m.codigo + ' — ' + m.titulo,
    'Grupo: ' + g.nome,
    '',
    'Descrição da meta (compromisso assumido no projeto):',
    m.descricao || '(descrição a definir)',
    '',
    '────────────────────────────────────────',
    'RESULTADOS ALCANÇADOS (preencha abaixo):',
    '',
    '',
    '',
    '',
    '────────────────────────────────────────',
    'Lembrete: arraste também o arquivo do relatório (PDF) para esta subpasta.',
  ].join('\n');
}
