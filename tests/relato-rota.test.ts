/**
 * As rotas do Relatório Anual — `#/relatorio-anual` e `#/relatorio-laboratorio`
 * — e os ALIAS PERMANENTES `#/meu-ano` e `#/meu-laboratorio`.
 *
 * Três coisas quebram aqui em silêncio e só aparecem com o convite já enviado a
 * 209 pessoas, quando já não dá para consertar sem reenviar e-mail:
 *
 * 1. **O endereço existir no texto e não no roteador.** Já aconteceu neste
 *    projeto com o permalink de uma figura. Um endereço que cai na home não
 *    avisa que caiu: a pessoa vê o site institucional, conclui que o link
 *    "expirou" e desiste. Por isso as rotas são testadas pelo mesmo caminho que
 *    o e-mail vai usar — a constante exportada, não uma string reescrita no
 *    teste.
 *
 * 2. **A query.** Duas queries diferentes chegam nesta rota: o `?m=<token>` do
 *    pré-preenchimento (§4.6) e o `?code=<pkce>` que o link mágico do Supabase
 *    devolve. `parseHash` descarta a query de propósito, e é justamente esse
 *    descarte que faz a volta do login cair na tela certa em vez da home. O
 *    teste cobre a query no lugar real (antes do `#`, como o GoTrue monta) e
 *    também no lugar defensivo (dentro da hash), porque um proxy ou um cliente
 *    de e-mail que reescreva a URL não é hipótese remota.
 *
 * 3. **O alias.** A renomeação de 2026-08 ("Meu ano" → "Relatório Anual de
 *    Atividades") trocou o endereço canônico, mas os convites nominais, os
 *    favoritos e o rascunho em localStorage já circulavam com `#/meu-ano` e
 *    `#/meu-laboratorio`. Os endereços antigos são ALIAS PERMANENTE: devolvem a
 *    MESMA rota que os novos, e este arquivo é o guarda de que ninguém "limpa"
 *    o alias num refactor futuro. Quebrar link em formulário institucional é
 *    inaceitável.
 *
 * Fecha com o que NÃO pode existir: estas são rotas de convite, e um item no
 * menu do cabeçalho transformaria um formulário nominal em porta pública. E com
 * o guarda da renomeação: o nome antigo não pode reaparecer em texto visível.
 *
 * ---------------------------------------------------------------------------
 * O arquivo cobre também `#/nova-senha`, pelo MESMO motivo nº 1: em produção o
 * link de redefinição de senha chegava por e-mail e abria a página inicial,
 * porque o retorno voltava para "onde a pessoa clicou" e não existia tela de
 * nova senha fora de três rotas. Endereço sem tela não avisa que não tem tela.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  parseHash,
  conviteDaHash,
  novaSenhaRedirectUrl,
  retornoAuthDaUrl,
  pareceRetornoDeAuth,
  rotaTrataAuth,
  relatorioAnualHref,
  meuAnoHref,
  NOVA_SENHA_HREF,
  RELATORIO_ANUAL_HREF,
  RELATORIO_LAB_HREF,
  MEU_ANO_HREF,
  MEU_LAB_HREF,
  MAPA_HREF,
  NOTICIAS_HREF,
  HUB_HREF,
  GROUPS_HREF,
  EDITAL_HREF,
  RESULTADO_IC_HREF,
  INSCRICAO_HREF,
  type Route,
} from "../src/webinars/router";

const RAIZ = join(__dirname, "..");
const APP = readFileSync(join(RAIZ, "src", "App.tsx"), "utf-8");
const AUTH = readFileSync(join(RAIZ, "src", "platform", "auth.tsx"), "utf-8");

/**
 * O que o GoTrue faz com `emailRedirectTo` no fluxo PKCE: `code` entra na QUERY
 * da URL, preservando o fragmento. É a razão de `flowType: "pkce"` ter sido
 * escolhido (ver src/platform/supabaseClient.ts) — no fluxo implícito os tokens
 * vinham num segundo `#…` e brigavam com o roteamento por hash.
 */
function voltaDoLinkMagico(destino: string, code: string): string {
  const url = new URL(destino);
  url.searchParams.set("code", code);
  return url.toString();
}

const BASE = "https://inct-conexao.com.br/";

