import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { platformEnabled, supabase } from "./supabaseClient";
import { novaSenhaRedirectUrl } from "../webinars/router";
import type { Profile } from "./types";

/**
 * A pessoa desta sessão TEM senha ativa?
 *
 * Existe para a UI esconder o convite "definir uma senha" de quem já a tem —
 * mostrá-lo a quem acabou de ENTRAR com senha lê como descuido (apontado pelo
 * dono em 10/08/2026). O Supabase não expõe "tem senha?" diretamente, então a
 * resposta vem de dois sinais, qualquer um basta:
 *
 *  1. `user_metadata.senha_definida` — a marca persistente que NÓS gravamos em
 *     todo caminho que cria senha (signUp, updatePassword — inclusive o
 *     PasswordCard e a redefinição por código do #/nova-senha, que passam por
 *     eles). Sobrevive a logins futuros por link/código.
 *  2. O `amr` do access token — o registro de COMO esta sessão nasceu. Quem
 *     entrou por `signInWithPassword` tem `{method:"password"}` ali, e isso
 *     cobre as contas criadas ANTES da marca existir, sem nenhuma escrita.
 *     (Decodificar o payload do JWT no cliente é leitura de dado próprio; a
 *     VERDADE de auth continua no servidor — isto só decide UI.)
 *
 * Falso quando não dá para afirmar — o pior caso é o convite aparecer para
 * quem já tem senha via caminho antigo + login por link, e aceitá-lo de novo é
 * inócuo (trocar a senha por outra).
 */
export function temSenhaAtiva(session: Session | null): boolean {
  if (!session) return false;
  if (session.user.user_metadata?.senha_definida === true) return true;
  try {
    const b64 = (session.access_token.split(".")[1] ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(b64)) as { amr?: Array<{ method?: string }> };
    return (payload.amr ?? []).some((m) => m.method === "password");
  } catch {
    return false;
  }
}

