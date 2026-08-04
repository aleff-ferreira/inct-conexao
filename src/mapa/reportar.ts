/**
 * Reportar erro com o contexto embarcado.
 *
 * O mapa está em revisão científica — que é justamente quando o retorno de quem
 * lê vale mais. Mas o canal era um `mailto:` de assunto invariável
 * ("Mapa interativo (beta)"), e o que chegava era "o número de Tocantins está
 * errado", sem que ninguém descobrisse QUAL número, em QUAL camada, de QUAL
 * safra, nem que aquele total é dengue sozinha.
 *
 * A mecânica vem do npw.scot, que faz a mesma coisa por uma API própria: o
 * relatório carrega automaticamente url, área, viewport, modo e camada de
 * fundo. Aqui não há backend, e não precisa haver — o corpo do e-mail é o
 * transporte, e o conteúdo é o mesmo.
 *
 * DUAS RESSALVAS QUE MUDAM O DESENHO
 * 1. Vários clientes truncam `mailto:` acima de ~2 kB. O corpo é curto de
 *    propósito, e a lista de doenças somadas entra abreviada.
 * 2. Quem não tem cliente de e-mail configurado não vai a lugar nenhum. Por
 *    isso o `href` do link continua sendo um `mailto:` simples e válido — o
 *    contexto é acrescentado no clique, não em vez dele.
 */
import type { Camada } from "./layers";
import type { Uf } from "./types";

export const EMAIL_EQUIPE = "inctconexao@gmail.com";

export type CategoriaErro =
  | "valor-errado"
  | "fonte-errada"
  | "falta-estado"
  | "texto-ficha"
  | "outro";

export const CATEGORIAS: { id: CategoriaErro; label: string }[] = [
  { id: "valor-errado", label: "Um valor está errado" },
  { id: "fonte-errada", label: "A fonte ou a licença está errada" },
  { id: "falta-estado", label: "Falta um estado ou um dado" },
  { id: "texto-ficha", label: "O texto da ficha está errado" },
  { id: "outro", label: "Outro" },
];

export type ContextoErro = {
  categoria: CategoriaErro;
  camada: Camada;
  uf?: Uf | null;
  secao?: string | null;
  /** Doenças efetivamente somadas na UF, quando a camada for de notificações. */
  somadas?: string[];
  geradoEm?: string;
};

/**
 * Monta o `mailto:` com o contexto.
 *
 * O que entra é o que o revisor precisa para AGIR: sem a safra da camada e sem
 * a lista de doenças somadas, "88.065 está errado" é irrespondível.
 */
export function linkDeErro(c: ContextoErro): string {
  const rotulo = CATEGORIAS.find((x) => x.id === c.categoria)?.label ?? "Outro";
  const assunto = `[mapa] ${rotulo} — ${c.camada.label}${c.uf ? ` — ${c.uf.sigla}` : ""}`;

  const l: string[] = [
    "Descreva o que está errado (e, se puder, qual seria o valor certo):",
    "",
    "",
    "---",
    "Contexto preenchido automaticamente — não apague, é o que permite localizar o dado:",
    `Camada: ${c.camada.label} (${c.camada.id})`,
    `Maturidade: ${c.camada.escopo.maturidade} · cobertura ${c.camada.escopo.cobertura.medidas} de ${c.camada.escopo.cobertura.total}`,
    `Fonte: ${c.camada.fonte.titulo}${c.camada.fonte.data ? ` (${c.camada.fonte.data})` : ""}`,
  ];

  if (c.uf) {
    const v = c.camada.rotularValor?.(c.uf) ?? c.camada.valor(c.uf);
    l.push(`Estado: ${c.uf.nome} (${c.uf.sigla})`, `Valor exibido: ${v ?? "sem dado"}`);
  }
  if (c.somadas?.length) {
    // Sem isto o revisor não descobre que o total de TO é dengue sozinha.
    l.push(`Doenças somadas nesta UF: ${c.somadas.join(", ")}`);
  }
  if (c.secao) l.push(`Seção aberta: ${c.secao}`);
  if (c.geradoEm) l.push(`Malha/geometria gerada em: ${c.geradoEm}`);

  l.push(
    `Acesso em: ${new Date().toISOString().slice(0, 10)}`,
    `Endereço: ${typeof window !== "undefined" ? window.location.href : ""}`,
  );

  const corpo = l.join("\n");
  return `mailto:${EMAIL_EQUIPE}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}
