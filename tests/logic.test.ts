import { describe, it, expect } from "vitest";
import {
  resolveStatus,
  sortByStartAsc,
  bySlug,
  upcomingFrom,
  pastFrom,
  liveFrom,
  featuredFrom,
  sortGroups,
  groupBySlug,
  webinarsOfGroup,
  webinarGroups,
  webinars,
  bareAsset,
  normalizeWebinar,
  normalizeGroup,
  webinarAsset,
  type WebinarEvent,
  type WebinarGroup,
} from "../src/webinars/data";
import { getCountdownParts, initials, formatEventTime, formatEventTimeBadge, buildIcsContent, scheduleLines } from "../src/webinars/format";
import { resolveStream, stageEscapeLinks } from "../src/webinars/stream";

const ev = (over: Partial<WebinarEvent>): WebinarEvent => ({
  slug: "x",
  title: "X",
  subtitle: "",
  theme: "",
  summary: "",
  description: "",
  startsAt: "2026-08-27T16:00:00-04:00",
  endsAt: "2026-08-27T17:30:00-04:00",
  timezoneLabel: "Horário de Rondônia (UTC-4)",
  speakers: [],
  agenda: [],
  materials: [],
  partners: [],
  ...over,
});

describe("resolveStatus", () => {
  const e = ev({ startsAt: "2026-08-27T16:00:00-04:00", endsAt: "2026-08-27T17:30:00-04:00" });
  it("upcoming before start", () => {
    expect(resolveStatus(e, new Date("2026-08-27T15:00:00-04:00"))).toBe("upcoming");
  });
  it("live at start (inclusive)", () => {
    expect(resolveStatus(e, new Date("2026-08-27T16:00:00-04:00"))).toBe("live");
  });
  it("live mid-window", () => {
    expect(resolveStatus(e, new Date("2026-08-27T17:00:00-04:00"))).toBe("live");
  });
  it("ended after end", () => {
    expect(resolveStatus(e, new Date("2026-08-27T18:00:00-04:00"))).toBe("ended");
  });
  it("explicit status overrides dates", () => {
    expect(resolveStatus(ev({ status: "live", startsAt: "2030-01-01T00:00:00-04:00" }), new Date("2026-01-01"))).toBe("live");
  });
  it("invalid dates fall back to upcoming, never live", () => {
    expect(resolveStatus(ev({ startsAt: "lixo", endsAt: "também-lixo" }))).toBe("upcoming");
  });
});

describe("list helpers", () => {
  const now = new Date("2026-06-16T12:00:00-04:00");
  const past = ev({ slug: "p", startsAt: "2026-04-01T15:00:00-04:00", endsAt: "2026-04-01T16:00:00-04:00" });
  const live = ev({ slug: "l", startsAt: "2026-06-16T11:00:00-04:00", endsAt: "2026-06-16T13:00:00-04:00" });
  const soon = ev({ slug: "s", startsAt: "2026-08-01T15:00:00-04:00", endsAt: "2026-08-01T16:00:00-04:00" });
  const later = ev({ slug: "z", startsAt: "2026-12-01T15:00:00-04:00", endsAt: "2026-12-01T16:00:00-04:00" });
  const list = [later, past, soon, live];

  it("upcomingFrom sorts ascending", () => {
    expect(upcomingFrom(list, now).map((e) => e.slug)).toEqual(["s", "z"]);
  });
  it("pastFrom newest-first", () => {
    expect(pastFrom(list, now).map((e) => e.slug)).toEqual(["p"]);
  });
  it("liveFrom finds the in-window event", () => {
    expect(liveFrom(list, now).map((e) => e.slug)).toEqual(["l"]);
  });
  it("featuredFrom prefers live > upcoming > past", () => {
    expect(featuredFrom(list, now)?.slug).toBe("l");
    expect(featuredFrom([later, past, soon], now)?.slug).toBe("s"); // no live -> next upcoming
    expect(featuredFrom([past], now)?.slug).toBe("p"); // only past
  });
  it("bySlug + sortByStartAsc", () => {
    expect(bySlug(list, "z")?.slug).toBe("z");
    expect(sortByStartAsc(list).map((e) => e.slug)).toEqual(["p", "l", "s", "z"]);
  });
});

