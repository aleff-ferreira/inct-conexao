import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Atom,
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  CloudSun,
  Compass,
  Dna,
  Download,
  ExternalLink,
  Filter,
  Globe2,
  HeartPulse,
  Instagram,
  Leaf,
  Linkedin,
  Mail,
  Map,
  Menu,
  Microscope,
  Network,
  Phone,
  Play,
  PlayCircle,
  Radio,
  Search,
  Ship,
  Sprout,
  UsersRound,
  X,
} from "lucide-react";
import { useHashRoute, HUB_HREF, GROUPS_HREF, EDITAL_HREF, eventHref } from "./webinars/router";
import { EditalIC2026 } from "./EditalIC2026";

// Plataforma de Seleções: carregada sob demanda para não pesar o site público.
const Inscricao = lazy(() => import("./platform/Inscricao"));
const MinhaInscricao = lazy(() => import("./platform/MinhaInscricao"));
const Gestao = lazy(() => import("./platform/Gestao"));

const PlatformFallback = () => (
  <main className="plat-page" id="conteudo">
    <section className="section-band plat-band">
      <div className="section-inner plat-inner">
        <div className="plat-loading">Carregando…</div>
      </div>
    </section>
  </main>
);
import { WebinarHub } from "./webinars/WebinarHub";
import { WebinarEvent } from "./webinars/WebinarEvent";
import { GroupsHub } from "./webinars/GroupsHub";
import { GroupPage } from "./webinars/GroupPage";
import { featuredFrom, resolveStatus, webinarAsset } from "./webinars/data";
import { useWebinars } from "./webinars/store";
import { formatEventDateShort, formatEventTime, machineDate } from "./webinars/format";
import { StatusBadge } from "./webinars/parts";

type ResearchProgram = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  outcomes: string[];
  image: string;
  icon: typeof CloudSun;
};

type Partner = {
  name: string;
  acronym?: string;
  group:
    | "Executora/Sede"
    | "Laboratório Associado"
    | "Colaboradora Nacional"
    | "Colaboradora"
    | "Parceira"
    | "FAP"
    | "Sociedade"
    | "Empresa"
    | "Colaboradora Estrangeira";
  location: string;
  focus: string;
};

type InstagramHighlight = {
  label: string;
  title: string;
  date: string;
  text: string;
  image: string;
  href: string;
  video?: string;
  poster?: {
    eyebrow: string;
    title: string;
    subtitle: string;
    meta: string;
  };
  icon: typeof Ship;
};

const assetPath = (fileName: string) => `${import.meta.env.BASE_URL}assets/${fileName}`;
const partnerLogoPath = (fileName: string) => assetPath(`partner-logos/${fileName}`);

