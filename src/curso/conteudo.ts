/**
 * ============================================================================
 *  Curso "Do átomo à ação biológica" — conteúdo estático (fonte da verdade)
 * ============================================================================
 *  Rota: #/curso · pública, sem login · IFRO Campus Jaru, 19–21 de agosto 2026.
 *
 *  Este arquivo é o TEXTO DE TELA. Ele não fala com o banco: a página tem de
 *  renderizar mesmo com a plataforma desligada (mostrando o aviso de "inscrições
 *  em breve"), então as datas das turmas, os casos e as trilhas vivem AQUI, não
 *  no Supabase. A edição no banco (migração 013 / seed 004) controla só a JANELA
 *  de inscrição — nunca o que a página mostra.
 *
 *  Os `id` das turmas e os tokens das listas são GÊMEOS dos CHECK da migração
 *  013 e das uniões de `types.ts`. Mudar um exige mudar os três.
 *
 *  A base científica é o Guia do Docente v2.0 (28/07/2026): quatro casos-âncora
 *  (COX-2, DHFR, ALS/AHAS, CYP51) e o caso demonstrativo EPSPS/glifosato. A leitura
 *  termina em limitação — docking gera hipótese, não recomendação clínica ou
 *  agronômica. Isso está dito na página, não escondido.
 * ============================================================================
 */
import type { Experiencia, TurmaC1, TurmaC2, Vinculo } from "./types";

/** O slug da edição. Espelha `curso_edicoes.slug` do seed 004. */
export const EDICAO_SLUG = "curso-conexao-bioinformatica";

export const TEXTO = {
  /** Nome do evento (marca). O descritivo abaixo é o subtítulo/conceito. */
  nome: "CONEXAO-BIOINFORMÁTICA",
  descritivo: "Do átomo à ação biológica",
  subtitulo:
    "Bioinformática estrutural, inteligência artificial, docking e ADMET, aplicados à Saúde Única, à Farmacologia Veterinária e às Ciências Agrárias.",
  metafora:
    "Investigação guiada em escala molecular: visualizar estruturas, formular hipóteses e reconhecer os limites do modelo.",
  onde: "IFRO Campus Jaru, Jaru/RO",
  quando: "19, 20 e 21 de agosto de 2026",
  cargaHoraria: "7 horas (dois conteúdos de 3h30)",
  contato: "inctconexao@gmail.com",
  publico: "Estudantes de Veterinária e Agronomia e docentes do IFRO Campus Jaru.",
  /** Versão para emendar no meio de frase (sem maiúscula inicial, nomes próprios intactos). */
  publicoInline: "estudantes de Veterinária e Agronomia e docentes do IFRO Campus Jaru",
  semProgramar: "Não é necessário saber programar.",
  /** Chamadas objetivas pedidas pela coordenação. */
  ctaMontar: "Monte seu percurso",
  ctaConfirmar: "Confirmar minha participação",
  privacidade:
    "Usamos seus dados apenas para organizar as turmas, emitir o certificado e dar retorno sobre o curso. Nada é publicado nem compartilhado fora da coordenação do INCT-CONEXAO e do IFRO Campus Jaru.",
  lgpd:
    "Autorizo o INCT-CONEXAO e o IFRO Campus Jaru a usarem os dados acima para organizar minha participação no curso, emitir certificado e entrar em contato. Posso pedir correção ou remoção a qualquer momento pelo e-mail da coordenação.",
} as const;

// =============================================================== AS TURMAS ==
// Uma oferta de cada conteúdo, 7 horas no total. As datas de Conteúdo 1 são em
// dias diferentes (19 ou 20); as de Conteúdo 2 são no mesmo dia (21, manhã ou
// tarde). Qualquer combinação é temporalmente compatível — não há conflito.

export type Turma = {
  readonly id: TurmaC1 | TurmaC2;
  readonly conteudo: 1 | 2;
  readonly data: string; // "2026-08-19"
  readonly diaRotulo: string; // "quarta, 19 de agosto"
  readonly inicio: string; // "14h00"
  readonly fim: string; // "17h30"
};

export const TURMAS_C1: readonly Turma[] = [
  { id: "c1_19ago", conteudo: 1, data: "2026-08-19", diaRotulo: "Quarta, 19 de agosto", inicio: "14h00", fim: "17h30" },
  { id: "c1_20ago", conteudo: 1, data: "2026-08-20", diaRotulo: "Quinta, 20 de agosto", inicio: "14h00", fim: "17h30" },
];

export const TURMAS_C2: readonly Turma[] = [
  { id: "c2_21ago_manha", conteudo: 2, data: "2026-08-21", diaRotulo: "Sexta, 21 de agosto", inicio: "08h00", fim: "11h30" },
  { id: "c2_21ago_tarde", conteudo: 2, data: "2026-08-21", diaRotulo: "Sexta, 21 de agosto", inicio: "14h00", fim: "17h30" },
];

export const TODAS_TURMAS: readonly Turma[] = [...TURMAS_C1, ...TURMAS_C2];

