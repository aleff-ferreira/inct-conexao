/**
 * Exportação da camada ativa em CSV.
 *
 * Reusa integralmente o contrato de figura (`src/figuras/csv.ts`): mesmo
 * separador `;`, mesmo escape, mesmo BOM e o mesmo cabeçalho de procedência.
 * Duas implementações do mesmo formato divergem, e a que diverge é sempre a que
 * não tem teste.
 *
 * A REGRA QUE GOVERNA ESTE ARQUIVO
 * Camada com `escopo.comparavel === false` NÃO sai em formato largo com uma
 * coluna de total. Sairia um arquivo em que Tocantins (88.065, dengue sozinha)
 * fica ao lado do Acre (79.324, quatro doenças somadas) na mesma coluna, e
 * qualquer planilha ordenaria isso. O CSV é o formato em que o número viaja
 * mais longe da página que o explica — é onde a ressalva precisa estar mais
 * colada ao dado, não menos.
 */
import { csvEscape } from "../figuras/csv";
import type { Camada } from "./layers";
import { ufs } from "./geo";

const fmt = (n: number) => String(n);

/** Cabeçalho de procedência da camada, no molde de `cabecalhoDeProcedencia`. */
function cabecalho(c: Camada, hoje: string): string {
  const e = c.escopo;
  const l = [
    `# ${c.label}`,
    `# ${c.descricao}`,
    "#",
    `# Fonte: ${c.fonte.titulo}${c.fonte.publicador ? ` — ${c.fonte.publicador}` : ""}`,
  ];
  if (c.fonte.url) l.push(`# URL: ${c.fonte.url}`);
  if (c.fonte.data) l.push(`# Data da fonte: ${c.fonte.data}`);
  l.push(
    `# Maturidade: ${e.maturidade}`,
    `# Cobertura: ${e.cobertura.medidas} de ${e.cobertura.total} unidades federativas com valor medido`,
    `# O que este número NÃO mede: ${e.naoMede}`,
  );
  if (!e.comparavel) {
    l.push(
      "#",
      "# ATENÇÃO: os valores desta camada NÃO são comparáveis entre unidades",
      "# federativas. Não ordene nem some esta coluna: cada linha pode medir um",
      "# conjunto diferente de coisas. Por isso o arquivo sai em formato longo,",
      "# sem coluna de total.",
    );
  }
  l.push("#", `# Extraído de https://inct-conexao.com.br/#/mapa?camada=${c.id} em ${hoje}`, "#");
  return l.join("\n");
}

/**
 * CSV da camada. Formato largo (uma linha por UF) quando comparável; caso
 * contrário, uma linha por UF com o rótulo textual em vez do número solto.
 */
export function csvDaCamada(c: Camada, hoje = new Date().toISOString().slice(0, 10)): string {
  const comparavel = c.escopo.comparavel;

  const colunas = comparavel
    ? ["uf", "sigla", "regiao", "amazonia_legal", "valor", "rotulo"]
    : ["uf", "sigla", "regiao", "amazonia_legal", "rotulo", "comparavel_entre_ufs"];

  const linhas = ufs
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .map((u) => {
      const v = c.valor(u);
      const rotulo = c.rotularValor?.(u) ?? "";
      const base = [u.nome, u.sigla, u.regiao, u.amazoniaLegal ?? "não"];
      /* `null` sai como célula VAZIA, nunca como 0: numa planilha, zero é uma
         medição de valor zero, e ausência de dado não é isso. */
      return comparavel
        ? [...base, v == null ? "" : fmt(v), rotulo]
        : [...base, rotulo, "não"];
    });

  const corpo = [colunas.join(";"), ...linhas.map((l) => l.map(csvEscape).join(";"))].join("\n");
  return `﻿${cabecalho(c, hoje)}\n${corpo}\n`;
}

/** Dispara o download. Mesmo padrão de `figuras/csv.ts`: data URI, sem blob a revogar. */
export function baixarCsvDaCamada(c: Camada): void {
  const a = document.createElement("a");
  a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csvDaCamada(c))}`;
  a.download = `inct-mapa-${c.id}.csv`;
  a.click();
}