/* ----------------------------------------------------------- as duas rotas */
describe("router · rotas do Relatório Anual", () => {
  it("#/relatorio-anual abre o Relatório Anual de Atividades (individual)", () => {
    expect(RELATORIO_ANUAL_HREF).toBe("#/relatorio-anual");
    expect(parseHash(RELATORIO_ANUAL_HREF)).toEqual({ name: "relatorio-anual" });
    expect(parseHash("#/relatorio-anual")).toEqual({ name: "relatorio-anual" });
  });

  it("#/relatorio-laboratorio abre o Relatório Anual do Laboratório (LLA)", () => {
    expect(RELATORIO_LAB_HREF).toBe("#/relatorio-laboratorio");
    expect(parseHash(RELATORIO_LAB_HREF)).toEqual({ name: "relatorio-laboratorio" });
    expect(parseHash("#/relatorio-laboratorio")).toEqual({ name: "relatorio-laboratorio" });
  });

  it("tolera barra final e hash sem o '#' (o que o navegador entrega varia)", () => {
    expect(parseHash("#/relatorio-anual/").name).toBe("relatorio-anual");
    expect(parseHash("/relatorio-anual").name).toBe("relatorio-anual");
    expect(parseHash("#/relatorio-laboratorio/").name).toBe("relatorio-laboratorio");
    expect(parseHash("/relatorio-laboratorio").name).toBe("relatorio-laboratorio");
  });

  it("as duas rotas não colidem entre si nem com prefixos parecidos", () => {
    expect(parseHash("#/relatorio-anual").name).not.toBe("relatorio-laboratorio");
    expect(parseHash("#/relatorio-laboratorio").name).not.toBe("relatorio-anual");
    // Prefixo não basta: o segmento é exato.
    expect(parseHash("#/relatorio-anuais").name).toBe("home");
    expect(parseHash("#/relatorio").name).toBe("home");
    expect(parseHash("#/meu-anos").name).toBe("home");
    expect(parseHash("#/meu").name).toBe("home");
  });
});

/* -------------------------------------------------- o alias permanente */
describe("router · #/meu-ano e #/meu-laboratorio são ALIAS PERMANENTES", () => {
  /* Os convites nominais de 2026 saíram por e-mail com os endereços antigos.
     Enquanto um único desses e-mails puder ser clicado, o alias fica. */

  it("os endereços antigos devolvem a MESMA rota que os novos", () => {
    expect(parseHash("#/meu-ano")).toEqual(parseHash(RELATORIO_ANUAL_HREF));
    expect(parseHash("#/meu-ano")).toEqual({ name: "relatorio-anual" });
    expect(parseHash("#/meu-laboratorio")).toEqual(parseHash(RELATORIO_LAB_HREF));
    expect(parseHash("#/meu-laboratorio")).toEqual({ name: "relatorio-laboratorio" });
  });

  it("o alias tolera as mesmas variações do endereço novo", () => {
    expect(parseHash("#/meu-ano/").name).toBe("relatorio-anual");
    expect(parseHash("/meu-ano").name).toBe("relatorio-anual");
    expect(parseHash("#/meu-laboratorio/").name).toBe("relatorio-laboratorio");
    expect(parseHash("/meu-laboratorio").name).toBe("relatorio-laboratorio");
  });

  it("as constantes antigas apontam para os hrefs NOVOS (alias de compilação)", () => {
    // Import antigo não pode quebrar nem gerar link para o endereço legado.
    expect(MEU_ANO_HREF).toBe(RELATORIO_ANUAL_HREF);
    expect(MEU_LAB_HREF).toBe(RELATORIO_LAB_HREF);
    expect(meuAnoHref).toBe(relatorioAnualHref);
  });

  it("o convite antigo com token continua caindo na rota certa, com o token", () => {
    // O formato EXATO que está nos e-mails já enviados.
    expect(parseHash("#/meu-ano?m=8f3c1e").name).toBe("relatorio-anual");
    expect(conviteDaHash("#/meu-ano?m=8f3c1e")).toBe("8f3c1e");
    expect(parseHash("#/meu-laboratorio?m=8f3c1e").name).toBe("relatorio-laboratorio");
  });

  it("a volta do link mágico nos endereços ANTIGOS também resolve", () => {
    // emailRedirectTo configurado antes da renomeação continua funcionando.
    const url = new URL(voltaDoLinkMagico(`${BASE}#/meu-ano`, "pkce-legado"));
    expect(parseHash(url.hash)).toEqual({ name: "relatorio-anual" });
    const url2 = new URL(voltaDoLinkMagico(`${BASE}#/meu-laboratorio`, "pkce-legado"));
    expect(parseHash(url2.hash)).toEqual({ name: "relatorio-laboratorio" });
  });
});

