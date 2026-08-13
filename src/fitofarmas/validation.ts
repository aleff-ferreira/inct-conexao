/**
 * ============================================================================
 *  Validações puras do formulário pré-evento
 * ============================================================================
 *  TUDO AQUI É PURO E LOCAL: nenhuma função vai à rede. Mesmo contrato de
 *  `src/relato/validation.ts` — `Validacao { ok, valor, mensagem }`, com `valor`
 *  já na forma canônica de gravar. O ORCID e o ID Lattes são REUSADOS de lá
 *  (são as mesmas regras, com o mesmo dígito verificador); o que existe aqui é
 *  só o que aquele arquivo não tinha.
 *
 *  AS MENSAGENS SÃO CONTRATO. Cada uma diz o que está errado E o caminho de
 *  saída. Trocá-las por "campo inválido" é regressão de produto: quem chegou
 *  por QR code, em pé no corredor, abandona o formulário em vez de adivinhar.
 *
 *  LIMITES DUPLICADOS DE PROPÓSITO. Cada número de `LIMITES` espelha uma
 *  constraint da `008_workshop_fitofarmas.sql`, apontada no comentário. O
 *  cliente recusa antes para a pessoa corrigir em 0 ms; o banco recusa depois
 *  porque cliente nenhum é autoridade.
 * ============================================================================
 */
import { validarLattes, validarOrcid } from "../relato/validation";
import { MAX_DETALHE, MAX_EETS, UFS, UF_EXTERIOR } from "./perguntas";
import type { Respostas } from "./types";

/** Mesmo formato do relato: `valor` é o canônico, pronto para gravar. */
export type Validacao = {
  readonly ok: boolean;
  readonly valor: string;
  readonly mensagem: string;
};

const ok = (valor: string): Validacao => ({ ok: true, valor, mensagem: "" });
const erro = (valor: string, mensagem: string): Validacao => ({ ok: false, valor, mensagem });

// ==================================================================== limites

export const LIMITES = {
  /** `workshop_respostas_nome` check: between 3 and 140. */
  nomeMin: 3,
  nomeMax: 140,
  /** `workshop_respostas.email` check: char_length <= 254 (RFC 5321). */
  emailMax: 254,
  /** `workshop_respostas.telefone` check: <= 32. */
  telefoneMax: 32,
  /** `workshop_respostas_instituicao` check: between 2 and 160. */
  instituicaoMin: 2,
  instituicaoMax: 160,
  /** `workshop_respostas.comentario` check: <= 600. */
  comentarioMax: 600,
  /** `workshop_respostas_detalhe_curto` (trigger): cada valor <= 140. */
  detalheMax: MAX_DETALHE,
  /** `workshop_respostas_eets_teto` check: cardinality(eets) <= 3. */
  eetsMax: MAX_EETS,
} as const;

// ================================================================== mensagens

export const MENSAGENS = {
  nomeCurto: "Escreva seu nome completo: é por ele que a coordenação vai te procurar.",
  nomeLongo: `O nome passou de ${LIMITES.nomeMax} caracteres. Use a forma que você assina.`,
  emailVazio: "Precisamos de um e-mail para dar retorno.",
  emailInvalido: "Confira o endereço: falta o @ ou o domínio (exemplo: nome@instituicao.br).",
  emailLongo: "Esse endereço é longo demais para ser um e-mail válido.",
  telefoneCurto: "O número ficou curto. Inclua o DDD, ou deixe em branco.",
  instituicaoVazia: "Diga a instituição, secretaria, associação ou empresa em que você atua.",
  instituicaoLonga: `Passou de ${LIMITES.instituicaoMax} caracteres. Use a sigla ou o nome curto.`,
  ufInvalida: "Escolha o estado.",
  semVinculo: "Escolha o que melhor descreve o seu vínculo.",
  semInteresse: "Escolha uma das quatro opções: é ela que define o resto do formulário.",
  semSede: "Diga em qual dia você pretende estar. Se ainda não sabe, marque “Ainda não sei”.",
  semEet: "Marque ao menos um eixo. Se nenhum servir, volte e marque “Tenho interesse, mas preciso entender melhor como funciona”.",
  eetsDemais: `Escolha no máximo ${LIMITES.eetsMax} eixos.`,
  semForma: "Marque ao menos uma forma de contribuição.",
  semAporte: "Marque o que você poderia agregar, ou “Nada disso por enquanto”, que é resposta válida.",
  semIniciativa:
    "Marque o que você gostaria de construir, ou “Nenhuma por enquanto”, que é resposta válida.",
  detalheLongo: `Uma linha basta (até ${LIMITES.detalheMax} caracteres). Nomear já é o suficiente.`,
  semDisponibilidade: "Diga quanto tempo consegue dedicar.",
  semHorizonte: "Escolha um prazo.",
  semDecisao: "Diga se você decide ou precisa de aval: é o que define a quem escrevemos.",
  semHistorico: "Responda se já houve colaboração antes.",
  semCompromisso: "Marque ao menos um passo: “Prefiro definir depois do workshop” também é um.",
  semChance: "Escolha um ponto da escala.",
  comentarioLongo: `Passou de ${LIMITES.comentarioMax} caracteres.`,
  semCanal: "Escolha por onde prefere ser procurado(a).",
  semConsentimento: "Sem esta autorização não podemos guardar suas respostas nem te procurar depois.",
  lattes: "O ID Lattes tem 16 números. Cole o endereço inteiro do currículo, que a gente extrai o número.",
} as const;