describe("countdown + misc", () => {
  it("countdown computes positive parts and 'done' when past", () => {
    const target = "2026-08-27T16:00:00-04:00";
    const before = getCountdownParts(target, new Date("2026-08-27T14:30:00-04:00"));
    expect(before.done).toBe(false);
    expect(before.hours).toBe(1);
    expect(before.minutes).toBe(30);
    expect(getCountdownParts(target, new Date("2026-08-27T17:00:00-04:00")).done).toBe(true);
  });
  it("initials skip titles", () => {
    expect(initials("Dra. Helena Marques")).toBe("HM");
    expect(initials("Prof. Dr. Rafael Tavares")).toBe("RT");
  });
  it("formatEventTime shows Rondônia HH:MM", () => {
    expect(formatEventTime("2026-08-27T16:00:00-04:00")).toBe("16:00");
  });
  it("scheduleLines traduz o instante para Brasília e para o fuso do visitante", () => {
    /* Rondônia é UTC-4; a maioria das 21 UFs está em UTC-3. "16:00" seco fazia
       um estudante em Recife chegar uma hora antes. Determinístico: o fuso do
       visitante entra por parâmetro — nada de mock de navegador. */
    const iso = "2026-08-27T16:00:00-04:00";
    const linhas = (zona?: string) => scheduleLines(iso, zona).map((l) => `${l.hora} ${l.rotulo}`);
    // Visitante no próprio fuso do evento: sem linha "no seu horário" repetida.
    expect(linhas("America/Porto_Velho")).toEqual(["16:00 em Rondônia", "17:00 em Brasília"]);
    // Visitante em UTC-3 (a maioria): coberto pela linha de Brasília.
    expect(linhas("America/Sao_Paulo")).toEqual(["16:00 em Rondônia", "17:00 em Brasília"]);
    // Acre, UTC-5: uma hora ANTES de Rondônia.
    expect(linhas("America/Rio_Branco")).toEqual(["16:00 em Rondônia", "17:00 em Brasília", "15:00 no seu horário"]);
    // Portugal em agosto: UTC+1 (horário de verão) -> 21:00, mesmo dia civil.
    expect(linhas("Europe/Lisbon")).toContain("21:00 no seu horário");
    // Sem fuso do visitante (SSR/build): só as duas linhas fixas.
    expect(linhas(undefined)).toHaveLength(2);
    // Fuso inválido não derruba a página nem inventa linha.
    expect(linhas("Marte/Olympus_Mons")).toHaveLength(2);
    // Data inválida: lista vazia, nunca "NaN:NaN".
    expect(scheduleLines("data-quebrada")).toEqual([]);
  });
  it("quando o dia VIRA no fuso alvo, a linha carrega a data", () => {
    /* "05:00 no seu horário" ao lado de "quinta, 27 de agosto" mandaria um
       parceiro em Tóquio chegar 24 horas adiantado — lá o instante é SEXTA
       05:00. Em 124 dos 418 fusos IANA a data local difere no instante do
       evento-semente; a marca de dia é o que mantém o conjunto verdadeiro. */
    const iso = "2026-08-27T16:00:00-04:00";
    const linhas = (zona: string) => scheduleLines(iso, zona).map((l) => `${l.hora} ${l.rotulo}`);
    expect(linhas("Asia/Tokyo")).toContain("05:00 no seu horário (28/08)");
    // E vale até para Brasília: 23:30 em Rondônia já é 00:30 do dia seguinte lá.
    const tarde = scheduleLines("2026-08-27T23:30:00-04:00").map((l) => `${l.hora} ${l.rotulo}`);
    expect(tarde).toContain("00:30 em Brasília (28/08)");
  });
  it("formatEventTimeBadge dá aos cartões a hora com selo de fuso", () => {
    // "16:00" seco num cartão é indistinguível de horário local.
    expect(formatEventTimeBadge("2026-08-27T16:00:00-04:00")).toBe("16:00 RO · 17:00 Brasília");
    expect(formatEventTimeBadge("data-quebrada")).toBe("");
  });
  it("ICS contains UTC stamps and the title", () => {
    const ics = buildIcsContent(ev({ title: "Mesa, teste; ok" }), "https://x/#/webinars/x");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20260827T200000Z"); // 16:00 -04:00 == 20:00 UTC
    expect(ics).toContain("SUMMARY:Mesa\\, teste\\; ok"); // escaped
  });
});

