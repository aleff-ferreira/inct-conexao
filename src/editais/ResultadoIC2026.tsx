/**
 * Resultado do Processo Seletivo Simplificado Nº 04/2026 (IC/CNPq).
 *
 * Esta página é um ATO PÚBLICO, não uma notícia. O que ela precisa entregar,
 * nessa ordem:
 *
 *   1. Que a pessoa ache o próprio nome em segundos, inclusive de celular e
 *      inclusive digitando sem acento — é isso que ela veio fazer.
 *   2. Que o resultado seja citável: número do edital e data de divulgação.
 *      Esta página É a divulgação oficial do resultado, e não a reprodução de
 *      um documento que estaria em outro lugar — por isso ela não remete a
 *      nenhuma outra autoridade nem promete um PDF que não existe.
 *   3. Que não exponha nada além do necessário. Nome, orientador e estado.
 *      Sem nota, sem classificação, sem CPF, sem parecer — o processo publica
 *      o RESULTADO, não a avaliação.
 *
 * A lista inteira fica no HTML desde o primeiro quadro: filtrar esconde
 * visualmente, nunca remove do documento. Quem imprime, quem usa leitor de
 * tela e quem tem a busca do navegador (Ctrl+F) continuam alcançando os 50.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Search } from "lucide-react";
import resultado from "../content/editais/resultado-ic-2026.json";
import { EDITAL_HREF } from "../webinars/router";

/** Mesma convenção de `EditalIC2026.tsx:20` e `App.tsx:194`. */
const asset = (fileName: string) => `${import.meta.env.BASE_URL}assets/${fileName}`;

type Selecionado = { nome: string; orientador: string };
type EstadoResultado = { sigla: string; nome: string; selecionados: Selecionado[] };

