/**
 * MapaPage — entrada do Mapa Interativo (rota #/mapa), carregada sob demanda.
 * Orquestra o estado (na URL), os dois modos (narrativa/explorador), o painel
 * de estado, a lista-alternativa acessível, a busca, a legenda e o modo leve.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Compass, BookOpen, List as ListIcon, Map as MapIcon, Search, ArrowRight,
  ChevronRight, Gauge, Info, Share2, MapPin, Layers, Building2, FlaskConical, Leaf,
  Trophy, Sparkles, Lock, Mountain, Activity, AlertTriangle,
} from "lucide-react";
import { BrazilMap, type MapOverlays, type TooltipInfo } from "./BrazilMap";
import { StatePanel, type SecaoId } from "./StatePanel";
import { useExploracao, TOTAL_UFS, type Conquista } from "./gamify";
import { CountUp } from "./viz";
import { ufs, ufBySigla, ufsPorRegiao, regionViewBox, enquadramentoDe, REGIOES } from "./geo";
import {
  construirCamadas, TEMAS, totalVagasIc, totalUfsComVagas, totalAmazoniaLegal,
  totalInstituicoes, totalUfsComInstituicoes, INSTITUICOES_POR_UF, type Camada,
} from "./layers";
import { carregarFicha, fichaEmCache, temConteudo, resumoNotificacoes, capitulos, capituloInicial } from "./content";
import { parseMapaHash, buildMapaHash, ESTADO_PADRAO, type MapaState } from "./url";
import type { EstadoConteudo, Uf } from "./types";
import { Figura } from "../figuras/Figura";
import { FOCOS } from "../figuras/registro";
import { usePassoAtivo, rolarAtePasso } from "../ui/passos";

/* ---- hooks utilitários ---- */
function usePrefersReducedMotion(): boolean {
  const [reduz, setReduz] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduz(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduz;
}

/** Estado do mapa dirigido pela hash (fonte única de verdade). */
function useMapaState(): [MapaState, (patch: Partial<MapaState>, opts?: { replace?: boolean }) => void] {
  const [state, setState] = useState<MapaState>(() => parseMapaHash(window.location.hash));
  /* O estado corrente também numa ref, para o `update` não precisar do updater
     funcional do `setState`. Escrever no histórico DENTRO daquele updater era o
     problema: ele deve ser puro, e em StrictMode roda duas vezes — o que
     duplicava a escrita. Com a rolagem passando a escrever o capítulo, isso
     deixaria de ser detalhe teórico. */
  const stRef = useRef(state);
  useEffect(() => {
    const on = () => {
      const s = parseMapaHash(window.location.hash);
      stRef.current = s;
      setState(s);
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const update = useCallback(
    (patch: Partial<MapaState>, opts: { replace?: boolean } = {}) => {
      const next = { ...stRef.current, ...patch };
      const hash = buildMapaHash(next);
      stRef.current = next;
      // A comparação vale para os DOIS ramos. Antes só o push comparava, e o
      // replace reescrevia a mesma hash a cada chamada.
      if (hash !== window.location.hash) {
        if (opts.replace) window.history.replaceState(null, "", hash);
        else window.location.hash = hash; // entrada no histórico + hashchange
      }
      setState(next);
    },
    [],
  );
  return [state, update];
}

/* Tooltip e rótulo como funções puras da CAMADA, e não do estado da página.
   Antes fechavam sobre `camadaAtiva` dentro do componente, o que impedia a
   narrativa de descrever a camada que ela mesma pinta. */
function tooltipCom(camada: Camada, u: Uf): TooltipInfo {
  const tags: string[] = [];
  const v = camada.rotularValor?.(u);
  if (v) tags.push(v);
  const inst = INSTITUICOES_POR_UF[u.sigla];
  if (inst && camada.id !== "instituicoes") tags.push(`${inst} instituiç${inst > 1 ? "ões" : "ão"}`);
  tags.push(temConteudo(u.sigla) ? "ficha disponível" : "em preparação");
  return { titulo: u.nome, sub: u.sigla, tags: tags.slice(0, 3) };
}

function rotuloCom(camada: Camada, u: Uf): string {
  const partes = [`${u.nome}, ${u.regiao}`];
  const v = camada.rotularValor?.(u);
  if (v) partes.push(v);
  partes.push(temConteudo(u.sigla) ? "ficha disponível" : "ficha em preparação");
  partes.push("Enter para abrir");
  return partes.join(". ");
}

export default function MapaPage() {
  const reduzir = usePrefersReducedMotion();
  const [st, update] = useMapaState();

  /* Modo leve em três estados, e não dois.
     Era `st.leve || !!saveData`: com economia de dados ligada no aparelho, o
     modo ficava preso em ligado — o `aria-pressed` afirmava "ligado", o clique
     não fazia nada, e a pessoa não tinha como ver o relevo.
     Agora o automático é só uma sugestão, e a escolha explícita ganha dele.
     Largura de tela DELIBERADAMENTE fora da conta: telefone pequeno não é
     prova de banda cara, e usar isso tiraria o relevo de quase todo o público
     do site por decisão que ninguém pediu. */
  const leveAuto = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const c = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    return c?.saveData === true || c?.effectiveType === "2g" || c?.effectiveType === "slow-2g";
  }, []);
  const leve = st.leve === "auto" ? leveAuto : st.leve === "1";

  const camadas = useMemo(() => construirCamadas(temConteudo, resumoNotificacoes), []);
  const camadaAtiva: Camada = camadas.find((c) => c.id === st.camada) ?? camadas[0];
  const ufSel = ufBySigla(st.uf);

  /* A ficha do estado é lida sob demanda: as 10 fichas somam 135 kB e não
     precisam descer para quem abre o mapa e nunca clica num estado. O painel
     abre na hora com o que o índice já sabe (contagens, notificações) e o corpo
     preenche quando o JSON chega. `fichaEmCache` evita o piscar em quem
     revisita um estado já aberto. */
  const [fichaSel, setFichaSel] = useState<EstadoConteudo | undefined>(() => fichaEmCache(st.uf));
  useEffect(() => {
    let vivo = true;
    setFichaSel(fichaEmCache(st.uf));
    if (!st.uf) return;
    carregarFicha(st.uf).then((f) => { if (vivo) setFichaSel(f); });
    return () => { vivo = false; };
  }, [st.uf]);
  const [hover, setHover] = useState<Uf | null>(null);

  // camadas sobrepostas (não-URL): conexões da rede + pontos (POI)
  const [overlays, setOverlays] = useState<MapOverlays>({ conexoes: true, pontos: false });
  const toggleOverlay = useCallback((k: keyof MapOverlays) => setOverlays((o) => ({ ...o, [k]: !o[k] })), []);
  // enquadramento de região (fast-travel); limpo ao selecionar um estado
  const [regiaoFoco, setRegiaoFoco] = useState<string | null>(null);
  const overrideTarget = useMemo(() => (regiaoFoco ? regionViewBox(regiaoFoco) : null), [regiaoFoco]);

  // gamificação: exploração dos estados + conquistas
  const { explorados, marcar, conquistas } = useExploracao();
  const [toast, setToast] = useState<Conquista | null>(null);
  const desbloqueadasRef = useRef<Set<string>>(new Set(conquistas.filter((c) => c.desbloqueada).map((c) => c.id)));
  useEffect(() => {
    const agora = conquistas.filter((c) => c.desbloqueada).map((c) => c.id);
    const novas = agora.filter((id) => !desbloqueadasRef.current.has(id));
    desbloqueadasRef.current = new Set(agora);
    if (novas.length) {
      setToast(conquistas.find((c) => c.id === novas[novas.length - 1]) ?? null);
      const t = window.setTimeout(() => setToast(null), 2600);
      return () => window.clearTimeout(t);
    }
  }, [conquistas]);

  // título da aba por rota (restaura ao sair)
  useEffect(() => {
    const prev = document.title;
    document.title = ufSel
      ? `${ufSel.nome} · Mapa Interativo (beta): INCT-CONEXAO`
      : "Mapa Interativo (beta): INCT-CONEXAO";
    return () => { document.title = prev; };
  }, [ufSel]);

  const selecionar = useCallback((sigla: string) => { setRegiaoFoco(null); marcar(sigla); update({ uf: sigla, modo: "explorador", sec: null }); }, [update, marcar]);
  const fechar = useCallback(() => update({ uf: null, sec: null }), [update]);

  const tooltipDe = useCallback((u: Uf) => tooltipCom(camadaAtiva, u), [camadaAtiva]);
  const rotuloDe = useCallback((u: Uf) => rotuloCom(camadaAtiva, u), [camadaAtiva]);

  /* ---- narrativa: o CAPÍTULO manda na camada, não a URL ----
     `cap.camada` estava no tipo e nos quatro JSONs e nenhuma linha o lia: os
     quatro capítulos pintavam o mapa igual, mesmo declarando camadas
     diferentes. Aqui ele passa a valer — e só dentro da história, sem escrever
     nada na hash, para a lente escolhida na narrativa não vazar para o
     explorador. Capítulo sem `camada` cai na da URL.

     Tooltip e rótulo TÊM de acompanhar. Eles fecham sobre a camada, e pintar o
     mapa com uma enquanto o hover e o `aria-label` descrevem outra troca um
     defeito de integridade por outro — mais escondido, porque só aparece para
     quem passa o mouse ou usa leitor de tela. */
  const capAtual = capituloInicial(st.cap);
  const camadaNarrativa = useMemo(
    () => camadas.find((c) => c.id === capAtual?.camada) ?? camadaAtiva,
    [camadas, capAtual?.camada, camadaAtiva],
  );
  const tooltipNarrativa = useCallback((u: Uf) => tooltipCom(camadaNarrativa, u), [camadaNarrativa]);
  const rotuloNarrativa = useCallback((u: Uf) => rotuloCom(camadaNarrativa, u), [camadaNarrativa]);
  const enquadreNarrativa = useMemo(() => enquadramentoDe(capAtual?.enquadrar), [capAtual?.enquadrar]);

  /* `?cap=` inválido não pode deixar o leitor num beco: `capituloInicial` já
     devolve o primeiro capítulo, e aqui a URL é normalizada uma vez para
     refletir o que está na tela. A desigualdade impede laço, e `replaceState`
     não dispara `hashchange`, então a árvore do App não acorda. */
  useEffect(() => {
    if (st.cap && capAtual && st.cap !== capAtual.id) update({ cap: capAtual.id }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main id="conteudo" className="map-band" tabIndex={-1}>
      <div className="map-inner">
        <MapaHeader st={st} update={update} leve={leve} />
        <AvisoBeta />

        {st.lista ? (
          <EstadosLista onSelecionar={selecionar} onFechar={() => update({ lista: false }, { replace: true })} />
        ) : st.modo === "panorama" ? (
          <Panorama
            camada={camadaAtiva}
            tooltipDe={tooltipDe}
            rotuloDe={rotuloDe}
            reduzir={reduzir}
            leve={leve}
            explorados={explorados}
            onSelecionar={selecionar}
            update={update}
          />
        ) : st.modo === "narrativa" ? (
          /* A guarda de "sem capítulos" vive AQUI, e não dentro de Narrativa.
             Lá dentro ela era um early-return antes de qualquer hook — hoje o
             componente tem um, e um render com a lista vazia lançaria
             "Rendered fewer hooks than expected" em produção. */
          capAtual ? (
            <Narrativa
              cap={capAtual}
              camada={camadaNarrativa}
              enquadrar={enquadreNarrativa}
              overlays={overlays}
              tooltipDe={tooltipNarrativa}
              explorados={explorados}
              reduzir={reduzir}
              leve={leve}
              onNav={(id) => update({ cap: id }, { replace: true })}
              onSelecionar={selecionar}
              onExplorar={() => update({ modo: "explorador", cap: null, camada: capAtual.camada ?? st.camada })}
              rotuloDe={rotuloNarrativa}
              setHover={setHover}
            />
          ) : (
            <p className="map-empty-note">
              <Info size={15} aria-hidden /> Nenhum capítulo cadastrado ainda. Use o modo <strong>Explorar</strong>.
            </p>
          )
        ) : (
          <Explorer
            st={st}
            fichaSel={fichaSel}
            update={update}
            camadas={camadas}
            camadaAtiva={camadaAtiva}
            ufSel={ufSel}
            leve={leve}
            reduzir={reduzir}
            hover={hover}
            setHover={setHover}
            overlays={overlays}
            toggleOverlay={toggleOverlay}
            tooltipDe={tooltipDe}
            overrideTarget={overrideTarget}
            regiaoFoco={regiaoFoco}
            onRegiao={setRegiaoFoco}
            explorados={explorados}
            conquistas={conquistas}
            onSelecionar={selecionar}
            onFechar={fechar}
            rotuloDe={rotuloDe}
          />
        )}

        <SecaoFocos />
      </div>

      {/* recompensa: aviso de conquista desbloqueada */}
      {toast ? (
        <div className="map-toast" role="status" aria-live="polite" key={toast.id}>
          <div className="map-toast-badge"><Trophy size={15} aria-hidden /></div>
          <div>
            <p className="map-toast-kicker"><Sparkles size={10} aria-hidden /> Conquista</p>
            <p className="map-toast-title">{toast.titulo}</p>
          </div>
        </div>
      ) : null}
    </main>
  );
}

/* ================================================================= */
/*  Cabeçalho: título + alternância de modo + acessos                */
/* ================================================================= */
function MapaHeader({ st, update, leve }: { st: MapaState; update: (p: Partial<MapaState>, o?: { replace?: boolean }) => void; leve: boolean }) {
  return (
    <header className="map-head">
      <div className="map-head-copy">
        <p className="eyebrow dark">Observatório territorial · Amazônia Legal e Brasil</p>
        <h1 className="map-h1">Mapa interativo da rede</h1>
        <p className="map-lede">
          Conecta campo, clima, saúde única e governança em {totalAmazoniaLegal} unidades da Amazônia Legal e nos {totalUfsComVagas} estados
          com bolsas de Iniciação Científica ({totalVagasIc} vagas em 2026). Explore por história ou navegue livremente.
        </p>
      </div>
      <div className="map-head-controls">
        <div className="map-modeswitch" role="tablist" aria-label="Modo de uso do mapa">
          <button role="tab" aria-selected={st.modo === "panorama" && !st.lista} className={`map-mode-btn${st.modo === "panorama" && !st.lista ? " is-active" : ""}`} onClick={() => update({ modo: "panorama", uf: null, lista: false })}>
            <Mountain size={16} aria-hidden /> Vista
          </button>
          <button role="tab" aria-selected={st.modo === "narrativa"} className={`map-mode-btn${st.modo === "narrativa" ? " is-active" : ""}`} onClick={() => update({ modo: "narrativa", uf: null, lista: false })}>
            <BookOpen size={16} aria-hidden /> História
          </button>
          <button role="tab" aria-selected={st.modo === "explorador" && !st.lista} className={`map-mode-btn${st.modo === "explorador" && !st.lista ? " is-active" : ""}`} onClick={() => update({ modo: "explorador", lista: false })}>
            <Compass size={16} aria-hidden /> Explorar
          </button>
        </div>
        <div className="map-head-toggles">
          <button type="button" className={`map-toggle${st.lista ? " is-on" : ""}`} aria-pressed={st.lista} onClick={() => update({ lista: !st.lista }, { replace: true })}>
            {st.lista ? <MapIcon size={15} aria-hidden /> : <ListIcon size={15} aria-hidden />} {st.lista ? "Ver mapa" : "Ver lista"}
          </button>
          {/* O clique escreve o OPOSTO do que está valendo, não o oposto do que
              está na URL — é isso que permite desligar o automático. */}
          <button
            type="button"
            className={`map-toggle${leve ? " is-on" : ""}`}
            aria-pressed={leve}
            onClick={() => update({ leve: leve ? "0" : "1" }, { replace: true })}
            title={
              leve && st.leve === "auto"
                ? "Ligado automaticamente: seu aparelho sinaliza economia de dados. Clique para ver o relevo."
                : "Reduz imagens e animações"
            }
          >
            <Gauge size={15} aria-hidden /> Modo leve
            {leve && st.leve === "auto" ? <span className="map-toggle-auto"> (automático)</span> : null}
          </button>
        </div>
      </div>
    </header>
  );
}

/* ================================================================= */
/*  Aviso de versão beta                                              */
/* ================================================================= */
/** Visível nos três modos e não dispensável: é uma ressalva sobre a
 *  confiabilidade dos dados, não uma notificação. Some quando o mapa
 *  sair de teste (remover o componente e a chamada em MapaPage). */
/**
 * Seção de séries temporais, abaixo do mapa.
 *
 * O mapa mostra o presente de cada estado; a série mostra o que mudou. Sem ela
 * o site conseguia dizer "queima muito" mas não "queimou mais em 2004 do que em
 * 2019", que é uma afirmação diferente e muito mais difícil de contestar.
 *
 * Todo número no texto é DERIVADO de `FOCOS`. Escrever "69,7%" aqui à mão seria
 * repetir o erro que `tests/rede.test.ts` já teve de consertar uma vez.
 */
function SecaoFocos() {
  return (
    <section className="map-series" aria-labelledby="map-series-titulo">
      <div className="map-series-cab">
        <h2 id="map-series-titulo">O que mudou, ano a ano</h2>
        <p className="map-lede">
          Entre {FOCOS.anoInicial} e {FOCOS.anoFinal}, o satélite de referência do INPE registrou{" "}
          <strong>{FOCOS.totalBrasil.toLocaleString("pt-BR")}</strong> focos de calor no Brasil.{" "}
          <strong>{FOCOS.participacaoAmazonia.toLocaleString("pt-BR")}%</strong> deles estão nos nove
          estados da Amazônia Legal — o território onde a rede atua. Os dados são públicos e podem ser
          baixados abaixo.
        </p>
      </div>
      <div className="map-series-grade">
        <Figura id="focos-amazonia-legal" />
        <Figura id="focos-estados-amazonia" />
      </div>
    </section>
  );
}

function AvisoBeta() {
  return (
    <aside className="map-beta" role="note" aria-labelledby="map-beta-titulo">
      <AlertTriangle size={19} aria-hidden />
      <div>
        <p className="map-beta-titulo" id="map-beta-titulo">
          <span className="map-beta-selo">Beta</span> Mapa em fase de testes
        </p>
        <p className="map-beta-texto">
          Os dados e textos desta página ainda estão em revisão científica e podem conter erros ou lacunas.{" "}
          <strong>Não use o mapa como referência</strong> para decisão clínica, citação acadêmica ou
          divulgação: para números oficiais, consulte as fontes indicadas em cada ficha. Encontrou algum erro?{" "}
          <a href="mailto:inctconexao@gmail.com?subject=Mapa%20interativo%20(beta)">Avise a equipe</a>.
        </p>
      </div>
    </aside>
  );
}

/* ================================================================= */
/*  MODO EXPLORADOR                                                   */
/* ================================================================= */
const LENS_ICON: Record<string, typeof Leaf> = {
  "amazonia-legal": Leaf,
  "doencas-notificacoes": Activity,
  "vagas-ic-2026": FlaskConical,
  "instituicoes": Building2,
  "conteudo": Layers,
};

type ExplorerProps = {
  /** Ficha do estado selecionado, carregada sob demanda (undefined enquanto vem). */
  fichaSel: EstadoConteudo | undefined;
  st: MapaState;
  update: (p: Partial<MapaState>, o?: { replace?: boolean }) => void;
  camadas: Camada[];
  camadaAtiva: Camada;
  ufSel: Uf | undefined;
  leve: boolean;
  reduzir: boolean;
  hover: Uf | null;
  setHover: (u: Uf | null) => void;
  overlays: MapOverlays;
  toggleOverlay: (k: keyof MapOverlays) => void;
  tooltipDe: (u: Uf) => TooltipInfo;
  overrideTarget: [number, number, number, number] | null;
  regiaoFoco: string | null;
  onRegiao: (r: string | null) => void;
  explorados: Set<string>;
  conquistas: Conquista[];
  onSelecionar: (s: string) => void;
  onFechar: () => void;
  rotuloDe: (u: Uf) => string;
};

function Explorer({ st, fichaSel, update, camadas, camadaAtiva, ufSel, leve, reduzir, setHover, overlays, toggleOverlay, tooltipDe, overrideTarget, regiaoFoco, onRegiao, explorados, conquistas, onSelecionar, onFechar, rotuloDe }: ExplorerProps) {
  // fecha painel com Escape
  useEffect(() => {
    if (!ufSel) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [ufSel, onFechar]);

  return (
    <div className={`map-explorer${ufSel ? " has-panel" : ""}`}>
      <div className="map-stage">
        <div className="map-hud">
          <div className="map-hud-top">
            <Busca onSelecionar={onSelecionar} />
            <ExploracaoPill explorados={explorados} conquistas={conquistas} />
            <div className="map-regions" role="group" aria-label="Ir para região">
              <button type="button" className={`map-region-chip${!regiaoFoco ? " is-active" : ""}`} onClick={() => onRegiao(null)}>Brasil</button>
              {REGIOES.map((r) => (
                <button key={r} type="button" className={`map-region-chip${regiaoFoco === r ? " is-active" : ""}`} onClick={() => onRegiao(regiaoFoco === r ? null : r)}>{r}</button>
              ))}
            </div>
          </div>
          <div className="map-hud-layers">
            <div className="map-lens" role="group" aria-label="Camada (lente do mapa)">
              {camadas.map((c) => {
                const Icon = LENS_ICON[c.id] ?? Layers;
                return (
                  <button key={c.id} type="button" className={`map-lens-btn${camadaAtiva.id === c.id ? " is-active" : ""}`}
                    aria-pressed={camadaAtiva.id === c.id} title={c.descricao}
                    onClick={() => update({ camada: c.id }, { replace: true })}>
                    <Icon size={14} aria-hidden /> {c.label}
                  </button>
                );
              })}
            </div>
            <div className="map-overlay-toggles" role="group" aria-label="Sobreposições do mapa">
              <button type="button" className={`map-ov-btn${overlays.conexoes ? " is-on" : ""}`} aria-pressed={overlays.conexoes} onClick={() => toggleOverlay("conexoes")}>
                <Share2 size={14} aria-hidden /> Conexões
              </button>
              <button type="button" className={`map-ov-btn${overlays.pontos ? " is-on" : ""}`} aria-pressed={overlays.pontos} onClick={() => toggleOverlay("pontos")}>
                <MapPin size={14} aria-hidden /> Instituições
              </button>
            </div>
          </div>
        </div>

        <BrazilMap
          camada={camadaAtiva}
          overlays={overlays}
          selecionada={ufSel?.sigla ?? null}
          foco={null}
          overrideTarget={overrideTarget}
          explorados={explorados}
          leve={leve}
          reduzirMovimento={reduzir}
          onSelecionar={onSelecionar}
          onDestacar={setHover}
          rotuloDe={rotuloDe}
          tooltipDe={tooltipDe}
        />

        <div className="map-stage-foot">
          <Legenda camada={camadaAtiva} />
          <StatBar />
        </div>
        <p className="map-fonte-nota">
          Limites: <strong>IBGE</strong> (malhas oficiais) · Relevo: <strong>NASA / GIBS</strong> · Camada “{camadaAtiva.label}”: {camadaAtiva.fonte.publicador ?? camadaAtiva.fonte.titulo}.
        </p>
      </div>

      <div className="map-side">
        {ufSel ? (
          <StatePanel
            uf={ufSel}
            conteudo={fichaSel}
            secaoAberta={st.sec as SecaoId | null}
            leve={leve}
            onAbrirSecao={(s) => update({ sec: s }, { replace: true })}
            onFechar={onFechar}
          />
        ) : (
          <IntroExplorador onSelecionar={onSelecionar} explorados={explorados} />
        )}
      </div>
    </div>
  );
}

function IntroExplorador({ onSelecionar, explorados }: { onSelecionar: (s: string) => void; explorados: Set<string> }) {
  const demoUfs = ["RO", "AM", "CE"].map((s) => ufBySigla(s)!).filter(Boolean);
  return (
    <aside className="map-intro">
      <h2>Comece a explorar</h2>
      <p className="map-muted">Clique num estado, use a busca ou parta dos exemplos — Rondônia e Amazonas (Amazônia Legal) e Ceará (fora dela). Cada estado aberto conta na sua exploração (veja o progresso no topo do mapa).</p>
      <div className="map-intro-demos">
        {demoUfs.map((u) => (
          <button key={u.sigla} type="button" className={`map-demo-card${explorados.has(u.sigla) ? " is-explored" : ""}`} onClick={() => onSelecionar(u.sigla)}>
            <strong>{u.nome}</strong>
            <span>{u.amazoniaLegal ? "Amazônia Legal" : u.regiao}</span>
            <ArrowRight size={16} aria-hidden />
          </button>
        ))}
      </div>
    </aside>
  );
}

/* ================================================================= */
/*  MODO VITRINE (panorama) — só o relevo 3D, sem seleção            */
/* ================================================================= */
type PanoramaProps = {
  camada: Camada;
  tooltipDe: (u: Uf) => TooltipInfo;
  rotuloDe: (u: Uf) => string;
  reduzir: boolean;
  leve: boolean;
  explorados: Set<string>;
  onSelecionar: (s: string) => void;
  update: (p: Partial<MapaState>, o?: { replace?: boolean }) => void;
};

function Panorama({ camada, tooltipDe, rotuloDe, reduzir, leve, explorados, onSelecionar, update }: PanoramaProps) {
  const overlays: MapOverlays = { conexoes: false, pontos: false };
  return (
    <div className="map-panorama">
      <div className="map-stage map-panorama-stage">
        <BrazilMap
          vitrine
          leve={leve}
          camada={camada}
          overlays={overlays}
          selecionada={null}
          foco={null}
          explorados={explorados}
          reduzirMovimento={reduzir}
          onSelecionar={onSelecionar}
          onDestacar={() => {}}
          rotuloDe={rotuloDe}
          tooltipDe={tooltipDe}
        />
        <div className="map-panorama-cap">
          <p className="eyebrow dark"><Mountain size={13} aria-hidden /> Relevo real do território</p>
          <h2>O Brasil da rede, em relevo de verdade</h2>
          <p>Satélite com sombreamento 3D calculado a partir de dados de elevação. Passe o cursor ou toque num estado para abrir a ficha.</p>
          <div className="map-panorama-stats" aria-label="Indicadores da rede">
            <span><strong><CountUp value={totalAmazoniaLegal} /></strong> UFs na Amazônia Legal</span>
            <span><strong><CountUp value={totalVagasIc} /></strong> vagas de IC 2026</span>
            <span><strong><CountUp value={totalInstituicoes} /></strong> instituições</span>
          </div>
          <div className="map-panorama-cta">
            <button type="button" className="button primary" onClick={() => update({ modo: "explorador" })}>
              <Compass size={16} aria-hidden /> Explorar o mapa
            </button>
            <button type="button" className="button plat-ghost" onClick={() => update({ modo: "narrativa" })}>
              <BookOpen size={16} aria-hidden /> Ver a história
            </button>
          </div>
        </div>
      </div>
      <p className="map-fonte-nota">
        Limites: <strong>IBGE</strong> · Relevo 3D calculado de dados de elevação (Terrarium / AWS Open Data) sobre satélite <strong>NASA Blue Marble</strong>.
      </p>
    </div>
  );
}

/* ================================================================= */
/*  MODO NARRATIVA                                                    */
/* ================================================================= */
type NarrativaProps = {
  /** O capítulo ATIVO. A pilha renderiza todos; este é o que está na faixa. */
  cap: import("./types").Capitulo;
  camada: Camada;
  /** Enquadramento do capítulo, já resolvido. Sobrepõe `foco` no BrazilMap. */
  enquadrar: [number, number, number, number] | null;
  overlays: MapOverlays;
  tooltipDe: (u: Uf) => TooltipInfo;
  explorados: Set<string>;
  reduzir: boolean;
  leve: boolean;
  onNav: (id: string) => void;
  onSelecionar: (s: string) => void;
  onExplorar: () => void;
  rotuloDe: (u: Uf) => string;
  setHover: (u: Uf | null) => void;
};

/**
 * A história inteira no DOM, com o mapa grudado ao lado.
 *
 * Antes um capítulo por vez, trocado por botões: o `position: sticky` do palco
 * existia mas não tinha o que grudar, porque a coluna de texto nunca ficava
 * mais alta que o mapa (medido: 4px de curso). Empilhando os capítulos, a
 * coluna cresce, o mapa fica parado e a rolagem passa a ser o controle.
 */
function Narrativa({ cap, camada, enquadrar, overlays, tooltipDe, explorados, reduzir, leve, onNav, onSelecionar, onExplorar, rotuloDe, setHover }: NarrativaProps) {
  const pilha = useRef<HTMLDivElement>(null);
  const jaRolou = useRef(false);
  const ids = useMemo(() => capitulos.map((c) => c.id), []);

  usePassoAtivo(pilha, ids, onNav);

  /* Deep-link: `?cap=` posiciona a rolagem UMA vez, na montagem. Refazer isso a
     cada troca de `cap` seria sequestro de rolagem — o leitor rola, o efeito
     puxa de volta. O rAF duplo espera o layout assentar; sem ele, o
     `window.scrollTo(0,0)` que o App dispara na troca de rota desfaz o salto,
     porque efeito de filho roda antes do efeito do pai. */
  useEffect(() => {
    if (jaRolou.current) return;
    jaRolou.current = true;
    const alvo = pilha.current?.querySelector<HTMLElement>(`[data-passo="${cap.id}"]`);
    if (!alvo || alvo === pilha.current?.firstElementChild) return;
    requestAnimationFrame(() => requestAnimationFrame(() => rolarAtePasso(alvo, true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="map-narrativa">
      <div className="map-stage">
        <BrazilMap
          camada={camada}
          overlays={overlays}
          selecionada={null}
          foco={cap.foco ?? null}
          overrideTarget={enquadrar}
          destaques={cap.destaques}
          explorados={explorados}
          leve={leve}
          /* Com o mapa parado, o cursor passa a história inteira sobre ele.
             Sem isso, a roda aproxima e o leitor não consegue mais voltar. */
          zoomRoda={false}
          reduzirMovimento={reduzir}
          onSelecionar={onSelecionar}
          onDestacar={setHover}
          rotuloDe={rotuloDe}
          tooltipDe={tooltipDe}
        />
        {/* Repintar um mapa científico sem chave de cores é erro de integridade:
            a camada agora muda por capítulo, e o leitor precisa saber o que a
            cor significa e de onde o número veio. */}
        <Legenda camada={camada} />
        <p className="map-fonte-nota">
          Limites: <strong>IBGE</strong> · Relevo: <strong>NASA / GIBS</strong>. Camada “{camada.label}”:{" "}
          <strong>{camada.fonte.publicador ?? camada.fonte.titulo}</strong>
          {camada.fonte.data ? ` (${camada.fonte.data})` : ""}.
        </p>
      </div>

      <div className="map-story" ref={pilha}>
        {capitulos.map((c, i) => (
          <section
            key={c.id}
            data-passo={c.id}
            className={`map-step${c.id === cap.id ? " is-ativa" : ""}`}
            aria-labelledby={`cap-${c.id}`}
          >
            <p className="map-story-step">Capítulo {i + 1} de {capitulos.length}</p>
            <h2 id={`cap-${c.id}`}>{c.titulo}</h2>
            {c.texto.split(/\n\n+/).map((p, j) => <p key={j}>{p}</p>)}
            {c.foco ? (
              <button type="button" className="button plat-ghost map-story-open" onClick={() => onSelecionar(c.foco!)}>
                Abrir ficha de {ufBySigla(c.foco)?.nome} <ChevronRight size={16} aria-hidden />
              </button>
            ) : null}
            {c.fontes?.length ? (
              <p className="map-sources"><span className="map-sources-h">Fontes:</span> {c.fontes.map((f, j) => <span key={j}>{j > 0 ? "; " : ""}{f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.titulo}</a> : f.titulo}</span>)}</p>
            ) : null}
          </section>
        ))}

        {/* Os botões Anterior/Próximo saíram: numa pilha contínua a rolagem já é
            a navegação, e repeti-los em cada capítulo daria quatro pares de
            botões dizendo a mesma coisa. O convite para o explorador fica no
            fim, onde a história acaba. */}
        <div className="map-story-nav">
          <button type="button" className="button primary" onClick={onExplorar}>
            Explorar o mapa <Compass size={15} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================================================================= */
/*  Busca, Legenda, Preview, Lista                                   */
/* ================================================================= */
function Busca({ onSelecionar }: { onSelecionar: (s: string) => void }) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const res = q.trim() ? ufs.filter((u) => norm(u.nome).includes(norm(q)) || u.sigla.toLowerCase() === norm(q)).slice(0, 6) : [];
  return (
    <div className="map-busca">
      <span className="map-control-label">Buscar estado</span>
      <label className="map-busca-field">
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nome ou sigla…"
          aria-label="Buscar um estado pelo nome ou sigla"
          onKeyDown={(e) => { if (e.key === "Enter" && res[0]) { onSelecionar(res[0].sigla); setQ(""); } }}
        />
      </label>
      {res.length ? (
        <ul className="map-busca-res">
          {res.map((u) => (
            <li key={u.sigla}>
              <button type="button" onClick={() => { onSelecionar(u.sigla); setQ(""); }}>
                {u.nome} <span>{u.sigla}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Legenda({ camada }: { camada: Camada }) {
  return (
    <div className="map-legenda" aria-label={`Legenda: ${camada.label}`}>
      <p className="map-legenda-h">{camada.label}</p>
      <ul>
        {camada.legenda.map((l, i) => (
          <li key={i}>
            <span className={`map-legenda-sw${l.hachura ? " is-hachura" : ""}`} style={{ background: l.cor }} aria-hidden />
            {l.rotulo}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pílula compacta de exploração (gamificação discreta): progresso + conquistas
 *  num popover que abre só sob clique (não fica bloqueando a visão). */
function ExploracaoPill({ explorados, conquistas }: { explorados: Set<string>; conquistas: Conquista[] }) {
  const pct = Math.round((explorados.size / TOTAL_UFS) * 100);
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;
  return (
    <details className="map-xp">
      <summary title="Sua exploração e conquistas">
        <Compass size={14} aria-hidden />
        <strong>{explorados.size}/{TOTAL_UFS}</strong>
        <span className="map-xp-track" aria-hidden><span style={{ width: `${pct}%` }} /></span>
        {desbloqueadas ? <span className="map-xp-count"><Trophy size={11} aria-hidden />{desbloqueadas}</span> : null}
      </summary>
      <div className="map-xp-pop">
        <p className="map-xp-h">Conquistas ({desbloqueadas}/{conquistas.length})</p>
        <div className="map-badges">
          {conquistas.map((c) => (
            <div key={c.id} className={`map-badge${c.desbloqueada ? " is-on" : ""}`} title={`${c.desc} (${c.atual}/${c.meta})`}>
              {c.desbloqueada ? <Trophy size={12} aria-hidden /> : <Lock size={11} aria-hidden />}
              <span>{c.titulo}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

/** Barra de indicadores da rede (HUD) — números reais, atualiza a leitura geral. */
function StatBar() {
  const stats = [
    { Icon: Leaf, valor: totalAmazoniaLegal, label: "na Amazônia Legal" },
    { Icon: FlaskConical, valor: totalVagasIc, label: `vagas de IC · ${totalUfsComVagas} UFs` },
    { Icon: Building2, valor: totalInstituicoes, label: `instituições · ${totalUfsComInstituicoes} UFs` },
  ];
  return (
    <div className="map-statbar" aria-label="Indicadores da rede">
      {stats.map((s, i) => (
        <div className="map-stat" key={i}>
          <s.Icon size={15} aria-hidden />
          <strong><CountUp value={s.valor} /></strong>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function EstadosLista({ onSelecionar, onFechar }: { onSelecionar: (s: string) => void; onFechar: () => void }) {
  const [q, setQ] = useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const grupos = ufsPorRegiao();
  return (
    <div className="map-lista">
      <div className="map-lista-top">
        <label className="map-busca-field">
          <Search size={16} aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar estados…" aria-label="Filtrar estados" />
        </label>
        <button type="button" className="map-toggle" onClick={onFechar}><MapIcon size={15} aria-hidden /> Ver mapa</button>
      </div>
      {grupos.map((g) => {
        const itens = g.ufs.filter((u) => !q.trim() || norm(u.nome).includes(norm(q)) || u.sigla.toLowerCase() === norm(q));
        if (!itens.length) return null;
        return (
          <section key={g.regiao} className="map-lista-regiao" aria-label={g.regiao}>
            <h2>{g.regiao}</h2>
            <ul>
              {itens.map((u) => (
                <li key={u.sigla}>
                  <button type="button" onClick={() => onSelecionar(u.sigla)}>
                    <span className="map-lista-nome">{u.nome} <em>{u.sigla}</em></span>
                    <span className="map-lista-meta">
                      {u.amazoniaLegal ? "Amazônia Legal" : u.regiao}
                      {temConteudo(u.sigla) ? <span className="map-tag map-tag--confirmado">ficha</span> : null}
                    </span>
                    <ChevronRight size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
