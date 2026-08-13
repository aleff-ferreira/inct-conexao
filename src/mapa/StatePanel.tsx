/**
 * StatePanel — painel de detalhe do estado (lateral no desktop, bottom sheet no
 * mobile; o layout é decidido por CSS). Divulgação progressiva por seções
 * (accordion controlado, para permitir deep-link `?sec=`), emergência sempre
 * visível, fontes e rótulos de incerteza em cada registro.
 */
import { useEffect, useId, useRef, useState } from "react";
import {
  X, AlertTriangle, Bug, Activity, Leaf, Stethoscope, FlaskConical,
  ExternalLink, Info, ShieldAlert, ShieldCheck, Eye, HeartPulse, Printer,
} from "lucide-react";
import type { Uf } from "./types";
import type { Camada } from "./layers";
import { posicaoDe, frasePosicao, avisoCobertura } from "./ranking";
import type { AnimalPeconhento, Doenca, EstadoConteudo, Fonte } from "./types";
import { mapaAsset } from "./content";
import { VAGAS_IC_2026, INSTITUICOES_POR_UF } from "./layers";
import { CountUp, Ring, BarChart, Timeline, fmtNum } from "./viz";
import { chuvaDaRegiao } from "./clima";

type SecaoId = "geral" | "animais" | "doencas" | "ambiente" | "servicos" | "inct";

const SECOES: { id: SecaoId; label: string; icon: typeof Bug }[] = [
  { id: "geral", label: "Visão geral", icon: Info },
  { id: "animais", label: "Animais peçonhentos", icon: Bug },
  { id: "doencas", label: "Doenças tropicais e negligenciadas", icon: Activity },
  { id: "ambiente", label: "Ambiente & clima", icon: Leaf },
  { id: "servicos", label: "Serviços & emergência", icon: Stethoscope },
  { id: "inct", label: "Pesquisa & INCT-CONEXAO", icon: FlaskConical },
];

const OCORRENCIA_ROTULO: Record<string, string> = {
  confirmado: "Ocorrência confirmada",
  provavel: "Ocorrência provável",
  incerto: "Ocorrência incerta",
};

export type StatePanelProps = {
  uf: Uf;
  conteudo?: EstadoConteudo;
  /** Camada ativa: define se ha posicao a mostrar, e em que recorte. */
  camada: Camada;
  secaoAberta: SecaoId | null;
  leve: boolean;
  onAbrirSecao: (s: SecaoId | null) => void;
  onFechar: () => void;
};

