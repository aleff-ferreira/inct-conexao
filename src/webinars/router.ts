import { useEffect, useState } from "react";

/**
 * Roteamento leve por hash — sem dependências, compatível com hospedagem
 * estática (Netlify) e com `base: "./"`. Âncoras internas da home continuam
 * funcionando (`#pesquisa`); rotas de webinar usam o prefixo `#/`.
 *
 *   #                      -> home
 *   #pesquisa              -> home, rola até a seção "pesquisa"
 *   #/webinars             -> hub de webinars
 *   #/webinars/<slug>      -> página do evento
 */
export type Route =
  | { name: "home"; anchor?: string }
  | { name: "hub" }
  | { name: "event"; slug: string }
  | { name: "groups" }
  | { name: "group"; slug: string }
  | { name: "edital" }
  | { name: "resultado-ic" }
  | { name: "inscricao"; slug: string }
  | { name: "minha-inscricao" }
  | { name: "gestao" }
  | { name: "nova-senha" }
  | { name: "mapa" }
  | { name: "noticias" }
  | { name: "noticia"; slug: string }
  | { name: "relatorio-anual" }
  | { name: "relatorio-laboratorio" }
  | { name: "fitofarmas" }
  | { name: "curso" };

export const HUB_HREF = "#/webinars";
export const GROUPS_HREF = "#/grupos";
export const EDITAL_HREF = "#/editais/selecao-ic-2026";
export const RESULTADO_IC_HREF = "#/editais/selecao-ic-2026/resultado";
export const INSCRICAO_HREF = "#/inscricao/selecao-ic-2026";
export const MAPA_HREF = "#/mapa";
export const NOTICIAS_HREF = "#/noticias";
/**
 * I Workshop Conexão Fitofarmas — formulário PRÉ-EVENTO, público e sem login.
 *
 * ENDEREÇO CURTO DE PROPÓSITO, e imutável depois da primeira peça impressa:
 * ele vai em QR code, em mensagem de WhatsApp e no rodapé do e-mail de convite.
 * Endereço de formulário institucional que muda vira "o link não funciona" — e
 * quem recebe conclui que a inscrição expirou, sem escrever para ninguém.
 *
 * NO MENU do cabeçalho por decisão do dono (2026-08-07). A implementação
 * original o deixara fora ("campanha com prazo vira link morto em setembro");
 * o dono preferiu a visibilidade durante a campanha. Depois do evento, o item
 * sai de `navItems` (App.tsx) — mas ESTA rota fica para sempre: o QR code
 * impresso não sabe que o evento acabou.
 */
export const FITOFARMAS_HREF = "#/fitofarmas";
/**
 * CONEXAO-BIOINFORMÁTICA — curso "Do átomo à ação biológica" (IFRO Campus Jaru,
 * 19–21/08/2026). Página pública que apresenta o curso e embute a inscrição.
 * Endereço curto e estável:
 * vai em cartaz, QR code e mensagem de divulgação. No menu do cabeçalho durante
 * a campanha; depois do curso a rota permanece (o QR impresso não sabe que
 * acabou), bastando remover o item de `navItems` (App.tsx).
 */
export const CURSO_HREF = "#/curso";
/**
 * Definir nova senha. É o endereço que o e-mail de redefinição aponta, e por
 * isso é ENDEREÇO ESTÁVEL, não "de onde a pessoa clicou": quem pede a nova
 * senha na Gestão pode terminar de defini-la em qualquer aba, em qualquer dia.
 * Fora do menu — é rota de retorno de e-mail, não porta pública.
 */
export const NOVA_SENHA_HREF = "#/nova-senha";
/**
 * Relatório Anual (antes "Meu ano"). As duas rotas abaixo são de CONVITE, não
 * de navegação pública: chegam por e-mail nominal e por isso NÃO entram no
 * menu do cabeçalho.
 */
export const RELATORIO_ANUAL_HREF = "#/relatorio-anual";
export const RELATORIO_LAB_HREF = "#/relatorio-laboratorio";
/**
 * @deprecated Use `RELATORIO_ANUAL_HREF`. Alias de compilação da renomeação de
 * 2026-08: aponta para o href NOVO, para que nenhum import antigo quebre nem
 * gere link para o endereço legado.
 */
