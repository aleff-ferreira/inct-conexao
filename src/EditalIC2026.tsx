import { useEffect } from "react";
import {
  ArrowLeft,
  Award,
  CalendarClock,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  ScrollText,
  Sparkles,
  Users,
  Video,
} from "lucide-react";

const asset = (fileName: string) => `${import.meta.env.BASE_URL}assets/${fileName}`;

/** Fatos-chave exibidos no topo (todos conferidos no edital oficial). */
const keyFacts = [
  { icon: Award, label: "Bolsas de IC/CNPq", value: "50" },
  { icon: Coins, label: "Valor mensal", value: "R$ 700" },
  { icon: CalendarClock, label: "Vigência", value: "12 meses" },
  { icon: FileText, label: "Inscrições", value: "01–15 jul 2026" },
];

/** Eixos Estratégicos Transversais (EET) — linhas de pesquisa do processo. */
const eets = [
  { code: "EET-1", title: "Clima, ambiente e saúde única", text: "Interações entre clima, meio ambiente e sociedade e seus impactos na saúde única da Amazônia Legal." },
  { code: "EET-2", title: "Diagnóstico situacional da Amazônia", text: "Dados climáticos, socioterritoriais, etnobotânicos, etnoecológicos, ecotoxicológicos e epidemiológicos." },
  { code: "EET-3", title: "Biodiversidade e bioprospecção", text: "Biodiversidade, bioprospecção e biotecnologia de venenos/toxinas, plantas medicinais e biomoléculas do bioma amazônico." },
  { code: "EET-4", title: "Bioeconomia e AEPLs", text: "Bioeconomia, empreendedorismo, inovação e políticas públicas em CT&I aplicadas aos arranjos ecoprodutivos locais." },
  { code: "EET-5", title: "Bioinformática e Saúde Pública de Precisão", text: "Tecnologias de SPP aplicadas a acidentes com animais peçonhentos/venenosos e às mudanças climáticas." },
  { code: "EET-6", title: "Biologia estrutural e química medicinal", text: "Bioensaios e ensaios in vitro e in silico aplicados a plantas medicinais, toxinas e biomoléculas de interesse." },
  { code: "EET-7", title: "Formação, redes e divulgação científica", text: "Formação de pessoas e redes de pesquisa em biotecnologia, biodiversidade, biometeorologia e bioeconomia." },
  { code: "EET-8", title: "Políticas informadas por evidências e educação", text: "Educação ambiental, científica e em saúde junto às comunidades originárias e à sociedade amazônica." },
];

/** Distribuição das 50 bolsas (item 3 do edital). */
const amazoniaLegal = [
  { uf: "Rondônia (RO)", vagas: 17, inst: "FIOCRUZ RO, UNIR, IFRO, Afya São Lucas, IESPRO, FIMCA, FAAr, FCR, ECOPORÉ, CEPEM, CEMETRON, CCIPWP" },
  { uf: "Pará (PA)", vagas: 4, inst: "UFPA, UFOPA" },
  { uf: "Roraima (RR)", vagas: 3, inst: "UFRR" },
  { uf: "Amazonas (AM)", vagas: 3, inst: "UFAM, FIOCRUZ AM, IFAM" },
  { uf: "Maranhão (MA)", vagas: 3, inst: "UFMA, UEMA" },
  { uf: "Amapá (AP)", vagas: 3, inst: "UNIFAP" },
  { uf: "Mato Grosso (MT)", vagas: 2, inst: "UFMT" },
  { uf: "Tocantins (TO)", vagas: 1, inst: "UFT" },
];

const nordesteCentroOeste = [
  { uf: "Ceará (CE)", vagas: 3, inst: "UFC, FIOCRUZ CE" },
  { uf: "Alagoas (AL)", vagas: 2, inst: "UFAL" },
  { uf: "Mato Grosso do Sul (MS)", vagas: 2, inst: "UFGD" },
  { uf: "Distrito Federal (DF)", vagas: 2, inst: "UnB, FIOCRUZ BSB" },
  { uf: "Paraíba (PB)", vagas: 1, inst: "UEPB" },
  { uf: "Pernambuco (PE)", vagas: 1, inst: "FIOCRUZ PE" },
  { uf: "Sergipe (SE)", vagas: 1, inst: "UFS" },
  { uf: "Rio Grande do Norte (RN)", vagas: 1, inst: "UFRN" },
  { uf: "Goiás (GO)", vagas: 1, inst: "UFJ" },
];

