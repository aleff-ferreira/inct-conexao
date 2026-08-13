/**
 * ============================================================================
 *  Curso "Do átomo à ação biológica" — página pública (#/curso)
 * ============================================================================
 *  Apresenta o curso e embute a inscrição, preservando a identidade visual do
 *  INCT-CONEXAO (tokens, tipografia, cores, `.section-*`, `.button`). As
 *  animações moleculares são LEVES e todas atrás de `prefers-reduced-motion`
 *  (ver styles.css). Nenhuma âncora `#secao` é usada para navegar: `#algo` sem
 *  barra é rota "home" no roteador — a rolagem interna é por `scrollIntoView`,
 *  para não jogar a pessoa para fora de `#/curso`.
 * ============================================================================
 */
import { ArrowRight, Atom, Award, BookOpen, Boxes, CalendarClock, Database, ExternalLink, FlaskConical, GraduationCap, MapPin, Microscope, Pill, ShieldCheck, Sparkles, Target } from "lucide-react";
import { absoluteUrl, useWebinarHead } from "../webinars/seo";
import { movimentoReduzido } from "../figuras/movimento";
import FormularioInscricao from "./FormularioInscricao";
import { HeroMolecula, MoleculaMini } from "./Molecula";
import { CASOS, CASO_DEMO, EQUIPE, FERRAMENTAS, MODULOS, SALVAGUARDA, TEXTO, TODAS_TURMAS } from "./conteudo";

/** Rola até uma seção sem mexer na hash (que jogaria a rota para "home"). */
function rolarPara(id: string): void {
  const alvo = document.getElementById(id);
  if (!alvo) return;
  alvo.scrollIntoView({ block: "start", behavior: movimentoReduzido() ? "auto" : "smooth" });
  // Leva o foco ao início da seção para quem navega por teclado/leitor de tela.
  const foco = alvo.querySelector<HTMLElement>("h2, [tabindex], input, button, a");
  window.requestAnimationFrame(() => foco?.focus?.({ preventScroll: true }));
}

const ICONE_MODULO = [Microscope, FlaskConical] as const;
/** Ícone de cada ferramenta, na ordem de `FERRAMENTAS` (conteudo.ts). */
const ICONE_FERRAMENTA = [Database, Sparkles, Microscope, Target, Pill] as const;