describe("groups", () => {
  const g = (slug: string, name: string): WebinarGroup => ({ slug, name, description: "", published: true });
  it("sortGroups orders by name (pt-BR)", () => {
    expect(sortGroups([g("z", "Zoologia"), g("a", "Águas")]).map((x) => x.slug)).toEqual(["a", "z"]);
  });
  it("groupBySlug finds the group", () => {
    expect(groupBySlug(webinarGroups, "conexao-clima-saude-unica")?.acronym).toBe("Clima & Saúde Única");
  });
  it("webinarsOfGroup filters by event.group.slug", () => {
    const a = ev({ slug: "a", group: { slug: "g1", name: "G1" } });
    const b = ev({ slug: "b", group: { slug: "g2", name: "G2" } });
    expect(webinarsOfGroup([a, b], "g1").map((e) => e.slug)).toEqual(["a"]);
    expect(webinarsOfGroup([a, b], "inexistente")).toHaveLength(0);
  });
});

describe("bareAsset (CMS path normalization)", () => {
  it("leaves a bare filename untouched", () => {
    expect(bareAsset("clima-saude.jpg")).toBe("clima-saude.jpg");
    expect(bareAsset("partner-logos/inpe.png")).toBe("partner-logos/inpe.png");
  });
  it("strips every assets/ prefix variant the CMS might store", () => {
    expect(bareAsset("/assets/x.jpg")).toBe("x.jpg");
    expect(bareAsset("assets/x.jpg")).toBe("x.jpg");
    expect(bareAsset("./assets/sub/x.png")).toBe("sub/x.png");
    expect(bareAsset("public/assets/x.jpg")).toBe("x.jpg");
  });
  it("passes absolute URLs through unchanged", () => {
    expect(bareAsset("https://cdn.exemplo.com/x.png")).toBe("https://cdn.exemplo.com/x.png");
    expect(bareAsset("//cdn/x.png")).toBe("//cdn/x.png");
  });
  it("treats empty/undefined as undefined", () => {
    expect(bareAsset(undefined)).toBeUndefined();
    expect(bareAsset("   ")).toBeUndefined();
  });
});

describe("normalizeWebinar (CMS JSON -> WebinarEvent)", () => {
  const groupName = (slug: string) => (slug === "g1" ? "Grupo Um" : slug);
  const base = {
    slug: "ev",
    title: "Evento",
    startsAt: "2026-08-27T16:00:00-04:00",
    endsAt: "2026-08-27T17:30:00-04:00",
  };

  it("keeps cover-type images bare (component resolves them later)", () => {
    const e = normalizeWebinar({ ...base, heroImage: "/assets/capa.jpg", posterImage: "capa.jpg" }, groupName);
    expect(e.heroImage).toBe("capa.jpg");
    expect(e.posterImage).toBe("capa.jpg");
  });
  it("pre-resolves logo/photo into a render-ready asset URL", () => {
    const e = normalizeWebinar(
      {
        ...base,
        partners: [{ name: "INPE", acronym: "INPE", logo: "partner-logos/inpe.png" }],
        speakers: [{ name: "A", role: "r", affiliation: "X", photo: "/assets/a.jpg" }],
      },
      groupName,
    );
    expect(e.partners[0].logo).toBe(webinarAsset("partner-logos/inpe.png"));
    expect(e.speakers[0].photo).toBe(webinarAsset("a.jpg"));
  });
  it("turns an uploaded replayVideo into an inline file source", () => {
    const e = normalizeWebinar({ ...base, replayVideo: "gravacao.mp4" }, groupName);
    expect(e.replay).toEqual({ type: "file", url: webinarAsset("gravacao.mp4") });
  });
  it("a replay URL wins over an uploaded replayVideo file", () => {
    /* INVERTIDO DE PROPÓSITO (o teste antigo travava o contrário): com o
       arquivo vencendo, um upload por engano — ou um placeholder esquecido —
       anulava em silêncio o VOD do YouTube já cadastrado. A URL é a gravação
       oficial; o arquivo é o fallback de quem não tem URL. Se alguém "consertar"
       isto de volta por reflexo, o placeholder volta a sequestrar o replay. */
    expect(normalizeWebinar({ ...base, replay: "https://youtu.be/abc" }, groupName).replay).toBe("https://youtu.be/abc");
    const both = normalizeWebinar({ ...base, replay: "https://youtu.be/abc", replayVideo: "g.mp4" }, groupName);
    expect(both.replay).toBe("https://youtu.be/abc");
  });
  it("liveStreamBackup e acessibilidade são normalizados (trim, vazio→undefined, select validado)", () => {
    const e = normalizeWebinar(
      {
        ...base,
        liveStreamBackup: "  https://reserva.exemplo/ao-vivo  ",
        acessibilidade: { declaracao: "transcricao-posterior", transcricaoUrl: " https://archive.org/t ", audioUrl: "" },
      },
      groupName,
    );
    expect(e.liveStreamBackup).toBe("https://reserva.exemplo/ao-vivo");
    expect(e.acessibilidade).toEqual({ declaracao: "transcricao-posterior", transcricaoUrl: "https://archive.org/t", audioUrl: undefined });
    // Valor desconhecido no select (CMS antigo) NÃO vira promessa na página.
    const ruim = normalizeWebinar({ ...base, acessibilidade: { declaracao: "banana" } }, groupName);
    expect(ruim.acessibilidade).toBeUndefined();
    expect(normalizeWebinar({ ...base, liveStreamBackup: "   " }, groupName).liveStreamBackup).toBeUndefined();
  });
  it("campos novos de URL só aceitam http(s) — javascript: não vira link", () => {
    /* Esses campos viram <a href> direto, sem passar por player: um esquema
       executável colado no CMS seria script rodando no clique. */
    const e = normalizeWebinar(
      {
        ...base,
        liveStreamBackup: "javascript:alert(1)",
        acessibilidade: { transcricaoUrl: "data:text/html,x", audioUrl: "https://archive.org/a.mp3" },
      },
      groupName,
    );
    expect(e.liveStreamBackup).toBeUndefined();
    expect(e.acessibilidade).toEqual({ declaracao: undefined, transcricaoUrl: undefined, audioUrl: "https://archive.org/a.mp3" });
  });
  it("resolves groupSlug into a {slug,name} snapshot and blank status to undefined", () => {
    const e = normalizeWebinar({ ...base, groupSlug: "g1", status: "" }, groupName);
    expect(e.group).toEqual({ slug: "g1", name: "Grupo Um" });
    expect(e.status).toBeUndefined();
  });
  it("defaults missing lists to empty arrays", () => {
    const e = normalizeWebinar(base, groupName);
    expect(e.speakers).toEqual([]);
    expect(e.agenda).toEqual([]);
    expect(e.materials).toEqual([]);
    expect(e.partners).toEqual([]);
    expect(e.group).toBeUndefined();
  });
  it("defaults published to true unless explicitly false (standby flag)", () => {
    expect(normalizeWebinar(base, groupName).published).toBe(true);
    expect(normalizeWebinar({ ...base, published: false }, groupName).published).toBe(false);
  });
});