export const MEU_ANO_HREF = RELATORIO_ANUAL_HREF;
/** @deprecated Use `RELATORIO_LAB_HREF` (mesmo motivo de `MEU_ANO_HREF`). */
export const MEU_LAB_HREF = RELATORIO_LAB_HREF;
export const eventHref = (slug: string): string => `#/webinars/${slug}`;
export const groupHref = (slug: string): string => `#/grupos/${slug}`;
export const noticiaHref = (slug: string): string => `#/noticias/${slug}`;

/**
 * Endereço do convite individual (§4.6 de docs/relato-anual.md).
 * O `m` é só a chave do PRÉ-PREENCHIMENTO — não autentica nada; a sessão vem do
 * link mágico no mesmo clique e a RLS continua exigindo que a linha seja sua.
 * Por isso o único dado que entra na query é um identificador opaco.
 */
export const relatorioAnualHref = (conviteToken?: string): string =>
  conviteToken
    ? `${RELATORIO_ANUAL_HREF}?m=${encodeURIComponent(conviteToken)}`
    : RELATORIO_ANUAL_HREF;

/** @deprecated Use `relatorioAnualHref` — é a mesma função, com o nome novo. */
export const meuAnoHref = relatorioAnualHref;

/**
 * Lê o token de convite da hash (`#/relatorio-anual?m=<token>`, e igualmente no
 * alias legado `#/meu-ano?m=<token>`). `parseHash` descarta a
 * query de propósito — quem precisa do parâmetro pede aqui, como o mapa faz com
 * o próprio sub-estado. Devolve null quando não há token ou ele está vazio.
 */