// ==================================================================== e-mail

/**
 * Conservadora de propósito, e a MESMA expressão do `v_email !~ …` da 008 —
 * se a tela aceitasse o que o banco recusa, a pessoa levaria um erro genérico
 * no envio, depois de tudo preenchido. Não valida existência: o portão de
 * verdade é a resposta humana do outro lado.
 */
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function validarEmail(bruto: string): Validacao {
  const v = bruto.trim().toLowerCase();
  if (!v) return erro("", MENSAGENS.emailVazio);
  if (v.length > LIMITES.emailMax) return erro(v, MENSAGENS.emailLongo);
  // `.invalid` é reservado pela RFC 2606 e nunca entrega — a 008 recusa igual.
  if (!EMAIL_RE.test(v) || v.endsWith(".invalid")) return erro(v, MENSAGENS.emailInvalido);
  return ok(v);
}

// ================================================================== telefone

/**
 * Guarda só os dígitos. Formato brasileiro varia demais ((69) 9 8152-6200,
 * +55 69 98152 6200, 69981526200) e recusar formatação é recusar gente: o
 * campo é opcional e serve para ligar, não para integrar com sistema nenhum.
 */
export function validarTelefone(bruto: string): Validacao {
  const v = bruto.trim();
  if (!v) return ok("");
  const digitos = v.replace(/\D/g, "");
  if (digitos.length < 10 || digitos.length > 15) return erro(v, MENSAGENS.telefoneCurto);
  return ok(v.slice(0, LIMITES.telefoneMax));
}

// ==================================================================== Lattes

/**
 * Aceita o ID de 16 dígitos OU o endereço inteiro do currículo, em qualquer das
 * três formas que o CNPq publica:
 *
 *   http://lattes.cnpq.br/1234567890123456
 *   https://buscatextual.cnpq.br/buscatextual/visualizacv.do?id=K1234567
 *   1234567890123456
 *
 * O `id=K…` NÃO é o ID de 16 dígitos — é o identificador curto da busca
 * textual, e o único jeito honesto de tratá-lo é guardar o endereço como veio.
 * Recusá-lo mandaria a pessoa procurar um número que a página dela não mostra.
 */