export default function CursoPage() {
  useWebinarHead({
    title: `${TEXTO.nome}: ${TEXTO.descritivo} | INCT-CONEXAO`,
    description:
      "CONEXAO-BIOINFORMÁTICA: curso presencial e prático de bioinformática estrutural, IA, docking e ADMET para estudantes de Veterinária e Agronomia e docentes do IFRO Campus Jaru. 19 a 21 de agosto de 2026. Não é necessário saber programar.",
    ogTitle: `${TEXTO.nome}: ${TEXTO.descritivo}`,
    ogType: "website",
    url: absoluteUrl(`${import.meta.env.BASE_URL}#/curso`),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Course",
      name: `${TEXTO.nome}: ${TEXTO.descritivo}`,
      description: TEXTO.subtitulo,
      inLanguage: "pt-BR",
      provider: { "@type": "Organization", name: "INCT-CONEXAO", url: absoluteUrl(import.meta.env.BASE_URL) },
      offers: { "@type": "Offer", price: "0", priceCurrency: "BRL", category: "Gratuito" },
    },
  });

  return (
    <main className="curso-page" id="conteudo" tabIndex={-1}>
      {/* ============================================================ HERO == */}
      <header className="curso-hero">
        <div className="section-inner curso-hero-inner">
          <div className="curso-hero-copy">
            <p className="eyebrow dark">
              <Atom size={15} aria-hidden="true" /> Curso presencial · IFRO Campus Jaru
            </p>
            <h1 className="curso-hero-titulo">
              <span className="curso-hero-marca">{TEXTO.nome}</span>
              <span className="curso-hero-desc">{TEXTO.descritivo}</span>
            </h1>
            <p className="curso-hero-sub">{TEXTO.subtitulo}</p>
            <p className="curso-hero-metafora">
              <Sparkles size={16} aria-hidden="true" /> {TEXTO.metafora}
            </p>

            <ul className="curso-hero-fatos">
              <li>
                <CalendarClock size={16} aria-hidden="true" /> {TEXTO.quando}
              </li>
              <li>
                <MapPin size={16} aria-hidden="true" /> {TEXTO.onde}
              </li>
              <li>
                <Award size={16} aria-hidden="true" /> {TEXTO.cargaHoraria}
              </li>
            </ul>

            <p className="curso-hero-selo">
              <ShieldCheck size={16} aria-hidden="true" /> {TEXTO.semProgramar} Voltado a {TEXTO.publicoInline}.
            </p>

            <div className="curso-hero-ctas">
              <button type="button" className="button primary" onClick={() => rolarPara("inscricao")}>
                {TEXTO.ctaMontar} <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="button plat-ghost" onClick={() => rolarPara("conteudos")}>
                Ver os conteúdos
              </button>
            </div>
          </div>

          <div className="curso-hero-arte" aria-hidden="true">
            <HeroMolecula />
          </div>
        </div>
      </header>

      {/* ================================================= OS DOIS CONTEÚDOS == */}
      <section className="section-inner curso-secao" id="conteudos">
        <div className="curso-secao-cabeca">
          <p className="eyebrow dark">
            <MoleculaMini /> Estrutura do curso
          </p>
          <h2>Dois conteúdos, um percurso de 7 horas</h2>
          <p className="curso-secao-intro">
            O curso tem uma <strong>parte teórica</strong> e uma <strong>parte prática</strong>. A teórica é oferecida
            em dois dias (19 e 20, à tarde) e a prática em dois turnos do dia 21 (manhã ou tarde). Em cada caso, o{" "}
            <strong>mesmo conteúdo se repete</strong>, então você escolhe quando fazer cada uma. Um horário de cada
            monta as suas <strong>7 horas</strong>, com vagas limitadas a <strong>40 por turma</strong>.
          </p>
        </div>

        <div className="curso-modulos">
          {MODULOS.map((m) => {
            const Icone = ICONE_MODULO[m.numero - 1];
            return (
              <article key={m.numero} className="curso-modulo">
                <div className="curso-modulo-topo">
                  <span className="curso-modulo-num" aria-hidden="true">
                    {m.numero}
                  </span>
                  <div>
                    <p className="curso-modulo-eyebrow">
                      <Icone size={15} aria-hidden="true" /> Conteúdo {m.numero} · {m.tipo}
                    </p>
                    <h3>{m.titulo}</h3>
                  </div>
                </div>
                <p className="curso-modulo-resumo">{m.resumo}</p>
                <ul className="curso-modulo-aprende">
                  {m.aprende.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                <div className="curso-modulo-turmas">
                  <p className="curso-modulo-turmas-titulo">Horários oferecidos</p>
                  <ul>
                    {m.turmas.map((t) => (
                      <li key={t.id}>
                        <CalendarClock size={14} aria-hidden="true" /> {t.diaRotulo} · {t.inicio} às {t.fim}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ==================================================== OS CASOS ======== */}
      <section className="section-inner curso-secao">
        <div className="curso-secao-cabeca">
          <p className="eyebrow dark">
            <FlaskConical size={15} aria-hidden="true" /> Casos aplicados
          </p>
          <h2>Quatro alvos moleculares do território</h2>
          <p className="curso-secao-intro">
            Sistemas reais, selecionados por sua relevância para a Medicina Veterinária, a Agronomia e a Saúde
            Única em Rondônia. Cada cartão indica a estrutura de referência (PDB) e o ligante analisado.
          </p>
        </div>
        <div className="curso-casos">
          {CASOS.map((c) => (
            <article key={c.id} className="curso-caso" tabIndex={0}>
              <div className="curso-caso-badge" aria-hidden="true">
                <Boxes size={18} />
              </div>
              <h3>{c.alvo}</h3>
              <p className="curso-caso-sistema">{c.sistema}</p>
              <p className="curso-caso-conexao">
                <MapPin size={13} aria-hidden="true" /> {c.conexao}
              </p>
              <p className="curso-caso-ideia">{c.ideia}</p>
              <p className="curso-caso-pdb">
                <span>PDB</span> {c.pdb} · ligante {c.ligante}
              </p>
            </article>
          ))}
        </div>
        <p className="curso-caso-demo">
          <BookOpen size={15} aria-hidden="true" /> <strong>Caso demonstrativo ({CASO_DEMO.alvo}, PDB {CASO_DEMO.pdb}):</strong>{" "}
          {CASO_DEMO.ideia}
        </p>
      </section>

      {/* ================================================== AS FERRAMENTAS ==== */}
      <section className="section-inner curso-secao">
        <div className="curso-secao-cabeca">
          <p className="eyebrow dark">
            <Microscope size={15} aria-hidden="true" /> Ferramentas
          </p>
          <h2>Programas consagrados de bioinformática estrutural</h2>
        </div>
        <ul className="curso-ferramentas">
          {FERRAMENTAS.map((t, i) => {
            const Icone = ICONE_FERRAMENTA[i] ?? Boxes;
            return (
              <li key={t.nome}>
                <a
                  className="curso-ferramenta"
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`Abrir ${t.nome} (nova aba)`}
                >
                  <span className="curso-ferramenta-icone">
                    <Icone size={20} aria-hidden="true" />
                  </span>
                  <span className="curso-ferramenta-txt">
                    <strong>
                      {t.nome} <ExternalLink size={12} aria-hidden="true" />
                    </strong>
                    <span>{t.papel}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
        <p className="curso-salvaguarda">
          <ShieldCheck size={15} aria-hidden="true" /> {SALVAGUARDA}
        </p>
      </section>

      {/* ===================================================== A INSCRIÇÃO ==== */}
      <section className="curso-inscricao-band" id="inscricao">
        <div className="rel-inner curso-inscricao-inner">
          <div className="curso-secao-cabeca curso-inscricao-cabeca">
            <p className="eyebrow">
              <GraduationCap size={15} aria-hidden="true" /> Inscrição · {TODAS_TURMAS.length} horários
            </p>
            <h2 tabIndex={-1}>{TEXTO.ctaMontar}</h2>
            <p className="curso-secao-intro">
              Escolha uma sessão de cada conteúdo, preencha seus dados e confirme. Leva cerca de 5 minutos e você
              recebe um protocolo na tela.
            </p>
          </div>
          <FormularioInscricao />
        </div>
      </section>

      {/* ======================================================= A EQUIPE ===== */}
      <section className="section-inner curso-secao curso-equipe-secao">
        <div className="curso-secao-cabeca">
          <p className="eyebrow dark">Realização</p>
          <h2>Quem conduz</h2>
        </div>
        <ul className="curso-equipe">
          {EQUIPE.map((p) => (
            <li key={p.nome}>
              <strong>{p.nome}</strong>
              <span>{p.papel}</span>
              <a className="curso-lattes" href={p.lattes} target="_blank" rel="noreferrer">
                Currículo Lattes <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
        <p className="curso-realizacao">
          INCT-CONEXAO · IFRO Campus Jaru · apoio PPP/FAPERO. Dúvidas:{" "}
          <a href={`mailto:${TEXTO.contato}`}>{TEXTO.contato}</a>.
        </p>
      </section>
    </main>
  );
}
