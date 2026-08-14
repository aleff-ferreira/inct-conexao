/**
 * ============================================================================
 *  Área "Curso" dentro da Gestão (#/gestao?area=curso)
 * ============================================================================
 *  Carregada com `lazy()` DENTRO de Gestao.tsx, no mesmo desenho do
 *  PainelFitofarmas: leitura da coordenação sobre as inscrições do curso.
 *
 *  DUAS CAMADAS, PROPÓSITOS DIFERENTES
 *  -----------------------------------
 *   1. CARTÃO DE DIVULGAÇÃO (`PainelDivulgacao`): o número de inscritos, o perfil
 *      da turma e os gráficos, num cartão de marca pensado para ser CAPTURADO e
 *      postado nas redes — chamar atenção ao alcance do curso, sem expor nenhum
 *      dado pessoal (só contagens e proporções).
 *   2. OPERAÇÃO: filtros, a lista priorizada e a ficha de cada pessoa (com
 *      contato) + o CSV. Essa camada tem dado pessoal e nunca vai para print.
 *
 *  Quase não é superfície de escrita: tudo é `select` na view `curso_inscritos`,
 *  com UMA exceção deliberada: a exclusão DEFINITIVA (LGPD) na ficha, que só
 *  SuperAdministrador vê e que chama a RPC da migração 015 (a linha e as
 *  versões somem juntas; a vaga volta a contar como livre). Corrigir inscrição
 *  segue sendo pelo SQL Editor (migração 013). Esta tela NÃO decide permissão:
 *  quem decide é a RLS da 013 (`is_admin()`) e a trava de superadmin da 015;
 *  para não-admin a RLS devolve ZERO LINHAS (não erro), por isso a tela checa
 *  o papel ANTES.
 * ============================================================================
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Camera,
  Download,
  ExternalLink,
  GraduationCap,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
} from "lucide-react";
import { toCsv } from "../platform/api";
import { CURSO_HREF } from "../webinars/router";
import { ApagarDefinitivo } from "../ui/ApagarDefinitivo";
import { NumeroQueConta } from "../ui/NumeroQueConta";
import { MoleculaMini } from "./Molecula";
import { apagarInscricao, cursoDisponivel, listarInscritosDoPainel } from "./api";
import { EXPERIENCIAS, MAX_VAGAS, SEMESTRES, TEXTO, TODAS_TURMAS, turmaResumo, VINCULOS } from "./conteudo";
import type { InscritoPainel } from "./types";

/** Rótulo de um token numa lista [token, rótulo]. */
function rotuloDe<T extends string>(lista: ReadonlyArray<readonly [T, string]>, id: T): string {
  return lista.find(([v]) => v === id)?.[1] ?? id;
}

/** Rótulos curtos de vínculo, para caberem no gráfico do cartão de divulgação. */
const VINCULO_CURTO: Record<string, string> = {
  grad_vet: "Grad. Veterinária",
  grad_agro: "Grad. Agronomia",
  grad_outro: "Grad. outro curso",
  pos_graduando: "Pós-graduando(a)",
  docente: "Docente",
  tecnico: "Técnico(a)/servidor(a)",
  outro: "Outro",
};

type Filtros = { busca: string; turma: string };
const SEM_FILTROS: Filtros = { busca: "", turma: "" };

function filtrar(linhas: readonly InscritoPainel[], f: Filtros): InscritoPainel[] {
  const q = f.busca.trim().toLocaleLowerCase("pt-BR");
  return linhas.filter((l) => {
    if (f.turma && l.turma_conteudo1 !== f.turma && l.turma_conteudo2 !== f.turma) return false;
    if (!q) return true;
    const alvo = `${l.nome} ${l.email} ${l.whatsapp} ${l.instituicao} ${l.curso_area} ${l.protocolo ?? ""}`.toLocaleLowerCase(
      "pt-BR",
    );
    return alvo.includes(q);
  });
}

