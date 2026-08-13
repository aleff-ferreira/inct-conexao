/**
 * ============================================================================
 *  Molécula decorativa do curso: cena de docking molecular (SVG inline)
 * ============================================================================
 *  Um ligante real, o catecol (benzeno-1,2-diol, motivo comum em flavonoides e
 *  outros produtos naturais), acoplado ao bolso de ligação de uma proteína.
 *  É o resumo visual honesto do que o curso ensina: o AutoDock Vina encontra a
 *  pose, o ChimeraX mostra a superfície e as pontes de hidrogênio tracejadas.
 *
 *  CONVENÇÕES CIENTÍFICAS RESPEITADAS
 *  ----------------------------------
 *   1. Bola e vareta: esferas nos átomos, varetas nas ligações, hidrogênios
 *      implícitos (padrão em representações de esqueleto).
 *   2. Cores CPK mapeadas para a paleta do site: carbono escuro (--forest-2),
 *      oxigênio terracota (--clay), nitrogênio azul (--river). Nada de arco-íris.
 *   3. Anel aromático em forma de Kekulé: hexágono regular (centro 142,100,
 *      raio 33, vértices a cada 60 graus) com três linhas internas EXATAMENTE
 *      paralelas às ligações alternadas C1C2, C3C4 e C5C6 (deslocadas 6,5 px
 *      para o centro ao longo da normal da corda, aparadas em t de 0,20 a 0,80).
 *      As hidroxilas saem de C2 e C3 na direção radial: 120 graus exatos (sp2).
 *   4. Pontes de hidrogênio: linhas tracejadas curtas entre heteroátomos, a
 *      convenção do ChimeraX e do PyMOL. As duas pontes que partem do mesmo O
 *      abrem 105 graus entre si (geometria de pares de elétrons do oxigênio).
 *   5. Bolso da proteína: superfície molecular translúcida em recorte, com os
 *      átomos dos resíduos ancorados na borda por hastes que somem na massa.
 *
 *  DESEMPENHO E ACESSIBILIDADE
 *  ---------------------------
 *   Decorativo: aria-hidden, sem texto. Só transform e opacity animados, tudo
 *   em CSS (styles.css). A pose base, sem animação, é o complexo JÁ ACOPLADO:
 *   qualquer renderização estática (leitor antigo, impressão) mostra a cena
 *   pronta e correta.
 *
 *  A ANIMAÇÃO CONTA O PROCESSO DE DOCAGEM (ciclo de 14 s, ver styles.css):
 *   o ligante entra vindo de fora do bolso com pequenas rotações (a busca de
 *   pose do algoritmo), assenta na pose de menor energia, as três pontes de
 *   hidrogênio se formam em sequência, o complexo respira ligado por alguns
 *   segundos e então se dissocia, reiniciando o laço. É o equilíbrio de
 *   associação e dissociação que a docagem modela: ligação REVERSÍVEL.
 *   Decisão do dono (2026-08-13): a molécula anima para todo mundo, inclusive
 *   sob prefers-reduced-motion (as regras usam !important de classe, que
 *   vence a trava global de movimento reduzido do styles.css).
 *
 *  AUDITORIA DE EXTENSÃO (viewBox 0 0 240 240): x de ~27 (bolso) a ~184 (halo
 *  de C6), y de ~56 (topo do bolso) a ~216 (base do bolso). Margem mínima de
 *  ~24 px em todos os lados: nada encosta na moldura, nem sob animação (as
 *  folgas das pontes foram conferidas no deslocamento máximo do ligante).
 * ============================================================================
 */

/** Um átomo: esfera com halo e brilho especular. `cor` é uma variável de tema. */
function Atomo({ cx, cy, r, cor }: { cx: number; cy: number; r: number; cor: string }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r + 3} fill={cor} opacity={0.16} />
      <circle cx={cx} cy={cy} r={r} fill={cor} />
      <circle cx={cx - r * 0.32} cy={cy - r * 0.32} r={r * 0.34} fill="#fff" opacity={0.55} />
    </>
  );
}