/** Sem acento, sem caixa: quem procura "jose" tem de achar "José". */
function chave(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

const ESTADOS = resultado.estados as EstadoResultado[];
const TOTAL = ESTADOS.reduce((n, e) => n + e.selecionados.length, 0);
const SIGLAS = new Set(ESTADOS.map((e) => chave(e.sigla)));

/**
 * Uma linha combina com a busca?
 *
 * Sigla de estado é caso à parte: "RO" como substring cai dentro de "Pedro",
 * "Carolina" e "Roberta", e devolvia 36 resultados em 7 estados para quem só
 * queria Rondônia. Quando o termo é exatamente uma sigla da lista, a busca
 * passa a ser por estado.
 */
function combinaCom(alvo: string, e: EstadoResultado, s: Selecionado): boolean {
  if (!alvo) return true;
  if (SIGLAS.has(alvo)) return chave(e.sigla) === alvo;
  return (
    chave(s.nome).includes(alvo) ||
    chave(s.orientador).includes(alvo) ||
    chave(e.nome).includes(alvo)
  );
}

function dataBR(iso: string | null): string | null {
  if (!iso) return null;
  const [a, m, d] = iso.split("-");
  return d && m && a ? `${d}/${m}/${a}` : null;
}

export default function ResultadoIC2026() {
  const [busca, setBusca] = useState("");
  const alvo = chave(busca);

  /* O filtro marca, não remove: cada linha sabe se combina, e o CSS esconde as
     que não combinam. Assim o documento continua completo para impressão,
     leitor de tela e Ctrl+F do navegador. */
  const { estados, achados } = useMemo(() => {
    if (!alvo) return { estados: ESTADOS.map((e) => ({ ...e, visiveis: e.selecionados.length })), achados: TOTAL };
    let n = 0;
    const lista = ESTADOS.map((e) => {
      const visiveis = e.selecionados.filter((s) => combinaCom(alvo, e, s)).length;
      n += visiveis;
      return { ...e, visiveis };
    });
    return { estados: lista, achados: n };
  }, [alvo]);

  const combina = (e: EstadoResultado, s: Selecionado) => combinaCom(alvo, e, s);

  const divulgado = dataBR(resultado.divulgadoEm);

  return (
    <main id="conteudo" className="res-band" tabIndex={-1}>
      <div className="res-inner">
        <a className="res-voltar" href={EDITAL_HREF}>
          <ArrowLeft size={15} aria-hidden /> Voltar ao edital
        </a>

        <header className="res-head">
          <p className="res-kicker">Processo Seletivo Simplificado {resultado.edital}</p>
          <h1 className="res-h1">Resultado: selecionados e orientadores</h1>
          <p className="res-lede">{resultado.titulo}. {resultado.escopo}</p>

          <dl className="res-meta">
            <div>
              <dt>Edital</dt>
              <dd>{resultado.edital}</dd>
            </div>
            <div>
              <dt>Bolsas concedidas</dt>
              <dd>{TOTAL}</dd>
            </div>
            <div>
              <dt>Unidades da federação</dt>
              <dd>{ESTADOS.length}</dd>
            </div>
            <div>
              {/* "Divulgação do resultado" é a expressão do próprio cronograma
                  do edital. Esta data é o ato, não o registro de um ato feito
                  em outro lugar. */}
              <dt>Divulgação do resultado</dt>
              <dd>{divulgado}</dd>
            </div>
          </dl>

          <div className="res-docs">
            <a className="res-doc" href={asset("edital-selecao-ic-2026.pdf")} download>
              <Download size={16} aria-hidden /> Edital completo (PDF)
            </a>
          </div>
        </header>

        <div className="res-busca">
          <label htmlFor="res-q">
            <Search size={16} aria-hidden /> Procurar por nome, orientador ou estado
          </label>
          <input
            id="res-q"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite seu nome…"
            autoComplete="off"
            enterKeyHint="search"
          />
          <p className="res-contagem" role="status" aria-live="polite">
            {alvo
              ? `${achados} de ${TOTAL} ${achados === 1 ? "resultado" : "resultados"}`
              : `${TOTAL} selecionados em ${ESTADOS.length} unidades da federação`}
          </p>
        </div>

        {alvo && achados === 0 ? (
          <p className="res-vazio">
            Nenhum nome corresponde a “{busca}”. Confira a grafia ou limpe a busca para ver a lista completa.
            A ausência aqui não substitui a consulta ao documento oficial.
          </p>
        ) : null}

        {estados.map((e) => (
          <section key={e.sigla} className="res-uf" hidden={alvo ? e.visiveis === 0 : false}>
            <h2 className="res-uf-titulo">
              {e.nome} <span className="res-uf-sigla">({e.sigla})</span>
              <span className="res-uf-conta">
                {e.selecionados.length} {e.selecionados.length === 1 ? "selecionado" : "selecionados"}
              </span>
            </h2>
            <table className="res-tabela">
              <caption className="res-tabela-cap">
                Selecionados e orientadores: {e.nome}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Selecionado(a)</th>
                  <th scope="col">Orientador(a)</th>
                </tr>
              </thead>
              <tbody>
                {e.selecionados.map((s) => (
                  <tr key={s.nome} hidden={!combina(e, s)}>
                    <th scope="row">{s.nome}</th>
                    <td>{s.orientador}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        <section className="res-panorama" aria-labelledby="res-panorama-h">
          <h2 id="res-panorama-h">O processo em números</h2>
          {/* Cada número traz a definição junto. Número grande sozinho é
              propaganda; com denominador, é informação. */}
          <dl className="res-numeros">
            {Object.entries(resultado.panorama).map(([id, n]) => (
              <div key={id}>
                <dt>
                  <strong>{n.valor}</strong> {n.rotulo}
                </dt>
                <dd>{n.definicao}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="res-rodape">
          Esta página é a divulgação oficial do resultado do Processo Seletivo Simplificado {resultado.edital},
          nos termos do cronograma do edital. Dúvidas e pedidos de esclarecimento devem ser encaminhados à
          coordenação do INCT-CONEXAO pelos canais indicados no edital.
        </p>
      </div>
    </main>
  );
}
