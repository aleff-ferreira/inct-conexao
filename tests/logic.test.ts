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
import { getCountdownParts, initials, formatEventTime, buildIcsContent } from "../src/webinars/format";
import { resolveStream } from "../src/webinars/stream";

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
  it("webinarsOfGroup filters by event.group.slug (standby webinars hidden)", () => {
    const slugs = webinarsOfGroup(webinars, "conexao-bioprospeccao-bioeconomia").map((e) => e.slug);
    expect(slugs).toContain("mesa-redonda-biodiversidade-bioprospeccao-bioeconomia-amazonia");
    expect(webinarsOfGroup(webinars, "inexistente")).toHaveLength(0);
    // O webinar de clima está em standby (published:false) → some do site.
    expect(bySlug(webinars, "mesa-redonda-clima-eventos-extremos-saude-unica-amazonia")).toBeUndefined();
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
  it("replayVideo wins over a replay URL; a bare replay URL passes through", () => {
    expect(normalizeWebinar({ ...base, replay: "https://youtu.be/abc" }, groupName).replay).toBe("https://youtu.be/abc");
    const both = normalizeWebinar({ ...base, replay: "https://youtu.be/abc", replayVideo: "g.mp4" }, groupName);
    expect(both.replay).toEqual({ type: "file", url: webinarAsset("g.mp4") });
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
  it("links a published webinar to its group via the resolved snapshot", () => {
    const ev = bySlug(webinars, "mesa-redonda-biodiversidade-bioprospeccao-bioeconomia-amazonia");
    expect(ev?.group).toEqual({ slug: "conexao-bioprospeccao-bioeconomia", name: "CONEXAO-Bioprospecção e Bioeconomia" });
    expect(ev?.partners[0].logo).toContain("assets/partner-logos/fiocruz-ro.png");
  });
  it("loads the self-hosted replay as an inline file source", () => {
    const ev = bySlug(webinars, "mesa-redonda-biodiversidade-bioprospeccao-bioeconomia-amazonia");
    expect(ev?.replay).toEqual({ type: "file", url: webinarAsset("instagram-iniciacao-cientifica.mp4") });
  });
});

describe("resolveStream (regression)", () => {
  it("youtube watch -> nocookie embed", () => {
    const r = resolveStream("https://www.youtube.com/watch?v=abcdefghijk");
    expect(r).toMatchObject({ mode: "embed", provider: "youtube" });
    expect((r as { url: string }).url).toContain("youtube-nocookie.com/embed/abcdefghijk");
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
