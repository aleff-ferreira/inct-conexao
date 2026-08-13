import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { platformEnabled } from "./supabaseClient";
import {
  CODIGO_MAX,
  codigoIssue,
  emailDeRecuperacaoLembrado,
  lembrarEmailDeRecuperacao,
  normalizarCodigo,
  trocarCodePorSessao,
  useAuth,
  type AuthState,
} from "./auth";
import PasswordCard from "./PasswordCard";
import { retornoAuthDaUrl, type RetornoAuth } from "../webinars/router";

/**
 * DEFINIR NOVA SENHA — a tela onde a redefinição termina, por qualquer caminho.
 *
 * Antes desta página não existia tela de nova senha fora de três rotas
 * (`#/inscricao/…`, `#/minha-inscricao`, `#/gestao`): o link do e-mail voltava
 * para "onde a pessoa clicou" e, quando esse retorno caía na raiz do site, ela
 * via a home e nada acontecia. Não havia mensagem, não havia formulário — só
 * silêncio. Esta tela existe para que o retorno tenha SEMPRE um lugar para
 * chegar, e para que quando não der certo a pessoa LEIA o porquê.
 *
 * DOIS CAMINHOS DE ENTRADA, E ELES CONVIVEM:
 *
 *  1. O CÓDIGO NUMÉRICO — o principal. A pessoa digita o código que veio
 *     no e-mail e o `verifyOtp` abre a sessão de recuperação. Nenhum robô
 *     "clica" num número, então nem o Safe Links da Microsoft nem o rastreador
 *     de cliques da Brevo conseguem gastá-lo antes dela (o porquê inteiro está
 *     no bloco "O CÓDIGO NUMÉRICO", em auth.tsx). O formulário aparece
 *     SEMPRE que não há sessão de recuperação em pé — inclusive logo abaixo da
 *     explicação de um link que falhou, que é o lugar mais útil possível.
 *
 *  2. O LINK — o antigo. Continua funcionando exatamente como funcionava: quem
 *     tem um e-mail antigo na caixa de entrada, ou um link que ainda não foi
 *     gasto, chega aqui e cai direto no formulário de senha.
 *
 * Dois modos de montagem:
 *
 *  - rota (`#/nova-senha`, o padrão): é a página inteira, com título próprio.
 *  - rede (`rede`): montada pelo App.tsx por cima de qualquer outra rota quando
 *    a URL parece a volta de um e-mail de autenticação e a rota atual não trata
 *    disso sozinha. Nesse modo a tela só APARECE se houver mesmo recuperação de
 *    senha ou erro; para um login normal por link mágico ela devolve `null` e
 *    não atrapalha nada.
 *
 * O que pode chegar na URL, e todos chegam:
 *   ?code=…                       PKCE na query — o SDK troca por sessão sozinho
 *   #/nova-senha?code=…           PKCE dentro do fragmento — o SDK NÃO enxerga
 *   ?error=…&error_description=…  erro no fluxo PKCE
 *   #error=…&error_code=otp_expired&error_description=…   erro no fluxo implícito
 *   (nada)                        entrada limpa — vai direto ao campo do código
 */

type Destino = { href: string; label: string };

/**
 * Erro do Supabase → texto que serve para alguém decidir o que fazer.
 *
 * O Supabase NÃO distingue "expirou" de "já foi usado": os dois voltam como
 * `otp_expired` / "Email link is invalid or has expired". O texto diz as duas
 * possibilidades, e cita a terceira — o link de uso único gasto por um scanner
 * de e-mail corporativo (Safe Links, antivírus de anexo, rastreador de cliques)
 * ANTES do clique humano —, que é invisível para quem só vê "não funcionou".
 *
 * TODOS os textos terminam apontando para o CAMPO LOGO ABAIXO: o formulário do
 * código numérico é renderizado junto com este aviso, e mandar a pessoa
 * "pedir um link novo" quando a saída está a dois centímetros de distância era
 * exatamente o que fazia gente desistir.
 */
