/**
 * ============================================================================
 *  Área "Fitofarmas" dentro da Gestão (#/gestao?area=fitofarmas)
 * ============================================================================
 *  Carregada com `lazy()` DENTRO de Gestao.tsx, no mesmo desenho do
 *  PainelRelatorio: o portal do processo seletivo não paga pelo código do
 *  workshop, e vice-versa.
 *
 *  O QUE ESTA TELA É — e o que ela não é
 *  -------------------------------------
 *   • É a leitura da coordenação sobre as respostas do formulário pré-evento:
 *     métricas de campanha, a lista priorizada por escore, a ficha de cada
 *     pessoa e o CSV para levar ao Excel.
 *   • Quase não é superfície de escrita: tudo aqui é `select` na view
 *     `workshop_prioridade`, com UMA exceção deliberada (decisão do dono,
 *     13/08/2026): a exclusão DEFINITIVA (LGPD) na ficha, exclusiva de
 *     SuperAdministrador, guardada pela RPC da migração 015 e por confirmação
 *     digitada (nunca a um clique de distância). Corrigir resposta continua
 *     sendo pelo SQL Editor (docs/fitofarmas-pre-evento.md §6).
 *   • NÃO decide permissão. Quem decide é a RLS da 008 (`is_admin()`); esta
 *     tela só EXPLICA a recusa em vez de mostrar tabela vazia sem motivo —
 *     para não-admin a RLS devolve zero linhas, não erro, e a tela que confia
 *     no resultado diria "ninguém respondeu" a quem não podia ver.
 *
 *  O ESCORE NUNCA É RECALCULADO AQUI. A view manda `escore_intencao`, `faixa`
 *  e `aportes_nomeados` prontos; o painel exibe. Recalcular no cliente é como
 *  a régua diverge em silêncio — e `tests/fitofarmas-painel.test.ts` confere
 *  que este arquivo não importa `escoreDe`.
 * ============================================================================
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  ExternalLink,
  Leaf,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Users,
} from "lucide-react";
import { toCsv } from "../platform/api";
import { FITOFARMAS_HREF } from "../webinars/router";
import { ApagarDefinitivo } from "../ui/ApagarDefinitivo";
import { apagarResposta, fitofarmasDisponivel, listarRespostasDoPainel } from "./api";
import {
  calcularMetricas,
  filtrarLinhas,
  linhasParaCsv,
  rotuloDe,
  tituloDoAporte,
  type Filtros,
  type RespostaPainel,
} from "./metricas";
import {
  CANAIS,
  COMPROMISSOS,
  DECISOES,
  DISPONIBILIDADES,
  EETS,
  FORMAS,
  HISTORICOS,
  HORIZONTES,
  INICIATIVAS,
  INTERESSES,
  SEDES,
  TEXTO,
  VINCULOS,
} from "./perguntas";
import { ROTULO_FAIXA } from "./escore";
import type { Faixa } from "./types";

const SEM_FILTROS: Filtros = { busca: "", faixa: "", sede: "" };

/** Selo da faixa — cor no vocabulário dos chips que a Gestão já usa. */
function ChipFaixa({ faixa }: { faixa: Faixa }) {
  const variante =
    faixa === "prioritario" ? "rel-chip rel-chip--ok"
    : faixa === "promissor" ? "rel-chip rel-chip--eet"
    : faixa === "acompanhar" ? "rel-chip rel-chip--aviso"
    : "rel-chip rel-chip--comite";
  // Só a primeira palavra: o rótulo completo ("Prioritário — procurar antes…")
  // é dica de coluna, não selo de linha.
  const curto = (ROTULO_FAIXA[faixa] ?? faixa).split(": ")[0];
  return <span className={variante}>{curto}</span>;
}

