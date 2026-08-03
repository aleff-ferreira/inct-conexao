/**
 * CSV: a versão canônica.
 *
 * Duas decisões já tomadas no projeto e mantidas aqui, porque o público é o
 * mesmo: separador `;` e BOM. Excel em português lê `,` como separador decimal,
 * então um CSV com vírgula chega ao pesquisador com tudo numa coluna só; e sem
 * BOM ele lê "Rondônia" como "RondÃ´nia". Ver `src/platform/Gestao.tsx:640`.
 *
 * `audit.ts` tinha suas próprias cópias de `csvEscape`/`toCsv`, privadas. Agora
 * importa daqui: duas implementações de escape do mesmo formato divergem, e a
 * que diverge é sempre a que não tem teste.
 */
import type { Coluna, Figura, Linha, Valor } from "./tipos";

/** Escapa uma célula. Aspas, `;`, `,` e quebra de linha forçam aspas. */
export function csvEscape(v: Valor | boolean): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Tabela → CSV. As colunas saem na ordem das chaves do primeiro registro. */
export function toCsv(records: Array<Record<string, Valor | boolean>>): string {
  if (!records.length) return "";
  const headers = Object.keys(records[0]);
  return [
    headers.join(";"),
    ...records.map((r) => headers.map((h) => csvEscape(r[h])).join(";")),
  ].join("\n");
}

/**
 * Cabeçalho de procedência, em linhas de comentário antes da tabela.
 *
 * Vai no arquivo, e não só na página, porque o CSV viaja: ele acaba numa pasta
 * de downloads, num anexo de e-mail, na planilha de outra pessoa. Separado da
 * página, um CSV sem fonte e sem data é um dado órfão — e dado órfão em ciência
 * é dado que não se pode usar. É o mesmo motivo pelo qual o OWID carimba fonte
 * e ano dentro da imagem.
 */
export function cabecalhoDeProcedencia(fig: Figura, colunas: Coluna[]): string {
  const l = [
    `# ${fig.titulo}`,
    `# ${fig.subtitulo}`,
    "#",
    `# Fonte: ${fig.fonte.titulo} — ${fig.fonte.publicador} (${fig.fonte.ano})`,
    `# URL: ${fig.fonte.url}`,
    `# Licença: ${fig.fonte.licenca}`,
  ];
  if (fig.fonte.nota) l.push(`# Nota: ${fig.fonte.nota}`);
  l.push("#", "# Colunas:");
  for (const c of colunas) {
    l.push(`#   ${c.chave} — ${c.definicao}${c.unidade ? ` (${c.unidade})` : ""}`);
  }
  l.push("#", `# Compilado por INCT-CONEXAO · https://inct-conexao.com.br/#/figura/${fig.id}`, "#");
  return l.join("\n");
}

/** O arquivo completo: BOM, procedência e tabela. */
export function csvDaFigura(fig: Figura): string {
  const linhas = fig.linhas();
  return `﻿${cabecalhoDeProcedencia(fig, fig.colunas)}\n${toCsv(linhas as Array<Record<string, Valor>>)}\n`;
}

/**
 * Dispara o download sem servidor e sem `URL.createObjectURL`.
 *
 * Blob exigiria `revokeObjectURL` depois, e esquecer disso vaza memória a cada
 * clique. Data URI não tem esse passo. Mesmo padrão de `WebinarEvent.tsx:167`.
 */
export function baixarCsv(fig: Figura): void {
  const a = document.createElement("a");
  a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvDaFigura(fig))}`;
  a.download = `${fig.id}.csv`;
  a.click();
}

/** Só para conferência em teste: a tabela sem BOM e sem comentários. */
export function tabelaDaFigura(fig: Figura): string {
  return toCsv(fig.linhas() as Array<Record<string, Valor>>);
}

export type { Linha };