describe("normalizeGroup (CMS JSON -> WebinarGroup)", () => {
  it("defaults published to true unless explicitly false", () => {
    expect(normalizeGroup({ slug: "a", name: "A", description: "" }).published).toBe(true);
    expect(normalizeGroup({ slug: "a", name: "A", description: "", published: false }).published).toBe(false);
  });
  it("normalizes the cover image to a bare filename and defaults links", () => {
    const g = normalizeGroup({ slug: "a", name: "A", description: "", coverImage: "/assets/cover.jpg" });
    expect(g.coverImage).toBe("cover.jpg");
    expect(g.links).toEqual([]);
  });
});

describe("content files load through the glob loader", () => {
  it("exposes the two example groups (sorted) with their acronyms", () => {
    expect(webinarGroups.length).toBeGreaterThanOrEqual(2);
    expect(groupBySlug(webinarGroups, "conexao-clima-saude-unica")?.acronym).toBe("Clima & Saúde Única");
  });
  it("ships both example webinars in standby (published:false) → none are public yet", () => {
    // Ainda não houve mesas-redondas; o conteúdo de exemplo fica oculto até haver datas.
    expect(bySlug(webinars, "mesa-redonda-clima-eventos-extremos-saude-unica-amazonia")).toBeUndefined();
    expect(bySlug(webinars, "mesa-redonda-biodiversidade-bioprospeccao-bioeconomia-amazonia")).toBeUndefined();
  });
});