export type AuthState = {
  /** null enquanto carrega; depois a sessão (ou ausência dela) */
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** e-mail para onde o link mágico foi enviado (feedback de UI) */
  otpSentTo: string | null;
  /** true quando o usuário chegou por um link de redefinição de senha */
  recovery: boolean;
  /** Candidatos: login sem senha por link mágico. */
  signIn: (email: string) => Promise<{ error?: string }>;
  /** Comissão: login com e-mail + senha (não depende de e-mail para entrar). */
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  /**
   * Comissão: primeiro acesso — cria a própria conta com senha.
   * O papel vem do banco (allowlist de avaliadores); retorna needsConfirm
   * quando o projeto exige confirmação do e-mail antes do primeiro login.
   */
  signUp: (email: string, password: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  /**
   * Dispara o e-mail de redefinição de senha. O MESMO e-mail carrega as duas
   * formas de voltar (ver o bloco "O CÓDIGO NUMÉRICO" abaixo): o código
   * numérico, que é o caminho principal, e o link, que volta sempre para
   * `#/nova-senha` e continua existindo para quem já tem um na caixa de entrada.
   */
  resetPassword: (email: string) => Promise<{ error?: string }>;
  /**
   * Verifica o CÓDIGO NUMÉRICO do e-mail de redefinição. Em caso de
   * sucesso abre a sessão de recuperação (o mesmo estado que o link produzia) e
   * `recovery` vira true, liberando a tela de definir a nova senha.
   */
  verificarCodigo: (email: string, codigo: string) => Promise<{ error?: string }>;
  /** Define/troca a senha do usuário logado (ou em recuperação). */
  updatePassword: (password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

/* ========================================================================== *
 * O CÓDIGO NUMÉRICO
 *
 * POR QUE ELE EXISTE. O link de redefinição é de USO ÚNICO e chegava GASTO:
 * medimos o e-mail passando pelo rastreador de cliques da Brevo (sendibt3.com)
 * e pelo Safe Links da Microsoft, que ABREM a URL antes do clique humano — a
 * própria documentação da Microsoft diz que as URLs são varridas antes da
 * entrega, e a Brevo só permite desligar o rastreamento em transacional no
 * plano Enterprise. Resultado em produção: a pessoa clicava, o Supabase
 * recusava o código já queimado e (pior) o `/verify` do GoTrue SOBRESCREVIA o
 * fragmento da URL, jogando fora a rota `#/nova-senha` e deixando a pessoa na
 * home, sem mensagem nenhuma.
 *
 * O código numérico resolve a RAIZ do problema: nenhum robô "clica" num
 * número. Ele não é URL, não é varrido, não é reescrito e não depende do
 * navegador em que o pedido saiu (o link PKCE depende — o `code_verifier` fica
 * guardado no navegador que pediu).
 *
 * COMO O SUPABASE ENTREGA. O template "Reset password" expõe `{{ .Token }}`,
 * que é exatamente esse código numérico (6 a 10 dígitos, conforme o painel), ao lado de `{{ .ConfirmationURL }}`
 * e `{{ .TokenHash }}`. Trocar o corpo do template para mostrar `{{ .Token }}`
 * faz o e-mail virar código sem mexer em mais nada do lado do servidor.
 *
 * COMO SE VERIFICA. `supabase.auth.verifyOtp({ email, token, type: 'recovery' })`.
 * O SDK faz um POST direto em `/verify` levando só e-mail + token + tipo: NÃO
 * usa o `code_verifier` do PKCE, e por isso o `flowType: "pkce"` deste projeto
 * (ver supabaseClient.ts) não interfere — o código funciona em qualquer
 * navegador e em qualquer aparelho. Quando dá certo o SDK grava a sessão e
 * emite `PASSWORD_RECOVERY`, o mesmo evento que o link emitia; daí para a
 * frente o fluxo é idêntico ao antigo.
 *
 * PRAZOS E LIMITES (padrão do Supabase, confirmados na documentação):
 *   - o código expira em 1 HORA;
 *   - só se pode PEDIR um novo a cada 60 segundos;
 *   - pedir um novo INVALIDA o anterior (é o mesmo campo no banco);
 *   - não há contador público de tentativas por código — o que existe é o
 *     limite de requisições do endpoint `/verify`. Por isso `tentativasRestantes`
 *     abaixo é defensiva: mostra o número SE a API algum dia mandar um.
 *
 * SEGURANÇA. O código é credencial de uso único: nunca vai para console.log,
 * nunca entra na URL e nunca é guardado em storage nenhum. Só o E-MAIL é
 * lembrado (em sessionStorage, ver `lembrarEmailDeRecuperacao`).
 * ========================================================================== */

/**
 * A FAIXA de dígitos que `{{ .Token }}` pode ter — nunca um número exato.
 *
 * O comprimento do OTP é CONFIGURAÇÃO DO PAINEL do Supabase (Authentication →
 * Providers → Email → "Email OTP length", de 6 a 10), não uma constante da
 * plataforma. A primeira versão deste arquivo fixou 6 — e o projeto está em 8:
 * o campo truncava a colagem no sexto dígito, o envio falhava com "código
 * incorreto", e a tela ainda garantia à pessoa que "o código tem seis dígitos"
 * com o código de oito na frente dela (medido em 07/08/2026, e-mail real).
 * O cliente aceita a faixa inteira exatamente para que uma mudança no painel
 * nunca mais derrube a redefinição de senha.
 */
export const CODIGO_MIN = 6;
export const CODIGO_MAX = 10;

/**
 * Extrai o código numérico do que a pessoa digitou OU COLOU.
 *
 * Colar é o caso comum: quem lê o e-mail no celular seleciona o número com o
 * dedo e leva junto um espaço, um traço ou a frase inteira. Duas regras, nesta
 * ordem:
 *
 *  1. Tirando espaços, pontos e traços, sobrou só dígito? Então é o código —
 *     cobre "123456", "123 456", "123-456", "123.456" e a digitação normal.
 *  2. Sobrou letra (a pessoa colou a linha inteira do e-mail): procura no texto
 *     CRU um único grupo com cara de código (6 a 10 dígitos). É de propósito
 *     que o texto cru não tenha os separadores removidos aqui — assim uma data
 *     "2026-08" continua sendo dois grupos ("2026" e "08") e não vira um falso
 *     código. Havendo zero ou mais de um candidato, junta os dígitos e corta:
 *     ambíguo demais para adivinhar, e o campo fica visível para a pessoa
 *     corrigir.
 */
export function normalizarCodigo(bruto: string): string {
  const texto = (bruto ?? "").trim();
  // Espaço (de qualquer tipo), ponto e traço — inclusive os traços tipográficos
  // U+2010…U+2015, que é o que um cliente de e-mail em HTML costuma inserir.
  const compacto = texto.replace(/[\s.\-‐-―]+/g, "");
  if (/^\d*$/.test(compacto)) return compacto.slice(0, CODIGO_MAX);

  const grupos = texto.match(/\d+/g) ?? [];
  const comCaraDeCodigo = grupos.filter((g) => g.length >= CODIGO_MIN && g.length <= CODIGO_MAX);
  if (comCaraDeCodigo.length === 1) return comCaraDeCodigo[0];
  return grupos.join("").slice(0, CODIGO_MAX);
}

/** "" quando o código está pronto para ser enviado; senão, o que falta. */
export function codigoIssue(bruto: string): string {
  const limpo = normalizarCodigo(bruto);
  if (!limpo) return "Digite o código numérico que chegou no seu e-mail.";
  // A mensagem NÃO afirma quantos dígitos o código tem — o cliente não sabe
  // (é configuração do servidor). Diz o que dá para saber: ficou curto.
  if (limpo.length < CODIGO_MIN)
    return `O código ficou incompleto: você digitou ${limpo.length} dígito(s). Copie o número inteiro do e-mail.`;
  return "";
}

/**
 * Segundos que o GoTrue manda esperar antes do PRÓXIMO envio
 * ("For security purposes, you can only request this after 51 seconds.").
 * null quando a mensagem não traz número.
 */
export function segundosDeEspera(message: string): number | null {
  const achado = /(\d+)\s*seconds?\b/i.exec(message ?? "");
  if (!achado) return null;
  const n = Number(achado[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Tentativas restantes, SE a API disser quantas ("2 attempts remaining",
 * "3 more attempts"). Hoje o GoTrue não devolve esse número para OTP de
 * e-mail; a função existe para que, no dia em que devolver, a pessoa leia o
 * aviso em vez de descobrir o bloqueio na tentativa seguinte.
 */
export function tentativasRestantes(message: string): number | null {
  const achado = /(\d+)\s+(?:more\s+)?attempts?(?:\s+(?:remaining|left))?/i.exec(message ?? "");
  if (!achado) return null;
  const n = Number(achado[1]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** De onde veio o erro: do clique num link ou da digitação do código. */
export type ContextoErro = "link" | "codigo";

/**
 * Traduz os erros mais comuns do Supabase Auth para PT-BR.
 *
 * `contexto` existe porque o GoTrue usa A MESMA mensagem ("expired or is
 * invalid") para o link e para o código, e mandar quem digitou o código
 * "pedir um link novo" é instrução errada. `code` é o `AuthError.code`
 * (`otp_expired`, `over_email_send_rate_limit`, …), mais estável que o texto:
 * quando existe, ele entra na busca junto com a mensagem.
 */
export function ptError(message: string, contexto: ContextoErro = "link", code?: string): string {
  const m = `${code ?? ""} ${message}`.toLowerCase();
  const porCodigo = contexto === "codigo";
  const alvo = porCodigo ? "código" : "link";

  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";

  // Limite de ENVIO (60 s entre pedidos). Vem antes do limite genérico porque a
  // mensagem do GoTrue não contém a expressão "rate limit".
  if (m.includes("over_email_send_rate_limit") || m.includes("you can only request this after")) {
    const seg = segundosDeEspera(message);
    return seg
      ? `Aguarde ${seg} segundo${seg === 1 ? "" : "s"} para pedir outro ${alvo}: o servidor de e-mail só aceita um pedido por vez.`
      : `Aguarde cerca de um minuto para pedir outro ${alvo}: o servidor de e-mail só aceita um pedido por vez.`;
  }

  // TENTATIVAS DEMAIS.
  if (m.includes("rate limit") || m.includes("over_request_rate_limit") || m.includes("too many requests")) {
    return porCodigo
      ? "Tentativas demais em pouco tempo. Espere alguns minutos e digite o código de novo. Ele continua valendo até expirar."
      : "Muitas tentativas, aguarde alguns minutos e tente novamente.";
  }

  /* SENHA REPETIDA VEM ANTES DA SENHA FRACA, e não é detalhe: a mensagem real
     do GoTrue é "New password should be different from the old password.", que
     contém "password should be" e caía na tradução de senha fraca — a pessoa
     lia "não atende aos requisitos mínimos" depois de digitar uma senha longa e
     perfeitamente válida, e não tinha como adivinhar que o problema era ser a
     mesma de antes. */
  if (m.includes("same password") || m.includes("same_password") || m.includes("different from the old"))
    return "A nova senha precisa ser diferente da atual.";
  if (m.includes("password should be") || m.includes("password is too weak") || m.includes("weak_password"))
    return "A senha não atende aos requisitos mínimos (10+ caracteres).";
  if (m.includes("email not confirmed")) return "E-mail ainda não confirmado, verifique sua caixa de entrada.";

  if (porCodigo) {
    if (m.includes("user_not_found") || m.includes("user not found"))
      return "Não foi possível validar este código para esse e-mail. Confira se o endereço digitado é exatamente o que recebeu a mensagem.";
    if (m.includes("validation_failed"))
      return "O código é só números, sem espaços nem letras. Copie o número inteiro do e-mail.";
    // CÓDIGO ERRADO OU EXPIRADO. O GoTrue devolve a MESMA resposta para os dois
    // ("Token has expired or is invalid", código `otp_expired`), então o texto
    // precisa cobrir as duas hipóteses — e a terceira, que é a mais comum na
    // prática: a pessoa pediu outro código e digitou o do e-mail antigo.
    if (
      m.includes("otp_expired") ||
      m.includes("expired") ||
      m.includes("invalid token") ||
      m.includes("invalid_credentials")
    ) {
      const restam = tentativasRestantes(message);
      const base =
        "Código incorreto ou expirado. Confira o código do e-mail MAIS RECENTE: pedir um código novo cancela o anterior, e cada código vale por 1 hora.";
      return restam === null
        ? base
        : `${base} Resta${restam === 1 ? "" : "m"} ${restam} tentativa${restam === 1 ? "" : "s"}.`;
    }
  }

  // PKCE: o "code verifier" fica no navegador que PEDIU o link. Abrir o e-mail
  // em outro navegador (ou outro aparelho) chega até o servidor e falha aqui.
  // O código numérico não tem essa limitação — daí a saída sugerida.
  if (m.includes("code verifier") || m.includes("code_verifier"))
    return "Abra o link de redefinição no MESMO navegador em que você pediu a nova senha (o mesmo aparelho e o mesmo perfil). Ou, mais simples, use o código numérico do mesmo e-mail.";
  if (m.includes("flow state") || m.includes("flow_state"))
    return "Este link de redefinição não vale mais: ele expira e só pode ser usado uma vez. Use o código numérico do mesmo e-mail, ou peça um envio novo.";
  if (m.includes("expired") || m.includes("invalid or has expired"))
    return "Este link de redefinição expirou ou já foi usado. Use o código numérico do mesmo e-mail, ou peça um envio novo.";
  if (m.includes("auth session missing") || m.includes("session_not_found"))
    return "Não há sessão de redefinição ativa: digite o código numérico do e-mail ou peça um envio novo.";
  return message;
}

/* -------------------------------------------------------------------------- *
 * O E-MAIL LEMBRADO ENTRE A TELA QUE PEDE E A TELA QUE DIGITA
 *
 * Verificar o código exige o e-mail junto (`verifyOtp` recebe os dois). Quem
 * acabou de pedir a redefinição no AuthCard já digitou o endereço uma vez, e
 * pedir de novo, na tela seguinte, é atrito puro — pior ainda no celular.
 *
 * Guardamos SÓ O E-MAIL, e em `sessionStorage`: morre quando a aba fecha e não
 * atravessa sessões nem perfis. Não vai para a URL (endereço de e-mail em
 * fragmento vaza no histórico e em link compartilhado) e o CÓDIGO não é
 * guardado em lugar nenhum — ele é credencial de uso único e vive apenas no
 * estado do formulário.
 * -------------------------------------------------------------------------- */

const CHAVE_EMAIL_RECUPERACAO = "inct.recuperacao.email";

export function lembrarEmailDeRecuperacao(email: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHAVE_EMAIL_RECUPERACAO, email.trim().toLowerCase());
  } catch {
    /* navegação privada ou storage bloqueado: seguir sem lembrar é aceitável —
       a tela do código pede o e-mail quando não o conhece. */
  }
}

export function emailDeRecuperacaoLembrado(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(CHAVE_EMAIL_RECUPERACAO) ?? "";
  } catch {
    return "";
  }
}

export function esquecerEmailDeRecuperacao(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CHAVE_EMAIL_RECUPERACAO);
  } catch {
    /* idem */
  }
}

/**
 * Troca o `code` do PKCE por sessão À MÃO.
 *
 * Só é preciso quando o code chegou DENTRO do fragmento
 * (`https://site/#/nova-senha?code=…`): nessa forma o SDK não o enxerga
 * (ver a explicação em `novaSenhaRedirectUrl`, em src/webinars/router.ts) e,
 * sem esta chamada, a pessoa vê a tela de senha sem sessão nenhuma por trás.
 * Quando o code vem na query real o SDK já resolveu sozinho — chamar de novo
 * queimaria um code já usado, então quem chama precisa checar `codeNaHash`.
 */
export async function trocarCodePorSessao(code: string): Promise<{ error?: string }> {
  const { error } = await supabase().auth.exchangeCodeForSession(code);
  if (error) return { error: ptError(error.message) };
  return {};
}

/**
 * Sessão + perfil (papel) do usuário. Dois modos de entrada:
 * candidatos usam link mágico; a comissão usa e-mail + senha.
 */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(platformEnabled);
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!platformEnabled) return;
    const sb = supabase();

    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (!next) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!platformEnabled || !session) return;
    let cancelled = false;
    supabase()
      .from("profiles")
      .select("id, email, full_name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        if (!cancelled) {
          setProfile((data as Profile) ?? null);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Informe um e-mail válido." };
    const { error } = await supabase().auth.signInWithOtp({
      email: clean,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) return { error: ptError(error.message) };
    setOtpSentTo(clean);
    return {};
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Informe um e-mail válido." };
    if (!password) return { error: "Informe a senha." };
    const { data, error } = await supabase().auth.signInWithPassword({ email: clean, password });
    if (error) return { error: ptError(error.message) };
    // Conta ANTIGA (criada antes da marca existir) que acabou de PROVAR que tem
    // senha: grava a marca uma única vez, para que uma volta futura por
    // link/código também esconda o convite. Fire-and-forget deliberado — o amr
    // desta sessão já resolve a UI de agora, e login não pode ficar mais lento
    // por causa de uma flag de conveniência.
    if (data.user && data.user.user_metadata?.senha_definida !== true) {
      void supabase().auth.updateUser({ data: { senha_definida: true } });
    }
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Informe um e-mail válido." };
    const { data, error } = await supabase().auth.signUp({
      email: clean,
      password,
      // senha_definida: a marca que temSenhaAtiva() lê — signUp SEMPRE cria senha.
      options: { emailRedirectTo: window.location.href, data: { senha_definida: true } },
    });
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("already registered"))
        return { error: "Já existe conta com este e-mail: use “Entrar” ou “Esqueci a senha”." };
      return { error: ptError(error.message) };
    }
    // Sem sessão = o projeto exige confirmação do e-mail (um clique no link).
    return { needsConfirm: !data.session };
  }, []);

  /*
   * O MESMO envio serve aos dois caminhos, e é assim de propósito enquanto os
   * dois formatos convivem: o e-mail traz o código numérico (caminho
   * principal) E o link (`redirectTo`), que continua valendo para quem já tem
   * um na caixa de entrada. Tirar o `redirectTo` daqui quebraria, hoje, todo
   * e-mail antigo ainda não aberto.
   */
  const resetPassword = useCallback(async (email: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) return { error: "Informe um e-mail válido." };
    /* O destino é a ROTA PRÓPRIA `#/nova-senha`, montada em URL absoluta — e
       NÃO `window.location.href`. O porquê (endereço estável, query antes do
       fragmento, nada de query/hash antigas de carona) está documentado em
       `novaSenhaRedirectUrl`, em src/webinars/router.ts: leia lá antes de
       trocar esta linha. Foi exatamente daqui que veio o defeito em que o link
       do e-mail abria a página inicial e não havia tela para definir a senha. */
    const { error } = await supabase().auth.resetPasswordForEmail(clean, {
      redirectTo: novaSenhaRedirectUrl(),
    });
    if (error) return { error: ptError(error.message) };
    return {};
  }, []);

  /*
   * VERIFICAR O CÓDIGO NUMÉRICO.
   *
   * `verifyOtp` faz um POST em `/verify` com e-mail + token + tipo, sem tocar no
   * `code_verifier` do PKCE — por isso funciona em qualquer navegador e em
   * qualquer aparelho, ao contrário do link. Dando certo, o SDK grava a sessão e
   * emite `PASSWORD_RECOVERY`; `setRecovery(true)` aqui é redundante de
   * propósito, para a tela não depender da ordem de chegada do evento.
   *
   * O `codigo` NÃO é registrado em lugar nenhum (nem em erro, nem em log).
   */
  const verificarCodigo = useCallback(async (email: string, codigo: string) => {
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean))
      return { error: "Informe o e-mail que recebeu o código." };
    const token = normalizarCodigo(codigo);
    const problema = codigoIssue(token);
    if (problema) return { error: problema };

    const { data, error } = await supabase().auth.verifyOtp({ email: clean, token, type: "recovery" });
    if (error) return { error: ptError(error.message, "codigo", error.code) };
    /* Sem sessão o `updateUser` seguinte não teria como autenticar. Não deveria
       acontecer (o /verify de recuperação devolve sessão), mas é melhor dizer
       isso do que mostrar um formulário de senha que falharia no salvar. */
    if (!data.session)
      return { error: "O código foi aceito, mas a sessão não abriu. Peça outro código e tente de novo." };

    setRecovery(true);
    esquecerEmailDeRecuperacao();
    return {};
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    // A senha e a marca `senha_definida` viajam na MESMA chamada: é a marca
    // que faz o convite "definir uma senha" sumir nas próximas visitas de quem
    // voltar por link/código (temSenhaAtiva lê as duas fontes).
    const { error } = await supabase().auth.updateUser({ password, data: { senha_definida: true } });
    if (error) return { error: ptError(error.message) };
    setRecovery(false);
    return {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
    setProfile(null);
    setOtpSentTo(null);
    setRecovery(false);
    esquecerEmailDeRecuperacao();
  }, []);

  return {
    session,
    profile,
    loading,
    otpSentTo,
    recovery,
    signIn,
    signInWithPassword,
    signUp,
    resetPassword,
    verificarCodigo,
    updatePassword,
    signOut,
  };
}