/* ------------------------------------------------- a query e o link mágico */
describe("router · query, token de convite e volta do login", () => {
  it("#/relatorio-anual?m=<token> continua sendo a rota do relato", () => {
    expect(parseHash("#/relatorio-anual?m=8f3c1e").name).toBe("relatorio-anual");
    expect(parseHash("#/relatorio-laboratorio?m=8f3c1e").name).toBe("relatorio-laboratorio");
  });

  it("relatorioAnualHref faz round-trip com conviteDaHash", () => {
    const token = "a1b2c3d4-e5f6";
    const href = relatorioAnualHref(token);
    expect(href).toBe(`#/relatorio-anual?m=${token}`);
    expect(parseHash(href)).toEqual({ name: "relatorio-anual" });
    expect(conviteDaHash(href)).toBe(token);

    // Token que exige escape sobrevive à ida e à volta.
    const estranho = "tok/en+com espaço&=";
    const href2 = relatorioAnualHref(estranho);
    expect(parseHash(href2).name).toBe("relatorio-anual");
    expect(conviteDaHash(href2)).toBe(estranho);

    // Sem token o endereço é o limpo, e não há convite para ler.
    expect(relatorioAnualHref()).toBe(RELATORIO_ANUAL_HREF);
    expect(conviteDaHash(RELATORIO_ANUAL_HREF)).toBeNull();
    expect(conviteDaHash("#/relatorio-anual?m=")).toBeNull();
    expect(conviteDaHash("#/relatorio-anual?m=%20%20")).toBeNull();
    expect(conviteDaHash("#/relatorio-anual?outra=1")).toBeNull();
  });

  it("a volta do link mágico cai na rota certa: o ?code fica FORA da hash", () => {
    const destino = `${BASE}#/relatorio-anual`;
    const volta = voltaDoLinkMagico(destino, "pkce-abc123");
    const url = new URL(volta);

    // É este o formato que o Supabase devolve: query antes do fragmento.
    expect(url.search).toContain("code=pkce-abc123");
    expect(url.hash).toBe("#/relatorio-anual");
    // E o roteador, que só olha a hash, nem vê o code.
    expect(parseHash(url.hash)).toEqual({ name: "relatorio-anual" });
  });

  it("a volta preserva o token de pré-preenchimento junto do code", () => {
    const destino = `${BASE}${relatorioAnualHref("conv-77")}`;
    const url = new URL(voltaDoLinkMagico(destino, "pkce-xyz"));

    expect(url.searchParams.get("code")).toBe("pkce-xyz");
    expect(parseHash(url.hash)).toEqual({ name: "relatorio-anual" });
    expect(conviteDaHash(url.hash)).toBe("conv-77");
  });

  it("mesmo se o code fosse parar DENTRO da hash, a rota resolve", () => {
    /* Defensivo: um proxy, um encurtador ou um cliente de e-mail que reescreva
       a URL pode empurrar a query para dentro do fragmento. Cair na home ali
       significaria perder a sessão recém-criada e o convite junto. */
    expect(parseHash("#/relatorio-anual?code=pkce-abc123").name).toBe("relatorio-anual");
    expect(parseHash("#/relatorio-laboratorio?code=pkce-abc123").name).toBe("relatorio-laboratorio");
    expect(parseHash("#/relatorio-anual?m=conv-77&code=pkce-abc123").name).toBe("relatorio-anual");
    expect(conviteDaHash("#/relatorio-anual?m=conv-77&code=pkce-abc123")).toBe("conv-77");
    // E no alias antigo, que é o que está nos e-mails de 2026.
    expect(parseHash("#/meu-ano?m=conv-77&code=pkce-abc123").name).toBe("relatorio-anual");
    expect(conviteDaHash("#/meu-ano?m=conv-77&code=pkce-abc123")).toBe("conv-77");
  });

  it("o link do LLA também sobrevive ao ciclo completo do login", () => {
    const url = new URL(voltaDoLinkMagico(`${BASE}${RELATORIO_LAB_HREF}`, "pkce-lla"));
    expect(parseHash(url.hash)).toEqual({ name: "relatorio-laboratorio" });
  });
});

/* ------------------------------------------------------------ não-regressão */
describe("router · as rotas existentes não regridem", () => {
  it("cada endereço publicado continua resolvendo para a sua rota", () => {
    const casos: [string, Route["name"]][] = [
      ["#", "home"],
      ["", "home"],
      ["#inicio", "home"],
      ["#pesquisa", "home"],
      [HUB_HREF, "hub"],
      ["#/webinars/webinar-inaugural", "event"],
      [GROUPS_HREF, "groups"],
      ["#/grupos/clima", "group"],
      [EDITAL_HREF, "edital"],
      ["#/editais", "edital"],
      [RESULTADO_IC_HREF, "resultado-ic"],
      [INSCRICAO_HREF, "inscricao"],
      ["#/minha-inscricao", "minha-inscricao"],
      ["#/gestao", "gestao"],
      [MAPA_HREF, "mapa"],
      [NOTICIAS_HREF, "noticias"],
      ["#/noticias/expedicao-resex-rio-ouro-preto", "noticia"],
      [RELATORIO_ANUAL_HREF, "relatorio-anual"],
      [RELATORIO_LAB_HREF, "relatorio-laboratorio"],
      [NOVA_SENHA_HREF, "nova-senha"],
      // Os endereços LEGADOS também são "publicados": estão em e-mails enviados.
      ["#/meu-ano", "relatorio-anual"],
      ["#/meu-laboratorio", "relatorio-laboratorio"],
    ];

    for (const [hash, esperado] of casos) {
      expect(`${hash} → ${parseHash(hash).name}`).toBe(`${hash} → ${esperado}`);
    }
  });

  it("#/mapa com query continua sendo o mapa (o caso que já quebrou)", () => {
    expect(parseHash("#/mapa?modo=explorador").name).toBe("mapa");
    expect(parseHash("#/mapa/ro?sec=animais").name).toBe("mapa");
    expect(parseHash("#/mapa?lista=1").name).toBe("mapa");
    // E a query do relato não contaminou o mapa nem vice-versa.
    expect(parseHash("#/mapa?m=conv-77").name).toBe("mapa");
  });

  it("a âncora da home sobrevive à chegada das rotas novas", () => {
    expect(parseHash("#rede")).toEqual({ name: "home", anchor: "rede" });
    expect(parseHash("#")).toEqual({ name: "home", anchor: undefined });
  });

  it("hash desconhecido volta para a home, sem lançar", () => {
    for (const hash of [
      "#/nao-existe",
      "#/meu-ano-nao",
      "#/relato",
      "#/relatorio-anual-x",
      "#/meu-laboratorio-x",
      "#/gestao-secreta",
      "#/%E0%A4%A", // percent-encoding malformado
      "#/../../etc/passwd",
    ]) {
      expect(parseHash(hash).name).toBe("home");
    }
  });
});