function explicarErro(
  retorno: RetornoAuth,
  erroDaTroca: string,
  /** Veio `code` na URL e, mesmo assim, não sobrou sessão nem estado de
   *  recuperação. O SDK trocou por conta própria e o servidor recusou — e o
   *  motivo NÃO chega até aqui, porque quem fez a troca foi o
   *  `detectSessionInUrl`, cujo erro não passa pelo nosso código. */
  codeSemSessao = false,
): { titulo: string; texto: string } {
  if (erroDaTroca) return { titulo: "Não foi possível abrir a redefinição", texto: erroDaTroca };

  const pista = `${retorno.errorCode ?? ""} ${retorno.error ?? ""} ${retorno.errorDescription ?? ""}`.toLowerCase();

  if (pista.includes("otp_expired") || pista.includes("expired")) {
    return {
      titulo: "Este link expirou ou já foi usado",
      texto:
        "O link de redefinição vale por pouco tempo e só pode ser usado uma vez. Alguns servidores de e-mail corporativos abrem os links das mensagens para conferir se são seguros, e quando isso acontece o link já chega gasto até você. Não precisa de link nenhum: o mesmo e-mail traz um código numérico. Digite-o no campo abaixo.",
    };
  }
  if (pista.includes("code verifier") || pista.includes("code_verifier") || pista.includes("flow state")) {
    return {
      titulo: "Este link precisa ser aberto no mesmo navegador",
      texto:
        "Por segurança, o LINK só se completa no navegador em que a redefinição foi pedida. Se o e-mail abriu no celular e o pedido saiu do computador (ou vice-versa), ele não fecha o ciclo. O código numérico do mesmo e-mail não tem essa limitação: digite-o abaixo, neste aparelho mesmo.",
    };
  }
  if (pista.includes("access_denied") || pista.includes("unauthorized")) {
    return {
      titulo: "Este link não é mais válido",
      texto:
        "O endereço de redefinição foi recusado pelo servidor de autenticação, normalmente porque já foi usado, expirou ou foi substituído por um pedido mais recente. Use o código numérico que veio no mesmo e-mail, no campo abaixo.",
    };
  }
  if (pista.trim()) {
    return {
      titulo: "Não foi possível abrir a redefinição",
      texto: `${retorno.errorDescription ?? retorno.error ?? "Erro não identificado"}. Use o código numérico que veio no mesmo e-mail, no campo abaixo.`,
    };
  }
  /* CHEGOU CÓDIGO E NÃO SOBROU SESSÃO — e este é o caso MAIS COMUM em produção,
     não um canto raro. O link de redefinição é de uso único, e servidores de
     e-mail corporativos (o Safe Links da Microsoft, o rastreador de cliques da
     Brevo) abrem os links antes da pessoa, gastando o código. O Supabase, nesse
     caminho, não põe erro na URL: quem tentou a troca foi o `detectSessionInUrl`
     do SDK, e o motivo da recusa morre lá dentro.
     Sem este ramo, a pessoa lia "não encontramos uma redefinição em andamento",
     que a manda procurar o link certo — quando o link ESTAVA certo e o problema
     era outro. Dizer a verdade provável aqui vale mais que a mensagem genérica. */
  if (codeSemSessao) {
    return {
      titulo: "Este link expirou ou já foi usado",
      texto:
        "O link de redefinição vale por pouco tempo e só funciona uma vez. Acontece com frequência de servidores de e-mail corporativos abrirem o link antes de você, para conferir se é seguro, e aí ele já chega gasto. Não é preciso outro link: o mesmo e-mail traz um código numérico, e nenhum servidor consegue gastar um número. Digite-o no campo abaixo.",
    };
  }

  // Sem erro na URL, sem código e sem sessão: não havia redefinição nenhuma.
  // Na prática este ramo não chega a ser exibido — o aviso só é montado quando
  // houve mesmo uma tentativa de link —, mas a função continua total.
  return {
    titulo: "Não encontramos uma redefinição em andamento",
    texto: "Digite abaixo o código que enviamos por e-mail.",
  };
}

/**
 * Tira o `code` de dentro do fragmento depois da troca manual, para um F5 não
 * tentar reusar um código já gasto e transformar sucesso em erro.
 */