/**
 * Vértices do anel benzênico: hexágono regular de centro (142, 100) e raio 33,
 * ângulos de 45 a 345 graus em passos de 60 (coordenadas de tela, y para baixo).
 * Ordem: C1 (45), C2 (105), C3 (165), C4 (225), C5 (285), C6 (345).
 */
const CARBONOS: ReadonlyArray<readonly [number, number]> = [
  [165.3, 123.3],
  [133.5, 131.9],
  [110.1, 108.5],
  [118.7, 76.7],
  [150.5, 68.1],
  [173.9, 91.5],
];

/**
 * Oxigênios das hidroxilas do catecol, ligados a C2 e C3 (orto, benzeno-1,2-
 * diol). Cada O fica a 26 px do carbono, na direção radial do anel: isso
 * garante os 120 graus corretos entre a ligação exocíclica e as duas ligações
 * do anel (geometria sp2).
 */
const OXIGENIOS: ReadonlyArray<readonly [number, number]> = [
  [126.7, 157.0],
  [85.0, 115.3],
];

/**
 * Molécula do herói: catecol acoplado ao bolso de ligação, seguro por três
 * pontes de hidrogênio tracejadas com átomos de resíduos na borda da cavidade.
 * Quem doa e quem aceita: a hidroxila de C2 doa para um O de carbonila (clay);
 * a hidroxila de C3 aceita de um N-H de cadeia lateral (river) e doa para um
 * segundo O da borda (clay), o que é quimicamente plausível para um O de
 * hidroxila (doa um H e aceita até dois).
 */