/** Acha uma turma pelo id (para a revisão, o recibo e o painel). */
export function turmaPorId(id: string): Turma | undefined {
  return TODAS_TURMAS.find((t) => t.id === id);
}

/** Frase curta de uma turma: "Quarta, 19 de agosto · 14h00–17h30". */
export function turmaResumo(id: string): string {
  const t = turmaPorId(id);
  return t ? `${t.diaRotulo} · ${t.inicio} às ${t.fim}` : "não escolhida";
}

// ================================================= OS DOIS CONTEÚDOS (módulos)

export type Modulo = {
  readonly numero: 1 | 2;
  /** "Teórico" (Conteúdo 1) ou "Prático" (Conteúdo 2). */
  readonly tipo: "Teórico" | "Prático";
  readonly titulo: string;
  /** Como escolher a turma: "dia" (teórico, 19 ou 20) ou "turno" (prático, 21). */
  readonly escolha: string;
  readonly resumo: string;
  readonly aprende: readonly string[];
  readonly turmas: readonly Turma[];
};

export const MODULOS: readonly Modulo[] = [
  {
    numero: 1,
    tipo: "Teórico",
    titulo: "Estruturas 3D, visualização molecular e IA",
    escolha: "Escolha um dos dois dias (19 ou 20, à tarde). O conteúdo é o mesmo nos dois.",
    resumo:
      "A parte teórica: aprenda a ver uma proteína por dentro (onde o alvo está, o que se liga a ele e de onde vêm as estruturas, do experimento à predição por inteligência artificial). O mesmo conteúdo é oferecido nos dois dias.",
    aprende: [
      "Navegar por uma proteína em 3D no RCSB PDB e no ChimeraX",
      "Localizar ligante, cofator, sítio de ligação e resíduos importantes",
      "Distinguir estrutura experimental, modelagem por homologia e predição por IA (AlphaFold/SWISS-MODEL)",
      "Ler a confiança de um modelo (pLDDT/PAE) e reconhecer onde não confiar",
      "Reconhecer as interações que sustentam o reconhecimento molecular",
    ],
    turmas: TURMAS_C1,
  },
  {
    numero: 2,
    tipo: "Prático",
    titulo: "Docking, interpretação molecular e ADMET",
    escolha: "Escolha um dos dois turnos (dia 21, manhã ou tarde). A aula é a mesma nos dois.",
    resumo:
      "A parte prática, no laboratório: transforme a estrutura em uma hipótese testável (prepare o sistema, rode um docking guiado e leia o resultado com honestidade). A mesma aula acontece de manhã e de tarde no dia 21.",
    aprende: [
      "Preparar receptor e ligante e definir a caixa de docking",
      "Rodar um docking guiado (PyRx/AutoDock Vina) e registrar os parâmetros",
      "Usar redocking como controle e comparar poses, não só o ranking",
      "Interpretar propriedades físico-químicas e alertas ADMET (SwissADME)",
      "Separar interação com o alvo de eficácia, dose e segurança",
    ],
    turmas: TURMAS_C2,
  },
];

/**
 * Teto de vagas por turma, usado só como FALLBACK de exibição quando o banco
 * ainda não respondeu. O número real vem de `curso_vagas` (config da edição). O
 * gêmeo no servidor é `config->>'max_por_turma'` (seed 004) — mude os dois.
 */
export const MAX_VAGAS = 40;

// ======================================================= OS CASOS DO TERRITÓRIO
// Quatro casos-âncora + um caso demonstrativo, todos ligados ao público de Jaru.

export type Caso = {
  readonly id: string;
  readonly alvo: string;
  readonly sistema: string;
  readonly pdb: string;
  readonly ligante: string;
  readonly conexao: string;
  readonly ideia: string;
};

export const CASOS: readonly Caso[] = [
  {
    id: "cox2",
    alvo: "COX-2",
    sistema: "Ciclo-oxigenase-2 + celecoxibe",
    pdb: "3LN1",
    ligante: "Celecoxibe",
    conexao: "Inflamação e farmacologia veterinária",
    ideia: "Como um anti-inflamatório reconhece o alvo, e por que coerência de pose não é o mesmo que seletividade.",
  },
  {
    id: "dhfr",
    alvo: "DHFR",
    sistema: "Di-hidrofolato redutase de E. coli + trimetoprima",
    pdb: "6XG5",
    ligante: "Trimetoprima",
    conexao: "Resistência antimicrobiana e Saúde Única",
    ideia: "O cofator muda o sítio, e a resistência é multicausal. A afinidade prevista não conta a história toda.",
  },
  {
    id: "als",
    alvo: "ALS / AHAS",
    sistema: "Acetohidroxiácido sintase vegetal + chlorsulfuron",
    pdb: "1YHZ",
    ligante: "Chlorsulfuron",
    conexao: "Herbicidas e plantas daninhas na Agronomia",
    ideia: "Classes diferentes de herbicida ocupam o mesmo canal; alterações estruturais podem favorecer resistência.",
  },
  {
    id: "cyp51",
    alvo: "CYP51",
    sistema: "Lanosterol 14-α-desmetilase + fluconazol",
    pdb: "4WMZ",
    ligante: "Fluconazol",
    conexao: "Fungos, azóis e One Health",
    ideia: "A coordenação com o ferro do heme ultrapassa o modelo de docking. O caso ensina onde a ferramenta acaba.",
  },
];