/* ------------------------------------------------- montagem lazy no App.tsx */
describe("App.tsx · montagem das rotas de convite", () => {
  it("carrega MeuAno e MeuLaboratorio sob demanda, no mesmo Suspense da plataforma", () => {
    /* Os ARQUIVOS mantêm o nome legado (decisão da renomeação de 2026-08:
       renomear arquivo tocaria todos os imports de uma vez). O que muda é a
       rota que os monta. */
    expect(APP).toContain('lazy(() => import("./relato/MeuAno"))');
    expect(APP).toContain('lazy(() => import("./relato/MeuLaboratorio"))');
    // Import estático colocaria os dois formulários no bundle da home.
    expect(APP).not.toMatch(/^import .*from "\.\/relato\/Meu/m);

    for (const [rota, componente] of [
      ["relatorio-anual", "MeuAno"],
      ["relatorio-laboratorio", "MeuLaboratorio"],
    ]) {
      const bloco = APP.slice(APP.indexOf(`route.name === "${rota}"`));
      const fim = bloco.indexOf(") : null}");
      expect(fim).toBeGreaterThan(-1);
      const trecho = bloco.slice(0, fim);
      expect(trecho).toContain("<Suspense fallback={<PlatformFallback />}>");
      expect(trecho).toContain(`<${componente} />`);
    }
  });

  it("NÃO entram no menu do cabeçalho — são rotas de convite, não porta pública", () => {
    /* O menu é a diferença entre "formulário nominal enviado por e-mail" e
       "qualquer visitante do site tropeça no relatório interno". */
    const navItems = APP.slice(APP.indexOf("const navItems"), APP.indexOf("];", APP.indexOf("const navItems")));
    expect(navItems.length).toBeGreaterThan(100); // o recorte pegou mesmo a lista
    expect(navItems).not.toContain("relatorio-anual");
    expect(navItems).not.toContain("relatorio-laboratorio");
    expect(navItems).not.toContain("meu-ano");
    expect(navItems).not.toContain("meu-laboratorio");
    expect(navItems).not.toContain("RELATORIO_ANUAL_HREF");
    expect(navItems).not.toContain("RELATORIO_LAB_HREF");
    expect(navItems).not.toContain("MEU_ANO_HREF");
    expect(navItems).not.toContain("MEU_LAB_HREF");
  });
});

/* ======================================================================== *
 * #/nova-senha — a rota do link de redefinição
 *
 * O defeito relatado em produção: "o link de recuperação vai para o e-mail mas
 * abre a página inicial da webpage". A causa tem três suspeitos que não se
 * distinguem pelo sintoma (allowlist do projeto devolvendo o Site URL; o
 * "?code=" caindo dentro do fragmento, onde o SDK não olha; o token de uso
 * único gasto por um scanner de e-mail antes do clique humano). O que estes
 * testes travam é o que o CÓDIGO tem de garantir nos três casos: existe um
 * endereço com tela própria, e nenhuma forma de retorno termina numa home
 * silenciosa.
 * ======================================================================== */
describe("router · #/nova-senha existe e é endereço estável", () => {
  it("a constante e a rota são a mesma coisa (o e-mail usa a constante)", () => {
    expect(NOVA_SENHA_HREF).toBe("#/nova-senha");
    expect(parseHash(NOVA_SENHA_HREF)).toEqual({ name: "nova-senha" });
  });

  it("tolera barra final, hash sem '#' e a query do retorno", () => {
    expect(parseHash("#/nova-senha/").name).toBe("nova-senha");
    expect(parseHash("/nova-senha").name).toBe("nova-senha");
    expect(parseHash("#/nova-senha?code=pkce-abc").name).toBe("nova-senha");
    expect(parseHash("#/nova-senha?error=access_denied").name).toBe("nova-senha");
  });

  it("não colide com prefixo parecido nem com as outras rotas", () => {
    expect(parseHash("#/nova-senhas").name).toBe("home");
    expect(parseHash("#/nova").name).toBe("home");
    expect(parseHash("#/senha").name).toBe("home");
    expect(parseHash(NOVA_SENHA_HREF).name).not.toBe("gestao");
  });

  it("NÃO entra no menu do cabeçalho — é rota de retorno de e-mail", () => {
    const navItems = APP.slice(APP.indexOf("const navItems"), APP.indexOf("];", APP.indexOf("const navItems")));
    expect(navItems).not.toContain("nova-senha");
    expect(navItems).not.toContain("NOVA_SENHA_HREF");
  });
});

describe("router · o redirectTo do e-mail de senha", () => {
  const local = new URL("https://inct-conexao.com.br/?m=conv-77#/gestao?modo=x");

  it("é ABSOLUTO, aponta para #/nova-senha e não é 'de onde a pessoa clicou'", () => {
    expect(novaSenhaRedirectUrl(local)).toBe(`https://inct-conexao.com.br/${NOVA_SENHA_HREF}`);
    // A query e a hash de origem NÃO vão de carona para dentro do e-mail.
    expect(novaSenhaRedirectUrl(local)).not.toContain("m=conv-77");
    expect(novaSenhaRedirectUrl(local)).not.toContain("gestao");
  });

  it("o retorno do Supabase põe o code na QUERY, ANTES do fragmento", () => {
    /* É esta a forma que o SDK enxerga: ele lê `location.search` e trata o
       fragmento inteiro como lista de parâmetros — "#/nova-senha?code=x" viria
       como a chave "/nova-senha?code", nunca como "code". */
    const volta = new URL(voltaDoLinkMagico(novaSenhaRedirectUrl(local), "pkce-reset"));
    expect(volta.search).toContain("code=pkce-reset");
    expect(volta.hash).toBe(NOVA_SENHA_HREF);
    expect(parseHash(volta.hash)).toEqual({ name: "nova-senha" });
    expect(retornoAuthDaUrl(volta.toString())).toMatchObject({ code: "pkce-reset", codeNaHash: false });
  });

  it("auth.tsx manda para esse endereço, e não para window.location.href", () => {
    const bloco = AUTH.slice(AUTH.indexOf("resetPasswordForEmail"), AUTH.indexOf("resetPasswordForEmail") + 260);
    expect(bloco).toContain("redirectTo: novaSenhaRedirectUrl()");
    expect(bloco).not.toContain("window.location.href");
  });
});

describe("router · retornoAuthDaUrl lê os DOIS lugares (query e fragmento)", () => {
  const BASE_URL = "https://inct-conexao.com.br/";

  it("code na query real: é o caso bom, e o SDK resolve sozinho", () => {
    const r = retornoAuthDaUrl(`${BASE_URL}?code=pkce-1#/nova-senha`);
    expect(r.code).toBe("pkce-1");
    expect(r.codeNaHash).toBe(false);
    expect(r.error).toBeNull();
  });

  it("code DENTRO do fragmento: é lido, e marcado como invisível para o SDK", () => {
    const r = retornoAuthDaUrl(`${BASE_URL}#/nova-senha?code=pkce-2`);
    expect(r.code).toBe("pkce-2");
    // O flag é o que dispara a troca manual por sessão em NovaSenha.tsx.
    expect(r.codeNaHash).toBe(true);
  });

  it("erro no fragmento (fluxo implícito): o GoTrue SOBRESCREVE a hash", () => {
    /* Formato real: a hash inteira vira a lista de parâmetros e a rota some —
       por isso a pessoa cai na home mesmo tendo pedido #/nova-senha. */
    const href = `${BASE_URL}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`;
    const r = retornoAuthDaUrl(href);
    expect(r.error).toBe("access_denied");
    expect(r.errorCode).toBe("otp_expired");
    expect(r.errorDescription).toContain("expired");
    expect(r.code).toBeNull();
    // A rota, aqui, é mesmo a home: quem salva é a rede de segurança.
    expect(parseHash(new URL(href).hash).name).toBe("home");
  });

  it("erro na query (fluxo PKCE): a rota sobrevive junto do erro", () => {
    const href = `${BASE_URL}?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired#/nova-senha`;
    const r = retornoAuthDaUrl(href);
    expect(r.errorCode).toBe("otp_expired");
    expect(r.errorDescription).toContain("expired");
    expect(parseHash(new URL(href).hash).name).toBe("nova-senha");
  });

  it("a query tem precedência sobre o fragmento (mesma regra do SDK)", () => {
    const r = retornoAuthDaUrl(`${BASE_URL}?code=da-query#code=do-fragmento`);
    expect(r.code).toBe("da-query");
    expect(r.codeNaHash).toBe(false);
  });

  it("parâmetro vazio não conta como retorno (senão a home carregaria à toa)", () => {
    expect(retornoAuthDaUrl(`${BASE_URL}?code=`).code).toBeNull();
    expect(pareceRetornoDeAuth(`${BASE_URL}?code=`)).toBe(false);
    expect(pareceRetornoDeAuth(BASE_URL)).toBe(false);
    expect(pareceRetornoDeAuth(`${BASE_URL}#/mapa?modo=explorador`)).toBe(false);
    expect(pareceRetornoDeAuth(`${BASE_URL}#/relatorio-anual?m=conv-77`)).toBe(false);
    expect(pareceRetornoDeAuth(`${BASE_URL}#pesquisa`)).toBe(false);
  });
});

describe("router · nenhuma forma de retorno cai em home SILENCIOSA", () => {
  const BASE_URL = "https://inct-conexao.com.br/";

  /** A tela aparece? Ou pela rota, ou pela rede de segurança do App.tsx. */
  const atendido = (href: string): string => {
    const hash = href.includes("#") ? href.slice(href.indexOf("#")) : "";
    const rota = parseHash(hash).name;
    if (rota === "nova-senha") return "rota";
    if (rotaTrataAuth(rota)) return "a própria rota trata";
    if (pareceRetornoDeAuth(href)) return "rede";
    return "HOME SILENCIOSA";
  };

  it("todas as voltas possíveis chegam em alguma tela de senha", () => {
    const formas = [
      // O caminho feliz: fragmento preservado, code na query.
      `${BASE_URL}?code=pkce-1#/nova-senha`,
      // O redirect_to perdeu a hash (allowlist recusou e caiu no Site URL).
      `${BASE_URL}?code=pkce-1`,
      // Erro no fragmento: o GoTrue sobrescreveu a rota.
      `${BASE_URL}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired`,
      // Erro na query, com e sem a rota.
      `${BASE_URL}?error=access_denied&error_code=otp_expired#/nova-senha`,
      `${BASE_URL}?error_description=Email+link+is+invalid+or+has+expired`,
      // A URL foi reescrita no caminho e o code foi parar dentro do fragmento.
      `${BASE_URL}#/nova-senha?code=pkce-2`,
      `${BASE_URL}#/?code=pkce-2`,
    ];

    for (const href of formas) {
      expect(`${href} → ${atendido(href)}`).not.toContain("HOME SILENCIOSA");
    }
  });

  it("a rede NÃO invade quem já trata o próprio retorno", () => {
    /* O link mágico do Relatório Anual e o login das telas da plataforma
       continuam funcionando exatamente como antes — sobrepor uma segunda tela
       ali seria trocar um defeito por outro. */
    for (const rota of ["inscricao", "minha-inscricao", "gestao", "nova-senha", "relatorio-anual", "relatorio-laboratorio"] as const) {
      expect(rotaTrataAuth(rota)).toBe(true);
    }
    expect(atendido(`${BASE_URL}?code=pkce-magico#/relatorio-anual?m=conv-77`)).toBe("a própria rota trata");
    expect(atendido(`${BASE_URL}?code=pkce-magico#/gestao`)).toBe("a própria rota trata");
  });

  it("a rede cobre as rotas públicas, mas só liga com retorno na URL", () => {
    // Estas rotas não têm tela de autenticação nenhuma: é nelas que a pessoa
    // caía em silêncio, e é nelas que a rede precisa poder aparecer.
    for (const nome of ["home", "hub", "mapa", "noticias", "edital"] as const) {
      expect(rotaTrataAuth(nome)).toBe(false);
    }
    // …e em navegação normal o gatilho fica desligado (a home não paga nada).
    expect(pareceRetornoDeAuth(`${BASE_URL}#pesquisa`)).toBe(false);
    expect(pareceRetornoDeAuth(`${BASE_URL}#/mapa`)).toBe(false);
    expect(pareceRetornoDeAuth(BASE_URL)).toBe(false);
  });
});

describe("App.tsx · a tela de nova senha e a rede de segurança", () => {
  it("monta #/nova-senha sob demanda, no mesmo Suspense da plataforma", () => {
    expect(APP).toContain('lazy(() => import("./platform/NovaSenha"))');
    expect(APP).not.toMatch(/^import .*from "\.\/platform\/NovaSenha"/m);

    const bloco = APP.slice(APP.indexOf('route.name === "nova-senha"'));
    const fim = bloco.indexOf(") : null}");
    expect(fim).toBeGreaterThan(-1);
    const trecho = bloco.slice(0, fim);
    expect(trecho).toContain("<Suspense fallback={<PlatformFallback />}>");
    expect(trecho).toContain("<NovaSenha />");
  });

  it("a rede monta a MESMA tela por cima de qualquer outra rota", () => {
    expect(APP).toContain("const redeDeSenha = retornoDeAuth && !rotaTrataAuth(route.name)");
    const bloco = APP.slice(APP.indexOf("{redeDeSenha ?"));
    const fim = bloco.indexOf(") : null}");
    expect(fim).toBeGreaterThan(-1);
    expect(bloco.slice(0, fim)).toContain("<NovaSenha rede />");
  });

  it("a home NÃO paga o SDK do Supabase pela rede", () => {
    /* O gatilho é parse de string (`pareceRetornoDeAuth`). Importar `useAuth`
       aqui arrastaria @supabase/supabase-js para o bundle inicial de quem só
       quer ler o site — e é isso, não a tela, que encarece a home. */
    expect(APP).toContain("pareceRetornoDeAuth(window.location.href)");
    expect(APP).not.toMatch(/useAuth\(/);
    expect(APP).not.toMatch(/import .*from "\.\/platform\/(auth|supabaseClient)"/);
  });
});

/* --------------------------------------------- o guarda da renomeação */
describe("renomeação 2026-08 · o nome antigo não volta, o que não pode mudar não muda", () => {
  const telas = [
    ...readdirSync(join(RAIZ, "src", "relato"))
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => join("src", "relato", f)),
    join("src", "App.tsx"),
  ];

  it('nenhuma tela volta a dizer "Meu ano" ou "Meu laboratório"', () => {
    /* O guarda é pela FRASE com espaço, título do formulário antigo. Ele não
       pega `MeuAno.tsx` (nome de arquivo, legado assumido) nem `#/meu-ano`
       (alias permanente, com hífen) — esses DEVEM continuar existindo. */
    for (const rel of telas) {
      const fonte = readFileSync(join(RAIZ, rel), "utf-8");
      expect(fonte, `"Meu ano" reapareceu em ${rel}`).not.toMatch(/Meu ano/);
      expect(fonte, `"Meu laboratório" reapareceu em ${rel}`).not.toMatch(/Meu laboratório/);
    }
  });

  it("os títulos novos estão nas duas telas, inclusive no <title>", () => {
    const meuAno = readFileSync(join(RAIZ, "src", "relato", "MeuAno.tsx"), "utf-8");
    expect(meuAno).toContain("<h1>Relatório Anual de Atividades</h1>");
    expect(meuAno).toContain('document.title = "Relatório Anual de Atividades | INCT-CONEXAO"');

    const meuLab = readFileSync(join(RAIZ, "src", "relato", "MeuLaboratorio.tsx"), "utf-8");
    expect(meuLab).toContain("<h1>Relatório Anual do Laboratório</h1>");
    expect(meuLab).toContain('document.title = "Relatório Anual do Laboratório | INCT-CONEXAO"');
  });

  it("a chave de localStorage do catálogo NÃO mudou com a renomeação", () => {
    /* Há escolhas já gravadas nos navegadores dos 209 sob esta chave. Renomear
       a chave descartaria todas em silêncio. */
    const busca = readFileSync(join(RAIZ, "src", "relato", "BuscaPesquisador.tsx"), "utf-8");
    expect(busca).toContain('"inct.relato.catalogo"');
  });
});

/* ----------------------------------------- gates por papel (migração 012) */
describe("gates por papel · líder (lla) vê o formulário do laboratório; os demais, o individual", () => {
  /* Decisão do dono (2026-08-10): quem tem papel 'lla' no roster do ciclo
     relata PELO laboratório; quem não tem vê e acessa só o individual. A RLS
     continua sendo a porta de verdade (lla_user_id, preenchido pela 012) —
     estes gates são de TELA, e o guarda aqui é de fonte: se alguém remover o
     gate num refactor, o líder volta a cair no wizard individual em silêncio. */
  const meuAno = readFileSync(join(RAIZ, "src", "relato", "MeuAno.tsx"), "utf-8");
  const painel = readFileSync(join(RAIZ, "src", "relato", "PainelRelatorio.tsx"), "utf-8");

  it("MeuAno tem o gate por papel 'lla' apontando para RELATORIO_LAB_HREF", () => {
    // O gate existe e barra pelo papel do roster (travado pela guard da 007)…
    expect(meuAno).toContain('membro?.papel === "lla"');
    // …e a saída é o endereço CANÔNICO do formulário do laboratório, pela
    // constante do roteador (motivo nº 1 deste arquivo: endereço no texto e
    // não no roteador quebra em silêncio).
    expect(meuAno).toContain('RELATORIO_LAB_HREF } from "../webinars/router"');
    expect(meuAno).toContain("href={RELATORIO_LAB_HREF}");
  });

  it("o gate de MeuAno vem DEPOIS da identificação — o fluxo que grava o vínculo continua vivo", () => {
    /* É pela identificação (semRoster → IdentificacaoComSessao) que o líder se
       identifica pela PRIMEIRA vez — e é nesse momento que a 012 grava
       laboratorios.lla_user_id. Um gate antes dela trancaria o líder do lado
       de fora do próprio vínculo. */
    const gate = meuAno.indexOf('membro?.papel === "lla"');
    const identificacao = meuAno.indexOf("if (semRoster)");
    expect(gate).toBeGreaterThan(-1);
    expect(identificacao).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(identificacao);
  });

  it("CartoesDeAcesso condiciona os cartões pelo papel (lla → lab; outro → individual; null → os dois)", () => {
    // A prop existe e é o PapelNoCiclo do roster…
    expect(painel).toMatch(/function CartoesDeAcesso\(\{ papel \}: \{ papel: PapelNoCiclo \| null \}\)/);
    // …e as duas condições dizem exatamente a regra do dono: o individual some
    // para o 'lla'; o do laboratório só aparece para 'lla' ou papel desconhecido.
    expect(painel).toContain('const mostrarIndividual = papel !== "lla"');
    expect(painel).toContain('const mostrarLaboratorio = papel === "lla" || papel === null');
    expect(painel).toContain("{mostrarIndividual ? (");
    expect(painel).toContain("{mostrarLaboratorio ? (");
  });

  it("todos os pontos de chamada do painel passam o papel — nenhum ficou com os dois cartões fixos", () => {
    /* São os 5 estados do componente (carregando, erro, sem-ciclo, sem-acesso,
       pronto): todos repassam o papel do estado. Enquanto ele ainda não chegou
       o estado é null e os dois cartões aparecem — o comportamento de hoje. */
    const comPapel = painel.match(/<CartoesDeAcesso papel=\{papel\} \/>/g) ?? [];
    expect(comPapel.length).toBe(5);
    // Chamada sem prop não sobrou nenhuma.
    expect(painel).not.toContain("<CartoesDeAcesso />");
  });
});

/* --------------------------------- nenhuma porta é beco (migração 013) */
describe("nenhuma porta é beco · vínculo por e-mail antes de erro, identificação em toda parede", () => {
  /* O incidente (2026-08-11): o COORDENADOR abriu o painel e leu "peça à
     coordenação para incluir seu e-mail" — ele É a coordenação. A diretriz do
     dono virou desenho: (1) e-mail pré-autorizado vincula SOZINHO, e toda tela
     que dependa do vínculo tenta esse caminho ANTES de mostrar qualquer erro;
     (2) quem não casa por e-mail recebe a identificação por busca de nome ali
     mesmo (o componente do formulário individual), valendo para a plataforma
     inteira; (3) papel de gestão a busca RECUSA (`papel_protegido`), porque
     reivindicar coordenação/CGES por nome seria escalada de privilégio.
     Estes guardas são de FONTE: se um refactor remover qualquer uma das três
     pernas, a parede volta em silêncio — e é exatamente o defeito relatado. */
  const painel = readFileSync(join(RAIZ, "src", "relato", "PainelRelatorio.tsx"), "utf-8");
  const meuLab = readFileSync(join(RAIZ, "src", "relato", "MeuLaboratorio.tsx"), "utf-8");
  const busca = readFileSync(join(RAIZ, "src", "relato", "BuscaPesquisador.tsx"), "utf-8");

  it("PainelRelatorio tenta o vínculo silencioso por e-mail ANTES de declarar sem-acesso", () => {
    // A chamada existe, importada do api.ts (a RPC da 006, consertada na 013)…
    expect(painel).toContain("vincularMeuCadastro,");
    const tentativa = painel.indexOf("await vincularMeuCadastro()");
    const semAcesso = painel.indexOf('setFase("sem-acesso")');
    expect(tentativa).toBeGreaterThan(-1);
    expect(semAcesso).toBeGreaterThan(-1);
    // …e vem ANTES da fase de erro: o coordenador com a 013 aplicada passa por
    // aqui e nunca vê a tela de sem-acesso.
    expect(tentativa).toBeLessThan(semAcesso);
  });

  it("SemAcesso (painel) oferece a identificação por busca de nome, sem sair da tela", () => {
    expect(painel).toContain('import { IdentificacaoComSessao } from "./BuscaPesquisador"');
    const inicio = painel.indexOf("function SemAcesso");
    const fim = painel.indexOf("function AbaVisaoGeral");
    expect(inicio).toBeGreaterThan(-1);
    expect(fim).toBeGreaterThan(inicio);
    const bloco = painel.slice(inicio, fim);
    // A identificação aparece só no estado sem papel (fora do roster); quem já
    // tem papel recebe a explicação do próprio papel, como antes.
    expect(bloco).toContain("<IdentificacaoComSessao");
    expect(bloco).toContain("papel === null ? (");
    // E o resultado recarrega o papel: os cartões de quem se identificou.
    expect(painel).toContain("onIdentificado={() => setTentativa((t) => t + 1)}");
  });

  it("MeuLaboratorio tenta o vínculo silencioso por e-mail antes da tela seca", () => {
    expect(meuLab).toContain("vincularMeuCadastro,");
    const tentativa = meuLab.indexOf("await vincularMeuCadastro()");
    const parede = meuLab.indexOf("Esta tela é do líder do laboratório");
    expect(tentativa).toBeGreaterThan(-1);
    expect(parede).toBeGreaterThan(-1);
    expect(tentativa).toBeLessThan(parede);
  });

  it("MeuLaboratorio sem vínculo no roster mostra a identificação, não o texto seco", () => {
    expect(meuLab).toContain('import { IdentificacaoComSessao } from "./BuscaPesquisador"');
    const guarda = meuLab.indexOf("if (!carga.membro)");
    expect(guarda).toBeGreaterThan(-1);
    // Logo dentro da guarda está o componente de identificação…
    const bloco = meuLab.slice(guarda, guarda + 400);
    expect(bloco).toContain("<IdentificacaoComSessao");
    // …e ANTES do aviso "esta tela é do líder": quem tem linha no roster mas
    // não lidera continua lendo o encaminhamento correto.
    expect(guarda).toBeLessThan(meuLab.indexOf("Esta tela é do líder do laboratório"));
  });

  it("o estado papel_protegido (013) é tratado: recusa com a mensagem da RPC, sem enviar link", () => {
    // O componente compartilhado existe e é exportado de BuscaPesquisador…
    expect(busca).toContain("export function IdentificacaoComSessao");
    // …e `interpretarReivindicacao` conhece o estado novo, mapeando-o para a
    // recusa com explicação (o caminho que mostra `mensagem` e PARA).
    const protegido = busca.indexOf('cru === "papel_protegido"');
    expect(protegido).toBeGreaterThan(-1);
    const trecho = busca.slice(protegido, protegido + 700);
    expect(trecho).toContain('status: "recusado"');
    expect(trecho).toContain("texto(o.mensagem)");
    // A checagem vem ANTES de `ja_vinculado`, espelhando a ordem do servidor:
    // linha de gestão nunca devolve e-mail mascarado.
    expect(protegido).toBeLessThan(busca.indexOf('"ja_vinculado", "já_vinculado"'));
    // E a porta com busca (link mágico) PARA na recusa, antes do envio.
    const enviar = busca.indexOf("const enviarLink");
    const recusa = busca.indexOf('r.status === "recusado"', enviar);
    const envio = busca.indexOf("auth.signIn(email)", enviar);
    expect(recusa).toBeGreaterThan(enviar);
    expect(envio).toBeGreaterThan(recusa);
  });
});