export function HeroMolecula({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `curso-mol ${className}` : "curso-mol"}
      viewBox="0 0 240 240"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      {/* --------------------------------------------------------------
          Bolso de ligação: superfície molecular translúcida em recorte,
          côncava na direção do ligante. Deriva lentíssima (36 s).
          -------------------------------------------------------------- */}
      <g className="curso-mol-bolso" style={{ transformOrigin: "80px 150px" }}>
        {/* Corpo da superfície: crescente orgânico de béziers suaves */}
        <path
          d="M 160 210
             C 118 222, 74 216, 48 188
             C 30 168, 26 128, 32 92
             C 36 70, 48 54, 62 60
             C 66 84, 58 100, 56 122
             C 58 148, 76 170, 102 186
             C 122 196, 142 203, 160 210 Z"
          fill="var(--forest)"
          fillOpacity={0.08}
          stroke="var(--forest)"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
        {/* Contorno interno: sugere a espessura da superfície recortada.
            Traçado afastado dos átomos dos resíduos para os halos não somarem. */}
        <path
          d="M 66 88 C 62 106, 60 124, 64 140 C 70 158, 84 172, 102 182"
          fill="none"
          stroke="var(--forest)"
          strokeOpacity={0.1}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        {/* Hastes curtas: as ligações dos resíduos mergulhando na proteína,
            no prolongamento de cada ponte de hidrogênio */}
        <path
          d="M 110 192 L 106.1 200.1 M 52 146 L 45.4 152.1 M 63 73 L 58.8 65"
          fill="none"
          stroke="var(--forest-2)"
          strokeOpacity={0.45}
          strokeWidth={3.5}
          strokeLinecap="round"
        />
        {/* Átomos de resíduos na borda da cavidade:
            O de carbonila (clay), N de cadeia lateral (river), O (clay) */}
        <Atomo cx={110} cy={192} r={6.5} cor="var(--clay)" />
        <Atomo cx={52} cy={146} r={6.5} cor="var(--river)" />
        <Atomo cx={63} cy={73} r={6.5} cor="var(--clay)" />
      </g>

      {/* --------------------------------------------------------------
          Pontes de hidrogênio: tracejadas, só entre heteroátomos, aparadas
          para nunca encostar nas esferas (12,5 px no lado do ligante, 11 px
          no lado do resíduo). No ciclo de docagem elas nascem em SEQUÊNCIA
          quando o ligante assenta (40 a 47% do ciclo), flutuam de ocupação
          durante a permanência e se rompem pouco antes da dissociação,
          quando o ligante ainda está a poucos px da pose. Enquanto o
          ligante está longe, ficam invisíveis: a geometria delas é fixa.
          -------------------------------------------------------------- */}
      <g stroke="var(--river-ink)" strokeWidth={2.2} strokeLinecap="round" strokeDasharray="3.5 4.5">
        {/* OH de C2 doa para o O de carbonila do resíduo: a primeira a formar */}
        <line className="curso-mol-ponte-a" x1={121.3} y1={168.3} x2={114.7} y2={182.1} opacity={0.9} />
        {/* O de C3 aceita do N-H do resíduo (ex.: lisina ou histidina) */}
        <line className="curso-mol-ponte-b" x1={75.9} y1={123.8} x2={60.1} y2={138.5} opacity={0.9} />
        {/* A mesma hidroxila doa para um segundo O da borda do bolso */}
        <line className="curso-mol-ponte-c" x1={79.2} y1={104.2} x2={68.1} y2={82.8} opacity={0.9} />
      </g>

      {/* --------------------------------------------------------------
          Ligante: catecol em bola e vareta, pose ACOPLADA como estado base.
          No ciclo de 14 s ele parte de fora (24 px acima e à direita, ainda
          dentro da moldura), se aproxima testando orientações, assenta na
          pose base, respira ligado e se dissocia de volta ao ponto inicial.
          -------------------------------------------------------------- */}
      <g className="curso-mol-ligante" style={{ transformOrigin: "142px 100px" }}>
        {/* Varetas do anel: hexágono fechado, juntas arredondadas */}
        <path
          d="M 165.3 123.3 L 133.5 131.9 L 110.1 108.5 L 118.7 76.7 L 150.5 68.1 L 173.9 91.5 Z"
          fill="none"
          stroke="var(--forest-2)"
          strokeOpacity={0.75}
          strokeWidth={5}
          strokeLinejoin="round"
        />
        {/* Varetas exocíclicas C-O das duas hidroxilas */}
        <path
          d="M 133.5 131.9 L 126.7 157 M 110.1 108.5 L 85 115.3"
          fill="none"
          stroke="var(--forest-2)"
          strokeOpacity={0.75}
          strokeWidth={5}
          strokeLinecap="round"
        />
        {/* Kekulé: linhas internas paralelas às ligações C1C2, C3C4 e C5C6,
            deslocadas 6,5 px para o centro (ao longo da normal) e aparadas */}
        <path
          d="M 157.3 118.8 L 138.2 123.9 M 118.1 103.9 L 123.2 84.7 M 150.6 77.4 L 164.6 91.4"
          fill="none"
          stroke="var(--forest-2)"
          strokeOpacity={0.75}
          strokeWidth={3}
          strokeLinecap="round"
        />
        {/* Carbonos do anel */}
        {CARBONOS.map(([x, y], i) => (
          <Atomo key={`c-${i}`} cx={x} cy={y} r={7} cor="var(--forest-2)" />
        ))}
        {/* Oxigênios das hidroxilas, voltados para o bolso */}
        {OXIGENIOS.map(([x, y], i) => (
          <Atomo key={`o-${i}`} cx={x} cy={y} r={8} cor="var(--clay)" />
        ))}
      </g>
    </svg>
  );
}

/**
 * Selo molecular pequeno: dois átomos ligados (molécula diatômica), para
 * acompanhar títulos de seção sem peso. Decorativo e cientificamente inócuo.
 */
export function MoleculaMini({ className }: { className?: string }) {
  return (
    <svg
      className={className ? `curso-mol-mini ${className}` : "curso-mol-mini"}
      viewBox="0 0 40 24"
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <line x1={9} y1={12} x2={31} y2={12} stroke="var(--leaf)" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      <circle cx={9} cy={12} r={6} fill="var(--river)" />
      <circle cx={31} cy={12} r={5} fill="var(--gold)" />
    </svg>
  );
}