/** Critérios de avaliação (item 5). */
const criterios = [
  { criterio: "Coerência do Plano de Trabalho com os EET e objetivos do INCT-CONEXAO", peso: "6", pontos: "60" },
  { criterio: "Histórico Escolar (Coeficiente de Rendimento Acadêmico)", peso: "2", pontos: "20" },
  { criterio: "Produção Acadêmica e Currículo Lattes", peso: "1", pontos: "10" },
  { criterio: "Vídeo de Apresentação/Intenção", peso: "1", pontos: "10" },
];

/** Documentos para inscrição (item 5.1). */
const documentos = [
  { icon: FileText, title: "Carta de intenção", text: "Até 3.500 caracteres (com espaços), em PDF — experiência na graduação, habilidades, motivação e indicação clara da região e do(a) orientador(a) pretendido(a)." },
  { icon: ScrollText, title: "Plano de Atividades", text: "Até 4.500 caracteres (com espaços), em PDF — Objetivo, Justificativa, Metodologia e Cronograma de Execução (modelo em anexo ao edital)." },
  { icon: GraduationCap, title: "Histórico escolar e matrícula", text: "Histórico escolar e comprovante de matrícula atualizados, em PDF." },
  { icon: Users, title: "Currículo Lattes", text: "Currículo Lattes atualizado nos últimos 30 dias, em PDF." },
  { icon: Video, title: "Vídeo de apresentação", text: "Vídeo de Apresentação/Intenção de 1 a 3 minutos (arquivo MPEG); enviar o link de acesso." },
];

/** Cronograma (item 7). */
const cronograma = [
  { etapa: "Publicação do edital", data: "30 de junho de 2026" },
  { etapa: "Inscrições on-line", data: "01 a 15 de julho de 2026" },
  { etapa: "Análise dos planos de trabalho e documentos", data: "16 a 25 de julho de 2026" },
  { etapa: "Divulgação do resultado preliminar", data: "27 de julho de 2026" },
  { etapa: "Homologação do resultado final", data: "31 de julho de 2026" },
  { etapa: "Implementação das bolsas", data: "Agosto de 2026" },
];

/** Perfil do candidato (item 4). */
const perfil = [
  "Estar regularmente matriculado(a) em curso de graduação, do 2º ao antepenúltimo período, em uma das instituições parceiras do INCT-CONEXAO listadas na distribuição das bolsas.",
  "Não possuir vínculo empregatício de qualquer natureza nem acumular a bolsa com outras modalidades de auxílio de agências de fomento.",
  "Possuir currículo cadastrado e atualizado na Plataforma Lattes (CNPq).",
  "Dedicar-se às atividades acadêmicas e de pesquisa previstas no Plano de Trabalho aprovado.",
];

