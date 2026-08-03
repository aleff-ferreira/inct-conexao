import { useState } from "react";
import { CheckCircle2, KeyRound, Lock, Send } from "lucide-react";
import type { AuthState } from "./auth";
import { passwordIssue } from "./validation";

/**
 * Login por e-mail + SENHA (sem link mágico). Usado pela comissão e pelos
 * candidatos — nada precisa ser entregue ou clicado no e-mail para entrar, então
 * o login não depende de deliverability nem sofre com scanners de e-mail
 * institucional. Só "Esqueci a senha" usa e-mail (caso raro).
 */

type Role = "committee" | "candidate";

const COPY: Record<Role, { loginTitle: string; loginIntro: string; signupIntro: string; resetIntro: string }> = {
  committee: {
    loginTitle: "Acesso da comissão",
    loginIntro: "Entre com o e-mail e a senha da sua conta de avaliador(a).",
    signupIntro:
      "Use o e-mail que a coordenação pré-autorizou; sua conta já nasce com o papel de avaliador(a). Você define sua própria senha: nada de senhas temporárias.",
    resetIntro: "Informe o e-mail da sua conta da comissão; enviaremos um link para definir uma nova senha.",
  },
  candidate: {
    loginTitle: "Entre para se inscrever",
    loginIntro: "Entre com o e-mail e a senha da sua conta. Sua inscrição fica salva e você pode revisá-la até o fim do prazo.",
    signupIntro:
      "Crie sua conta com e-mail e senha para iniciar sua inscrição. Você poderá voltar e editar seus dados até o fim do prazo, guarde bem a sua senha.",
    resetIntro: "Informe o e-mail da sua conta; enviaremos um link para definir uma nova senha.",
  },
};

export default function AuthCard({ auth, role }: { auth: AuthState; role: Role }) {
  const copy = COPY[role];
  const [mode, setMode] = useState<"login" | "reset" | "reset-sent" | "signup" | "signup-sent">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  if (mode === "signup-sent") {
    return (
      <div className="plat-card plat-login">
        <CheckCircle2 size={22} aria-hidden="true" />
        <h2>Conta criada: confirme seu e-mail</h2>
        <p>
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail{" "}
          <strong>neste mesmo navegador</strong> e clique no link; depois é só entrar com sua senha.
        </p>
        <button className="plat-linkbtn" onClick={() => setMode("login")}>
          Voltar ao login
        </button>
      </div>
    );
  }

  if (mode === "signup") {
    return (
      <div className="plat-card plat-login">
        <KeyRound size={22} aria-hidden="true" />
        <h2>Primeiro acesso: criar conta</h2>
        <p>{copy.signupIntro}</p>
        <form
          className="plat-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            const issue = passwordIssue(senha, confirmar);
            if (issue) {
              setMsg(issue);
              return;
            }
            setBusy(true);
            const { error, needsConfirm } = await auth.signUp(email, senha);
            setBusy(false);
            if (error) setMsg(error);
            else if (needsConfirm) {
              setMsg("");
              setMode("signup-sent");
            }
            // com sessão imediata (confirmação de e-mail desligada), o próprio
            // estado de auth troca a tela para o wizard/portal.
          }}
        >
          <label>
            E-mail
            <input
              type="email"
              required
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              required
              minLength={10}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="new-password"
            />
            <small>Mínimo de 10 caracteres.</small>
          </label>
          <label>
            Confirmar a senha
            <input
              type="password"
              required
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          {msg ? <p className="plat-error">{msg}</p> : null}
          <div className="plat-nav">
            <button type="button" className="plat-linkbtn" onClick={() => setMode("login")}>
              Já tenho conta
            </button>
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? "Criando…" : "Criar conta"} <KeyRound size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (mode === "reset-sent") {
    return (
      <div className="plat-card plat-login">
        <CheckCircle2 size={22} aria-hidden="true" />
        <h2>Link de redefinição enviado</h2>
        <p>
          Enviamos um link para <strong>{email}</strong>. Abra o e-mail <strong>neste mesmo navegador</strong> e
          clique no link para definir a nova senha.
        </p>
        <button className="plat-linkbtn" onClick={() => setMode("login")}>
          Voltar ao login
        </button>
      </div>
    );
  }

  if (mode === "reset") {
    return (
      <div className="plat-card plat-login">
        <KeyRound size={22} aria-hidden="true" />
        <h2>Redefinir senha</h2>
        <p>{copy.resetIntro}</p>
        <form
          className="plat-inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { error } = await auth.resetPassword(email);
            setBusy(false);
            if (error) setMsg(error);
            else {
              setMsg("");
              setMode("reset-sent");
            }
          }}
        >
          <input
            type="email"
            required
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Seu e-mail"
          />
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Enviando…" : "Enviar link"} <Send size={16} aria-hidden="true" />
          </button>
        </form>
        {msg ? <p className="plat-error">{msg}</p> : null}
        <button className="plat-linkbtn" onClick={() => setMode("login")}>
          Voltar ao login
        </button>
      </div>
    );
  }

  return (
    <div className="plat-card plat-login">
      <Lock size={22} aria-hidden="true" />
      <h2>{copy.loginTitle}</h2>
      <p>{copy.loginIntro}</p>
      <form
        className="plat-fields"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await auth.signInWithPassword(email, senha);
          setBusy(false);
          setMsg(error ?? "");
        }}
      >
        <label>
          E-mail
          <input
            type="email"
            required
            placeholder="email@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {msg ? <p className="plat-error">{msg}</p> : null}
        <div className="plat-nav">
          <button type="button" className="plat-linkbtn" onClick={() => setMode("reset")}>
            Esqueci a senha
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"} <Lock size={15} aria-hidden="true" />
          </button>
        </div>
      </form>
      <button type="button" className="plat-linkbtn" onClick={() => setMode("signup")}>
        Primeiro acesso? Criar conta
      </button>
    </div>
  );
}