describe("resolveStream (regression)", () => {
  it("youtube watch -> nocookie embed", () => {
    const r = resolveStream("https://www.youtube.com/watch?v=abcdefghijk");
    expect(r).toMatchObject({ mode: "embed", provider: "youtube" });
    expect((r as { url: string }).url).toContain("youtube-nocookie.com/embed/abcdefghijk");
  });
  it("todo embed carrega a URL original — é a rota de fuga quando o iframe não carrega", () => {
    const entrada = "https://www.youtube.com/watch?v=abcdefghijk";
    expect((resolveStream(entrada) as { original: string }).original).toBe(entrada);
    const vimeo = resolveStream("https://vimeo.com/123456789");
    expect((vimeo as { original: string }).original).toBe("https://vimeo.com/123456789");
  });
  it("embed/live_stream preserva o ?channel= (a regex de 11 chars casava a PALAVRA live_stream e o descartava)", () => {
    const r = resolveStream("https://www.youtube.com/embed/live_stream?channel=UCabcdefghijk");
    expect(r).toMatchObject({ mode: "embed", provider: "youtube" });
    const { url } = r as { url: string };
    expect(url).toContain("channel=UCabcdefghijk");
    // O defeito antigo: embed/live_stream SEM canal, com parâmetros de vídeo comum.
    expect(url).not.toMatch(/embed\/live_stream\?rel=/);
  });
  it("embed/live_stream SEM canal nunca vira iframe mudo — é link externo", () => {
    expect(resolveStream("https://www.youtube.com/embed/live_stream")).toMatchObject({ mode: "external", provider: "YouTube" });
    // youtu.be/live_stream: 11 chars válidos que NÃO são um ID de vídeo.
    expect(resolveStream("https://youtu.be/live_stream")).toMatchObject({ mode: "external" });
  });
  it("@canal/live não expõe ID — link externo, nunca embed quebrado", () => {
    expect(resolveStream("https://www.youtube.com/@inctconexao/live")).toMatchObject({ mode: "external", provider: "YouTube" });
  });
  it("youtube.com/live/<id> (evento agendado — a forma recomendada) -> nocookie embed", () => {
    const r = resolveStream("https://youtube.com/live/abcdefghijk");
    expect(r).toMatchObject({ mode: "embed", provider: "youtube" });
    expect((r as { url: string }).url).toContain("youtube-nocookie.com/embed/abcdefghijk");
  });
  it("no ramo live_stream o original é SINTETIZADO: a página do canal ao vivo, não a URL de embed colada", () => {
    /* A URL colada é de embed — inútil como link clicável. O único destino
       clicável derivável dela é youtube.com/channel/<id>/live. */
    const r = resolveStream("https://www.youtube.com/embed/live_stream?channel=UCabcdefghijk");
    expect((r as { original: string }).original).toBe("https://www.youtube.com/channel/UCabcdefghijk/live");
  });
});

describe("stageEscapeLinks (rota de fuga sob o palco)", () => {
  const embed = resolveStream("https://youtube.com/live/abcdefghijk");
  it("live com reserva: dois links; reserva IGUAL à original: um só (dedupe)", () => {
    const dois = stageEscapeLinks({ liveStreamBackup: "https://reserva.org/x" }, "live", embed);
    expect(dois.map((l) => l.href)).toEqual(["https://youtube.com/live/abcdefghijk", "https://reserva.org/x"]);
    /* O hint do CMS sugere usar a página do YouTube como reserva — igual à
       original, viraria dois links para o mesmo lugar e duas keys React. */
    const um = stageEscapeLinks({ liveStreamBackup: "https://youtube.com/live/abcdefghijk" }, "live", embed);
    expect(um).toHaveLength(1);
  });
  it("ended: transcrição e áudio entram; reserva não (a live acabou)", () => {
    const links = stageEscapeLinks(
      { liveStreamBackup: "https://reserva.org/x", acessibilidade: { transcricaoUrl: "https://archive.org/t", audioUrl: "https://archive.org/a.mp3" } },
      "ended",
      embed,
    );
    expect(links.map((l) => l.texto)).toEqual(["assistir direto no YouTube", "ler a transcrição", "ouvir em áudio (MP3)"]);
  });
  it("upcoming ou sem embed: nada a oferecer", () => {
    expect(stageEscapeLinks({}, "upcoming", embed)).toEqual([]);
    expect(stageEscapeLinks({}, "live", null)).toEqual([]);
  });
  it("zoom -> external", () => {
    expect(resolveStream("https://us02web.zoom.us/j/123")).toMatchObject({ mode: "external", provider: "Zoom" });
  });
  it("file object stays file", () => {
    expect(resolveStream({ type: "file", url: "/x.mp4" })).toMatchObject({ mode: "file" });
  });
  it("self-hosted .mp4 string is recognized as inline file (no data loss on edit)", () => {
    expect(resolveStream("./assets/gravacao.mp4")).toMatchObject({ mode: "file" });
    expect(resolveStream("https://cdn.exemplo.com/x.webm?t=1")).toMatchObject({ mode: "file" });
  });
});