function ActionVideo({ highlight }: { highlight: InstagramHighlight }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const playVideo = () => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    void video
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  };

  return (
    <div className="action-video-wrap">
      <video
        ref={videoRef}
        className="action-video"
        controls
        playsInline
        preload="auto"
        poster={highlight.image}
        aria-label={`Vídeo: ${highlight.title}`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      >
        <source src={highlight.video} type="video/mp4" />
      </video>
      {!isPlaying ? (
        <button className="action-video-trigger" type="button" onClick={playVideo} aria-label={`Reproduzir vídeo: ${highlight.title}`}>
          <Play size={30} fill="currentColor" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

type NavItem = { label: string; href: string; icon: typeof Microscope; routes?: string[] };

const navItems: NavItem[] = [
  { label: "Pesquisa", href: "#pesquisa", icon: Microscope },
  { label: "Governança", href: "#governanca", icon: BarChart3 },
  { label: "Rede", href: "#rede", icon: Globe2 },
  { label: "Editais", href: "#editais", icon: Download },
  { label: "Webinars", href: HUB_HREF, icon: Radio, routes: ["hub", "event"] },
  { label: "Grupos", href: GROUPS_HREF, icon: UsersRound, routes: ["groups", "group"] },
  { label: "Contato", href: "#contato", icon: Mail },
];

const heroMetrics = [
  { label: "Rede formal", value: "86 instituições" },
  { label: "Território", value: "Amazônia Legal" },
  { label: "Método", value: "Saúde Única" },
  { label: "Impacto", value: "ODS 3/4/8/11/13" },
];

const fieldStories = [
  {
    title: "Campo científico no Rio Madeira",
    eyebrow: "Expedição",
    text: "Barco Ciência, Saúde e Cidadania leva coleta, escuta territorial e atendimento científico para comunidades ribeirinhas.",
    image: assetPath("barco-ciencia-real.jpg"),
    meta: "Calama, Nazaré e São Carlos",
    icon: Ship,
  },
  {
    title: "Biodiversidade como plataforma de inovação",
    eyebrow: "Biotecnologia",
    text: "Plantas medicinais, biomoléculas e venenos amazônicos são organizados em rotas de pesquisa aplicadas à saúde e à bioeconomia.",
    image: assetPath("bioprospec.jpg"),
    meta: "Biofármacos, antivenenos e nanoformulações",
    icon: Sprout,
  },
  {
    title: "Dados climáticos para decisão pública",
    eyebrow: "Observatório",
    text: "Monitoramento ambiental, modelagem preditiva e alertas precoces aproximam ciência de gestão, prevenção e cuidado.",
    image: assetPath("clima-amazonia.jpg"),
    meta: "Clima, saúde e precisão",
    icon: Map,
  },
];

const networkOverview = [
  {
    label: "Coordenação",
    value: "FIOCRUZ RO + UNIR",
    text: "Sede executora e vice-coordenação articulam laboratórios, campo, formação e governança territorial.",
  },
  {
    label: "Base amazônica",
    value: "35 instituições",
    text: "Presença formal na Amazônia Legal, com 21 instituições em Rondônia e vínculos nos demais estados amazônicos.",
  },
  {
    label: "Governança técnica",
    value: "9 CGES + 6 comitês",
    text: "Comitê gestor, comitês técnicos e líderes de laboratórios associados acompanham execução e entregas.",
  },
  {
    label: "Cooperação",
    value: "16 países",
    text: "Colaborações nacionais e estrangeiras conectam Saúde Única, clima, biodiversidade e bioeconomia.",
  },
];

const networkFacts = [
  {
    value: "86",
    label: "instituições formais",
    text: "Rede indicada na proposta submetida ao CNPq, distribuída entre Amazônia Legal, demais regiões do Brasil e exterior.",
  },
  {
    value: "35",
    label: "instituições da Amazônia Legal",
    text: "Inclui instituições dos 9 estados amazônicos; 21 estão em Rondônia, sede executora da rede.",
  },
  {
    value: "190",
    label: "pesquisadores cadastrados",
    text: "Equipe técnico-científica registrada na PICC/CNPq, com responsabilidades vinculadas às metas do INCT.",
  },
  {
    value: "28",
    label: "líderes de laboratórios associados",
    text: "LLAs organizam a execução das etapas estratégicas, com ênfase na Amazônia Legal.",
  },
];

const featuredInstitutions = [
  {
    acronym: "FIOCRUZ RO",
    name: "Fundação Oswaldo Cruz Noroeste",
    role: "coordenação executiva",
    location: "Rondônia",
    logo: assetPath("partner-logos/fiocruz-ro.png"),
    tone: "forest",
  },
  {
    acronym: "UNIR",
    name: "Universidade Federal de Rondônia",
    role: "vice-coordenação e LABOGEOPA",
    location: "Rondônia",
    logo: assetPath("institution-logos/unir.png"),
    tone: "river",
  },
  {
    acronym: "IFRO",
    name: "Instituto Federal de Rondônia",
    role: "formação técnica e ciência cidadã",
    location: "Rondônia",
    logo: assetPath("institution-logos/ifro.png"),
    tone: "leaf",
  },
  {
    acronym: "INPE",
    name: "Instituto Nacional de Pesquisas Espaciais",
    role: "clima, modelagem e dados ambientais",
    location: "São Paulo",
    logo: assetPath("institution-logos/inpe.png"),
    tone: "sky",
  },
  {
    acronym: "FAPERO",
    name: "Fundação Rondônia de Amparo à Pesquisa",
    role: "fomento e ecossistema de CT&I",
    location: "Rondônia",
    logo: assetPath("institution-logos/fapero.png"),
    tone: "gold",
  },
  {
    acronym: "HARVARD",
    name: "Harvard University",
    role: "cooperação internacional",
    location: "Estados Unidos",
    logo: assetPath("institution-logos/harvard.svg"),
    tone: "clay",
  },
  {
    acronym: "CNRS",
    name: "Centre National de la Recherche Scientifique",
    role: "pesquisa científica internacional",
    location: "França",
    logo: assetPath("institution-logos/cnrs.svg"),
    tone: "forest",
  },
  {
    acronym: "ECMWF",
    name: "European Centre for Medium-Range Weather Forecasts",
    role: "previsão, clima e dados",
    location: "Reino Unido",
    logo: assetPath("institution-logos/ecmwf.svg"),
    tone: "river",
  },
];

const amazonStateHighlights = [
  { code: "RO", label: "Rondônia", detail: "sede + 21 instituições" },
  { code: "AM", label: "Amazonas", detail: "FIOCRUZ Amazônia, UFAM e empresas" },
  { code: "AP", label: "Amapá", detail: "UNIFAP" },
  { code: "PA", label: "Pará", detail: "UFPA e UFOPA" },
  { code: "RR", label: "Roraima", detail: "UFRR, IFRR e saúde pública" },
  { code: "TO", label: "Tocantins", detail: "UFT e inovação biotecnológica" },
];

const internationalCountries = [
  { flag: assetPath("flags/br.svg"), country: "Brasil", detail: "rede nacional e Amazônia Legal" },
  { flag: assetPath("flags/fr.svg"), country: "França", detail: "Université Paris-Cité, CNRS" },
  { flag: assetPath("flags/us.svg"), country: "EUA", detail: "Harvard, SDSU" },
  { flag: assetPath("flags/gb.svg"), country: "Reino Unido", detail: "Imperial, ECMWF" },
  { flag: assetPath("flags/mx.svg"), country: "México", detail: "UAEM" },
  { flag: assetPath("flags/pe.svg"), country: "Peru", detail: "UNMSM" },
  { flag: assetPath("flags/ec.svg"), country: "Equador", detail: "IKIAM" },
  { flag: assetPath("flags/ar.svg"), country: "Argentina", detail: "UNNE" },
  { flag: assetPath("flags/pt.svg"), country: "Portugal", detail: "Universidade do Porto" },
  { flag: assetPath("flags/co.svg"), country: "Colômbia", detail: "UAO Cali" },
  { flag: assetPath("flags/cr.svg"), country: "Costa Rica", detail: "UNA, UCR" },
  { flag: assetPath("flags/pa.svg"), country: "Panamá", detail: "Universidad de Panama" },
];

const networkRoleHighlights = [
  {
    label: "Saúde pública",
    value: "FIOCRUZ, IAM, ILMD, CEPEM",
    text: "base para vigilância, doenças tropicais, biologia molecular e Saúde Única.",
    icon: HeartPulse,
  },
  {
    label: "Clima e território",
    value: "INPE, ECMWF, UFGD, UEMA",
    text: "modelagem, monitoramento, biometeorologia e inteligência territorial.",
    icon: CloudSun,
  },
  {
    label: "Biodiversidade",
    value: "UNIFAP, UFPA, UFOPA, UFRR",
    text: "plantas medicinais, ecologia, bioprospecção e comunidades amazônicas.",
    icon: Leaf,
  },
  {
    label: "Inovação e formação",
    value: "IFRO, FAPERO, empresas e escolas",
    text: "capacitação, bioeconomia, transferência tecnológica e ciência cidadã.",
    icon: BookOpen,
  },
];

const policyImpacts = [
  {
    ods: "ODS 3",
    title: "Saúde Única e vigilância",
    text: "Integra saúde humana, animal, vegetal e ambiental para orientar prevenção, cuidado e resposta a riscos climáticos e biológicos.",
    icon: HeartPulse,
  },
  {
    ods: "ODS 4",
    title: "Formação e ciência cidadã",
    text: "Apoia capacitação, educação ambiental em saúde e participação de estudantes, escolas e comunidades ribeirinhas.",
    icon: BookOpen,
  },
  {
    ods: "ODS 8/11",
    title: "Bioeconomia territorial",
    text: "Fortalece arranjos ecoprodutivos, inovação social e soluções para municípios e comunidades amazônicas.",
    icon: Building2,
  },
  {
    ods: "ODS 13",
    title: "Clima aplicado à decisão",
    text: "Transforma monitoramento ambiental, modelagem e alertas em subsídios para políticas públicas e gestão de riscos.",
    icon: Leaf,
  },
];

const policyEvidence = [
  {
    label: "Campo e saúde",
    title: "Barco Ciência & Saúde no Rio Madeira",
    text: "Registro público da mobilização de equipe para ciência, saúde, educação e cidadania em comunidades ribeirinhas.",
    source: "Instagram @inct_conexao · maio 2026",
    image: assetPath("instagram-barco-ciencia-acao.jpg"),
  },
  {
    label: "Comunidade",
    title: "Atendimentos no distrito de Nazaré",
    text: "Ação territorial que conecta cuidado, escuta comunitária e produção de evidências em Saúde Única.",
    source: "Instagram @inct_conexao · maio 2026",
    image: assetPath("instagram-nazare-atendimentos.jpg"),
  },
  {
    label: "Clima e dados",
    title: "Visita técnica científica ao INPE",
    text: "Aproximação institucional para modelagem, monitoramento climático e inteligência territorial aplicada.",
    source: "Instagram @inct_conexao · maio 2026",
    image: assetPath("instagram-inpe-visita-tecnica.jpg"),
  },
  {
    label: "Governança",
    title: "Reunião estratégica com a FAPERO",
    text: "Articulação pública de fomento, eventos científicos, expedições e redes colaborativas de pesquisa.",
    source: "Instagram @inct_conexao · mar. 2026",
    image: assetPath("instagram-fapero-reuniao.jpg"),
  },
];

const linkedInProfileFacts = [
  { label: "Setor", value: "Serviços de pesquisa" },
  { label: "Sede", value: "Porto Velho, Rondônia" },
  { label: "Tipo", value: "Agência governamental" },
  { label: "Fundação", value: "2024" },
  { label: "Porte", value: "51-200 pessoas" },
];

const linkedInHighlights = [
  {
    label: "Institucional",
    title: "Ciência, inovação e impacto global",
    text: "O perfil público apresenta o INCT-CONEXAO como uma rede que articula grupos de pesquisa em áreas estratégicas para desenvolvimento sustentável e inovação tecnológica.",
    meta: "academia, setor produtivo e sociedade",
    icon: Globe2,
  },
  {
    label: "Pesquisa aplicada",
    title: "Dados e estudos convertidos em soluções",
    text: "A comunicação no LinkedIn reforça a passagem da produção científica para respostas práticas diante de desafios complexos da Amazônia Ocidental e Oriental.",
    meta: "evidência, gestão e políticas públicas",
    icon: BarChart3,
  },
  {
    label: "Expedição",
    title: "Barco Ciência & Saúde 2026.1",
    text: "Cronograma público: inscrições de 10/02/2026 a 03/03/2026, resultado a partir de 16/03/2026 e expedição de 18/05/2026 a 24/05/2026 para Calama, Nazaré e São Carlos.",
    meta: "saída fluvial de Porto Velho",
    icon: Ship,
  },
];

const researchPrograms: ResearchProgram[] = [
  {
    id: "clima",
    eyebrow: "Dados, clima e precisão",
    title: "CONEXAO-Clima & Saúde Única",
    description:
      "Monitoramento contínuo das condições climáticas e ambientais da Amazônia Legal, conectando ilhas de calor, estresse hídrico, poluição do ar e riscos à saúde humana, animal e vegetal.",
    outcomes: [
      "Modelagem preditiva com inteligência artificial",
      "Sistemas de alerta precoce para eventos extremos",
      "Subsídios para a Saúde Pública de Precisão",
    ],
    image: assetPath("clima-amazonia.jpg"),
    icon: CloudSun,
  },
  {
    id: "biotec",
    eyebrow: "Biodiversidade aplicada",
    title: "CONEXAO-Bioprospecção e Biotecnologia",
    description:
      "Bioprospecção de plantas medicinais, animais peçonhentos e biomoléculas amazônicas, integrando conhecimento tradicional, bancos genéticos, química, biologia e modelagem molecular.",
    outcomes: [
      "Biofármacos, antivenenos recombinantes e nanoformulações",
      "Caracterização química e biológica de compostos ativos",
      "Rotas de inovação voltadas à saúde, ao SUS e à bioeconomia",
    ],
    image: assetPath("bioprospec.jpg"),
    icon: Dna,
  },
  {
    id: "comunidades",
    eyebrow: "Ciência cidadã e território",
    title: "CONEXAO-Comunidades, Bioeconomia e Políticas Públicas",
    description:
      "Transferência de conhecimento, valorização de saberes tradicionais e fortalecimento dos arranjos ecoprodutivos locais com comunidades originárias, setor público, setor privado e escolas.",
    outcomes: [
      "Capacitação comunitária e educação ambiental em saúde",
      "Políticas públicas informadas por evidências",
      "Empreendedorismo e inovação social na Amazônia",
    ],
    image: assetPath("barco-ciencia-real.jpg"),
    icon: UsersRound,
  },
];

const strategicAxes = [
  { title: "Saúde Única", text: "Integra a saúde humana, animal, vegetal e ambiental.", image: assetPath("eet-1.png") },
  { title: "Biometeorologia", text: "Transforma dados climáticos em decisões públicas.", image: assetPath("eet-2.jpeg") },
  { title: "Bioeconomia", text: "Aproxima biodiversidade, tecnologia e arranjos locais.", image: assetPath("eet-3.png") },
  { title: "Biotecnologia", text: "Converte conhecimento científico em soluções aplicáveis.", image: assetPath("eet-4.png") },
  { title: "Ciência cidadã", text: "Inclui escolas, comunidades e agentes territoriais.", image: assetPath("eet-5.jpeg") },
  { title: "Políticas públicas", text: "Produz evidências para decisões de alto impacto.", image: assetPath("eet-6.png") },
  { title: "Formação", text: "Capacita pessoas para pesquisa, gestão e inovação.", image: assetPath("eet-7.png") },
  { title: "Internacionalização", text: "Conecta a Amazônia a redes científicas globais.", image: assetPath("eet-8.png") },
];

const associatedLabTracks = [
  {
    code: "EET-1",
    title: "Clima, ambiente e Saúde Única",
    text: "Investigação e monitoramento das interações entre clima, ambiente, sociedade e impactos sobre a saúde na Amazônia Legal.",
  },
  {
    code: "EET-2",
    title: "Diagnóstico territorial da Amazônia",
    text: "Dados climáticos, socioterritoriais, etnobotânicos, etnoecológicos, ecotoxicológicos e epidemiológicos.",
  },
  {
    code: "EET-3",
    title: "Biodiversidade e bioprospecção",
    text: "Venenos, toxinas, plantas medicinais e biomoléculas de interesse presentes no bioma amazônico.",
  },
  {
    code: "EET-4",
    title: "Bioeconomia e AEPLs",
    text: "Empreendedorismo, inovação e políticas públicas aplicadas a arranjos ecoprodutivos locais.",
  },
  {
    code: "EET-5",
    title: "Bioinformática e SPP",
    text: "Tecnologias de Saúde Pública de Precisão para acidentes com animais peçonhentos e mudanças climáticas.",
  },
  {
    code: "EET-6",
    title: "Biologia estrutural e química medicinal",
    text: "Bioensaios, ensaios in vitro e in silico aplicados a plantas medicinais, toxinas e biomoléculas.",
  },
  {
    code: "EET-7",
    title: "Formação e redes de pesquisa",
    text: "Integração de PPGs, grupos de pesquisa e divulgação científica em biodiversidade, biometeorologia e bioeconomia.",
  },
  {
    code: "EET-8",
    title: "Políticas e educação em saúde",
    text: "Políticas informadas por evidências e educação ambiental, científica e em saúde com comunidades amazônicas.",
  },
];

const governanceLayers = [
  {
    label: "Coordenação executiva",
    value: "FIOCRUZ RO + UNIR",
    text: "Sede executora e vice-coordenação no estado de Rondônia, articulando a rede científica, territorial e institucional.",
    icon: Network,
  },
  {
    label: "Comitê Gestor",
    value: "9 pesquisadores",
    text: "Define diretrizes estratégicas, acompanha a implementação e gerencia recursos do INCT-CONEXAO.",
    icon: Compass,
  },
  {
    label: "LLAs",
    value: "28 líderes",
    text: "Líderes de Laboratórios Associados atuam como equipe executiva para acompanhar e executar atividades do projeto.",
    icon: Microscope,
  },
  {
    label: "Comitês Técnicos",
    value: "6 frentes",
    text: "Assessoram o CGES em áreas específicas: campo, clima, qualidade científica, divulgação, políticas e internacionalização.",
    icon: BarChart3,
  },
  {
    label: "Membros de equipe",
    value: "190 pesquisadores",
    text: "Pesquisadores, profissionais e instituições colaboram no modelo academia, governo, empresas e sociedade.",
    icon: UsersRound,
  },
];

const cgesDistribution = [
  { count: "4", code: "RO", label: "Rondônia", detail: "sede executora" },
  { count: "1", code: "AM", label: "Amazonas", detail: "Amazônia Legal" },
  { count: "1", code: "AP", label: "Amapá", detail: "Amazônia Legal" },
  { count: "1", code: "PA", label: "Pará", detail: "Amazônia Legal" },
  { count: "1", code: "RR", label: "Roraima", detail: "Amazônia Legal" },
  { count: "1", code: "SP", label: "São Paulo", detail: "cooperação nacional" },
];

const governanceCadence = [
  "Relatórios parciais anuais e/ou semestrais com resultados, dificuldades e oportunidades.",
  "Reuniões remotas tri ou semestrais entre LLAs, CTs e CGES.",
  "Visitas técnicas, intercâmbios presenciais ou remotos e acompanhamento das metas pactuadas.",
  "Orientação legal para autorizações, envio, identificação e rastreabilidade de amostras.",
];

const committees = [
  {
    acronym: "CEXPECIAL",
    name: "Expedições Científicas na Amazônia Legal",
    scope: "Campo e logística",
    text: "Planeja ações em territórios amazônicos, logística fluvial/terrestre, segurança operacional e integração com missões de saúde e cidadania.",
    deliverables: ["planos de campo", "segurança operacional", "integração territorial"],
    icon: Ship,
  },
  {
    acronym: "CCCO",
    name: "Clima e Comunidades Originárias",
    scope: "Clima, território e comunidades",
    text: "Conecta monitoramento ambiental, vulnerabilidade socioambiental, comunidades originárias/tradicionais e resposta a eventos extremos.",
    deliverables: ["leitura territorial", "diálogos interculturais", "alertas e riscos"],
    icon: CloudSun,
  },
  {
    acronym: "CTC",
    name: "Técnico-Científico",
    scope: "Qualidade científica",
    text: "Acompanha desenho metodológico, integração entre laboratórios associados, produtos científicos e aderência às oito EETs.",
    deliverables: ["padrões metodológicos", "integração de EETs", "produção científica"],
    icon: Dna,
  },
  {
    acronym: "CDIV",
    name: "Divulgação e Comunicação Científica",
    scope: "Comunicação pública",
    text: "Traduz resultados para públicos diversos, apoia materiais educativos e fortalece popularização da ciência nos territórios amazônicos.",
    deliverables: ["materiais educativos", "comunicação pública", "popularização da CT&I"],
    icon: BookOpen,
  },
  {
    acronym: "CPIE",
    name: "Políticas Públicas, Inovação e Empreendedorismo",
    scope: "Evidências e bioeconomia",
    text: "Organiza evidências, transferência de tecnologia e oportunidades para políticas públicas e arranjos ecoprodutivos locais.",
    deliverables: ["subsídios para decisão", "inovação social", "AEPLs"],
    icon: Building2,
  },
  {
    acronym: "CINTER",
    name: "Internacionalização",
    scope: "Cooperação global",
    text: "Promove cooperação científica internacional, intercâmbio de pesquisadores, consultorias especializadas e agendas compartilhadas.",
    deliverables: ["redes internacionais", "intercâmbios", "consultorias científicas"],
    icon: Globe2,
  },
];

type Notice = {
  status: string;
  title: string;
  date: string;
  text: string;
  href: string;
  linkLabel?: string;
  featured?: boolean;
};

const notices: Notice[] = [
  {
    status: "Inscrições: 06–19 jul 2026",
    title: "Processo Seletivo Simplificado Nº 04/2026 — Bolsas de IC/CNPq",
    date: "Divulgação: 02 jul. 2026",
    text: "Seleção de 50 bolsistas de Iniciação Científica (R$ 700/mês, por 12 meses) para os grupos e instituições do INCT-CONEXAO, nas regiões da Amazônia Legal, Nordeste e Centro-Oeste.",
    href: EDITAL_HREF,
    linkLabel: "Ver edital completo",
    featured: true,
  },
  {
    status: "Resultado publicado",
    title: "Resultado do Processo Seletivo Barco Ciência e Saúde 2026.1",
    date: "01 abr. 2026",
    text: "Lista de participantes selecionados para a expedição Barco Ciência, Saúde e Cidadania 2026/1.",
    href: assetPath("resultado-barco-ciencia-2026-1.pdf"),
  },
  {
    status: "Inscrições encerradas",
    title: "Chamada Barco Ciência e Saúde 2026.1",
    date: "10 fev. a 03 mar. 2026",
    text: "Seleção de estudantes, professores e pesquisadores para atender às comunidades de Calama, Nazaré e São Carlos, situadas no Rio Madeira.",
    href: assetPath("chamada-barco-ciencia-2026-1.pdf"),
  },
  {
    status: "Chamada 01/2026",
    title: "Bolsistas de Iniciação Científica e Tecnológica",
    date: "2026",
    text: "Processo seletivo simplificado para que estudantes de graduação participem de projetos orientados por pesquisadores qualificados.",
    href: assetPath("chamada-bolsistas-01-2026.pdf"),
  },
];

const fundingAgencies = [
  {
    acronym: "MCTI",
    name: "Ministério da Ciência, Tecnologia e Inovação",
    role: "Coordenação política do Programa INCT e da Chamada 46/2024.",
    logo: assetPath("funding-logos/mcti.png"),
    href: "https://www.gov.br/mcti/pt-br",
  },
  {
    acronym: "CNPq",
    name: "Conselho Nacional de Desenvolvimento Científico e Tecnológico",
    role: "Agência executora da chamada e fomento federal à pesquisa.",
    logo: assetPath("funding-logos/cnpq.svg"),
    href: "https://www.gov.br/cnpq/pt-br",
  },
  {
    acronym: "SECTICS/MS",
    name: "Ministério da Saúde",
    role: "Parceria por meio da SECTICS para ciência, tecnologia e inovação em saúde.",
    logo: assetPath("funding-logos/ministerio-saude.png"),
    href: "https://www.gov.br/saude/pt-br/composicao/sectics",
  },
  {
    acronym: "CAPES",
    name: "Coordenação de Aperfeiçoamento de Pessoal de Nível Superior",
    role: "Apoio à formação avançada, pós-graduação e capacidade científica.",
    logo: assetPath("funding-logos/capes.png"),
    href: "https://www.gov.br/capes/pt-br",
  },
  {
    acronym: "FAPERO",
    name: "Fundação Rondônia de Amparo ao Desenvolvimento das Ações Científicas e Tecnológicas e à Pesquisa",
    role: "FAP estadual ligada à base executora e ao fomento em Rondônia.",
    logo: assetPath("institution-logos/fapero.png"),
    href: "https://rondonia.ro.gov.br/fapero/",
  },
];

const instagramHighlights: InstagramHighlight[] = [
  {
    label: "Expedição",
    title: "Barco Ciência & Saúde reúne equipe de campo",
    date: "22 maio 2026",
    text: "Registro da mobilização que levou ciência, saúde, educação e cidadania às comunidades ribeirinhas atendidas pelo projeto.",
    image: assetPath("instagram-barco-ciencia-acao.jpg"),
    href: "https://www.instagram.com/p/DYqbCNmFlwA/",
    video: assetPath("instagram-barco-ciencia-acao.mp4"),
    icon: Ship,
  },
  {
    label: "Comunidade",
    title: "Atendimentos no distrito de Nazaré",
    date: "23 maio 2026",
    text: "A ação em Nazaré destacou cuidado com a população, troca de conhecimentos e fortalecimento da ciência junto às comunidades do Rio Madeira.",
    image: assetPath("instagram-nazare-atendimentos.jpg"),
    href: "https://www.instagram.com/reel/DYr7rFeK-cn/",
    video: assetPath("instagram-nazare-atendimentos.mp4"),
    icon: HeartPulse,
  },
  {
    label: "Clima e dados",
    title: "Visita técnica científica ao INPE",
    date: "29 maio 2026",
    text: "A aproximação com o INPE reforça a agenda de modelagem, monitoramento climático e inteligência territorial para a Amazônia.",
    image: assetPath("instagram-inpe-visita-tecnica.jpg"),
    href: "https://www.instagram.com/p/DY8byg6K7SE/",
    video: assetPath("instagram-inpe-visita-tecnica.mp4"),
    icon: CloudSun,
  },
  {
    label: "Parcerias",
    title: "Reunião estratégica com a FAPERO",
    date: "04 mar. 2026",
    text: "A reunião articulou eventos científicos, expedições, Workshop AMAZCLIM e redes colaborativas de pesquisa entre instituições parceiras.",
    image: assetPath("instagram-fapero-reuniao.jpg"),
    href: "https://www.instagram.com/p/DVd8EYhCssE/",
    icon: Building2,
  },
  {
    label: "Formação",
    title: "Iniciação científica e tecnológica 2026.1",
    date: "18 mar. 2026",
    text: "A chamada amplia a participação de estudantes de graduação em projetos orientados por pesquisadores qualificados da rede.",
    image: assetPath("instagram-iniciacao-cientifica.jpg"),
    href: "https://www.instagram.com/reel/DWCuLQtClnd/",
    video: assetPath("instagram-iniciacao-cientifica.mp4"),
    icon: BookOpen,
  },
  {
    label: "Laboratório",
    title: "Resultado da seleção em DNA ambiental",
    date: "02 abr. 2026",
    text: "A comunicação sobre a formação em biologia molecular valoriza capacitação técnica conectada à biodiversidade e às amostras ambientais.",
    image: assetPath("instagram-dna-ambiental.jpg"),
    href: "https://www.instagram.com/p/DWpsx6PCpgQ/",
    poster: {
      eyebrow: "Resultado institucional",
      title: "DNA ambiental",
      subtitle: "Iniciação científica e tecnológica 2026.1",
      meta: "Edição Rondônia · candidatos aprovados",
    },
    icon: Dna,
  },
  {
    label: "Chamada",
    title: "Lançamento da chamada Barco Ciência & Saúde",
    date: "06 fev. 2026",
    text: "O lançamento público organizou prazos e orientações para a expedição 2026.1 no Rio Madeira, com saída de Porto Velho.",
    image: assetPath("instagram-barco-chamada.jpg"),
    href: "https://www.instagram.com/p/DUcOLP-DB1V/",
    poster: {
      eyebrow: "Chamada pública",
      title: "Barco Ciência & Saúde 2026.1",
      subtitle: "Expedição no Rio Madeira com saída de Porto Velho",
      meta: "Calama · Nazaré · São Carlos",
    },
    icon: Download,
  },
  {
    label: "Inovação",
    title: "INCT-CONEXAO no Rondônia Startup Connect",
    date: "06 dez. 2025",
    text: "A presença no ecossistema de startups aproxima pesquisa, tecnologia, empreendedorismo e oportunidades de inovação para Rondônia.",
    image: assetPath("instagram-startup-connect.jpg"),
    href: "https://www.instagram.com/reel/DR8cKyODLWG/",
    video: assetPath("instagram-startup-connect.mp4"),
    icon: Sprout,
  },
];

const partners: Partner[] = [
  {
    name: "Fundação Oswaldo Cruz Noroeste - Unidade de Rondônia",
    acronym: "FIOCRUZ/RO",
    group: "Executora/Sede",
    location: "RO, Brasil",
    focus: "Instituição executora; coordenação geral, Saúde Única, biotecnologia, toxinologia e articulação da rede.",
  },
  {
    name: "Instituto Aggeu Magalhães",
    acronym: "IAM",
    group: "Laboratório Associado",
    location: "PE, Brasil",
    focus: "Laboratório associado em saúde, imunogenética, biologia molecular e doenças infecciosas.",
  },
  {
    name: "Universidade Estadual Paulista Júlio de Mesquita Filho",
    acronym: "UNESP",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em climatologia geográfica, saúde ambiental, medicina veterinária e pesquisa translacional.",
  },
  {
    name: "Universidade Federal do Amapá",
    acronym: "UNIFAP",
    group: "Laboratório Associado",
    location: "AP, Brasil",
    focus: "Laboratório associado da Amazônia Legal; biodiversidade, ecologia, saúde e biotecnologia.",
  },
  {
    name: "Universidade Estadual da Paraíba",
    acronym: "UEPB",
    group: "Laboratório Associado",
    location: "PB, Brasil",
    focus: "Laboratório associado em bioensaios, educação científica e saúde.",
  },
  {
    name: "Universidade Federal de Uberlândia",
    acronym: "UFU",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em farmacologia, toxinologia, dor, analgesia e fisiopatologia de venenos animais.",
  },
  {
    name: "Universidade Federal de São Paulo",
    acronym: "UNIFESP",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em biologia estrutural, química medicinal e saúde.",
  },
  {
    name: "Instituto Federal de Educação, Ciência e Tecnologia de Rondônia",
    acronym: "IFRO",
    group: "Laboratório Associado",
    location: "RO, Brasil",
    focus: "Laboratório associado em sensoriamento remoto, clima urbano, formação técnica e educação científica.",
  },
  {
    name: "Universidade Federal do Amazonas",
    acronym: "UFAM",
    group: "Laboratório Associado",
    location: "AM, Brasil",
    focus: "Laboratório associado da Amazônia Legal; saúde, biodiversidade, ambiente e formação regional.",
  },
  {
    name: "Universidade Federal do Oeste do Pará",
    acronym: "UFOPA",
    group: "Laboratório Associado",
    location: "PA, Brasil",
    focus: "Laboratório associado da Amazônia Legal; território, biodiversidade, comunidades e ambiente.",
  },
  {
    name: "Universidade Federal de Minas Gerais",
    acronym: "UFMG",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em bioquímica, biologia molecular, farmacologia e toxicologia.",
  },
  {
    name: "Universidade Federal da Grande Dourados",
    acronym: "UFGD",
    group: "Laboratório Associado",
    location: "MS, Brasil",
    focus: "Laboratório associado em geografia, vulnerabilidade climática, geoprocessamento e ciências ambientais.",
  },
  {
    name: "Pontifícia Universidade Católica do Paraná",
    acronym: "PUC/PR",
    group: "Laboratório Associado",
    location: "PR, Brasil",
    focus: "Laboratório associado em saúde, dados, modelagem e inovação aplicada.",
  },
  {
    name: "Instituto Leônidas e Maria Deane",
    acronym: "ILMD",
    group: "Laboratório Associado",
    location: "AM, Brasil",
    focus: "Laboratório associado da FIOCRUZ Amazônia em biologia molecular, imunologia e produtos naturais.",
  },
  {
    name: "Universidade Federal de São Carlos",
    acronym: "UFSCar",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em biotecnologia, química medicinal, bioensaios e formação científica.",
  },
  {
    name: "Universidade de São Paulo",
    acronym: "USP",
    group: "Laboratório Associado",
    location: "SP, Brasil",
    focus: "Laboratório associado em geografia, ambiente, paisagem, modelagem e saúde.",
  },
  {
    name: "Fundação Oswaldo Cruz - Ceará",
    acronym: "FIOCRUZ/CE",
    group: "Laboratório Associado",
    location: "CE, Brasil",
    focus: "Laboratório associado em saúde pública, biotecnologia e doenças negligenciadas.",
  },
  {
    name: "Universidade Federal do Tocantins",
    acronym: "UFT",
    group: "Laboratório Associado",
    location: "TO, Brasil",
    focus: "Laboratório associado em biodiversidade, ambiente, saúde e bioeconomia.",
  },
  {
    name: "Universidade Federal de Mato Grosso",
    acronym: "UFMT",
    group: "Laboratório Associado",
    location: "MT, Brasil",
    focus: "Laboratório associado em ambiente, território, saúde e bioprospecção.",
  },
  {
    name: "Universidade Federal de São João Del-Rei",
    acronym: "UFSJ",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em biomateriais, bioengenharia, microbiologia e popularização da ciência.",
  },
  {
    name: "Universidade Federal do Pará",
    acronym: "UFPA",
    group: "Laboratório Associado",
    location: "PA, Brasil",
    focus: "Laboratório associado da Amazônia Legal; biodiversidade, comunidades e saúde ambiental.",
  },
  {
    name: "Universidade Federal de Roraima",
    acronym: "UFRR",
    group: "Laboratório Associado",
    location: "RR, Brasil",
    focus: "Laboratório associado em plantas medicinais, saúde coletiva, biotecnologia e educação científica.",
  },
  {
    name: "Faculdade Santa Casa BH",
    acronym: "FSCBH",
    group: "Laboratório Associado",
    location: "MG, Brasil",
    focus: "Laboratório associado em saúde, assistência, formação e pesquisa clínica.",
  },
  {
    name: "Fundação Universidade Federal de Ciências da Saúde de Porto Alegre",
    acronym: "UFCSPA",
    group: "Laboratório Associado",
    location: "RS, Brasil",
    focus: "Laboratório associado em ciências da saúde, biologia molecular e formação.",
  },
  {
    name: "Universidade Estadual do Maranhão",
    acronym: "UEMA",
    group: "Laboratório Associado",
    location: "MA, Brasil",
    focus: "Laboratório associado em geografia física, climatologia, saúde ambiental e modelagem bioclimática.",
  },
  {
    name: "Universidade Federal de Rondônia",
    acronym: "UNIR",
    group: "Laboratório Associado",
    location: "RO, Brasil",
    focus: "Vice-coordenação; sede física no LABOGEOPA/UNIR, biodiversidade, geografia, ecologia e comunidades.",
  },
  {
    name: "Universidade Federal de Sergipe",
    acronym: "UFS",
    group: "Laboratório Associado",
    location: "SE, Brasil",
    focus: "Laboratório associado em biodiversidade, biotecnologia, saúde e formação.",
  },
  {
    name: "Universidade Federal do Maranhão",
    acronym: "UFMA",
    group: "Laboratório Associado",
    location: "MA, Brasil",
    focus: "Laboratório associado em ambiente, saúde, biodiversidade e educação científica.",
  },
  {
    name: "Instituto Butantan",
    acronym: "IBU",
    group: "Colaboradora Nacional",
    location: "SP, Brasil",
    focus: "Colaboração em toxinologia, imunobiológicos, venenos e saúde pública.",
  },
  {
    name: "Fundação Oswaldo Cruz",
    acronym: "FIOCRUZ",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração nacional em saúde pública, biotecnologia e rede FIOCRUZ.",
  },
  {
    name: "Universidade Federal do Ceará",
    acronym: "UFC",
    group: "Colaboradora Nacional",
    location: "CE, Brasil",
    focus: "Colaboração em biotecnologia, saúde, produtos naturais e formação.",
  },
  {
    name: "Fundação CECIERJ",
    acronym: "CECIERJ",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração em educação, divulgação científica e formação a distância.",
  },
  {
    name: "Universidade Federal de Alagoas",
    acronym: "UFAL",
    group: "Colaboradora Nacional",
    location: "AL, Brasil",
    focus: "Colaboração em biotecnologia, química, saúde e formação científica.",
  },
  {
    name: "Universidade Federal Rural do Rio de Janeiro",
    acronym: "UFRRJ",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração em produtos naturais, plantas medicinais, fitoterápicos e Saúde Única.",
  },
  {
    name: "Universidade de Brasília",
    acronym: "UnB",
    group: "Colaboradora Nacional",
    location: "DF, Brasil",
    focus: "Colaboração em políticas públicas, saúde, ambiente e formação.",
  },
  {
    name: "Fundação Oswaldo Cruz Pantanal",
    acronym: "FIOCRUZ/Pantanal",
    group: "Colaboradora Nacional",
    location: "MS, Brasil",
    focus: "Colaboração em saúde, ambiente, Pantanal e integração centro-oeste/Amazônia.",
  },
  {
    name: "Universidade Federal do Rio Grande do Norte",
    acronym: "UFRN",
    group: "Colaboradora Nacional",
    location: "RN, Brasil",
    focus: "Colaboração em modelagem atmosférica, previsão de tempo e ciência de dados.",
  },
  {
    name: "Instituto Nacional de Pesquisas Espaciais",
    acronym: "INPE",
    group: "Colaboradora Nacional",
    location: "SP, Brasil",
    focus: "Modelagem numérica de tempo e clima, IA, previsão climática, SIMBAM e dados ambientais.",
  },
  {
    name: "Universidade Federal de Juiz de Fora",
    acronym: "UFJF",
    group: "Colaboradora Nacional",
    location: "MG, Brasil",
    focus: "Colaboração em saúde, ambiente, educação e análise de dados.",
  },
  {
    name: "Universidade Federal de Campina Grande",
    acronym: "UFCG",
    group: "Colaboradora Nacional",
    location: "PB, Brasil",
    focus: "Colaboração em meteorologia, clima, modelagem e dados ambientais.",
  },
  {
    name: "Universidade Federal do Paraná",
    acronym: "UFPR",
    group: "Colaboradora Nacional",
    location: "PR, Brasil",
    focus: "Colaboração em saúde, biodiversidade, biotecnologia e formação.",
  },
  {
    name: "Universidade Federal Fluminense",
    acronym: "UFF",
    group: "Colaboradora Nacional",
    location: "RJ, Brasil",
    focus: "Colaboração em saúde, ciências ambientais, educação e pesquisa aplicada.",
  },
  {
    name: "Instituto Brasileiro do Meio Ambiente e dos Recursos Naturais Renováveis",
    acronym: "IBAMA",
    group: "Colaboradora",
    location: "DF, Brasil",
    focus: "Colaboração ambiental, licenciamento, conservação e políticas públicas.",
  },
  {
    name: "Faculdades Associadas de Ariquemes",
    acronym: "FAAR/IESUR",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração regional em formação, pesquisa aplicada e extensão.",
  },
  {
    name: "Faculdade Católica de Rondônia",
    acronym: "FCR",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração regional em formação, direito, políticas públicas e extensão.",
  },
  {
    name: "Faculdades Integradas Aparício Carvalho",
    acronym: "FIMCA",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração regional em saúde, formação profissional e ações de extensão.",
  },
  {
    name: "Centro Universitário São Lucas",
    acronym: "UniSL",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração em saúde, farmácia, biotecnologia, educação científica e projetos.",
  },
  {
    name: "Centro de Pesquisa em Medicina Tropical de Rondônia",
    acronym: "CEPEM/SSER",
    group: "Colaboradora",
    location: "RO, Brasil",
    focus: "Colaboração em helmintologia, protozoologia, epidemiologia, medicina preventiva e saúde pública.",
  },
  {
    name: "Instituto Chico Mendes de Conservação da Biodiversidade",
    acronym: "ICMBio",
    group: "Colaboradora",
    location: "DF, Brasil",
    focus: "Colaboração em conservação, expedições científicas, biodiversidade e licenças ambientais.",
  },
  {
    name: "Instituto Federal de Roraima",
    acronym: "IFRR",
    group: "Colaboradora",
    location: "RR, Brasil",
    focus: "Colaboração em formação técnica, educação científica e ações regionais em Roraima.",
  },
  {
    name: "Ação Ecológica Guaporé",
    acronym: "ECOPORÉ",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceira em campo, comunidades, ciência cidadã, restauração ecológica e educação ambiental.",
  },
  {
    name: "Governo do Estado de Rondônia",
    acronym: "GOVERNO/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Apoio institucional por SEDAM, SESAU, SEDEC e SEDUC para execução e políticas públicas.",
  },
  {
    name: "Prefeitura Municipal de Ji-Paraná",
    acronym: "PMJP",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria municipal para ações territoriais, saúde, educação e CT&I.",
  },
  {
    name: "Secretaria de Estado da Saúde de Roraima",
    acronym: "SESAU/RR",
    group: "Parceira",
    location: "RR, Brasil",
    focus: "Parceria estadual em saúde pública, dados epidemiológicos e ações territoriais.",
  },
  {
    name: "Prefeitura Municipal de Rorainópolis",
    acronym: "PMRILIS",
    group: "Parceira",
    location: "RR, Brasil",
    focus: "Parceria municipal para ações territoriais em Roraima.",
  },
  {
    name: "Secretaria de Educação do Estado de Rondônia",
    acronym: "SEDUC/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em educação científica, escolas, clubes de ciência e formação.",
  },
  {
    name: "Instituto de Pesquisas em Patologias Tropicais de Rondônia",
    acronym: "IPEPATRO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em patologias tropicais, diagnóstico, epidemiologia e saúde pública.",
  },
  {
    name: "Secretaria de Estado da Saúde de Rondônia",
    acronym: "SESAU/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em saúde pública, vigilância, capacitação e políticas informadas por evidências.",
  },
  {
    name: "Secretaria de Estado do Desenvolvimento Ambiental de Rondônia",
    acronym: "SEDAM/RO",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria em desenvolvimento ambiental, gestão de recursos naturais e políticas para a Amazônia.",
  },
  {
    name: "Prefeitura Municipal de Porto Velho",
    acronym: "PMPV",
    group: "Parceira",
    location: "RO, Brasil",
    focus: "Parceria municipal para ações de saúde, educação, ambiente e comunidades.",
  },
  {
    name: "Fundação Rondônia de Amparo ao Desenvolvimento das Ações Científicas e Tecnológicas e à Pesquisa",
    acronym: "FAPERO",
    group: "FAP",
    location: "RO, Brasil",
    focus: "Fundação de amparo parceira, com apoio institucional à proposta e ao ecossistema de CT&I.",
  },
  {
    name: "Karipunas Associação Ecológica da Amazônia",
    acronym: "KARIPUNAS",
    group: "Sociedade",
    location: "RO, Brasil",
    focus: "Organização da sociedade civil e comunidades originárias para diálogo territorial e saberes tradicionais.",
  },
  {
    name: "Associação Gabgir do Povo Indígena Paiter Surui",
    acronym: "PAITER SURUI",
    group: "Sociedade",
    location: "RO, Brasil",
    focus: "Organização indígena parceira; apoio humano e material para execução junto ao território Paiter Surui.",
  },
  {
    name: "Antigen Desenvolvimento de Tecnologias de Vacinas e Serviços LTDA",
    acronym: "Antigen",
    group: "Empresa",
    location: "TO, Brasil",
    focus: "Empresa parceira em tecnologias de vacinas, diagnóstico, inovação e transferência de conhecimento.",
  },
  {
    name: "Amazonzyme Pesquisa e Desenvolvimento de Produtos Biotecnológicos LTDA",
    acronym: "Amazonzyme",
    group: "Empresa",
    location: "AM, Brasil",
    focus: "Empresa parceira em produtos biotecnológicos, bioinsumos e inovação em biodiversidade.",
  },
  {
    name: "Université Paris-Cité",
    acronym: "UPCité",
    group: "Colaboradora Estrangeira",
    location: "França",
    focus: "Colaboração internacional em saúde, biotecnologia, biodiversidade e formação.",
  },
  {
    name: "Harvard University",
    acronym: "HARVARD",
    group: "Colaboradora Estrangeira",
    location: "Estados Unidos",
    focus: "Colaboração internacional em pesquisa, saúde, ambiente e ciência de dados.",
  },
  {
    name: "San Diego State University",
    acronym: "SDSU",
    group: "Colaboradora Estrangeira",
    location: "Estados Unidos",
    focus: "Colaboração internacional em ambiente, clima, saúde e formação.",
  },
  {
    name: "European Centre for Medium-Range Weather Forecasts",
    acronym: "ECMWF",
    group: "Colaboradora Estrangeira",
    location: "Inglaterra",
    focus: "Colaboração internacional em previsão de tempo, clima, dados e modelagem.",
  },
  {
    name: "Universidad Autónoma del Estado de México",
    acronym: "UAEM",
    group: "Colaboradora Estrangeira",
    location: "México",
    focus: "Colaboração internacional em biodiversidade, ambiente e saúde.",
  },
  {
    name: "Universidad Nacional Mayor de San Marcos",
    acronym: "UNMSM",
    group: "Colaboradora Estrangeira",
    location: "Peru",
    focus: "Colaboração internacional em biodiversidade amazônica, saúde e formação.",
  },
  {
    name: "Universidad Regional Amazónica IKIAM",
    acronym: "IKIAM",
    group: "Colaboradora Estrangeira",
    location: "Equador",
    focus: "Colaboração internacional amazônica em biodiversidade, território e biotecnologia.",
  },
  {
    name: "Universidad Nacional del Nordeste",
    acronym: "UNNE",
    group: "Colaboradora Estrangeira",
    location: "Argentina",
    focus: "Colaboração internacional em biotecnologia, saúde e toxinologia.",
  },
  {
    name: "Universidade do Porto",
    acronym: "U.PORTO",
    group: "Colaboradora Estrangeira",
    location: "Portugal",
    focus: "Colaboração internacional em biotecnologia, toxinologia e redes Brasil-Portugal.",
  },
  {
    name: "Imperial College London - Silwood Park Campus",
    acronym: "Silwood Park",
    group: "Colaboradora Estrangeira",
    location: "Inglaterra",
    focus: "Colaboração internacional em ecologia, biodiversidade, ambiente e modelagem.",
  },
  {
    name: "Centro para el Desarrollo de la Investigación Científica",
    acronym: "CEDIC",
    group: "Colaboradora Estrangeira",
    location: "Paraguai",
    focus: "Colaboração internacional em pesquisa científica, biotecnologia e saúde.",
  },
  {
    name: "Centre National de la Recherche Scientifique",
    acronym: "CNRS",
    group: "Colaboradora Estrangeira",
    location: "França",
    focus: "Colaboração internacional em pesquisa científica, biodiversidade, biologia e biotecnologia.",
  },
  {
    name: "Universidad Nacional Costa Rica",
    acronym: "UNA",
    group: "Colaboradora Estrangeira",
    location: "Costa Rica",
    focus: "Colaboração internacional em ambiente, saúde e biodiversidade tropical.",
  },
  {
    name: "Universidad de Costa Rica",
    acronym: "UCR",
    group: "Colaboradora Estrangeira",
    location: "Costa Rica",
    focus: "Colaboração internacional em biodiversidade, saúde, ambiente e formação.",
  },
  {
    name: "Universidad de Panama",
    acronym: "U.PANAMA",
    group: "Colaboradora Estrangeira",
    location: "Panamá",
    focus: "Colaboração internacional em biotecnologia, toxinologia, biodiversidade e saúde.",
  },
  {
    name: "Universidad Autónoma de Occidente de Cali",
    acronym: "UAO",
    group: "Colaboradora Estrangeira",
    location: "Colômbia",
    focus: "Colaboração internacional em inovação, território, ambiente e pesquisa aplicada.",
  },
];

const partnerLogos: Record<string, string> = {
  "FIOCRUZ/RO": partnerLogoPath("fiocruz-ro.png"),
  IAM: partnerLogoPath("iam.png"),
  UNESP: partnerLogoPath("unesp.png"),
  UNIFAP: partnerLogoPath("unifap.png"),
  UEPB: partnerLogoPath("uepb.png"),
  UFU: partnerLogoPath("ufu.png"),
  UNIFESP: partnerLogoPath("unifesp.png"),
  IFRO: partnerLogoPath("ifro.png"),
  UFAM: partnerLogoPath("ufam.png"),
  UFOPA: partnerLogoPath("ufopa.jpg"),
  UFMG: partnerLogoPath("ufmg.png"),
  UFGD: partnerLogoPath("ufgd.png"),
  "PUC/PR": partnerLogoPath("pucpr.png"),
  ILMD: partnerLogoPath("ilmd.png"),
  UFSCar: partnerLogoPath("ufscar.png"),
  USP: partnerLogoPath("usp.jpg"),
  "FIOCRUZ/CE": partnerLogoPath("fiocruz-ce.jpg"),
  UFT: partnerLogoPath("uft.png"),
  UFMT: partnerLogoPath("ufmt.png"),
  UFSJ: partnerLogoPath("ufsj.png"),
  UFPA: partnerLogoPath("ufpa.png"),
  UFRR: partnerLogoPath("ufrr.png"),
  FSCBH: partnerLogoPath("fscbh.png"),
  UFCSPA: partnerLogoPath("ufcspa.png"),
  UEMA: partnerLogoPath("uema.png"),
  UNIR: assetPath("institution-logos/unir.png"),
  UFS: partnerLogoPath("ufs.png"),
  UFMA: partnerLogoPath("ufma.png"),
  IBU: partnerLogoPath("butantan.png"),
  FIOCRUZ: partnerLogoPath("fiocruz.png"),
  UFC: partnerLogoPath("ufc.png"),
  CECIERJ: partnerLogoPath("cecierj.png"),
  UFAL: partnerLogoPath("ufal.png"),
  UFRRJ: partnerLogoPath("ufrrj.png"),
  UnB: partnerLogoPath("unb.gif"),
  "FIOCRUZ/Pantanal": partnerLogoPath("fiocruz-pantanal.png"),
  UFRN: partnerLogoPath("ufrn.jpg"),
  INPE: partnerLogoPath("inpe.png"),
  UFJF: partnerLogoPath("ufjf.png"),
  UFCG: partnerLogoPath("ufcg.png"),
  UFPR: partnerLogoPath("ufpr.png"),
  UFF: partnerLogoPath("uff.png"),
  IBAMA: partnerLogoPath("ibama.png"),
  "FAAR/IESUR": partnerLogoPath("faar-official.png"),
  FCR: partnerLogoPath("fcr.png"),
  FIMCA: partnerLogoPath("fimca.png"),
  UniSL: partnerLogoPath("unisl.jpg"),
  "CEPEM/SSER": partnerLogoPath("cepem.png"),
  ICMBio: partnerLogoPath("icmbio.png"),
  IFRR: partnerLogoPath("ifrr.png"),
  ECOPORÉ: partnerLogoPath("ecopore.png"),
  "GOVERNO/RO": partnerLogoPath("governo-ro.png"),
  PMJP: partnerLogoPath("pmjp.png"),
  "SESAU/RR": partnerLogoPath("sesau-rr.png"),
  PMRILIS: partnerLogoPath("pmrilis.png"),
  "SEDUC/RO": partnerLogoPath("seduc-ro.jpg"),
  // IPEPATRO: partnerLogoPath("ipepatro.png"), // ⚠ desativado: placeholder genérico (idêntico ao de CEPEM). Mostra a sigla até receber a arte oficial.
  "SESAU/RO": partnerLogoPath("sesau-ro.jpg"),
  "SEDAM/RO": partnerLogoPath("sedam-ro.jpg"),
  PMPV: partnerLogoPath("pmpv.svg"),
  FAPERO: partnerLogoPath("fapero.png"),
  // KARIPUNAS: partnerLogoPath("karipunas.png"), // ⚠ desativado: imagem em branco (27×27). Mostra a sigla até receber a arte oficial.
  "PAITER SURUI": partnerLogoPath("paiter-surui.png"),
  Antigen: partnerLogoPath("antigen.png"),
  Amazonzyme: partnerLogoPath("amazonzyme.png"),
  UPCité: partnerLogoPath("upcite.png"),
  HARVARD: partnerLogoPath("harvard.png"),
  SDSU: partnerLogoPath("sdsu.png"),
  ECMWF: assetPath("institution-logos/ecmwf.svg"),
  UAEM: partnerLogoPath("uaem.jpg"),
  UNMSM: partnerLogoPath("unmsm.png"),
  IKIAM: partnerLogoPath("ikiam.png"),
  UNNE: partnerLogoPath("unne.png"),
  "U.PORTO": partnerLogoPath("uporto.png"),
  "Silwood Park": partnerLogoPath("imperial.png"),
  CEDIC: partnerLogoPath("cedic.png"),
  CNRS: assetPath("institution-logos/cnrs.svg"),
  UNA: partnerLogoPath("una-cr.png"),
  UCR: partnerLogoPath("ucr.png"),
  "U.PANAMA": partnerLogoPath("upanama.png"),
  UAO: partnerLogoPath("uao.png"),
};

const partnerGroups = ["Todos", ...Array.from(new Set(partners.map((partner) => partner.group)))];

function App() {
  const route = useHashRoute();
  const prevRouteName = useRef(route.name);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedResearch, setSelectedResearch] = useState(researchPrograms[0]);
  const [partnerFilter, setPartnerFilter] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSection, setActiveSection] = useState("inicio");
  const [headerLifted, setHeaderLifted] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("is-mobile-menu-open", menuOpen);

    return () => {
      document.body.classList.remove("is-mobile-menu-open");
    };
  }, [menuOpen]);

  useEffect(() => {
    if (route.name !== "home") return;

    const sectionIds = ["inicio", ...navItems.filter((item) => !item.routes).map((item) => item.href.slice(1))];
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const updateActiveSection = () => {
      setHeaderLifted(window.scrollY > 48);

      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8) {
        setActiveSection("contato");
        return;
      }

      const probeLine = window.scrollY + Math.min(window.innerHeight * 0.38, 360);
      const passedSections = sections.filter((section) => section.offsetTop <= probeLine);
      const currentSection = passedSections[passedSections.length - 1];

      setActiveSection(currentSection?.id ?? "inicio");
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [route.name]);

  // On route change: close the mobile menu and place the scroll position.
  // In-page anchors within the home page are left to native smooth scrolling;
  // only cross-route navigation is handled here (the target section may not have
  // existed in the DOM when the hash changed).
  useEffect(() => {
    setMenuOpen(false);
    const cameFromOtherRoute = prevRouteName.current !== route.name;
    prevRouteName.current = route.name;

    if (route.name === "home" && route.anchor) {
      if (cameFromOtherRoute) {
        const target = document.getElementById(route.anchor);
        // Double rAF so lazy-loaded sections above the target have reserved
        // their height before we measure the scroll offset.
        if (target) {
          requestAnimationFrame(() => requestAnimationFrame(() => target.scrollIntoView({ block: "start" })));
        }
      }
      return;
    }
    if (cameFromOtherRoute) {
      window.scrollTo({ top: 0 });
      // Move keyboard/SR focus to the new view so the page change is perceivable.
      requestAnimationFrame(() => document.getElementById("conteudo")?.focus({ preventScroll: true }));
    }
  }, [route]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  // Mobile drawer = modal dialog: focus in on open, trap Tab, Escape to close.
  useEffect(() => {
    if (!menuOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;

    const getFocusables = () =>
      Array.from(drawer.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));

    requestAnimationFrame(() => getFocusables()[0]?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;
      const items = getFocusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen, closeMenu]);

  const { events: webinarEvents } = useWebinars();
  const featuredWebinar = featuredFrom(webinarEvents);
  const featuredStatus = featuredWebinar ? resolveStatus(featuredWebinar) : "upcoming";

  const filteredPartners = useMemo(() => {
    const normalized = searchTerm.trim().toLocaleLowerCase("pt-BR");

    return partners.filter((partner) => {
      const matchesGroup = partnerFilter === "Todos" || partner.group === partnerFilter;
      const searchable = `${partner.name} ${partner.acronym ?? ""} ${partner.group} ${partner.location} ${partner.focus}`.toLocaleLowerCase("pt-BR");
      return matchesGroup && (!normalized || searchable.includes(normalized));
    });
  }, [partnerFilter, searchTerm]);

  return (
    <div className="site-shell">
      <a
        className="skip-link"
        href="#conteudo"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("conteudo");
          if (main) {
            main.focus();
            main.scrollIntoView({ block: "start" });
          }
        }}
      >
        Pular para o conteúdo
      </a>
      <header className={`site-header ${route.name === "home" && !headerLifted ? "is-on-hero" : "is-lifted"}`}>
        <a className="brand-lockup" href="#inicio" aria-label="INCT-CONEXAO">
          <span className="brand-mark">
            <img className="brand-logo-color" src={assetPath("logo-symbol.png")} alt="" />
            <img className="brand-logo-white" src={assetPath("logo-mark-white.png")} alt="" />
          </span>
          <span className="brand-copy">
            <strong>INCT-CONEXAO</strong>
            <small>Saúde Única, clima e bioeconomia</small>
          </span>
        </a>

        <nav className="desktop-nav" aria-label="Navegação principal">
          {navItems.map((item) => {
            const active = item.routes
              ? item.routes.includes(route.name)
              : route.name === "home" && activeSection === item.href.slice(1);

            return (
              <a
                key={item.href}
                href={item.href}
                className={active ? "is-active" : ""}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        <button
          ref={menuButtonRef}
          className="icon-button mobile-menu-button"
          type="button"
          aria-label="Abrir menu"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={22} aria-hidden="true" />
        </button>
      </header>

      <div
        ref={drawerRef}
        className={`mobile-drawer ${menuOpen ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        inert={!menuOpen}
      >
        <button className="icon-button drawer-close" type="button" aria-label="Fechar menu" onClick={closeMenu}>
          <X size={22} aria-hidden="true" />
        </button>
        <div className="drawer-brand" aria-hidden="true">
          <span className="brand-mark">
            <img className="brand-logo-color" src={assetPath("logo-symbol.png")} alt="" />
            <img className="brand-logo-white" src={assetPath("logo-mark-white.png")} alt="" />
          </span>
          <span className="brand-copy">
            <strong>INCT-CONEXAO</strong>
            <small>Navegação principal</small>
          </span>
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <a key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
              <Icon size={20} aria-hidden="true" />
              {item.label}
            </a>
          );
        })}
      </div>

      {route.name === "hub" ? <WebinarHub /> : null}
      {route.name === "event" ? <WebinarEvent slug={route.slug} /> : null}
      {route.name === "groups" ? <GroupsHub /> : null}
      {route.name === "group" ? <GroupPage slug={route.slug} /> : null}
      {route.name === "edital" ? <EditalIC2026 /> : null}
      {route.name === "inscricao" ? (
        <Suspense fallback={<PlatformFallback />}>
          <Inscricao slug={route.slug} />
        </Suspense>
      ) : null}
      {route.name === "minha-inscricao" ? (
        <Suspense fallback={<PlatformFallback />}>
          <MinhaInscricao />
        </Suspense>
      ) : null}
      {route.name === "gestao" ? (
        <Suspense fallback={<PlatformFallback />}>
          <Gestao />
        </Suspense>
      ) : null}

      {route.name === "home" ? (
      <main id="conteudo" tabIndex={-1}>
        <section className="hero section-band dark-band" id="inicio">
          <img className="hero-image" src={assetPath("hero-forest.jpg")} alt="Paisagem amazônica vista do alto ao pôr do sol" />
          <div className="hero-overlay" />
          <div className="section-inner hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">Observatório amazônico de ciência, tecnologia e inovação</p>
              <h1>
                <span>INCT</span>
                <span>CONEXAO</span>
              </h1>
              <p className="hero-subtitle">
                Instituto Nacional de Pesquisa e Conhecimento de Excelência da Amazônia Ocidental e Oriental.
              </p>
              <p className="hero-text">
                Saúde Única, biometeorologia, biodiversidade, biotecnologia, bioeconomia e políticas públicas conectadas para transformar conhecimento científico em impacto social, ambiental e tecnológico.
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#pesquisa">
                  Explorar pesquisas
                  <Compass size={18} aria-hidden="true" />
                </a>
              </div>
            </div>

            <aside className="hero-observatory" aria-label="Indicadores do INCT-CONEXAO">
              <Network size={22} aria-hidden="true" />
              <span>Rede de excelência</span>
              <p>Ciência em escala territorial, conectando dados, campo, comunidades e políticas públicas.</p>
            </aside>
          </div>
          <div className="section-inner hero-metrics" aria-label="Síntese do instituto">
            {heroMetrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="mission-strip section-band">
          <div className="section-inner strip-grid">
            <div>
              <p className="eyebrow dark">O que é o INCT-CONEXAO</p>
              <h2>Ciência amazônica organizada para decisão, inovação e cuidado</h2>
            </div>
            <p>
              O instituto atua diante dos desafios regionais ampliados pelas mudanças climáticas e por eventos ambientais extremos. O monitoramento biometeorológico, a pesquisa em biodiversidade e a integração com comunidades permitem compreender riscos à Saúde Única, identificar fragilidades e aproveitar a biodiversidade amazônica de forma sustentável.
            </p>
          </div>
        </section>

        <section className="field-section section-band">
          <div className="section-inner field-layout">
            <div className="field-intro">
              <p className="eyebrow dark">Ciência em movimento</p>
              <h2>Campo, dados e biodiversidade como uma única infraestrutura de conhecimento</h2>
            </div>
            <div className="field-grid">
              {fieldStories.map((story, index) => {
                const Icon = story.icon;

                return (
                  <article className={`field-card field-card-${index + 1}`} key={story.title}>
                    <img src={story.image} alt="" />
                    <div>
                      <span>{story.eyebrow}</span>
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <h3>{story.title}</h3>
                    <p>{story.text}</p>
                    <small>{story.meta}</small>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-band research-section" id="pesquisa">
          <div className="section-inner">
            <div className="section-heading">
              <p className="eyebrow dark">Linhas de pesquisa</p>
              <h2>Três frentes integradas, uma agenda amazônica</h2>
              <p>
                A pesquisa foi reorganizada para ficar mais clara para públicos científicos, gestores, parceiros e comunidades.
              </p>
            </div>

            <div className="research-layout">
              <div className="research-tabs" role="tablist" aria-label="Linhas de pesquisa">
                {researchPrograms.map((program) => {
                  const Icon = program.icon;
                  const isSelected = selectedResearch.id === program.id;

                  return (
                    <button
                      className={`research-tab ${isSelected ? "is-selected" : ""}`}
                      key={program.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedResearch(program)}
                    >
                      <Icon size={22} aria-hidden="true" />
                      <span>
                        <small>{program.eyebrow}</small>
                        <strong>{program.title}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>

              <article className="research-detail">
                <div className="research-media" aria-hidden="true">
                  <img src={selectedResearch.image} alt="" />
                </div>
                <div className="research-copy">
                  <p className="eyebrow dark">{selectedResearch.eyebrow}</p>
                  <h3>{selectedResearch.title}</h3>
                  <p>{selectedResearch.description}</p>
                  <ul>
                    {selectedResearch.outcomes.map((outcome) => (
                      <li key={outcome}>
                        <CheckCircle2 size={18} aria-hidden="true" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section-band axes-section">
          <div className="section-inner">
            <div className="section-heading compact">
              <p className="eyebrow dark">Eixos estratégicos transversais</p>
              <h2>Da coleta de dados à transformação territorial</h2>
            </div>
            <div className="axes-grid">
              {strategicAxes.map((axis) => (
                <article className="axis-card" key={axis.title}>
                  <img src={axis.image} alt="" />
                  <h3>{axis.title}</h3>
                  <p>{axis.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section-band dark-band expedition-section">
          <div className="section-inner expedition-grid">
            <figure className="expedition-figure">
              <img
                src={assetPath("barco-ciencia-real.jpg")}
                alt="Barco Ciência e Saúde INCT-CONEXAO usado na expedição do Rio Madeira"
              />
              <figcaption>Foto: Nubia Abe/Agência Brasil</figcaption>
            </figure>
            <div>
              <p className="eyebrow">Expedição científica</p>
              <h2>Barco Ciência, Saúde e Cidadania 2026/1</h2>
              <p>
                A expedição, divulgada também no LinkedIn institucional, atende às comunidades ribeirinhas do Rio Madeira nos distritos de Calama, Nazaré e São Carlos, com saída fluvial de Porto Velho e campo de 18/05/2026 a 24/05/2026.
              </p>
              <div className="timeline">
                <span>10/02/2026</span>
                <strong>Inscrições abertas</strong>
                <span>03/03/2026</span>
                <strong>Encerramento</strong>
                <span>01/04/2026</span>
                <strong>Resultado publicado</strong>
                <span>18-24/05/2026</span>
                <strong>Campo no Rio Madeira</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="section-band action-section" id="acoes">
          <div className="section-inner action-layout">
            <div className="action-intro">
              <p className="eyebrow dark">No Instagram @inct_conexao</p>
              <h2>Registros públicos das ações coordenadas pelo INCT</h2>
              <p>
                Seleção de publicações com fotos e artes do próprio Instagram do INCT-CONEXAO, filtradas para mostrar o que acrescenta contexto institucional: campo, formação, dados, parcerias e inovação.
              </p>
              <a className="instagram-cta" href="https://www.instagram.com/inct_conexao/" target="_blank" rel="noreferrer">
                <Instagram size={20} aria-hidden="true" />
                Acompanhar atualizações
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>

            <div className="action-grid">
              {instagramHighlights.map((highlight) => {
                const Icon = highlight.icon;

                return (
                  <article className={`action-card ${highlight.video ? "" : "is-notice"}`} key={highlight.title}>
                    {highlight.video ? (
                      <div className="action-media is-video">
                        <ActionVideo highlight={highlight} />
                      </div>
                    ) : null}
                    <div className="action-card-body">
                      {!highlight.video ? (
                        <div className="action-notice-head">
                          <Icon size={25} aria-hidden="true" />
                          <span>
                            <strong>{highlight.poster?.eyebrow ?? "Registro institucional"}</strong>
                            <small>{highlight.poster?.meta ?? "Publicação do INCT-CONEXAO"}</small>
                          </span>
                        </div>
                      ) : null}
                      <div className="action-card-top">
                        <span>{highlight.label}</span>
                        {highlight.video ? <Icon size={24} aria-hidden="true" /> : null}
                      </div>
                      <h3>{highlight.title}</h3>
                      <p>{highlight.text}</p>
                      <div className="action-card-foot">
                        <span>{highlight.date}</span>
                        <strong>{highlight.video ? "Registro audiovisual" : "Registro institucional"}</strong>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-band webinar-teaser-section">
          <div className="section-inner webinar-teaser">
            <div className="webinar-teaser-copy">
              <p className="eyebrow dark">
                <Radio size={15} aria-hidden="true" /> Transmissões científicas
              </p>
              <h2>Webinars e mesas-redondas da rede</h2>
              <p>
                {featuredWebinar
                  ? "Acompanhe debates científicos do INCT-CONEXAO sobre Saúde Única, clima, biodiversidade e bioeconomia — ao vivo e sob demanda, no nosso centro de transmissões."
                  : "Estamos preparando o centro de transmissões científicas do INCT-CONEXAO. Em breve, mesas-redondas e webinars sobre Saúde Única, clima, biodiversidade e bioeconomia na Amazônia — ao vivo e sob demanda."}
              </p>
              <a className="button primary" href={HUB_HREF}>
                {featuredWebinar ? "Ver webinars" : "Conhecer o centro de transmissões"}
                <PlayCircle size={18} aria-hidden="true" />
              </a>
            </div>
            {featuredWebinar ? (
              <a
                className="webinar-teaser-card"
                href={eventHref(featuredWebinar.slug)}
                aria-label={`Abrir: ${featuredWebinar.title}`}
              >
                <span className="webinar-teaser-media">
                  <img src={webinarAsset(featuredWebinar.heroImage ?? "hero-forest.jpg")} alt="" loading="lazy" decoding="async" />
                  <StatusBadge status={featuredStatus} size="sm" />
                </span>
                <span className="webinar-teaser-info">
                  <small>{featuredWebinar.theme}</small>
                  <strong>{featuredWebinar.title}</strong>
                  <span className="webinar-teaser-meta">
                    <CalendarClock size={15} aria-hidden="true" />
                    <time dateTime={machineDate(featuredWebinar.startsAt)}>
                      {formatEventDateShort(featuredWebinar.startsAt)} · {formatEventTime(featuredWebinar.startsAt)}
                    </time>
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        </section>

        <section className="section-band linkedin-section">
          <div className="section-inner linkedin-layout">
            <div className="linkedin-profile">
              <div className="linkedin-profile-head">
                <Linkedin size={28} aria-hidden="true" />
                <p className="eyebrow dark">LinkedIn institucional</p>
                <h2>Presença pública orientada a pesquisa, inovação e articulação institucional</h2>
                <p>
                  O perfil público do INCT-CONEXAO apresenta a rede como iniciativa de pesquisa sediada em Porto Velho, articulando biodiversidade, biotecnologia, biometeorologia, toxicologia, educação em Saúde Única, CT&I, empreendedorismo e formação acadêmica.
                </p>
                <a className="linkedin-link" href="https://www.linkedin.com/company/inct-conexao/" target="_blank" rel="noreferrer">
                  <Linkedin size={18} aria-hidden="true" />
                  Ver perfil no LinkedIn
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </div>
              <div className="linkedin-facts" aria-label="Dados do perfil público no LinkedIn">
                {linkedInProfileFacts.map((fact) => (
                  <div key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="linkedin-updates" aria-label="Conteúdos selecionados do LinkedIn do INCT-CONEXAO">
              {linkedInHighlights.map((item) => {
                const Icon = item.icon;

                return (
                  <article className="linkedin-card" key={item.title}>
                    <div className="linkedin-card-top">
                      <span>{item.label}</span>
                      <Icon size={22} aria-hidden="true" />
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <small>{item.meta}</small>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-band governance-section" id="governanca">
          <div className="section-inner governance-shell">
            <div className="section-heading governance-heading">
              <p className="eyebrow dark">Gestão e governança</p>
              <h2>Como o INCT-CONEXAO coordena uma rede multicêntrica na Amazônia</h2>
              <p>
                O modelo descrito na proposta CNPq combina coordenação executiva em Rondônia, Comitê Gestor, líderes de laboratórios associados, comitês técnicos e membros de equipe para executar ciência, tecnologia e ações sociais em todos os estados da Amazônia Legal.
              </p>
            </div>

            <div className="governance-layout">
              <aside className="governance-command" aria-label="Estrutura de comando e acompanhamento">
                <article className="governance-command-card">
                  <span>Gestão compartilhada</span>
                  <h3>Decisão estratégica, execução territorial e controle técnico no mesmo fluxo</h3>
                  <p>
                    O CGES define prioridades; os LLAs acompanham e executam atividades; os CTs assessoram por área; os membros de equipe conectam academia, governo, empresas e sociedade.
                  </p>
                </article>

                <article className="cges-composition">
                  <div>
                    <span>Composição do CGES</span>
                    <strong>9 pesquisadores</strong>
                    <p>Representação distribuída entre Rondônia, outros estados amazônicos e São Paulo.</p>
                  </div>
                  <div className="cges-distribution" aria-label="Distribuição geográfica do Comitê Gestor">
                    {cgesDistribution.map((item, index) => (
                      <div className={`cges-region ${index === 0 ? "is-lead" : ""}`} key={item.code}>
                        <strong>{item.count}</strong>
                        <span>{item.code}</span>
                        <small>{item.label}</small>
                        <em>{item.detail}</em>
                      </div>
                    ))}
                  </div>
                </article>
              </aside>

              <div className="governance-layers" aria-label="Camadas de governança do INCT-CONEXAO">
                {governanceLayers.map((layer) => {
                  const Icon = layer.icon;

                  return (
                    <article className="governance-layer" key={layer.label}>
                      <Icon size={24} aria-hidden="true" />
                      <div>
                        <span>{layer.label}</span>
                        <strong>{layer.value}</strong>
                        <p>{layer.text}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="governance-cadence" aria-label="Rotina de acompanhamento da execução">
              {governanceCadence.map((item) => (
                <div key={item}>
                  <CheckCircle2 size={18} aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="committee-board">
              <div className="committee-board-head">
                <div>
                  <p className="eyebrow dark">Comitês técnicos</p>
                  <h3>Seis frentes assessoram o CGES e dão suporte aos LLAs</h3>
                </div>
                <p>
                  Os comitês deixam explícito quem cuida da logística de campo, da relação clima-território, da qualidade científica, da comunicação, da inovação e da cooperação internacional.
                </p>
              </div>

              <div className="committee-grid">
                {committees.map((committee) => {
                  const Icon = committee.icon;

                  return (
                    <article className="committee-card" key={committee.acronym}>
                      <div className="committee-card-top">
                        <span>{committee.acronym}</span>
                        <Icon size={22} aria-hidden="true" />
                      </div>
                      <small>{committee.scope}</small>
                      <h4>{committee.name}</h4>
                    <p>{committee.text}</p>
                      <ul>
                        {committee.deliverables.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="section-band network-section" id="rede">
          <div className="section-inner">
            <div className="section-heading">
              <p className="eyebrow dark">Ecossistema institucional</p>
              <h2>Instituições, laboratórios associados e grupos que executam o INCT-CONEXAO</h2>
              <p>
                Rede extraída da proposta CNPq 2024: sede executora, laboratórios associados, colaboradoras nacionais e estrangeiras, FAP, setor público, empresas e organizações da sociedade.
              </p>
            </div>

            <div className="network-overview" aria-label="Resumo operacional da rede INCT-CONEXAO">
              {networkOverview.map((item) => (
                <article key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>

            <div className="network-facts" aria-label="Síntese institucional do INCT-CONEXAO">
              {networkFacts.map((fact) => (
                <article key={fact.label}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                  <p>{fact.text}</p>
                </article>
              ))}
            </div>

            <div className="network-showcase" aria-label="Instituições, territórios e países em destaque na rede">
              <article className="institution-wall">
                <div className="network-panel-head">
                  <span>Instituições em destaque</span>
                  <strong>Marcas que ajudam a reconhecer a rede.</strong>
                </div>
                <div className="institution-logo-grid">
                  {featuredInstitutions.map((institution) => (
                    <article className={`institution-logo-tile has-logo tone-${institution.tone}`} key={institution.acronym}>
                      <span className="institution-mark">
                        <img src={institution.logo} alt={`Logotipo ${institution.name}`} loading="lazy" />
                        <em>{institution.acronym}</em>
                      </span>
                      <div>
                        <strong>{institution.name}</strong>
                        <small>
                          {institution.role} · {institution.location}
                        </small>
                      </div>
                    </article>
                  ))}
                </div>
              </article>

              <aside className="network-globe-card">
                <div className="network-panel-head">
                  <span>Bandeiras e cooperação</span>
                  <strong>Conexões nacionais e estrangeiras.</strong>
                </div>
                <div className="flag-cloud" aria-label="Países com instituições colaboradoras">
                  {internationalCountries.map((country) => (
                    <span key={`${country.country}-${country.detail}`}>
                      <img src={country.flag} alt={`Bandeira: ${country.country}`} loading="lazy" />
                      <em>{country.country}</em>
                      <small>{country.detail}</small>
                    </span>
                  ))}
                </div>
                <div className="amazon-state-strip" aria-label="Estados amazônicos com presença institucional destacada">
                  {amazonStateHighlights.map((state) => (
                    <span key={state.code}>
                      <strong>{state.code}</strong>
                      <small>{state.label}</small>
                      <em>{state.detail}</em>
                    </span>
                  ))}
                </div>
              </aside>
            </div>

            <div className="network-role-strip" aria-label="Como os grupos da rede se conectam por função">
              {networkRoleHighlights.map((role) => {
                const Icon = role.icon;

                return (
                  <article key={role.label}>
                    <Icon size={24} aria-hidden="true" />
                    <span>{role.label}</span>
                    <strong>{role.value}</strong>
                    <p>{role.text}</p>
                  </article>
                );
              })}
            </div>

            <div className="lab-network" aria-label="Laboratórios associados e grupos de pesquisa">
              <div className="lab-network-head">
                <div>
                  <p className="eyebrow dark">Laboratórios e grupos associados</p>
                  <h3>O trabalho científico é organizado em 8 Etapas Estratégicas Transversais</h3>
                </div>
                <p>
                  Cada EET conta com líderes de laboratórios associados e pesquisadores vinculados aos comitês técnicos: Expedições Científicas, Clima e Comunidades Originárias, Técnico-Científico, Divulgação, Políticas Públicas/Inovação e Internacionalização.
                </p>
              </div>
              <div className="lab-track-grid">
                {associatedLabTracks.map((track) => (
                  <article className="lab-track" key={track.code}>
                    <span>{track.code}</span>
                    <h4>{track.title}</h4>
                    <p>{track.text}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="directory-controls">
              <label className="search-box">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Buscar instituição, sigla, estado, país, papel ou foco"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <label className="filter-select">
                <Filter size={18} aria-hidden="true" />
                <span>Papel</span>
                <select value={partnerFilter} onChange={(event) => setPartnerFilter(event.target.value)} aria-label="Filtrar instituições por categoria">
                  {partnerGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="directory-summary">
              <span>{filteredPartners.length} registros institucionais detalhados</span>
              <span>{partnerFilter}</span>
            </div>

            <div className="partner-grid">
              {filteredPartners.map((partner) => {
                const partnerLogo = partner.acronym ? partnerLogos[partner.acronym] : undefined;
                const partnerLabel = partner.acronym ?? partner.name.slice(0, 2);

                return (
                  <article className="partner-card" key={`${partner.name}-${partner.location}-${partner.group}`}>
                    <span className={`partner-acronym ${partnerLogo ? "has-logo" : ""}`}>
                      {partnerLogo ? <img src={partnerLogo} alt={`Logotipo ${partner.name}`} loading="eager" decoding="async" /> : partnerLabel}
                    </span>
                    <div>
                      <h3>{partner.name}</h3>
                      <p>{partner.focus}</p>
                    </div>
                    <div className="partner-meta">
                      <span>{partner.group}</span>
                      <small>{partner.location}</small>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-band impact-section" id="impacto">
          <div className="section-inner impact-shell">
            <div className="impact-grid">
              <div className="impact-copy">
                <p className="eyebrow dark">ODS e políticas públicas</p>
                <h2>Do dado de campo à decisão pública</h2>
                <p>
                  O INCT-CONEXAO organiza evidências para apoiar a Política Nacional de Mudança do Clima, o Plano de Ação Nacional de Uma Só Saúde e o Programa Nacional de Plantas Medicinais.
                </p>
                <div className="policy-tags" aria-label="Objetivos de desenvolvimento sustentável relacionados">
                  <span>ODS 3</span>
                  <span>ODS 4</span>
                  <span>ODS 8</span>
                  <span>ODS 11</span>
                  <span>ODS 13</span>
                </div>
              </div>
              <div className="impact-cards" aria-label="Aplicações do INCT-CONEXAO para políticas públicas">
                {policyImpacts.map((impact) => {
                  const Icon = impact.icon;

                  return (
                    <article key={impact.title}>
                      <Icon size={24} aria-hidden="true" />
                      <div>
                        <span>{impact.ods}</span>
                        <h3>{impact.title}</h3>
                        <p>{impact.text}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="policy-evidence-panel">
              <div className="policy-evidence-head">
                <span>Registros públicos</span>
                <h3>Evidências visuais conectam campo, comunidade, clima e governança</h3>
                <p>Publicações selecionadas do INCT-CONEXAO usadas como provas de execução, mobilização territorial e articulação institucional.</p>
              </div>
              <div className="policy-evidence-grid" aria-label="Registros públicos que sustentam a agenda de impacto">
                {policyEvidence.map((evidence) => (
                  <article className="policy-evidence-card" key={evidence.title}>
                    <figure>
                      <img src={evidence.image} alt={evidence.title} loading="eager" decoding="async" />
                    </figure>
                    <div>
                      <span>{evidence.label}</span>
                      <h3>{evidence.title}</h3>
                      <p>{evidence.text}</p>
                      <small>{evidence.source}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section-band notices-section" id="editais">
          <div className="section-inner">
            <div className="section-heading">
              <p className="eyebrow dark">Editais e documentos</p>
              <h2>Acesso rápido a processos seletivos e resultados</h2>
            </div>
            <div className="notice-grid">
              {notices.map((notice) => {
                const internal = notice.href.startsWith("#");
                const linkProps = internal ? {} : { target: "_blank", rel: "noreferrer" };
                return (
                  <article className={`notice-card${notice.featured ? " notice-card--featured" : ""}`} key={notice.title}>
                    <div>
                      <span className="status-pill">{notice.status}</span>
                      <p>{notice.date}</p>
                    </div>
                    <h3>{notice.title}</h3>
                    <p>{notice.text}</p>
                    <a className="notice-link" href={notice.href} {...linkProps}>
                      {notice.linkLabel ?? "Abrir documento"}
                      {internal ? <ArrowRight size={18} aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section-band funding-section" id="fomento">
          <div className="section-inner funding-grid">
            <div className="funding-copy">
              <p className="eyebrow dark">Fomento</p>
              <h2>Agências e instituições que sustentam o INCT-CONEXAO</h2>
              <p>
                O INCT-CONEXAO se insere na Chamada MCTI/CNPq/SECTICS/MS/CAPES/FAPs Nº 46/2024, do Programa Institutos Nacionais de Ciência e Tecnologia.
              </p>
              <div className="funding-callout">
                <strong>Chamada 46/2024</strong>
                <span>Fomento federal, cooperação em saúde, formação científica e apoio das FAPs para pesquisa em rede de alto impacto.</span>
              </div>
            </div>
            <div>
              <div className="funding-logo-grid" aria-label="Agências e instituições de fomento do INCT-CONEXAO">
                {fundingAgencies.map((agency) => (
                  <a
                    className="funding-card"
                    href={agency.href}
                    target="_blank"
                    rel="noreferrer"
                    key={agency.acronym}
                  >
                    <span className="funding-logo-box">
                      <img src={agency.logo} alt={`Logotipo ${agency.name}`} loading="eager" decoding="async" />
                    </span>
                    <span>
                      <small>{agency.acronym}</small>
                      <strong>{agency.name}</strong>
                      <em>{agency.role}</em>
                    </span>
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                ))}
              </div>
              <p className="funding-note">
                Apoio: logomarcas institucionais exibidas em equilíbrio visual com a identificação do INCT-CONEXAO.
              </p>
            </div>
          </div>
        </section>

        <section className="section-band contact-section dark-band" id="contato">
          <img src={assetPath("river-amazon.jpg")} alt="" className="contact-bg" />
          <div className="section-inner contact-grid">
            <div>
              <p className="eyebrow">Contato</p>
              <h2>Conecte sua instituição, comunidade ou pesquisa à rede</h2>
              <p>
                Para dúvidas sobre chamadas, cooperações, expedições, divulgação científica e parcerias, use os canais oficiais do INCT-CONEXAO.
              </p>
            </div>
            <div className="contact-actions" aria-label="Canais de contato">
              <a href="mailto:inctconexao@gmail.com">
                <Mail size={22} aria-hidden="true" />
                <span>
                  <strong>Email</strong>
                  inctconexao@gmail.com
                </span>
              </a>
              <a href="https://www.instagram.com/inct_conexao/" target="_blank" rel="noreferrer">
                <Instagram size={22} aria-hidden="true" />
                <span>
                  <strong>Instagram</strong>
                  @inct_conexao
                </span>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              <a href="https://www.linkedin.com/company/inct-conexao/" target="_blank" rel="noreferrer">
                <Linkedin size={22} aria-hidden="true" />
                <span>
                  <strong>LinkedIn</strong>
                  INCT-CONEXAO
                </span>
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              <a href="tel:+5569981526200">
                <Phone size={22} aria-hidden="true" />
                <span>
                  <strong>Telefone</strong>
                  +55 69 98152-6200
                </span>
              </a>
            </div>
          </div>
        </section>
      </main>
      ) : null}

      <footer className="site-footer">
        <div className="section-inner footer-grid">
          <div className="footer-brand">
            <img src={assetPath("logo-mark-white.png")} alt="INCT-CONEXAO" />
            <p>
              Instituto Nacional de Pesquisa e Conhecimento de Excelência da Amazônia Ocidental e Oriental.
            </p>
          </div>
          <div className="footer-links">
            <a href="#pesquisa">
              <Atom size={18} aria-hidden="true" />
              Pesquisa
            </a>
            <a href="#rede">
              <Globe2 size={18} aria-hidden="true" />
              Rede
            </a>
            <a href="#editais">
              <Download size={18} aria-hidden="true" />
              Editais
            </a>
            <a href={HUB_HREF}>
              <Radio size={18} aria-hidden="true" />
              Webinars
            </a>
            <a href={GROUPS_HREF}>
              <UsersRound size={18} aria-hidden="true" />
              Grupos
            </a>
            <a href="#fomento">
              <Building2 size={18} aria-hidden="true" />
              Fomento
            </a>
          </div>
          <div className="footer-note">
            <p>Saúde Única, biodiversidade, clima, bioeconomia e políticas públicas para a Amazônia Legal.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
