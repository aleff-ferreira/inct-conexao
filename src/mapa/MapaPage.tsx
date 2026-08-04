/**
 * MapaPage — entrada do Mapa Interativo (rota #/mapa), carregada sob demanda.
 * Orquestra o estado (na URL), os dois modos (narrativa/explorador), o painel
 * de estado, a lista-alternativa acessível, a busca, a legenda e o modo leve.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Compass, BookOpen, List as ListIcon, Map as MapIcon, Search, ArrowRight,
  ChevronRight, Gauge, Info, Share2, MapPin, Layers, Building2, FlaskConical, Leaf,
  Trophy, Sparkles, Lock, Mountain, Activity, AlertTriangle, Download, EyeOff,
} from "lucide-react";
import { BrazilMap, type MapOverlays, type TooltipInfo } from "./BrazilMap";
import { StatePanel, type SecaoId } from "./StatePanel";
import { useExploracao, TOTAL_UFS, type Conquista } from "./gamify";
import { CountUp } from "./viz";
import { ufs, ufBySigla, ufsPorRegiao, regionViewBox, enquadramentoDe, REGIOES } from "./geo";
import {
  construirCamadas, TEMAS, totalVagasIc, totalUfsComVagas, totalAmazoniaLegal,
  totalInstituicoes, totalUfsComInstituicoes, INSTITUICOES_POR_UF, CAMADA_SEM_ID, type Camada,
} from "./layers";
import { carregarFicha, fichaEmCache, temConteudo, resumoNotificacoes, capitulos, capituloInicial } from "./content";
import { parseMapaHash, buildMapaHash, ESTADO_PADRAO, type MapaState } from "./url";
import type { EstadoConteudo, Uf } from "./types";
import { Figura } from "../figuras/Figura";
import { FOCOS } from "../figuras/registro";
import { usePassoAtivo, rolarAtePasso } from "../ui/passos";
import { baixarCsvDaCamada } from "./csvCamada";
import { linkDeErro, EMAIL_EQUIPE } from "./reportar";
import { ControleAno } from "./ControleAno";
import { ANO_FINAL } from "./focos";

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

  /* O ano vive em estado local ENQUANTO se arrasta, e na URL quando se solta.
     Repintar 27 estados a cada passo precisa ser instantâneo; escrever na URL a
     cada passo criaria 22 entradas de histórico e transformaria o botão Voltar
     numa armadilha. */
  const [anoVivo, setAnoVivo] = useState<number>(st.ano ?? ANO_FINAL);
  useEffect(() => { setAnoVivo(st.ano ?? ANO_FINAL); }, [st.ano]);

  const camadas = useMemo(
    () => construirCamadas(temConteudo, resumoNotificacoes, { ano: anoVivo, medida: st.medida }),
    [anoVivo, st.medida],
  );
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

  /* ---- ocultar TODAS as camadas ----
     "Todas" inclui as sobreposições: para quem olha a tela, as conexões e os
     pinos de instituição são camadas tanto quanto a pintura — desligar só o
     coroplético e deixar o mapa riscado de linhas azuis não é o que o botão
     promete.

     O estado anterior fica numa ref para o botão poder desfazer. Sem isso ele
     seria um caminho de mão única: a pessoa esconde tudo, clica de novo e o
     mapa volta com a camada padrão, não com a que ela estava lendo. */
  const anteriorRef = useRef<{ camada: string | null; overlays: MapOverlays } | null>(null);
  const tudoOculto = st.camada === CAMADA_SEM_ID && !overlays.conexoes && !overlays.pontos;
  const alternarOcultar = useCallback(() => {
    if (tudoOculto) {
      const a = anteriorRef.current;
      setOverlays(a?.overlays ?? { conexoes: true, pontos: false });
      update({ camada: a?.camada ?? ESTADO_PADRAO.camada }, { replace: true });
      return;
    }
    anteriorRef.current = { camada: st.camada, overlays };
    setOverlays({ conexoes: false, pontos: false });
    update({ camada: CAMADA_SEM_ID }, { replace: true });
  }, [tudoOculto, st.camada, overlays, update]);
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
          <EstadosLista camada={camadaAtiva} onSelecionar={selecionar} onFechar={() => update({ lista: false }, { replace: true })} />
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
            anoVivo={anoVivo}
            setAnoVivo={setAnoVivo}
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
            tudoOculto={tudoOculto}
            onOcultarTudo={alternarOcultar}
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
          divulgação: para números oficiais, consulte as fontes indicadas em cada ficha.{" "}
          {/* O aviso NÃO cobre a seção de figuras: aquelas têm fonte, licença e
              CSV, e dizer "não cite" sobre elas seria falso. Ver SecaoFocos. */}
          <a href={`mailto:${EMAIL_EQUIPE}?subject=${encodeURIComponent("[mapa] correção")}`}>
            Encontrou um erro? Avise a equipe
          </a>{" "}
          — ou use o botão “Reportar erro” ao lado da legenda, que já leva a camada, o estado e a safra do dado.
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
  /** Ano corrente da camada de focos, enquanto se arrasta o controle. */
  anoVivo: number;
  setAnoVivo: (a: number) => void;
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
  /** Pintura E sobreposições desligadas ao mesmo tempo. */
  tudoOculto: boolean;
  onOcultarTudo: () => void;
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