export function StatePanel({ uf, conteudo, camada, secaoAberta, leve, onAbrirSecao, onFechar }: StatePanelProps) {
  const ref = useRef<HTMLElement>(null);
  const tituloId = useId();

  // ao abrir/trocar de estado, move o foco para o título do painel (a11y)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>(".map-panel-title")?.focus();
  }, [uf.sigla]);

  /* `tudo` expande as seis seções ao mesmo tempo. Serve a dois usos:
     imprimir a ficha inteira (uma regra @media print não conseguiria, porque
     as seções são renderização condicional e não estão no DOM) e permitir que
     o Ctrl+F do navegador encontre um termo que está numa aba fechada. */
  const [tudo, setTudo] = useState(false);
  const aberta = secaoAberta ?? "geral";
  const mostrar = (s: SecaoId) => tudo || aberta === s;

  /* O botão precisa existir: no iOS Safari não há `onbeforeprint`, então não dá
     para expandir automaticamente ao acionar a impressão do navegador. E o
     `requestAnimationFrame` duplo garante que o React já pintou as seções antes
     de a caixa de impressão abrir — sem isso, imprime o que estava na tela. */
  const imprimir = () => {
    setTudo(true);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  };
  const postos = posicaoDe(uf, camada);
  const aviso = postos.length ? avisoCobertura(camada) : null;
  const vagas = VAGAS_IC_2026[uf.sigla];
  const inst = INSTITUICOES_POR_UF[uf.sigla] ?? 0;
  const contagem: Record<SecaoId, number> = {
    geral: 0,
    animais: conteudo?.animais?.length ?? 0,
    doencas: conteudo?.doencas?.length ?? 0,
    ambiente: conteudo?.ambiente ? 1 : 0,
    servicos: 0,
    inct: conteudo?.atividadesInct?.length ?? 0,
  };

  // dashboard visual da Visão geral
  const [mes, setMes] = useState(() => new Date().getMonth());
  const chuva = chuvaDaRegiao(uf.regiao);
  const secoesConteudo = [!!conteudo?.resumo, contagem.animais > 0, contagem.doencas > 0, !!conteudo?.ambiente, contagem.inct > 0];
  const completos = secoesConteudo.filter(Boolean).length;
  const perfil = [
    { label: "Animais", valor: contagem.animais, cor: "var(--clay)" },
    { label: "Doenças", valor: contagem.doencas, cor: "var(--gold)" },
    { label: "Instituições", valor: inst, cor: "var(--river)" },
    { label: "Vagas IC", valor: vagas ?? 0, cor: "var(--leaf)" },
  ];

  return (
    <aside
      className="map-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={tituloId}
      ref={ref}
      /* Vira o rodapé da folha impressa (ver `@media print`). Endereço e data
         no papel são o que impede o PDF de virar dado sem origem — e o papel é
         justamente onde o número circula mais longe de quem o publicou. */
      data-procedencia={`${uf.nome} (${uf.sigla}) · ${typeof window !== "undefined" ? window.location.href : ""} · impresso em ${new Date().toLocaleDateString("pt-BR")}`}
    >
      <header className="map-panel-head">
        <div>
          <p className="map-panel-kicker">
            {uf.regiao} · {uf.sigla}
            {uf.amazoniaLegal ? <span className="map-tag map-tag--al">Amazônia Legal</span> : null}
          </p>
          <h2 className="map-panel-title" id={tituloId} tabIndex={-1}>{uf.nome}</h2>
        </div>
        <div className="map-panel-acoes">
          <button type="button" className="map-panel-acao" onClick={() => setTudo((v) => !v)} aria-pressed={tudo}>
            {tudo ? "Recolher seções" : "Expandir tudo"}
          </button>
          <button type="button" className="map-panel-acao" onClick={imprimir}>
            <Printer size={14} aria-hidden /> Imprimir ficha
          </button>
          <button type="button" className="icon-button no-print" onClick={onFechar} aria-label="Fechar painel e voltar ao Brasil">
            <X size={18} aria-hidden />
          </button>
        </div>
      </header>

      {/* Emergência SEMPRE visível, no topo */}
      <div className="map-emergency" role="note">
        <ShieldAlert size={18} aria-hidden />
        <div>
          <strong>Emergência:</strong> ligue <a href="tel:192">SAMU 192</a>. Intoxicações/acidentes com
          animais peçonhentos: <a href="tel:08007226001">Disque-Intoxicação 0800 722 6001</a> (CIATox).
          <span className="map-emergency-note"> Em risco de vida, procure o serviço de saúde mais próximo.</span>
        </div>
      </div>

      {/* Ressalva de beta: repetida aqui porque é na ficha que os números são lidos. */}
      <p className="map-beta-flag">
        <AlertTriangle size={14} aria-hidden /> Mapa em <strong>fase de testes</strong>: conteúdo em revisão
        científica, ainda não utilizável como referência.
      </p>

      {conteudo?.demonstracao ? (
        <p className="map-demo-flag"><Info size={14} aria-hidden /> Ficha de <strong>demonstração</strong>: conteúdo ilustrativo, verificável pelas fontes citadas, ainda em revisão editorial.</p>
      ) : null}

      {/* Régua de posição: só existe quando a camada é comparável, e sempre
          com o denominador impresso. "1º de 27" com 4 estados medidos não é
          posição — é artefato de cobertura, e o mais enganoso possível. */}
      {postos.length ? (
        <div className="map-regua">
          <p className="map-regua-titulo">Posição em {camada.label}</p>
          {postos.map((p) => (
            <div key={p.recorte} className="map-regua-linha">
              <span className="map-regua-rotulo">{p.recorte}</span>
              {/* A barra é decorativa: quem usa leitor de tela recebe a frase,
                  que é mais precisa que qualquer comprimento. */}
              <span className="map-regua-trilho" aria-hidden>
                <span className="map-regua-preenchida" style={{ width: `${Math.round(p.fracao * 100)}%` }} />
              </span>
              <span className="map-regua-posto">
                {p.posicao}º<span className="map-regua-de"> de {p.de}</span>
              </span>
              <span className="sr-only">{frasePosicao(p, camada)}</span>
            </div>
          ))}
          {aviso ? <p className="map-regua-aviso">{aviso}</p> : null}
        </div>
      ) : null}

      {/* Painel de indicadores do estado */}
      <div className="map-panel-stats" aria-label="Indicadores do estado">
        <div className="map-ptile"><strong><CountUp value={vagas ?? 0} /></strong><span>vagas de IC</span></div>
        <div className="map-ptile"><strong><CountUp value={inst} /></strong><span>instituições</span></div>
        <div className={`map-ptile${uf.amazoniaLegal ? " is-al" : ""}`}><strong>{uf.amazoniaLegal ? "Sim" : "Não"}</strong><span>Amazônia Legal</span></div>
      </div>

      {/* Índice de seções (chips) com contagem de registros */}
      <nav className="map-panel-tabs" aria-label="Seções do estado">
        {SECOES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`map-panel-tab${aberta === s.id ? " is-active" : ""}`}
            aria-current={aberta === s.id ? "true" : undefined}
            onClick={() => onAbrirSecao(s.id)}
          >
            <s.icon size={15} aria-hidden /> {s.label}
            {contagem[s.id] ? <span className="map-tab-badge" aria-label={`${contagem[s.id]} registros`}>{contagem[s.id]}</span> : null}
          </button>
        ))}
      </nav>

      <div className="map-panel-body">
        {mostrar("geral") && (
          <Secao titulo="Visão geral" icon={Info}>
            {/* Painel visual: anel de completude + perfil em barras */}
            <div className="viz-dash">
              <div className="viz-dash-ring">
                <Ring value={completos} max={secoesConteudo.length} sub="ficha" aria={`Ficha ${Math.round((completos / secoesConteudo.length) * 100)} por cento completa`} />
                <p className="viz-cap">completude da ficha</p>
              </div>
              <BarChart data={perfil} ariaLabel={`Perfil de ${uf.nome}`} />
            </div>

            {/* Linha do tempo climatológica ajustável */}
            <Timeline chuvoso={chuva} mes={mes} onMes={setMes} regiao={uf.regiao} />

            {conteudo?.resumo ? <p className="map-resumo">{conteudo.resumo}</p> : <FichaEmPreparo nome={uf.nome} />}

            <details className="map-facts-more">
              <summary>Dados do estado</summary>
              <dl className="map-facts">
                <div><dt>Região</dt><dd>{uf.regiao}</dd></div>
                <div><dt>Amazônia Legal</dt><dd>{uf.amazoniaLegal ? (uf.amazoniaLegal === "parcial" ? "Sim (parcial)" : "Sim") : "Não"}</dd></div>
                {vagas != null ? <div><dt>Vagas de IC (2026)</dt><dd>{vagas}</dd></div> : null}
                <div><dt>Código IBGE</dt><dd>{uf.codigoIbge}</dd></div>
              </dl>
            </details>
            <Fontes fontes={conteudo?.fontes} />
          </Secao>
        )}

        {mostrar("animais") && (
          <Secao titulo="Animais peçonhentos" icon={Bug}>
            <p className="map-section-lede">Animais <em>peçonhentos</em> inoculam veneno (picada/ferrão), diferentes dos <em>venenosos</em> (tóxicos se ingeridos/tocados). Fotos servem só de referência: a identificação segura em campo exige cautela.</p>
            {conteudo?.animais?.length ? (
              conteudo.animais.map((a, i) => <AnimalCard key={i} a={a} leve={leve} />)
            ) : (
              <SemRegistros />
            )}
          </Secao>
        )}

        {mostrar("doencas") && (
          <Secao titulo="Doenças tropicais e negligenciadas" icon={Activity}>
            <p className="map-section-lede">Conteúdo <strong>educativo</strong>. Não substitui avaliação profissional. O site não diagnostica nem prescreve.</p>
            {conteudo?.doencas?.length ? (
              <DoencasSecao doencas={conteudo.doencas} uf={uf.nome} />
            ) : (
              <SemRegistros />
            )}
          </Secao>
        )}

        {mostrar("ambiente") && (
          <Secao titulo="Ambiente & clima" icon={Leaf}>
            {conteudo?.ambiente ? (
              <>
                {conteudo.ambiente.resumo ? <p>{conteudo.ambiente.resumo}</p> : null}
                <dl className="map-facts">
                  {conteudo.ambiente.biomas?.length ? <div><dt>Biomas</dt><dd>{conteudo.ambiente.biomas.join(", ")}</dd></div> : null}
                  {conteudo.ambiente.hidrografia ? <div><dt>Hidrografia</dt><dd>{conteudo.ambiente.hidrografia}</dd></div> : null}
                  {conteudo.ambiente.clima ? <div><dt>Clima</dt><dd>{conteudo.ambiente.clima}</dd></div> : null}
                </dl>
                <Fontes fontes={conteudo.ambiente.fontes} />
              </>
            ) : (
              <SemRegistros />
            )}
          </Secao>
        )}

        {mostrar("servicos") && (
          <Secao titulo="Serviços & emergência" icon={Stethoscope}>
            <ul className="map-servicos">
              <li><strong>SAMU</strong>: <a href="tel:192">192</a> <span className="map-muted">urgência e emergência</span></li>
              <li><strong>Disque-Intoxicação (CIATox)</strong>: <a href="tel:08007226001">0800 722 6001</a> <span className="map-muted">acidentes com peçonhentos e intoxicações</span></li>
              <li><strong>Bombeiros</strong>: <a href="tel:193">193</a></li>
              {(conteudo?.servicos ?? []).map((s, i) => (
                <li key={i}><strong>{s.nome}</strong>: {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.contato}</a> : s.contato} {s.nota ? <span className="map-muted">{s.nota}</span> : null}</li>
              ))}
            </ul>
            <p className="map-note"><Info size={14} aria-hidden /> Telefones nacionais oficiais. A rede de referência para soroterapia varia por município. Confirme com a Vigilância em Saúde local.</p>
          </Secao>
        )}

        {mostrar("inct") && (
          <Secao titulo="Pesquisa & INCT-CONEXAO" icon={FlaskConical}>
            {conteudo?.atividadesInct?.length ? (
              <ul className="map-inct">
                {conteudo.atividadesInct.map((a, i) => (
                  <li key={i}>
                    <span className="map-inct-kind">{a.tipo}</span>
                    <strong>{a.titulo}</strong>
                    {a.confianca === "incerto" ? <span className="map-tag map-tag--warn">a confirmar</span> : null}
                    {a.detalhe ? <p>{a.detalhe}</p> : null}
                    {a.url ? <a className="map-src-link" href={a.url} target="_blank" rel="noreferrer">Acessar <ExternalLink size={12} aria-hidden /></a> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <SemRegistros />
            )}
          </Secao>
        )}

        {conteudo?.revisadoPor || conteudo?.revisadoEm ? (
          <p className="map-review">
            {conteudo.revisadoPor ? <>Revisão: {conteudo.revisadoPor}. </> : null}
            {conteudo.revisadoEm ? <>Última atualização: {conteudo.revisadoEm}.</> : null}
          </p>
        ) : null}
      </div>
    </aside>
  );
}

/* ---- subcomponentes ---- */

function Secao({ titulo, icon: Icon, children }: { titulo: string; icon: typeof Bug; children: React.ReactNode }) {
  return (
    <section className="map-section" aria-label={titulo}>
      <h3 className="map-section-h"><Icon size={17} aria-hidden /> {titulo}</h3>
      {children}
    </section>
  );
}

function AnimalCard({ a, leve }: { a: AnimalPeconhento; leve: boolean }) {
  const img = mapaAsset(a.imagem);
  return (
    <article className="map-record">
      <div className="map-record-head">
        <h4>{a.nomeComum} <span className="map-sci">{a.nomeCientifico}</span></h4>
        <span className={`map-tag map-tag--${a.ocorrencia}`}>{OCORRENCIA_ROTULO[a.ocorrencia] ?? a.ocorrencia}</span>
      </div>
      <p className="map-record-meta">{a.grupo}{a.distribuicao ? ` · ${a.distribuicao}` : ""}</p>
      {img && !leve ? (
        <figure className="map-figure">
          <img src={img} alt={a.imagemAlt ?? `${a.nomeComum} (${a.nomeCientifico})`} loading="lazy" decoding="async" />
          {a.imagemCredito ? <figcaption>{a.imagemCredito}</figcaption> : null}
        </figure>
      ) : null}
      {a.identificacao ? <p><strong>Como reconhecer:</strong> {a.identificacao}</p> : null}
      {a.prevencao?.length ? <Lista titulo="Prevenção" itens={a.prevencao} /> : null}
      {a.primeirosSocorros?.length ? <Lista titulo="Em caso de acidente" itens={a.primeirosSocorros} /> : null}
      {a.naoFazer?.length ? (
        <div className="map-dont">
          <p><AlertTriangle size={14} aria-hidden /> <strong>Não faça</strong></p>
          <ul>{a.naoFazer.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      ) : null}
      <Fontes fontes={a.fontes} />
    </article>
  );
}

/** Seção de doenças: panorama de notificações (ranking legível) + fichas que
 *  abrem sob clique. Torna o dado grande fácil de assimilar sem esconder as
 *  ressalvas de origem. */
function DoencasSecao({ doencas, uf }: { doencas: Doenca[]; uf: string }) {
  // ranking por notificações (só as representativas — exclui, ex., malária/SINAN)
  const comDado = doencas
    .filter((d) => d.notificacoes && d.notificacoes.representativo !== false)
    .sort((a, b) => (b.notificacoes!.valor) - (a.notificacoes!.valor));
  const total = comDado.reduce((s, d) => s + d.notificacoes!.valor, 0);
  const periodo = comDado[0]?.notificacoes?.periodo;
  const sistema = comDado[0]?.notificacoes?.sistema;

  return (
    <>
      {comDado.length >= 1 ? (
        <div className="map-burden">
          {comDado.length >= 2 ? (
            <>
              <div className="map-burden-top">
                <div className="map-burden-tot">
                  <strong><CountUp value={total} format={fmtNum} /></strong>
                  <span>notificações{periodo ? ` · ${periodo}` : ""}</span>
                </div>
              </div>
              <BarChart
                data={comDado.map((d) => ({ label: d.nome, valor: d.notificacoes!.valor, cor: "var(--gold)" }))}
                fmt={fmtNum}
                ariaLabel={`Notificações por doença em ${uf}`}
              />
            </>
          ) : null}
          <p className="map-burden-nota">
            <Info size={13} aria-hidden /> {sistema ? `${sistema}. ` : ""}
            Notificação não é o mesmo que caso confirmado, e o número também depende da intensidade da vigilância.
            Use como ordem de grandeza, não como comparação exata.
          </p>
        </div>
      ) : null}

      {doencas.map((d, i) => <DoencaCard key={i} d={d} maxValor={comDado[0]?.notificacoes?.valor ?? 0} defaultOpen={doencas.length <= 1} />)}
    </>
  );
}

function DoencaCard({ d, maxValor, defaultOpen }: { d: Doenca; maxValor: number; defaultOpen: boolean }) {
  const n = d.notificacoes;
  const foraDoTotal = n?.representativo === false;
  const share = n && !foraDoTotal && maxValor ? Math.max(4, Math.round((n.valor / maxValor) * 100)) : 0;
  return (
    <details className="map-doenca" open={defaultOpen}>
      <summary>
        <span className="map-doenca-nome">{d.nome}</span>
        {n && !foraDoTotal ? (
          <span className="map-doenca-num">
            <strong>{fmtNum(n.valor)}</strong>
            <span className="map-doenca-num-lbl">notif.</span>
          </span>
        ) : foraDoTotal ? (
          <span className="map-doenca-tag">ver ressalva</span>
        ) : null}
      </summary>

      {n ? (
        <div className={`map-doenca-dado${foraDoTotal ? " is-caveat" : ""}`}>
          {!foraDoTotal && maxValor ? (
            <span className="map-doenca-bar" aria-hidden><span style={{ width: `${share}%` }} /></span>
          ) : null}
          <p>
            <strong>{fmtNum(n.valor)}</strong> notificações · {n.periodo}. <span className="map-muted">{n.sistema}.</span>
            {n.nota ? <span className="map-doenca-caveat"><AlertTriangle size={12} aria-hidden /> {n.nota}</span> : null}
          </p>
        </div>
      ) : null}

      {d.agente ? <p className="map-record-meta">Agente: {d.agente}</p> : null}
      {d.transmissao ? <p><strong>Transmissão:</strong> {d.transmissao}</p> : null}
      {d.vetoresReservatorios ? <p><strong>Vetores/reservatórios:</strong> {d.vetoresReservatorios}</p> : null}

      {d.prevencao?.length ? <Bloco icon={ShieldCheck} titulo="Como se prevenir" itens={d.prevencao} /> : null}
      {d.comoReconhecer ? (
        <div className="map-mini">
          <p className="map-mini-h"><Eye size={13} aria-hidden /> Como reconhecer</p>
          <p className="map-mini-txt">{d.comoReconhecer}</p>
        </div>
      ) : null}
      {d.sinaisAlerta?.length ? (
        <div className="map-alert">
          <p><AlertTriangle size={14} aria-hidden /> <strong>Procure atendimento se houver</strong></p>
          <ul>{d.sinaisAlerta.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </div>
      ) : null}
      {d.tratamento?.length ? <Bloco icon={HeartPulse} titulo="Primeiros cuidados" itens={d.tratamento} /> : null}
      {d.manejoServicos ? <p className="map-manejo"><Info size={14} aria-hidden /> <strong>Nos serviços de saúde:</strong> {d.manejoServicos} <em>(informação geral, não é orientação de tratamento individual).</em></p> : null}
      <Fontes fontes={d.fontes} />
    </details>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  return (
    <div className="map-mini">
      <p className="map-mini-h">{titulo}</p>
      <ul>{itens.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

/** Lista com ícone no cabeçalho (prevenção / cuidados). */
function Bloco({ icon: Icon, titulo, itens }: { icon: typeof Bug; titulo: string; itens: string[] }) {
  return (
    <div className="map-mini">
      <p className="map-mini-h"><Icon size={13} aria-hidden /> {titulo}</p>
      <ul>{itens.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </div>
  );
}

function Fontes({ fontes }: { fontes?: Fonte[] }) {
  if (!fontes?.length) return null;
  return (
    <p className="map-sources">
      <span className="map-sources-h">Fontes:</span>{" "}
      {fontes.map((f, i) => (
        <span key={i}>
          {i > 0 ? "; " : ""}
          {f.url ? <a href={f.url} target="_blank" rel="noreferrer">{f.titulo}{f.publicador ? ` (${f.publicador})` : ""} <ExternalLink size={11} aria-hidden /></a> : <>{f.titulo}{f.publicador ? ` (${f.publicador})` : ""}</>}
        </span>
      ))}
    </p>
  );
}

function SemRegistros() {
  return (
    <p className="map-empty-note">
      <Info size={15} aria-hidden /> Sem registros nesta ficha. <strong>Ausência de registro não significa ausência</strong> da espécie, doença ou risco: apenas que ainda não foi cadastrado e revisado.
    </p>
  );
}

function FichaEmPreparo({ nome }: { nome: string }) {
  return (
    <p className="map-empty-note">
      <Info size={15} aria-hidden /> A ficha de <strong>{nome}</strong> está em preparação. Os estados de demonstração (Rondônia, Amazonas e Ceará) mostram o formato completo. Ausência de conteúdo não indica ausência de risco ou de atividade.
    </p>
  );
}

export { SECOES };
export type { SecaoId };