export function EditalIC2026() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Processo Seletivo Simplificado Nº 04/2026 — Bolsas de IC/CNPq | INCT-CONEXAO";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <main className="edital-page" id="conteudo" tabIndex={-1}>
      {/* HERO */}
      <section className="section-band dark-band edital-hero">
        <img className="edital-hero-bg" src={asset("hero-forest.jpg")} alt="" />
        <div className="edital-hero-overlay" aria-hidden="true" />
        <div className="section-inner edital-hero-inner">
          <a className="edital-back" href="#editais">
            <ArrowLeft size={16} aria-hidden="true" /> Voltar para Editais
          </a>
          <p className="eyebrow">
            <Sparkles size={15} aria-hidden="true" /> Edital aberto
          </p>
          <p className="edital-kicker">Processo Seletivo Simplificado Nº 04/2026</p>
          <h1>Seleção de Bolsistas de Iniciação Científica (IC/CNPq)</h1>
          <p className="edital-hero-text">
            Seleção de 50 bolsistas de Iniciação Científica para atuar nos grupos de pesquisa e instituições do
            INCT-CONEXAO, em projetos de Biodiversidade, Biotecnologia, Bioclimatologia e Bioeconomia aplicadas à
            Saúde Única, Políticas Informadas por Evidências e Popularização da Ciência na Amazônia.
          </p>
          <div className="edital-facts">
            {keyFacts.map((fact) => {
              const Icon = fact.icon;
              return (
                <div key={fact.label} className="edital-fact">
                  <Icon size={18} aria-hidden="true" />
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </div>
              );
            })}
          </div>
          <div className="edital-hero-actions">
            <a className="button primary" href={asset("edital-selecao-ic-2026.pdf")} target="_blank" rel="noreferrer">
              Baixar edital completo (PDF) <Download size={18} aria-hidden="true" />
            </a>
            <a className="button ghost-light" href={asset("resumo-selecao-ic-2026.pdf")} target="_blank" rel="noreferrer">
              Resumo ilustrativo <FileText size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* OBJETO */}
      <section className="section-band edital-section">
        <div className="section-inner edital-shell">
          <div className="edital-block">
            <p className="eyebrow dark">Objeto e finalidade</p>
            <h2>Iniciação científica para a Amazônia, ligada à Saúde Única e à Bioeconomia</h2>
            <p>
              O processo seletivo simplificado seleciona 50 (cinquenta) bolsistas de Iniciação Científica (IC/CNPq)
              para integrar os grupos de pesquisa e instituições do INCT-CONEXAO. O programa fomenta projetos nas áreas
              de Biodiversidade, Biotecnologia, Bioclimatologia e Bioeconomia aplicadas à Saúde Única, às Políticas
              Informadas por Evidências e à Popularização da Ciência (POP CIÊNCIA), integrando a educação superior à
              ciência de fronteira na Amazônia e demais regiões de abrangência da rede.
            </p>
            <p className="edital-ods">
              Alinhado aos Objetivos de Desenvolvimento Sustentável <strong>ODS 3, 4, 8, 11 e 13</strong> e à temática
              <strong> "Ciência Delas"</strong> da 23ª Semana Nacional de Ciência e Tecnologia (SNCT 2026).
            </p>
          </div>

          <div className="edital-block">
            <p className="eyebrow dark">Linhas de pesquisa</p>
            <h2>Os 8 Eixos Estratégicos Transversais (EET)</h2>
            <div className="edital-eet-grid">
              {eets.map((e) => (
                <article key={e.code} className="edital-eet">
                  <span className="edital-eet-code">{e.code}</span>
                  <strong>{e.title}</strong>
                  <p>{e.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* DISTRIBUIÇÃO */}
      <section className="section-band edital-section edital-section--alt">
        <div className="section-inner edital-shell">
          <div className="edital-block">
            <p className="eyebrow dark">Distribuição das bolsas</p>
            <h2>Onde estão as 50 vagas</h2>
            <p>
              As bolsas são distribuídas entre pesquisadores(as) e instituições do INCT-CONEXAO nas regiões da Amazônia
              Legal, Nordeste e Centro-Oeste. As vagas podem ser remanejadas entre estados conforme a demanda e as
              deliberações do Comitê Gestor (CGes) do INCT-CONEXAO.
            </p>

            <div className="edital-dist-head">
              <MapPin size={18} aria-hidden="true" />
              <h3>Amazônia Legal — 36 bolsas</h3>
            </div>
            <div className="edital-table-wrap">
              <table className="edital-table">
                <thead>
                  <tr>
                    <th scope="col">Estado</th>
                    <th scope="col" className="num">Vagas</th>
                    <th scope="col">Instituições de destino</th>
                  </tr>
                </thead>
                <tbody>
                  {amazoniaLegal.map((r) => (
                    <tr key={r.uf}>
                      <td data-label="Estado">{r.uf}</td>
                      <td data-label="Vagas" className="num">{r.vagas}</td>
                      <td data-label="Instituições">{r.inst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="edital-dist-head">
              <MapPin size={18} aria-hidden="true" />
              <h3>Nordeste e Centro-Oeste — 14 bolsas</h3>
            </div>
            <div className="edital-table-wrap">
              <table className="edital-table">
                <thead>
                  <tr>
                    <th scope="col">Estado</th>
                    <th scope="col" className="num">Vagas</th>
                    <th scope="col">Instituições de destino</th>
                  </tr>
                </thead>
                <tbody>
                  {nordesteCentroOeste.map((r) => (
                    <tr key={r.uf}>
                      <td data-label="Estado">{r.uf}</td>
                      <td data-label="Vagas" className="num">{r.vagas}</td>
                      <td data-label="Instituições">{r.inst}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* PERFIL */}
      <section className="section-band edital-section">
        <div className="section-inner edital-shell">
          <div className="edital-block">
            <p className="eyebrow dark">Quem pode se inscrever</p>
            <h2>Perfil do candidato(a)</h2>
            <p>Além de atender a todos os requisitos do CNPq, o(a) candidato(a) deve cumprir os itens obrigatórios:</p>
            <ul className="edital-check">
              {perfil.map((p, i) => (
                <li key={i}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <p className="edital-note">
              Aplicam-se, ainda, os requisitos gerais do CNPq para bolsas de Iniciação Científica (Resolução Normativa
              RN-017/2006): dedicação às atividades de pesquisa do plano aprovado, conta-corrente ativa em nome do(a)
              próprio(a) bolsista para recebimento da bolsa e não acumulação com outra bolsa de agência de fomento
              (ressalvados benefícios como PROUNI e FIES). A orientação é conduzida por pesquisador(a) doutor(a) da
              rede, em plena atividade de pesquisa.
            </p>
          </div>
        </div>
      </section>

      {/* CRITÉRIOS */}
      <section className="section-band edital-section edital-section--alt">
        <div className="section-inner edital-shell">
          <div className="edital-block">
            <p className="eyebrow dark">Como você será avaliado</p>
            <h2>Critérios de seleção</h2>
            <p>A seleção é feita por um comitê de pesquisadores(as) do INCT-CONEXAO, somando até 100 pontos:</p>
            <div className="edital-table-wrap">
              <table className="edital-table">
                <thead>
                  <tr>
                    <th scope="col">Critério de avaliação</th>
                    <th scope="col" className="num">Peso</th>
                    <th scope="col" className="num">Pontuação máxima</th>
                  </tr>
                </thead>
                <tbody>
                  {criterios.map((c) => (
                    <tr key={c.criterio}>
                      <td data-label="Critério">{c.criterio}</td>
                      <td data-label="Peso" className="num">{c.peso}</td>
                      <td data-label="Pontuação máxima" className="num">{c.pontos} pts</td>
                    </tr>
                  ))}
                  <tr className="edital-table-total">
                    <td data-label="Total">Total</td>
                    <td data-label="Peso" className="num">10</td>
                    <td data-label="Pontuação máxima" className="num">100 pts</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="edital-callout">
              <Sparkles size={20} aria-hidden="true" />
              <div>
                <strong>Ação afirmativa "Ciência Delas"</strong>
                <span>
                  Em consonância com a SNCT 2026, candidatas do sexo feminino recebem bonificação adicional de 10% sobre
                  a nota final. Havendo candidatas suficientes, a lista final de aprovados(as) terá ao menos 50% de
                  mulheres. Mais meninas e mulheres na ciência.
                </span>
              </div>
            </div>
          </div>

          <div className="edital-block">
            <p className="eyebrow dark">O que enviar</p>
            <h2>Documentos para inscrição</h2>
            <div className="edital-doc-grid">
              {documentos.map((d) => {
                const Icon = d.icon;
                return (
                  <article key={d.title} className="edital-doc">
                    <Icon size={20} aria-hidden="true" />
                    <strong>{d.title}</strong>
                    <p>{d.text}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CRONOGRAMA + BENEFÍCIOS */}
      <section className="section-band edital-section">
        <div className="section-inner edital-shell edital-shell--split">
          <div className="edital-block">
            <p className="eyebrow dark">Datas importantes</p>
            <h2>Cronograma</h2>
            <ol className="edital-timeline">
              {cronograma.map((c) => (
                <li key={c.etapa}>
                  <span className="edital-timeline-date">{c.data}</span>
                  <span className="edital-timeline-step">{c.etapa}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="edital-block">
            <p className="eyebrow dark">Benefícios e vigência</p>
            <h2>O que a bolsa oferece</h2>
            <div className="edital-benefit">
              <Coins size={22} aria-hidden="true" />
              <div>
                <strong>R$ 700,00 por mês, durante 12 meses</strong>
                <span>Pago diretamente pelo CNPq ou via repasse institucional do INCT-CONEXAO.</span>
              </div>
            </div>
            <div className="edital-benefit">
              <Award size={22} aria-hidden="true" />
              <div>
                <strong>Investimento total de R$ 420.000,00</strong>
                <span>Programa IC/CNPq para o ciclo 2026–2027.</span>
              </div>
            </div>
            <p className="edital-note">
              A vigência da bolsa pressupõe a entrega de relatórios anuais e dos produtos sob responsabilidade do(a)
              bolsista, conforme as diretrizes do CNPq para Iniciação Científica.
            </p>
          </div>
        </div>
      </section>

      {/* COMO SE INSCREVER */}
      <section className="section-band dark-band edital-cta">
        <div className="section-inner edital-cta-inner">
          <p className="eyebrow">Como se inscrever</p>
          <h2>Leia o edital, prepare seus documentos e participe</h2>
          <p className="edital-cta-text">
            As inscrições ocorrem de 01 a 15 de julho de 2026. Consulte o edital completo para o passo a passo, o modelo
            do Plano de Atividades e as regras de envio. Em caso de dúvidas, fale com a coordenação do INCT-CONEXAO.
          </p>
          <div className="edital-hero-actions">
            <a className="button primary" href={asset("edital-selecao-ic-2026.pdf")} target="_blank" rel="noreferrer">
              Baixar edital completo (PDF) <Download size={18} aria-hidden="true" />
            </a>
            <a className="button ghost-light" href="mailto:inctconexao@gmail.com">
              inctconexao@gmail.com <Mail size={18} aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