export const CASO_DEMO = {
  alvo: "EPSPS + glifosato",
  pdb: "1G6S",
  ideia:
    "Um caso demonstrativo de Agronomia: contexto conformacional e ligantes auxiliares importam. Remover tudo de uma estrutura pode destruir a própria pergunta biológica.",
} as const;

// ============================================================= AS FERRAMENTAS
// `url` leva ao site oficial de cada ferramenta (o cartão é clicável). Para os
// pares, aponta para a primeira ferramenta nomeada.
export const FERRAMENTAS: readonly {
  readonly nome: string;
  readonly papel: string;
  readonly url: string;
}[] = [
  { nome: "RCSB PDB", papel: "banco de estruturas 3D", url: "https://www.rcsb.org/" },
  { nome: "AlphaFold / SWISS-MODEL", papel: "predição e modelagem por homologia", url: "https://alphafold.ebi.ac.uk/" },
  { nome: "UCSF ChimeraX", papel: "visualização e análise molecular", url: "https://www.cgl.ucsf.edu/chimerax/" },
  { nome: "PyRx / AutoDock Vina", papel: "docking molecular", url: "https://vina.scripps.edu/" },
  { nome: "SwissADME", papel: "propriedades físico-químicas e ADMET", url: "https://www.swissadme.ch/" },
];

// ================================================================== A EQUIPE
// Lattes: Aleff e Anderson de src/content/relato/equipe.json e do ofício
// FAPERO (20/07/2026); Mateus é mestre e atualmente doutorando.
export const EQUIPE: readonly {
  readonly nome: string;
  readonly papel: string;
  readonly lattes: string;
}[] = [
  { nome: "Dr. Aleff Ferreira Francisco", papel: "Coordenação", lattes: "http://lattes.cnpq.br/6740177714494876" },
  { nome: "Dr. Anderson Makoto Kayano", papel: "Docência", lattes: "http://lattes.cnpq.br/9089138319657407" },
  { nome: "Mateus Farias Souza", papel: "Docência · mestre, doutorando", lattes: "http://lattes.cnpq.br/5834687386187545" },
];

/** Salvaguarda científica — dita na página, com todas as letras. */
export const SALVAGUARDA =
  "Curso introdutório e prático. O docking gera hipóteses de pose e prioridade; não demonstra eficácia, seletividade, dose nem segurança. Nada aqui é recomendação clínica, veterinária, agronômica ou regulatória.";

// ===================================================== LISTAS DO FORMULÁRIO ==
// Cada tupla é [token, rótulo]. O token é gêmeo do CHECK da migração 013.

export const VINCULOS: ReadonlyArray<readonly [Vinculo, string]> = [
  ["grad_vet", "Graduando(a) em Medicina Veterinária"],
  ["grad_agro", "Graduando(a) em Engenharia Agronômica"],
  ["grad_outro", "Graduando(a) em outro curso"],
  ["pos_graduando", "Pós-graduando(a)"],
  ["docente", "Docente"],
  ["tecnico", "Técnico(a) / servidor(a)"],
  ["outro", "Outro"],
];

export const SEMESTRES: ReadonlyArray<readonly [string, string]> = [
  ["1", "1º semestre"],
  ["2", "2º semestre"],
  ["3", "3º semestre"],
  ["4", "4º semestre"],
  ["5", "5º semestre"],
  ["6", "6º semestre"],
  ["7", "7º semestre"],
  ["8", "8º semestre"],
  ["9", "9º semestre"],
  ["10", "10º semestre ou mais"],
  ["concluido", "Curso concluído"],
  ["nao_se_aplica", "Não se aplica (docente/técnico)"],
];

export const EXPERIENCIAS: ReadonlyArray<readonly [Experiencia, string]> = [
  ["nenhuma", "Nenhuma: nunca vi uma proteína em 3D"],
  ["basica", "Básica: já vi imagens, mas nunca manipulei"],
  ["intermediaria", "Intermediária: já manipulei estruturas ou fiz docking"],
  ["avancada", "Avançada: uso essas ferramentas com frequência"],
];

// ==================================================================== PASSOS
export type Passo = { readonly id: number; readonly titulo: string; readonly minutos: number };

export const PASSOS: readonly Passo[] = [
  { id: 1, titulo: "Monte seu percurso", minutos: 1 },
  { id: 2, titulo: "Quem é você", minutos: 2 },
  { id: 3, titulo: "Seu ponto de partida", minutos: 1 },
  { id: 4, titulo: "Revisão e confirmação", minutos: 1 },
];