function Explorer({ st, fichaSel, anoVivo, setAnoVivo, update, camadas, camadaAtiva, ufSel, leve, reduzir, setHover, overlays, toggleOverlay, tudoOculto, onOcultarTudo, tooltipDe, overrideTarget, regiaoFoco, onRegiao, explorados, conquistas, onSelecionar, onFechar, rotuloDe }: ExplorerProps) {
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
              {/* "Sem camada" sai da lista de lentes e vira o botão de ocultar,
                  no fim: entre as lentes ela pareceria mais um assunto do mapa,
                  quando é a ausência de todos eles. */}
              {camadas.filter((c) => c.id !== CAMADA_SEM_ID).map((c) => {
                const Icon = LENS_ICON[c.id] ?? Layers;
                return (
                  <button key={c.id} type="button" className={`map-lens-btn${camadaAtiva.id === c.id ? " is-active" : ""}`}
                    aria-pressed={camadaAtiva.id === c.id} title={c.descricao}
                    onClick={() => update({ camada: c.id }, { replace: true })}>
                    <Icon size={14} aria-hidden /> {c.label}
                  </button>
                );
              })}
              {/* Desliga a pintura E as sobreposições. Botão de dois estados, não
                  de mão única: quem escondeu tudo para ver o relevo precisa
                  poder voltar à camada que estava lendo. */}
              <button
                type="button"
                className={`map-lens-btn map-lens-limpar${tudoOculto ? " is-active" : ""}`}
                aria-pressed={tudoOculto}
                title={
                  tudoOculto
                    ? "Traz de volta a camada e as sobreposições que estavam ligadas."
                    : "Esconde a pintura temática, as conexões e os pinos. Ficam o relevo, os limites do IBGE e os nomes."
                }
                onClick={onOcultarTudo}
              >
                <EyeOff size={14} aria-hidden /> {tudoOculto ? "Mostrar camadas" : "Ocultar camadas"}
              </button>
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

        {/* O controle de ano só existe quando a camada tem eixo de tempo. */}
        {camadaAtiva.id === "focos-calor" ? (
          <ControleAno
            ano={anoVivo}
            medida={st.medida}
            reduzirMovimento={reduzir}
            onPreview={setAnoVivo}
            onFirmar={(a) => update({ ano: a }, { replace: true })}
            onMedida={(m) => update({ medida: m }, { replace: true })}
          />
        ) : null}

        <div className="map-stage-foot">
          <Legenda camada={camadaAtiva} />
          <StatBar />
        </div>
        <p className="map-fonte-nota">
          Limites: <strong>IBGE</strong> (malhas oficiais) · Relevo: <strong>NASA / GIBS</strong>
          {/* Sem camada, creditar "Camada 'Sem camada': IBGE" seria atribuir
              procedência a uma leitura que não está na tela. */}
          {camadaAtiva.id === CAMADA_SEM_ID
            ? "."
            : <> · Camada “{camadaAtiva.label}”: {camadaAtiva.fonte.publicador ?? camadaAtiva.fonte.titulo}.</>}
        </p>
      </div>

      <div className="map-side">
        {ufSel ? (
          <StatePanel
            uf={ufSel}
            conteudo={fichaSel}
            camada={camadaAtiva}
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
        {/* Índice da história: diz onde a pessoa está e permite pular.
            No celular é uma lista normal no topo, não uma segunda barra
            grudada: o palco já é sticky com 38svh, e empilhar outra barra
            espremeria o texto — que é o conteúdo. */}
        <nav className="map-indice" aria-label="Capítulos da história">
          <p className="map-indice-titulo">
            Capítulo {capitulos.findIndex((c) => c.id === cap.id) + 1} de {capitulos.length}
          </p>
          <ol>
            {capitulos.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`map-indice-btn${c.id === cap.id ? " is-on" : ""}`}
                  aria-current={c.id === cap.id ? "step" : undefined}
                  onClick={() => {
                    const alvo = pilha.current?.querySelector<HTMLElement>(`[data-passo="${c.id}"]`);
                    alvo?.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
                  }}
                >
                  <span className="map-indice-n">{i + 1}</span> {c.titulo}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* DUAS caixas, e não uma: `<section>` é o TRILHO (a altura que dá curso
            à rolagem para o mapa grudado ter o que fazer) e `<article>` é o
            CARTÃO (do tamanho do texto). Eram a mesma caixa, com `min-height:
            78svh` e conteúdo centralizado — o que produzia, numa tela de 1080,
            um cartão de mais de 800px de moldura para uns 600 caracteres de
            texto: três quartos de branco emoldurado. O curso de rolagem tinha
            de existir; a moldura em volta dele é que não. */}
        {capitulos.map((c, i) => (
          <section
            key={c.id}
            data-passo={c.id}
            className={`map-step${c.id === cap.id ? " is-ativa" : ""}`}
            aria-labelledby={`cap-${c.id}`}
          >
            <article className="map-step-card">
              {/* A posição fica na medalha e some do texto: com as duas coisas,
                  a tarja saía "① CAPÍTULO 1 DE 4" — o mesmo número duas vezes a
                  dois centímetros de distância. A medalha é `aria-hidden`, então
                  o "1 de 4" volta como texto para quem ouve a página. */}
              <p className="map-story-step">
                <span className="map-step-n" aria-hidden>{i + 1}</span>
                Capítulo<span className="sr-only"> {i + 1} de {capitulos.length}</span>
              </p>
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
            </article>
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
  /* Camada sem cores não recebe chave de cores. Publicar uma legenda vazia (ou
     pior, uma linha "sem dado") ao lado de um mapa sem pintura é dar aparência
     de leitura a um mapa que deliberadamente não tem nenhuma. */
  if (!camada.legenda.length) {
    return (
      <div className="map-legenda map-legenda--vazia">
        <p className="map-legenda-h">{camada.label}</p>
        <p className="map-legenda-nota">{camada.descricao}</p>
      </div>
    );
  }
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

function EstadosLista({ camada, onSelecionar, onFechar }: { camada: Camada; onSelecionar: (s: string) => void; onFechar: () => void }) {
  const [q, setQ] = useState("");
  const [ordem, setOrdem] = useState<"nome" | "valor">("nome");
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const e = camada.escopo;
  /* Com as camadas ocultas, a tabela continua \u00fatil \u2014 nomes, regi\u00e3o e Amaz\u00f4nia
     Legal s\u00e3o do territ\u00f3rio, n\u00e3o da camada. O que sai \u00e9 tudo que fala de um
     dado que n\u00e3o est\u00e1 aplicado: o CSV (uma coluna inteira de vazio), o
     invent\u00e1rio de lacunas (que acusaria "faltam as 27") e o bot\u00e3o de reportar
     erro (n\u00e3o h\u00e1 valor sobre o qual reclamar). */
  const semCamada = camada.id === CAMADA_SEM_ID;

  /* Ordenar por valor SÓ quando a camada permite. Em "doenças", ordenar
     produziria "Tocantins pior que Acre" — mas o número de TO é dengue sozinha
     e o do AC soma quatro doenças. A interface teria fabricado a afirmação; o
     dado não a contém. Por isso o botão de ordenar nem existe nesse caso. */
  const podeOrdenarPorValor = e.comparavel;
  const faltando = useMemo(() => ufs.filter((u) => camada.valor(u) == null).map((u) => u.sigla), [camada]);

  const linhas = useMemo(() => {
    const alvo = norm(q.trim());
    const filtradas = ufs.filter(
      (u) => !alvo || norm(u.nome).includes(alvo) || u.sigla.toLowerCase() === alvo || norm(u.regiao).includes(alvo),
    );
    const com = filtradas.map((u) => ({ u, v: camada.valor(u), rotulo: camada.rotularValor?.(u) }));
    if (ordem === "valor" && podeOrdenarPorValor) {
      // Sem dado vai SEMPRE para o fim, nunca tratado como zero.
      return com.sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
    }
    return com.sort((a, b) => a.u.nome.localeCompare(b.u.nome, "pt-BR"));
  }, [q, ordem, camada, podeOrdenarPorValor]);

  return (
    <div className="map-lista">
      <div className="map-lista-top">
        <label className="map-busca-field">
          <Search size={16} aria-hidden />
          <input type="search" value={q} onChange={(ev) => setQ(ev.target.value)} placeholder="Filtrar estados…" aria-label="Filtrar estados" />
        </label>
        {semCamada ? null : (
          <button type="button" className="map-toggle" onClick={() => baixarCsvDaCamada(camada)}>
            <Download size={15} aria-hidden /> Baixar CSV
          </button>
        )}
        <button type="button" className="map-toggle" onClick={onFechar}><MapIcon size={15} aria-hidden /> Ver mapa</button>
      </div>

      {/* Bloco de escopo: a mesma informação que a legenda do mapa mostra, para
          quem lê a tabela sem ter visto o mapa. */}
      <p className="map-lista-escopo">
        {semCamada ? (
          e.naoMede
        ) : (
          <>
            <span className={`map-selo map-selo--${e.maturidade}`}>{e.maturidade}</span>
            {e.cobertura.medidas} de {e.cobertura.total} unidades federativas com valor medido.
            {" "}{e.naoMede}
            {" "}
            <a className="map-reportar" href={linkDeErro({ categoria: "valor-errado", camada })}>
              Reportar erro nesta camada
            </a>
          </>
        )}
      </p>

      {/* O cinza do mapa é ambíguo: pode ser "medimos e não há" ou "não
          medimos". São coisas opostas, e nomear quais estados faltam é a única
          forma de não afirmar a primeira quando se quer dizer a segunda. */}
      {faltando.length && !semCamada ? (
        <details className="map-lacunas">
          <summary>
            Sem dado nesta camada: {faltando.length} de {e.cobertura.total} unidades federativas
          </summary>
          <p>{faltando.join(", ")}</p>
          <p className="map-lacunas-nota">
            Ausência aqui significa dado ainda não cadastrado — não ausência de risco, de atividade
            ou de ocorrência.
          </p>
        </details>
      ) : null}

      <table className="map-tabela">
        <caption>
          {camada.label} — {camada.fonte.publicador ?? camada.fonte.titulo}
          {camada.fonte.data ? ` (${camada.fonte.data})` : ""}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <button type="button" className="map-th-btn" onClick={() => setOrdem("nome")} aria-pressed={ordem === "nome"}>
                Estado
              </button>
            </th>
            <th scope="col">Região</th>
            <th scope="col">Amazônia Legal</th>
            <th scope="col" aria-sort={ordem === "valor" ? "descending" : "none"}>
              {podeOrdenarPorValor ? (
                <button type="button" className="map-th-btn" onClick={() => setOrdem("valor")} aria-pressed={ordem === "valor"}>
                  {camada.tipo === "sequencial" ? "Valor" : "Situação"}
                </button>
              ) : (
                camada.tipo === "sequencial" ? "Valor" : "Situação"
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(({ u, v, rotulo }) => (
            <tr key={u.sigla}>
              <th scope="row">
                <button type="button" className="map-tabela-uf" onClick={() => onSelecionar(u.sigla)}>
                  {u.nome} <em>{u.sigla}</em>
                  {temConteudo(u.sigla) ? <span className="map-tag map-tag--confirmado">ficha</span> : null}
                  <ChevronRight size={15} aria-hidden />
                </button>
              </th>
              <td data-rotulo="Região">{u.regiao}</td>
              <td data-rotulo="Amazônia Legal">{u.amazoniaLegal ?? "—"}</td>
              {/* Camada categórica mostra o RÓTULO, não o número: `valor` devolve
                  1 tanto para integral quanto para parcial, e publicar isso como
                  coluna seria um ranking de booleanos. */}
              <td data-rotulo="Valor" className="map-tabela-valor">
                {camada.tipo === "categorica" || !e.comparavel
                  ? rotulo ?? "—"
                  : v == null
                    ? <span className="map-sem-dado">sem dado</span>
                    : v.toLocaleString("pt-BR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {linhas.length === 0 ? <p className="map-empty-note">Nenhum estado corresponde a “{q}”.</p> : null}
    </div>
  );
}