function limparCodeDaHash(): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash.replace(/^#/, "");
  const corte = hash.indexOf("?");
  if (corte === -1) return;
  const params = new URLSearchParams(hash.slice(corte + 1));
  if (!params.has("code")) return;
  params.delete("code");
  const resto = params.toString();
  const nova = `#${hash.slice(0, corte)}${resto ? `?${resto}` : ""}`;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${nova}`);
}

/**
 * O CAMPO DO CÓDIGO NUMÉRICO — o caminho principal da redefinição.
 *
 * Decisões que este formulário carrega:
 *
 *  - O E-MAIL VEM JUNTO, e sempre visível. `verifyOtp` precisa do par
 *    (e-mail, código); quem acabou de pedir a redefinição no AuthCard chega com
 *    o campo preenchido (sessionStorage, ver `lembrarEmailDeRecuperacao`), e
 *    quem caiu aqui pelo link de um e-mail antigo simplesmente digita. Deixar o
 *    campo à mostra nos dois casos também conserta o endereço digitado errado
 *    na hora do pedido, que era um beco sem saída.
 *
 *  - COLAR TEM DE FUNCIONAR. `maxLength` sozinho estragaria a colagem: o
 *    navegador corta o texto ANTES do onChange, e "123-456" (sete caracteres)
 *    viraria "12345". Por isso o `onPaste` intercepta, normaliza o que veio da
 *    área de transferência e escreve o código inteiro de uma vez.
 *
 *  - `autoComplete="one-time-code"` faz o teclado do celular oferecer o código
 *    da notificação sozinho; `inputMode="numeric"` abre o teclado numérico.
 *
 *  - O CÓDIGO NÃO SAI DAQUI. Vive só neste estado: não vai para a URL, não vai
 *    para storage nenhum e não aparece em log — é credencial de uso único.
 */
function FormularioCodigo({ auth, depoisDeErro }: { auth: AuthState; depoisDeErro: boolean }) {
  const [email, setEmail] = useState(() => emailDeRecuperacaoLembrado());
  const [codigo, setCodigo] = useState("");
  const [msg, setMsg] = useState("");
  const [aviso, setAviso] = useState("");
  const [verificando, setVerificando] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  return (
    <div className="plat-card plat-login">
      <KeyRound size={22} aria-hidden="true" />
      <h2>{depoisDeErro ? "Use o código do e-mail" : "Digite o código do e-mail"}</h2>
      <p>
        O e-mail de redefinição traz um <strong>código numérico</strong>. Ele não depende de clicar
        em nada, então nenhum filtro de segurança de e-mail consegue gastá-lo antes de você. Vale por
        1 hora e só serve uma vez.
      </p>
      <form
        className="plat-fields"
        onSubmit={async (e) => {
          e.preventDefault();
          setAviso("");
          const problema = codigoIssue(codigo);
          if (problema) {
            setMsg(problema);
            return;
          }
          setVerificando(true);
          const { error } = await auth.verificarCodigo(email, codigo);
          setVerificando(false);
          if (error) {
            setMsg(error);
            return;
          }
          /* Deu certo: `auth.recovery` vira true e esta tela é substituída pelo
             PasswordCard no próximo render. Limpar o código é higiene — ele não
             fica pendurado em estado nenhum além do necessário. */
          setMsg("");
          setCodigo("");
        }}
      >
        <label>
          E-mail que recebeu o código
          <input
            type="email"
            /* Idem ao campo do código: sem `required`, para o navegador não
               interromper em inglês. A validação do e-mail já é feita no
               submit, com mensagem nossa. */
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Código do e-mail
          <input
            type="text"
            /* SEM `required`: a validação nativa do HTML fala o idioma do
               NAVEGADOR, e num campo vazio o Chrome em inglês responde "Please
               fill out this field." no meio de um formulário em português.
               Quem valida é `codigoIssue`, que já cobre vazio, curto e não
               numérico com texto nosso. */
            value={codigo}
            onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
            onPaste={(e) => {
              const colado = normalizarCodigo(e.clipboardData.getData("text"));
              if (!colado) return;
              e.preventDefault();
              setCodigo(colado);
            }}
            inputMode="numeric"
            // Deixa o celular oferecer o código da notificação sem digitação.
            autoComplete="one-time-code"
            // Dica para iOS antigo; o valor já chega normalizado, então nunca
            // dispara mensagem nativa de validação (que viria em inglês).
            pattern="[0-9]*"
            /* O MÁXIMO da faixa do painel (10), nunca o comprimento "esperado":
               foi um maxLength de 6 que truncou o código real de 8 dígitos na
               colagem e fez o envio falhar com "código incorreto" (07/08/2026). */
            maxLength={CODIGO_MAX}
            aria-describedby="codigo-ajuda"
            style={{ letterSpacing: "0.35em", fontVariantNumeric: "tabular-nums" }}
          />
          <small id="codigo-ajuda">
            Só números. Pode colar o código inteiro: espaços e traços são removidos sozinhos.
          </small>
        </label>
        {msg ? <p className="plat-error">{msg}</p> : null}
        {aviso ? <p className="plat-ok">{aviso}</p> : null}
        <div className="plat-nav">
          <button
            type="button"
            className="plat-linkbtn"
            disabled={reenviando || verificando}
            onClick={async () => {
              setMsg("");
              setAviso("");
              setReenviando(true);
              const { error } = await auth.resetPassword(email);
              setReenviando(false);
              if (error) {
                setMsg(error);
                return;
              }
              lembrarEmailDeRecuperacao(email);
              setCodigo("");
              setAviso(
                `Enviamos um código novo para ${email.trim()}. Use o do e-mail MAIS RECENTE: pedir outro cancela o anterior.`,
              );
            }}
          >
            {reenviando ? "Enviando…" : "Não recebi: enviar outro código"}
          </button>
          <button className="button primary" type="submit" disabled={verificando}>
            {verificando ? "Verificando…" : "Verificar código"} <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NovaSenha({ rede = false }: { rede?: boolean }) {
  const auth = useAuth();

  /* Lido UMA vez, no primeiro render — antes de qualquer efeito. Assim que o
     SDK troca o code por sessão ele APAGA o "?code=" da URL
     (history.replaceState), e depois disso não há mais nada para ler. */
  const [retorno] = useState<RetornoAuth>(() =>
    retornoAuthDaUrl(typeof window === "undefined" ? "" : window.location.href),
  );
  const [trocando, setTrocando] = useState(retorno.codeNaHash);
  const [erroDaTroca, setErroDaTroca] = useState("");
  const [pronto, setPronto] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  /* A rede se declara `aria-modal`, então precisa se comportar como modal: o
     foco entra nela ao aparecer e o corpo atrás para de rolar. Sem isso, quem
     usa teclado ou leitor de tela continua navegando a home por baixo de um
     diálogo que diz ocupar a tela inteira — e não encontra o campo de senha. */
  const caixaDaRede = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rede) document.title = "Definir nova senha | INCT-CONEXAO";
  }, [rede]);

  /* O code voltou DENTRO do fragmento: o SDK não o encontra, então a troca por
     sessão é feita aqui. Quando o code vem na query real o SDK já resolveu — e
     repetir a troca queimaria um código válido. */
  useEffect(() => {
    if (!platformEnabled || !retorno.codeNaHash || !retorno.code) return;
    let cancelado = false;
    trocarCodePorSessao(retorno.code).then(({ error }) => {
      if (cancelado) return;
      if (error) setErroDaTroca(error);
      else limparCodeDaHash();
      setTrocando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [retorno]);

  const temErro = Boolean(erroDaTroca || retorno.error || retorno.errorCode || retorno.errorDescription);
  const carregando = !temErro && (trocando || auth.loading);
  /* Na rota, uma sessão comum já basta para trocar a própria senha. Na rede,
     só a recuperação abre a tela: um login por link mágico não pode ser
     sequestrado por um formulário de senha. */
  const podeDefinir = auth.recovery || (!rede && Boolean(auth.session));
  /* Veio um code, a poeira baixou e não sobrou sessão nenhuma: o código foi
     recusado sem que o Supabase pusesse erro na URL (acontece quando ele já
     tinha sido usado). Sem este caso a rede voltaria a ficar calada — que é
     exatamente o defeito que ela existe para impedir. */
  const semResultado = Boolean(retorno.code) && !carregando && !auth.session && !auth.recovery;

  // Na rede, enquanto não há o que dizer, não existe: a página de baixo segue
  // inteira e o visitante comum nunca vê nada disto.
  const redeVisivel = rede && !dispensado && (temErro || podeDefinir || semResultado || pronto);

  /* Foco para dentro do diálogo e rolagem do corpo travada — só enquanto ele
     está de fato visível. Os hooks ficam ANTES do return condicional: React
     exige ordem estável de hooks, e um `return null` no meio quebraria isso. */
  useEffect(() => {
    if (!redeVisivel) return;
    caixaDaRede.current?.focus();
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
    };
  }, [redeVisivel]);

  if (rede && !redeVisivel) return null;

  const staff =
    auth.profile?.role === "superadmin" ||
    auth.profile?.role === "admin" ||
    auth.profile?.role === "avaliador";
  const destino: Destino = staff
    ? { href: "#/gestao", label: "Ir para a gestão de seleções" }
    : { href: "#/minha-inscricao", label: "Ir para minha inscrição" };

  /* Saída. Na rede a tela está POR CIMA da página, e um link para a home não
     tiraria o que está em cima dela — quem fecha é o botão. */
  const sair = rede ? (
    <button type="button" className="plat-linkbtn" onClick={() => setDispensado(true)}>
      Fechar e voltar ao site
    </button>
  ) : (
    <a className="plat-linkbtn" href="#inicio">
      Voltar ao site
    </a>
  );

  const { titulo: tituloErro, texto: textoErro } = explicarErro(retorno, erroDaTroca, semResultado);
  /* O aviso do link que falhou. Ele já NÃO é o fim da conversa: o formulário do
     código vem logo abaixo, e por isso não há mais o parágrafo "vá até outra
     tela e peça um link novo". */
  const avisoDoLink = (
    <div className="plat-card plat-notice">
      <AlertTriangle size={20} aria-hidden="true" />
      <div>
        <strong>{tituloErro}</strong>
        <p>{textoErro}</p>
      </div>
    </div>
  );

  let miolo;
  if (!platformEnabled) {
    miolo = (
      <div className="plat-card plat-notice">
        <AlertTriangle size={20} aria-hidden="true" />
        <div>
          <strong>Sistema em preparação</strong>
          <p>O acesso com senha ainda não foi habilitado neste site.</p>
        </div>
      </div>
    );
  } else if (pronto) {
    miolo = (
      <div className="plat-card plat-login">
        <CheckCircle2 size={22} aria-hidden="true" />
        <h2>Senha definida</h2>
        <p>
          Sua nova senha já vale a partir de agora
          {auth.session?.user.email ? (
            <>
              {" "}
              para <strong>{auth.session.user.email}</strong>
            </>
          ) : null}
          . Guarde-a: o login normal é com e-mail e senha, sem depender de e-mail nenhum.
        </p>
        <div className="plat-nav">
          {sair}
          <a className="button primary" href={destino.href}>
            {destino.label} <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    );
  } else if (carregando) {
    miolo = (
      <div className="plat-loading">
        <Loader2 size={22} aria-hidden="true" /> {trocando ? "Validando o link…" : "Carregando…"}
      </div>
    );
  } else if (podeDefinir) {
    /* ANTES DO RAMO DE ERRO, de propósito. Quem chegou com um link queimado
       (`temErro`) e resolveu digitando o código passa a ter sessão de
       recuperação — e continuaria olhando para a mensagem de erro antiga se a
       ordem fosse a de antes, sem nunca ver o formulário de senha. */
    miolo = (
      <PasswordCard
        title="Definir nova senha"
        cta="Salvar nova senha"
        onSubmit={async (senha) => {
          const resultado = await auth.updatePassword(senha);
          if (!resultado.error) setPronto(true);
          return resultado;
        }}
      />
    );
  } else {
    /* O CAMINHO PRINCIPAL. Não há sessão de recuperação — porque o link falhou,
       porque ele nem foi tentado, ou porque a pessoa veio direto do "Esqueci a
       senha". Nos três casos a saída é a mesma: digitar o código. O aviso do
       link só aparece quando houve mesmo uma tentativa de link a explicar. */
    miolo = (
      <>
        {temErro || semResultado ? avisoDoLink : null}
        <FormularioCodigo auth={auth} depoisDeErro={temErro || semResultado} />
        <div className="plat-nav plat-nav--start">{sair}</div>
      </>
    );
  }

  const corpo = (
    <div className="section-inner plat-inner">
      <p className="eyebrow dark">Acesso à plataforma</p>
      <h1>Definir nova senha</h1>
      {miolo}
    </div>
  );

  /* Na rede a tela cobre a página em que a pessoa caiu (a home, no caso
     relatado). Estilo em linha de propósito: esta é a única tela que precisa
     ficar por cima do cabeçalho fixo, e não vale criar classe global para
     ela. */
  if (rede) {
    return (
      <div
        ref={caixaDaRede}
        role="dialog"
        aria-modal="true"
        aria-label="Definir nova senha"
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape") setDispensado(true);
        }}
        style={{ position: "fixed", inset: 0, zIndex: 90, overflowY: "auto", background: "var(--paper)" }}
      >
        <section className="section-band plat-band" style={{ paddingTop: 48, minHeight: "100%" }}>
          {corpo}
        </section>
      </div>
    );
  }

  return (
    <main className="plat-page" id="conteudo" tabIndex={-1}>
      <section className="section-band plat-band">{corpo}</section>
    </main>
  );
}