export default function PainelCurso({ isAdmin, isSuper = false }: { isAdmin: boolean; isSuper?: boolean }) {
  const [linhas, setLinhas] = useState<InscritoPainel[] | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>(SEM_FILTROS);
  const [aberta, setAberta] = useState<InscritoPainel | null>(null);

  const carregar = () => {
    if (!isAdmin || !cursoDisponivel()) return;
    setCarregando(true);
    void listarInscritosDoPainel().then((r) => {
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

  const visiveis = useMemo(() => filtrar(linhas ?? [], filtros), [linhas, filtros]);
  const corrigidas = useMemo(
    () => (linhas ?? []).filter((l) => l.updated_at > l.created_at).length,
    [linhas],
  );
  const comAcessibilidade = useMemo(
    () => (linhas ?? []).filter((l) => l.acessibilidade).length,
    [linhas],
  );

  // ---------------------------------------------------------------- guardas
  if (!isAdmin) {
    return (
      <div className="plat-card plat-notice">
        <Lock size={20} aria-hidden="true" />
        <div>
          <strong>Área restrita a administradores</strong>
          <p>
            As inscrições do curso têm dados de contato pessoais, e por isso só o papel de admin as enxerga. A
            regra é do banco (migração 013), não desta tela. Peça a um administrador para promover seu perfil,
            se for o caso.
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
          <strong>As inscrições ainda não estão acessíveis</strong>
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
        <Loader2 size={22} aria-hidden="true" /> Carregando as inscrições do curso…
      </div>
    );
  }

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

  return (
    <div className="plat-eval">
      <div className="plat-card">
        <h2>
          <GraduationCap size={18} aria-hidden="true" /> {TEXTO.nome}: inscrições
        </h2>
        <p className="plat-muted">
          {TEXTO.quando} · {TEXTO.onde}. Formulário público em{" "}
          <a href={CURSO_HREF}>
            {CURSO_HREF} <ExternalLink size={12} aria-hidden="true" />
          </a>
          . Cada inscrição escolhe um horário de cada conteúdo (7 horas no total).
        </p>

        {linhas.length === 0 ? (
          <p className="plat-empty">
            Nenhuma inscrição ainda. O painel de divulgação e os gráficos aparecem aqui assim que a primeira
            pessoa confirmar. Confira se a divulgação já saiu e se a edição está aberta no banco.
          </p>
        ) : (
          <>
            <PainelDivulgacao linhas={linhas} />

            <p className="plat-muted curso-op-linha">
              {corrigidas ? `${corrigidas} inscrição(ões) corrigida(s) · ` : ""}
              {comAcessibilidade} pedido(s) de acessibilidade: detalhes na ficha de cada pessoa, abaixo.
            </p>

            <div className="plat-filters">
              <input
                type="search"
                placeholder="Buscar por nome, instituição, e-mail, WhatsApp ou protocolo…"
                aria-label="Buscar inscrições"
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              />
              <select
                aria-label="Filtrar por horário"
                value={filtros.turma}
                onChange={(e) => setFiltros({ ...filtros, turma: e.target.value })}
              >
                <option value="">Todos os horários</option>
                {TODAS_TURMAS.map((t) => (
                  <option key={t.id} value={t.id}>
                    Conteúdo {t.conteudo} · {t.diaRotulo} · {t.inicio}
                  </option>
                ))}
              </select>
              <button className="button plat-ghost" onClick={() => baixarCsv(visiveis)}>
                <Download size={15} aria-hidden="true" /> Exportar CSV ({visiveis.length})
              </button>
            </div>

            {visiveis.length === 0 ? (
              <p className="plat-empty">Nenhuma inscrição com estes filtros.</p>
            ) : (
              <div className="plat-list">
                {visiveis.map((l) => (
                  <button key={l.id} type="button" className="plat-app-row" onClick={() => setAberta(l)}>
                    <div>
                      <h3>{l.nome}</h3>
                      <p>
                        {l.instituicao} · {rotuloDe(VINCULOS, l.vinculo)} · {l.curso_area}
                      </p>
                      <p className="plat-muted">
                        C1: {turmaResumo(l.turma_conteudo1)} · C2: {turmaResumo(l.turma_conteudo2)}
                        {l.protocolo ? ` · ${l.protocolo}` : ""}
                      </p>
                    </div>
                    {l.acessibilidade ? (
                      <span className="rel-chip rel-chip--aviso" title={l.acessibilidade}>
                        acessibilidade
                      </span>
                    ) : null}
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

// ================================================= CARTÃO DE DIVULGAÇÃO =====
// Só CONTAGENS e PROPORÇÕES — nenhum nome, e-mail ou telefone. Pensado para ser
// capturado e postado: identidade de marca, número grande e três gráficos.

type Fatia = { readonly id: string; readonly rotulo: string; readonly total: number };

function PainelDivulgacao({ linhas }: { linhas: readonly InscritoPainel[] }) {
  const total = linhas.length;

  const instituicoes = new Set(
    linhas.map((l) => l.instituicao.trim().toLocaleLowerCase("pt-BR")).filter(Boolean),
  ).size;

  const alvo = linhas.filter((l) => l.vinculo === "grad_vet" || l.vinculo === "grad_agro").length;
  const pctAlvo = total ? Math.round((alvo / total) * 100) : 0;

  const porSessao: Fatia[] = TODAS_TURMAS.map((t) => ({
    id: t.id,
    rotulo: `C${t.conteudo} · ${t.diaRotulo.split(",")[0]} ${t.inicio}`,
    total: linhas.filter((l) => l.turma_conteudo1 === t.id || l.turma_conteudo2 === t.id).length,
  }));

  const porVinculo: Fatia[] = VINCULOS.map(([id]) => ({
    id,
    rotulo: VINCULO_CURTO[id] ?? id,
    total: linhas.filter((l) => l.vinculo === id).length,
  }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);

  const porExperiencia: Fatia[] = EXPERIENCIAS.map(([id, r]) => ({
    id,
    rotulo: r.split(":")[0],
    total: linhas.filter((l) => l.experiencia === id).length,
  })).filter((f) => f.total > 0);

  return (
    <figure className="curso-painel" aria-label="Cartão de divulgação das inscrições">
      <div className="curso-painel-marca">
        <MoleculaMini />
        <div>
          <p className="curso-painel-eyebrow">INCT-CONEXAO · IFRO Campus Jaru</p>
          <strong>{TEXTO.nome}</strong>
        </div>
      </div>

      <div className="curso-painel-hero">
        <span className="curso-painel-num">
          <NumeroQueConta valor={String(total)} />
        </span>
        <span className="curso-painel-cap">
          {total === 1 ? "inscrição confirmada" : "inscrições confirmadas"}
        </span>
      </div>

      <div className="curso-painel-mini">
        <div>
          <b>{instituicoes}</b>
          <span>{instituicoes === 1 ? "instituição" : "instituições"}</span>
        </div>
        <div>
          <b>{pctAlvo}%</b>
          <span>de Veterinária e Agronomia</span>
        </div>
        <div>
          <b>7h</b>
          <span>de formação por participante</span>
        </div>
      </div>

      <div className="curso-painel-charts">
        <Grafico titulo="Vagas por sessão" variante="river" dados={porSessao} escala={MAX_VAGAS} />
        <Grafico titulo="Perfil da turma" variante="leaf" dados={porVinculo} />
        <Grafico titulo="Experiência prévia" variante="gold" dados={porExperiencia} />
      </div>

      <figcaption className="curso-painel-rodape">
        <span>19, 20 e 21 de agosto de 2026 · inct-conexao.com.br/#/curso</span>
        <span className="curso-painel-dica">
          <Camera size={13} aria-hidden="true" /> Capture este cartão para divulgar
        </span>
      </figcaption>
    </figure>
  );
}

/** Um gráfico de barras horizontais. As barras são decorativas; o número ao
 *  lado carrega o dado, então leitor de tela e print de baixa resolução leem. */
function Grafico({
  titulo,
  variante,
  dados,
  escala,
}: {
  titulo: string;
  variante: "river" | "leaf" | "gold";
  dados: readonly Fatia[];
  /** Se dado, a barra mede o quão CHEIA está a sessão (total/escala) e o número
   *  aparece como "total/escala"; senão, escala pelo maior valor e mostra total. */
  escala?: number;
}) {
  if (!dados.length) return null;
  const base = escala ?? Math.max(1, ...dados.map((d) => d.total));
  return (
    <div className="curso-painel-grafico">
      <h4>{titulo}</h4>
      <ul>
        {dados.map((d) => (
          <li key={d.id}>
            <span className="curso-painel-rot">{d.rotulo}</span>
            <span className="curso-painel-track" aria-hidden="true">
              <span
                className={`curso-painel-fill curso-painel-fill--${variante}`}
                style={{ width: `${Math.min(100, Math.round((d.total / base) * 100))}%` }}
              />
            </span>
            <b>{escala ? `${d.total}/${escala}` : d.total}</b>
          </li>
        ))}
      </ul>
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
  linha: InscritoPainel;
  aoVoltar: () => void;
  isSuper: boolean;
  aoApagada: () => void;
}) {
  const l = linha;
  return (
    <div className="plat-eval">
      <button className="plat-back plat-back-btn" onClick={aoVoltar}>
        <ArrowLeft size={15} aria-hidden="true" /> Voltar à lista
      </button>

      <div className="plat-card">
        <h2>
          {l.nome}{" "}
          {l.protocolo ? (
            <span className="plat-protocolo" title="Protocolo">
              {l.protocolo}
            </span>
          ) : null}
        </h2>
        <p className="plat-muted">
          inscrita em {new Date(l.created_at).toLocaleString("pt-BR")}
          {l.updated_at > l.created_at ? ` · corrigida em ${new Date(l.updated_at).toLocaleString("pt-BR")}` : ""}
        </p>

        <div className="plat-review">
          <div>
            <dt>Contato</dt>
            <dd>
              <a href={`mailto:${l.email}`}>
                <Mail size={13} aria-hidden="true" /> {l.email}
              </a>
              {" · "}
              <Phone size={13} aria-hidden="true" /> {l.whatsapp}
            </dd>
          </div>
          <div>
            <dt>Instituição e curso</dt>
            <dd>
              {l.instituicao} · {l.curso_area} · {rotuloDe(VINCULOS, l.vinculo)}
              {l.semestre !== "nao_se_aplica" ? ` · ${rotuloDe(SEMESTRES, l.semestre)}` : ""}
            </dd>
          </div>
          <div>
            <dt>Experiência</dt>
            <dd>{rotuloDe(EXPERIENCIAS, l.experiencia)}</dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={13} aria-hidden="true" /> Conteúdo 1: Estruturas 3D e IA
            </dt>
            <dd>{turmaResumo(l.turma_conteudo1)}</dd>
          </div>
          <div>
            <dt>
              <CalendarClock size={13} aria-hidden="true" /> Conteúdo 2: Docking e ADMET
            </dt>
            <dd>{turmaResumo(l.turma_conteudo2)}</dd>
          </div>
          {l.acessibilidade ? (
            <div>
              <dt>
                <MapPin size={13} aria-hidden="true" /> Acessibilidade
              </dt>
              <dd>{l.acessibilidade}</dd>
            </div>
          ) : null}
        </div>

        {/* Só superadmin VÊ a zona; a permissão real é a trava da RPC (015). */}
        {isSuper ? (
          <ApagarDefinitivo
            alvo={`a inscrição ${l.protocolo ?? "sem protocolo"} (${l.nome})`}
            confirmacao={l.protocolo ?? l.email}
            detalhes="A vaga volta a contar como livre na hora."
            aoApagar={() => apagarInscricao(l.id)}
            aoApagada={aoApagada}
          />
        ) : null}
      </div>
    </div>
  );
}

// ================================================================= CSV =====

function baixarCsv(linhas: readonly InscritoPainel[]): void {
  const rows = linhas.map((l) => ({
    protocolo: l.protocolo ?? "",
    nome: l.nome,
    email: l.email,
    whatsapp: l.whatsapp,
    instituicao: l.instituicao,
    curso_area: l.curso_area,
    vinculo: rotuloDe(VINCULOS, l.vinculo),
    semestre: rotuloDe(SEMESTRES, l.semestre),
    experiencia: rotuloDe(EXPERIENCIAS, l.experiencia),
    conteudo_1: turmaResumo(l.turma_conteudo1),
    conteudo_2: turmaResumo(l.turma_conteudo2),
    acessibilidade: l.acessibilidade ?? "",
    inscrito_em: new Date(l.created_at).toLocaleString("pt-BR"),
    corrigido_em: l.updated_at > l.created_at ? new Date(l.updated_at).toLocaleString("pt-BR") : "",
  }));
  const csv = toCsv(rows);
  if (!csv) return;
  // BOM explícito para o Excel do Windows ler UTF-8 (senão "instituição"
  // quebra). Escrito como escape, nunca como caractere invisível no fonte.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `curso-inscricoes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