export default function PainelFitofarmas({ isAdmin, isSuper = false }: { isAdmin: boolean; isSuper?: boolean }) {
  const [linhas, setLinhas] = useState<RespostaPainel[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  const [aberta, setAberta] = useState<RespostaPainel | null>(null);

  const carregar = () => {
    if (!isAdmin || !fitofarmasDisponivel()) return;
    setCarregando(true);
    void listarRespostasDoPainel().then((r) => {
      setCarregando(false);
      if (r.ok) {
        setLinhas(r.linhas);
        setErro("");
      } else {
        setLinhas(null);
        setErro(r.mensagem);
      }
    });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(carregar, [isAdmin]);

  const metricas = useMemo(() => calcularMetricas(linhas ?? []), [linhas]);
  const visiveis = useMemo(() => filtrarLinhas(linhas ?? [], filtros), [linhas, filtros]);

  // ---------------------------------------------------------------- guardas
  if (!isAdmin) {
    return (
      <div className="plat-card plat-notice">
        <Lock size={20} aria-hidden="true" />
        <div>
          <strong>Área restrita a administradores</strong>
          <p>
            As respostas do workshop têm dados de contato pessoais, e por isso só o papel de admin as
            enxerga. A regra é do banco (migração 008), não desta tela. Peça a um administrador para
            promover seu perfil, se for o caso.
          </p>
        </div>
      </div>
    );
  }
  if (erro) {
    return (
      <div className="plat-card plat-notice">
        <CalendarClock size={20} aria-hidden="true" />
        <div>
          <strong>As respostas ainda não estão acessíveis</strong>
          <p>{erro}</p>
          <p>
            <button className="button plat-ghost" onClick={carregar}>
              <RefreshCw size={15} aria-hidden="true" /> Tentar de novo
            </button>
          </p>
        </div>
      </div>
    );
  }
  if (carregando || linhas === null) {
    return (
      <div className="plat-loading">
        <Loader2 size={22} aria-hidden="true" /> Carregando as respostas do workshop…
      </div>
    );
  }

  // ------------------------------------------------------- ficha individual
  if (aberta) {
    return (
      <Ficha
        linha={aberta}
        aoVoltar={() => setAberta(null)}
        isSuper={isSuper}
        aoApagada={() => {
          setAberta(null);
          carregar();
        }}
      />
    );
  }

  // ---------------------------------------------------------------- o painel
  return (
    <div className="plat-eval">
      <div className="plat-card">
        <h2>
          <Leaf size={18} aria-hidden="true" /> {TEXTO.titulo}: respostas pré-evento
        </h2>
        <p className="plat-muted">
          {TEXTO.quando}. O formulário público está em{" "}
          <a href={FITOFARMAS_HREF}>
            {FITOFARMAS_HREF} <ExternalLink size={12} aria-hidden="true" />
          </a>
          . O escore e a faixa são calculados pelo servidor a partir do que custa mais responder:
          compromissos assumidos e ativos nomeados pesam mais que autodeclaração (a régua completa está
          em docs/fitofarmas-pre-evento.md, §4).
        </p>

        {linhas.length === 0 ? (
          <p className="plat-empty">
            Nenhuma resposta ainda. O número aparece aqui assim que a primeira pessoa enviar o
            formulário. Confira se a divulgação já saiu e se a edição está aberta no banco.
          </p>
        ) : (
          <>
            {/* -------------------------------------------------- métricas */}
            <div className="plat-stats">
              <div className="plat-stat">
                <strong>{metricas.total}</strong>
                <span>respostas{metricas.corrigidas ? ` · ${metricas.corrigidas} corrigidas` : ""}</span>
              </div>
              <div className="plat-stat">
                <strong>{metricas.escoreMedio}</strong>
                <span>escore médio (0 a 100)</span>
              </div>
              <div className="plat-stat">
                <strong>{metricas.dia25PortoVelho}</strong>
                <span>dia 25 · Porto Velho</span>
              </div>
              <div className="plat-stat">
                <strong>{metricas.dia27Cacoal}</strong>
                <span>dia 27 · Cacoal</span>
              </div>
              <div className="plat-stat">
                <strong>{metricas.aportesNomeados}</strong>
                <span>ativos nomeados (o sinal caro)</span>
              </div>
              <div className="plat-stat">
                <strong>{metricas.jaColaboraram}</strong>
                <span>já colaboraram com a rede</span>
              </div>
            </div>

            {/* As quatro faixas — "com quem eu sento no dia 25?" */}
            <div className="plat-stats">
              {metricas.porFaixa.map((f) => (
                <div key={f.id} className="plat-stat" title={f.rotulo}>
                  <strong>{f.total}</strong>
                  <span>{f.rotulo.split(": ")[0].toLowerCase()}</span>
                </div>
              ))}
              {metricas.soOnline || metricas.semDiaDefinido ? (
                <div className="plat-stat">
                  <strong>
                    {metricas.soOnline}+{metricas.semDiaDefinido}
                  </strong>
                  <span>só on-line + dia indefinido</span>
                </div>
              ) : null}
            </div>

            {/* ---------------------------------- onde a rede vai crescer */}
            <div className="plat-eval-grid">
              <TabelaContagem
                titulo="Compromissos assumidos"
                dica="O dado mais útil para agir: em outubro, volte a esta lista item por item."
                contagens={metricas.porCompromisso}
              />
              <TabelaContagem titulo="Eixos mais marcados" contagens={metricas.porEet.slice(0, 8)} />
              <TabelaContagem titulo="Quem respondeu (vínculo)" contagens={metricas.porVinculo} />
            </div>

            {/* -------------------------------------------------- filtros */}
            <div className="plat-filters">
              <input
                type="search"
                placeholder="Buscar por nome, instituição, e-mail ou protocolo…"
                aria-label="Buscar respostas"
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              />
              <select
                aria-label="Filtrar por faixa"
                value={filtros.faixa}
                onChange={(e) => setFiltros({ ...filtros, faixa: e.target.value as Filtros["faixa"] })}
              >
                <option value="">Todas as faixas</option>
                {(Object.keys(ROTULO_FAIXA) as Faixa[]).map((f) => (
                  <option key={f} value={f}>
                    {ROTULO_FAIXA[f]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filtrar por dia"
                value={filtros.sede}
                onChange={(e) => setFiltros({ ...filtros, sede: e.target.value })}
              >
                <option value="">Todos os dias</option>
                {SEDES.map(([id, rotulo]) => (
                  <option key={id} value={id}>
                    {rotulo}
                  </option>
                ))}
              </select>
              <button className="button plat-ghost" onClick={() => baixarCsv(visiveis)}>
                <Download size={15} aria-hidden="true" /> Exportar CSV ({visiveis.length})
              </button>
            </div>

            {/* ---------------------------------------------------- a lista */}
            {visiveis.length === 0 ? (
              <p className="plat-empty">Nenhuma resposta com estes filtros.</p>
            ) : (
              <div className="plat-list">
                {visiveis.map((l) => (
                  <button key={l.id} type="button" className="plat-app-row" onClick={() => setAberta(l)}>
                    <div>
                      <h3>
                        {l.nome} <ChipFaixa faixa={l.faixa} />
                      </h3>
                      <p>
                        {l.instituicao}
                        {l.uf ? ` · ${l.uf}` : ""} · {rotuloDe(VINCULOS, l.vinculo)} ·{" "}
                        {rotuloDe(SEDES, l.sede)}
                      </p>
                      <p className="plat-muted">
                        {l.compromissos.length} compromisso(s) · {l.aportes_nomeados} ativo(s) nomeado(s)
                        {l.protocolo ? ` · ${l.protocolo}` : ""}
                      </p>
                    </div>
                    <span className="plat-protocolo" title="Escore de intenção (0 a 100)">
                      {l.escore_intencao}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================ contagens ====

function TabelaContagem({
  titulo,
  dica,
  contagens,
}: {
  titulo: string;
  dica?: string;
  contagens: ReadonlyArray<{ id: string; rotulo: string; total: number }>;
}) {
  const comDado = contagens.filter((c) => c.total > 0);
  if (!comDado.length) return null;
  return (
    <div className="plat-card">
      <h3>{titulo}</h3>
      {dica ? <p className="plat-hint">{dica}</p> : null}
      <div className="rel-tabela-rolo">
        <table className="rel-tabela">
          <tbody>
            {comDado.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.rotulo}</th>
                <td className="num">{c.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======================================================= ficha da pessoa ===

function Ficha({
  linha,
  aoVoltar,
  isSuper,
  aoApagada,
}: {
  linha: RespostaPainel;
  aoVoltar: () => void;
  isSuper: boolean;
  aoApagada: () => void;
}) {
  const l = linha;
  const aportesComDetalhe = l.aportes.map((a) => {
    const detalhe = (l.aportes_detalhe[a] ?? "").trim();
    return detalhe ? `${tituloDoAporte(a)}: ${detalhe}` : tituloDoAporte(a);
  });

  return (
    <div className="plat-eval">
      <button className="plat-back plat-back-btn" onClick={aoVoltar}>
        <ArrowLeft size={15} aria-hidden="true" /> Voltar à lista
      </button>

      <div className="plat-card">
        <h2>
          {l.nome} <ChipFaixa faixa={l.faixa} />{" "}
          <span className="plat-protocolo" title="Escore de intenção (0 a 100)">
            {l.escore_intencao}
          </span>
        </h2>
        <p className="plat-muted">
          {l.protocolo ? `${l.protocolo} · ` : ""}
          enviada em {new Date(l.created_at).toLocaleString("pt-BR")}
          {l.updated_at > l.created_at
            ? ` · corrigida em ${new Date(l.updated_at).toLocaleString("pt-BR")}`
            : ""}
        </p>

        <div className="plat-review">
          <div>
            <dt>Contato</dt>
            <dd>
              <a href={`mailto:${l.email}`}>
                <Mail size={13} aria-hidden="true" /> {l.email}
              </a>
              {l.telefone ? (
                <>
                  {" · "}
                  <Phone size={13} aria-hidden="true" /> {l.telefone}
                </>
              ) : null}
              {" · prefere "}
              {rotuloDe(CANAIS, l.canal)}
            </dd>
          </div>
          <div>
            <dt>Instituição</dt>
            <dd>
              {l.instituicao}
              {l.uf ? ` · ${l.uf}` : ""} · {rotuloDe(VINCULOS, l.vinculo)}
            </dd>
          </div>
          {l.lattes || l.orcid ? (
            <div>
              <dt>Currículo</dt>
              <dd>
                {l.lattes ? (
                  <a
                    href={/^https?:/.test(l.lattes) ? l.lattes : `http://lattes.cnpq.br/${l.lattes}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lattes <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : null}
                {l.lattes && l.orcid ? " · " : ""}
                {l.orcid ? (
                  <a href={`https://orcid.org/${l.orcid}`} target="_blank" rel="noreferrer">
                    ORCID {l.orcid} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : null}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Interesse na rede</dt>
            <dd>{rotuloDe(INTERESSES, l.interesse)}</dd>
          </div>
          <div>
            <dt>
              <MapPin size={13} aria-hidden="true" /> Dia do evento
            </dt>
            <dd>{rotuloDe(SEDES, l.sede)}</dd>
          </div>
          {l.eets.length ? (
            <div>
              <dt>Eixos</dt>
              <dd>{l.eets.map((e) => rotuloDe(EETS, e)).join(" · ")}</dd>
            </div>
          ) : null}
          {l.formas.length ? (
            <div>
              <dt>Formas de contribuição</dt>
              <dd>{l.formas.map((f) => rotuloDe(FORMAS, f)).join(" · ")}</dd>
            </div>
          ) : null}
          {aportesComDetalhe.length ? (
            <div>
              <dt>
                <Users size={13} aria-hidden="true" /> O que agrega ({l.aportes_nomeados} nomeado(s))
              </dt>
              <dd>{aportesComDetalhe.join(" · ")}</dd>
            </div>
          ) : null}
          {l.iniciativas.length ? (
            <div>
              <dt>Quer construir</dt>
              <dd>{l.iniciativas.map((i) => rotuloDe(INICIATIVAS, i)).join(" · ")}</dd>
            </div>
          ) : null}
          {l.compromissos.length ? (
            <div>
              <dt>Compromissos assumidos</dt>
              <dd>{l.compromissos.map((c) => rotuloDe(COMPROMISSOS, c)).join(" · ")}</dd>
            </div>
          ) : null}
          {l.disponibilidade ? (
            <div>
              <dt>Disponibilidade e prazo</dt>
              <dd>
                {rotuloDe(DISPONIBILIDADES, l.disponibilidade)} · {rotuloDe(HORIZONTES, l.horizonte)}
              </dd>
            </div>
          ) : null}
          {l.decisao ? (
            <div>
              <dt>Decisão e histórico</dt>
              <dd>
                {rotuloDe(DECISOES, l.decisao)} · {rotuloDe(HISTORICOS, l.historico)}
                {l.chance_1a5 ? ` · chance ${l.chance_1a5}/5` : ""}
              </dd>
            </div>
          ) : null}
          {l.comentario ? (
            <div>
              <dt>Comentário</dt>
              <dd>{l.comentario}</dd>
            </div>
          ) : null}
        </div>

        {/* Só superadmin VÊ a zona; a permissão real é a trava da RPC (015). */}
        {isSuper ? (
          <ApagarDefinitivo
            alvo={`a resposta ${l.protocolo ?? "sem protocolo"} (${l.nome})`}
            confirmacao={l.protocolo ?? l.email}
            aoApagar={() => apagarResposta(l.id)}
            aoApagada={aoApagada}
          />
        ) : null}
      </div>
    </div>
  );
}

// ================================================================= CSV =====

/**
 * Baixa o CSV do que está FILTRADO — exportar o filtro é o que a coordenação
 * espera ("me dá só os prioritários de Cacoal"). Excel pt-BR abre `;` como
 * separador nativo (o `toCsv` da plataforma já usa `;` por isso).
 */
function baixarCsv(linhas: readonly RespostaPainel[]): void {
  const csv = toCsv(linhasParaCsv(linhas));
  if (!csv) return;
  // BOM explícito (\uFEFF): sem ele o Excel do Windows lê o UTF-8 como Latin-1
  // e "instituição" vira "instituiÃ§Ã£o" — na planilha que vai circular pela
  // coordenação. Escrito como escape, nunca como caractere invisível no fonte.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `fitofarmas-respostas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