export function conviteDaHash(rawHash: string): string | null {
  const query = rawHash.replace(/^#/, "").split("?").slice(1).join("?");
  if (!query) return null;
  const valor = new URLSearchParams(query).get("m");
  return valor && valor.trim() ? valor.trim() : null;
}

/* ========================================================================== *
 * O RETORNO DO E-MAIL DE AUTENTICAÇÃO (link mágico e redefinição de senha)
 *
 * Este bloco vive no roteador, e não em src/platform/, por dois motivos:
 * ele é PARSE DE URL (nada de Supabase) e o App.tsx precisa consultá-lo sem
 * importar `useAuth` — importar o hook colocaria o SDK inteiro do Supabase no
 * bundle da home, que é justamente o que não pode acontecer.
 * ========================================================================== */

/**
 * Endereço ABSOLUTO para onde o Supabase deve devolver o clique do e-mail de
 * redefinição de senha. Fica aqui, e não em auth.tsx, para ser testável sem
 * navegador.
 *
 * POR QUE NÃO `window.location.href` (que era o que estava em auth.tsx):
 *
 * 1. `href` é "de onde a pessoa clicou". Se ela pediu o link na home, o retorno
 *    volta para a home — e a home NÃO tem tela de definir senha. Era esse o
 *    defeito relatado: o e-mail chegava, o link abria a página inicial e nada
 *    acontecia. O endereço tem de ser fixo e ter tela própria.
 *
 * 2. `href` normalmente JÁ CARREGA uma hash (`https://site/#/gestao`). O GoTrue
 *    devolve o PKCE acrescentando `?code=…` à QUERY e preservando o fragmento,
 *    o que dá `https://site/?code=…#/gestao` — forma boa. Mas basta um proxy,
 *    um encurtador ou o rastreador de cliques do provedor de e-mail reescrever
 *    a URL para o code acabar DENTRO do fragmento
 *    (`https://site/#/gestao?code=…`); aí o SDK não o encontra, porque ele lê a
 *    query da URL e o fragmento inteiro como lista de parâmetros — e
 *    `#/gestao?code=x` vira a chave `/gestao?code`, não `code`.
 *
 * 3. `href` pode trazer query e hash antigas (`?m=…`, `#/mapa?modo=…`) que
 *    seguiriam de carona para dentro do e-mail.
 *
 * A forma montada aqui — `origin + pathname + "#/nova-senha"` — cobre os dois
 * cenários: se o fragmento for preservado, o retorno é
 * `https://site/?code=…#/nova-senha` (query ANTES do fragmento, que é onde o
 * SDK enxerga) e a rota resolve para a tela certa; se o fragmento for perdido
 * ou sobrescrito (o GoTrue sobrescreve a hash quando devolve erro no fluxo
 * implícito), sobra `https://site/?code=…` ou `https://site/#error=…`, que caem
 * na home — e é para esse caso que existe a rede de segurança do App.tsx.
 */
export function novaSenhaRedirectUrl(loc?: { origin: string; pathname: string }): string {
  const alvo = loc ?? (typeof window === "undefined" ? { origin: "", pathname: "/" } : window.location);
  return `${alvo.origin}${alvo.pathname}${NOVA_SENHA_HREF}`;
}

/** O que o Supabase devolveu na URL depois do clique no e-mail. */
export type RetornoAuth = {
  /** `code` do PKCE, venha ele da query real ou de dentro do fragmento. */
  code: string | null;
  /**
   * true quando o `code` existe SÓ dentro do fragmento. Nessa forma o SDK não o
   * encontra sozinho e a troca por sessão precisa ser feita à mão.
   */
  codeNaHash: boolean;
  /** ex.: "access_denied" */
  error: string | null;
  /** ex.: "otp_expired" */
  errorCode: string | null;
  /** ex.: "Email link is invalid or has expired" */
  errorDescription: string | null;
};

function pegar(params: URLSearchParams, chave: string): string | null {
  const valor = params.get(chave);
  return valor && valor.trim() ? valor : null;
}

/**
 * Parâmetros escondidos no fragmento. Duas formas convivem, e as duas são reais:
 *
 *   "#error=access_denied&error_code=otp_expired&…"  → o fragmento INTEIRO é a
 *     lista de parâmetros. É assim que o GoTrue devolve erro no fluxo
 *     implícito, SOBRESCREVENDO a rota que estava na hash (por isso a pessoa
 *     cai na home mesmo tendo pedido `#/nova-senha`).
 *
 *   "#/nova-senha?code=…"  → a query vem depois do caminho da rota. Não é o que
 *     o Supabase monta, é o que sobra quando alguém reescreve a URL no caminho.
 */
function paramsDaHash(hash: string): URLSearchParams {
  const corte = hash.indexOf("?");
  if (corte !== -1) return new URLSearchParams(hash.slice(corte + 1));
  return hash.startsWith("/") ? new URLSearchParams() : new URLSearchParams(hash);
}

/**
 * Lê o retorno de autenticação de uma URL inteira, OLHANDO OS DOIS LUGARES
 * (query e fragmento). A query tem precedência, que é a mesma regra do SDK.
 */
export function retornoAuthDaUrl(href: string): RetornoAuth {
  const corte = href.indexOf("#");
  const antes = corte === -1 ? href : href.slice(0, corte);
  const hash = corte === -1 ? "" : href.slice(corte + 1);
  const inicioQuery = antes.indexOf("?");

  const daQuery = new URLSearchParams(inicioQuery === -1 ? "" : antes.slice(inicioQuery + 1));
  const daHash = paramsDaHash(hash);
  const ler = (chave: string): string | null => pegar(daQuery, chave) ?? pegar(daHash, chave);

  return {
    code: ler("code"),
    codeNaHash: !pegar(daQuery, "code") && Boolean(pegar(daHash, "code")),
    error: ler("error"),
    errorCode: ler("error_code"),
    errorDescription: ler("error_description"),
  };
}

/**
 * A URL parece a volta de um clique em e-mail de autenticação? Barato (só
 * parse de string) e sem tocar no SDK: é o gatilho que o App.tsx usa para
 * decidir se vale a pena CARREGAR o módulo da tela de senha. Sem isto, a única
 * alternativa seria importar `useAuth` na home — e junto o SDK do Supabase.
 */
export function pareceRetornoDeAuth(href: string): boolean {
  const retorno = retornoAuthDaUrl(href);
  return Boolean(retorno.code || retorno.error || retorno.errorCode || retorno.errorDescription);
}

/**
 * Rotas que JÁ tratam o retorno de autenticação por conta própria (mostram
 * login, recuperação de senha ou o próprio erro). A rede de segurança não entra
 * nelas: duas telas de erro empilhadas confundem mais do que uma.
 */
const ROTAS_COM_AUTH: ReadonlySet<Route["name"]> = new Set([
  "inscricao",
  "minha-inscricao",
  "gestao",
  "nova-senha",
  "relatorio-anual",
  "relatorio-laboratorio",
]);

export function rotaTrataAuth(nome: Route["name"]): boolean {
  return ROTAS_COM_AUTH.has(nome);
}

export function parseHash(rawHash: string): Route {
  // Remove o "#" e descarta a query string (ex.: "#/mapa?modo=explorador").
  // Rotas que usam parâmetros (o mapa) leem a hash completa por conta própria;
  // aqui só interessa o caminho para escolher a rota.
  const hash = rawHash.replace(/^#/, "").split("?")[0];

  if (!hash.startsWith("/")) {
    return { name: "home", anchor: hash || undefined };
  }

  const segments = hash.split("/").filter(Boolean); // ["webinars", "<slug>"?]

  const decode = (value: string): string => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value; // percent-encoding malformado → cai no "não encontrado"
    }
  };

  if (segments[0] === "webinars") {
    if (segments[1]) return { name: "event", slug: decode(segments[1]) };
    return { name: "hub" };
  }

  if (segments[0] === "grupos") {
    if (segments[1]) return { name: "group", slug: decode(segments[1]) };
    return { name: "groups" };
  }

  if (segments[0] === "noticias") {
    if (segments[1]) return { name: "noticia", slug: decode(segments[1]) };
    return { name: "noticias" };
  }

  if (segments[0] === "editais") {
    // O resultado tem endereço próprio, e não âncora dentro do edital: é o
    // documento que candidato, orientador e instituição vão compartilhar por
    // link, e link de resultado precisa continuar resolvendo daqui a anos.
    if (segments[1] === "selecao-ic-2026" && segments[2] === "resultado") {
      return { name: "resultado-ic" };
    }
    return { name: "edital" };
  }

  if (segments[0] === "inscricao" && segments[1]) {
    return { name: "inscricao", slug: decode(segments[1]) };
  }

  if (segments[0] === "minha-inscricao") {
    return { name: "minha-inscricao" };
  }

  if (segments[0] === "gestao") {
    return { name: "gestao" };
  }

  if (segments[0] === "nova-senha") {
    return { name: "nova-senha" };
  }

  // Formulário pré-evento do I Workshop Conexão Fitofarmas. Rota pública, sem
  // sub-caminho: quem chega por QR code chega direto na primeira pergunta.
  if (segments[0] === "fitofarmas") {
    return { name: "fitofarmas" };
  }

  // CONEXAO-BIOINFORMÁTICA (curso "Do átomo à ação biológica"). Rota pública, sem
  // sub-caminho: quem chega por QR/cartaz cai direto na apresentação e inscrição.
  if (segments[0] === "curso") {
    return { name: "curso" };
  }

  if (segments[0] === "mapa") {
    // O sub-estado (uf, modo, camada…) é lido da própria hash pelo módulo do
    // mapa (src/mapa/url.ts); aqui basta reconhecer a rota.
    return { name: "mapa" };
  }

  // Relatório Anual. O token de pré-preenchimento (`?m=…`) e o "?code=…" que o
  // link mágico devolve JÁ foram descartados acima: a rota só olha o caminho.
  //
  // "meu-ano" e "meu-laboratorio" são ALIAS PERMANENTE dos segmentos novos e
  // NUNCA devem ser removidos: os convites nominais de 2026 saíram por e-mail
  // com esses endereços, há favoritos salvos e rascunho em localStorage
  // atrelado à rota — quebrar link em formulário institucional significa
  // pessoa concluindo que o convite "expirou" e desistindo em silêncio.
  // Os dois caminhos devolvem a MESMA rota; o canônico é o novo.
  if (segments[0] === "relatorio-anual" || segments[0] === "meu-ano") {
    return { name: "relatorio-anual" };
  }

  if (segments[0] === "relatorio-laboratorio" || segments[0] === "meu-laboratorio") {
    return { name: "relatorio-laboratorio" };
  }

  // Rota desconhecida: volta para a home com segurança.
  return { name: "home" };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() =>
    parseHash(typeof window === "undefined" ? "" : window.location.hash),
  );

  useEffect(() => {
    const handleChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", handleChange);
    return () => window.removeEventListener("hashchange", handleChange);
  }, []);

  return route;
}

/**
 * Relógio que dispara re-render periódico para que o status do evento
 * (upcoming → live → ended) acompanhe o tempo real sem recarregar a página.
 * Usado pelo hub e pela página de evento.
 */
export function useNow(periodMs = 10000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), periodMs);
    return () => window.clearInterval(id);
  }, [periodMs]);

  return now;
}