export function validarLattesOuUrl(bruto: string): Validacao {
  const v = bruto.trim();
  if (!v) return ok("");

  // Forma canônica publicada pelo CNPq: lattes.cnpq.br/<16 dígitos>.
  const daUrl = v.match(/lattes\.cnpq\.br\/(\d{16})/i);
  if (daUrl) return ok(daUrl[1]);

  // Endereço da busca textual (…/visualizacv.do?id=K1234567): o "K…" NÃO é o ID
  // de 16 dígitos e não há como derivá-lo sem consultar o CNPq. Guarda como
  // veio — recusar mandaria a pessoa procurar um número que a própria página
  // dela não mostra, e o endereço já resolve para quem for conferir.
  if (/^https?:\/\/[\w.-]*cnpq\.br\//i.test(v)) return ok(v.slice(0, 200));

  // Sobrou o número, com ou sem separadores. `validarLattes` dá a mensagem.
  const numero = validarLattes(v);
  return numero.ok ? numero : erro(v, MENSAGENS.lattes);
}

/** Reexportado para a tela não precisar conhecer o módulo do relato. */
export { validarOrcid };

/**
 * Põe as respostas na FORMA CANÔNICA antes de gravar.
 *
 * ARMADILHA QUE ISTO EXISTE PARA FECHAR, e que já estava aberta: a tela aceita
 * o ORCID em três grafias (com hífen, só dígitos, e o endereço inteiro de
 * orcid.org) porque recusar as outras duas seria pedantismo. O banco aceita UMA
 * (`orcid ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$'`, migração 008).
 * Sem esta normalização, quem colasse "https://orcid.org/0000-0002-1825-0097"
 * passava por toda a validação da tela, era recusado pelo CHECK no envio, via
 * "recarregue a página e envie de novo" — e o rascunho restaurava o mesmo valor,
 * fechando um ciclo do qual não havia saída.
 *
 * O mesmo vale para o e-mail (o índice único é sobre `lower(email)`) e para o
 * Lattes (o banco guarda o ID de 16 dígitos ou o endereço, nunca o meio-termo).
 *
 * Chamada em UM lugar só, no envio: normalizar a cada tecla brigaria com o
 * cursor de quem ainda está digitando.
 */
export function normalizarParaEnvio(f: Respostas): Respostas {
  return {
    ...f,
    nome: f.nome.trim(),
    email: validarEmail(f.email).valor,
    telefone: validarTelefone(f.telefone).valor,
    instituicao: f.instituicao.trim(),
    uf: f.uf.trim().toUpperCase(),
    lattes: validarLattesOuUrl(f.lattes).valor,
    orcid: validarOrcid(f.orcid).valor,
    comentario: f.comentario.trim(),
  };
}

// ======================================================= o passo e a pendência

/** Um campo que falta, com o texto que a pessoa lê e o id para onde ir. */
export type Pendencia = { readonly campo: string; readonly mensagem: string };

const vazio = (s: string): boolean => s.trim().length === 0;

/**
 * Valida UM passo e devolve a primeira pendência — validação BLOQUEANTE, ao
 * contrário do relato anual (que é não-bloqueante porque tem sessão e rascunho
 * no servidor). Aqui não há sessão: quem avança com metade do passo em branco
 * chega ao fim e descobre tudo de uma vez. Bloquear cedo custa um clique;
 * bloquear tarde custa a resposta inteira.
 */
export function erroDoPasso(passo: number, f: Respostas): Pendencia | null {
  switch (passo) {
    case 1: {
      const nome = f.nome.trim();
      if (nome.length < LIMITES.nomeMin) return { campo: "nome", mensagem: MENSAGENS.nomeCurto };
      if (nome.length > LIMITES.nomeMax) return { campo: "nome", mensagem: MENSAGENS.nomeLongo };
      const email = validarEmail(f.email);
      if (!email.ok) return { campo: "email", mensagem: email.mensagem };
      const tel = validarTelefone(f.telefone);
      if (!tel.ok) return { campo: "telefone", mensagem: tel.mensagem };
      const inst = f.instituicao.trim();
      if (inst.length < LIMITES.instituicaoMin)
        return { campo: "instituicao", mensagem: MENSAGENS.instituicaoVazia };
      if (inst.length > LIMITES.instituicaoMax)
        return { campo: "instituicao", mensagem: MENSAGENS.instituicaoLonga };
      if (!UFS.includes(f.uf) && f.uf !== UF_EXTERIOR)
        return { campo: "uf", mensagem: MENSAGENS.ufInvalida };
      if (!f.vinculo) return { campo: "vinculo", mensagem: MENSAGENS.semVinculo };
      const lattes = validarLattesOuUrl(f.lattes);
      if (!lattes.ok) return { campo: "lattes", mensagem: lattes.mensagem };
      const orcid = validarOrcid(f.orcid);
      if (!orcid.ok) return { campo: "orcid", mensagem: orcid.mensagem };
      return null;
    }
    case 2: {
      if (!f.interesse) return { campo: "interesse", mensagem: MENSAGENS.semInteresse };
      if (!f.sede) return { campo: "sede", mensagem: MENSAGENS.semSede };
      return null;
    }
    case 3: {
      if (f.eets.length === 0) return { campo: "eets", mensagem: MENSAGENS.semEet };
      if (f.eets.length > LIMITES.eetsMax) return { campo: "eets", mensagem: MENSAGENS.eetsDemais };
      if (f.formas.length === 0) return { campo: "formas", mensagem: MENSAGENS.semForma };
      if (f.aportes.length === 0) return { campo: "aportes", mensagem: MENSAGENS.semAporte };
      for (const [chave, texto] of Object.entries(f.aportes_detalhe)) {
        if ((texto ?? "").trim().length > LIMITES.detalheMax)
          return { campo: `detalhe-${chave}`, mensagem: MENSAGENS.detalheLongo };
      }
      return null;
    }
    case 4: {
      // `iniciativas` é bloqueante como `aportes` e `compromissos`: é o primeiro
      // bloco da tela, pontua até 8, e tem a saída explícita "Nenhuma por
      // enquanto". Deixá-lo passar em branco apagaria a diferença entre "não
      // respondeu" e "respondeu que não" — que é justamente o que a opção
      // exclusiva existe para preservar.
      if (f.iniciativas.length === 0)
        return { campo: "iniciativas", mensagem: MENSAGENS.semIniciativa };
      if (!f.disponibilidade)
        return { campo: "disponibilidade", mensagem: MENSAGENS.semDisponibilidade };
      if (!f.horizonte) return { campo: "horizonte", mensagem: MENSAGENS.semHorizonte };
      if (!f.decisao) return { campo: "decisao", mensagem: MENSAGENS.semDecisao };
      if (!f.historico) return { campo: "historico", mensagem: MENSAGENS.semHistorico };
      if (f.compromissos.length === 0)
        return { campo: "compromissos", mensagem: MENSAGENS.semCompromisso };
      if (!f.chance_1a5) return { campo: "chance_1a5", mensagem: MENSAGENS.semChance };
      return null;
    }
    case 5: {
      // `contarCaracteres` (code points), e não `.length` (unidades UTF-16):
      // é a MESMA conta que o contador embaixo do campo mostra. Com `.length`,
      // um comentário com 590 caracteres dos quais 15 são emoji ou letras fora
      // do BMP exibia "590 de 600" e mesmo assim era barrado no envio — e não
      // havia nada que a pessoa pudesse fazer, porque o número na tela dizia
      // que cabia.
      if (contarCaracteres(f.comentario) > LIMITES.comentarioMax)
        return { campo: "comentario", mensagem: MENSAGENS.comentarioLongo };
      if (!f.canal) return { campo: "canal", mensagem: MENSAGENS.semCanal };
      if (!f.lgpd) return { campo: "lgpd", mensagem: MENSAGENS.semConsentimento };
      return null;
    }
    default:
      return null;
  }
}

/**
 * TODAS as pendências, na ordem dos passos — o resumo do fim, para que a pessoa
 * veja de uma vez o que falta em vez de descobrir campo a campo. Recebe a lista
 * de passos ATIVOS porque quem marcou "só acompanhar" não tem os passos 3 e 4 e
 * não pode ser cobrado por eles.
 */
export function pendenciasDe(f: Respostas, passosAtivos: readonly number[]): Pendencia[] {
  const achadas: Pendencia[] = [];
  for (const passo of passosAtivos) {
    const p = erroDoPasso(passo, f);
    if (p) achadas.push(p);
  }
  return achadas;
}

/** Conta code points, não unidades UTF-16: um emoji é um caractere. */
export function contarCaracteres(texto: string): number {
  return Array.from(texto.trim()).length;
}

/** Rótulo curto de cada pendência, para o botão "Ir para …" do resumo. */
export const ROTULO_CAMPO: Readonly<Record<string, string>> = {
  nome: "nome",
  email: "e-mail",
  telefone: "telefone",
  instituicao: "instituição",
  uf: "estado",
  vinculo: "vínculo",
  lattes: "Lattes",
  orcid: "ORCID",
  interesse: "interesse na rede",
  sede: "dia do evento",
  eets: "eixos",
  formas: "formas de contribuição",
  aportes: "o que você agrega",
  iniciativas: "iniciativas conjuntas",
  disponibilidade: "disponibilidade",
  horizonte: "prazo",
  decisao: "poder de decisão",
  historico: "colaboração anterior",
  compromissos: "próximos passos",
  chance_1a5: "escala de chance",
  comentario: "comentário",
  canal: "canal de contato",
  lgpd: "autorização",
} as const;
