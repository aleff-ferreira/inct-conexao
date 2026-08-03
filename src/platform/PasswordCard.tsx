import { useState } from "react";
import { CheckCircle2, KeyRound } from "lucide-react";
import { passwordIssue } from "./validation";

/**
 * Definir/trocar senha. Usado tanto pela comissão (aba "Trocar senha") quanto
 * pelos candidatos ao chegarem por um link de redefinição (auth.recovery) —
 * por isso vive em módulo próprio, compartilhado.
 */
export default function PasswordCard({
  title,
  cta,
  onSubmit,
}: {
  title: string;
  cta: string;
  onSubmit: (password: string) => Promise<{ error?: string }>;
}) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="plat-card plat-login">
      <KeyRound size={22} aria-hidden="true" />
      <h2>{title}</h2>
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
          const { error } = await onSubmit(senha);
          setBusy(false);
          if (error) setMsg(error);
          else {
            setMsg("");
            setOk(true);
            setSenha("");
            setConfirmar("");
          }
        }}
      >
        <label>
          Nova senha
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
          Confirmar a nova senha
          <input
            type="password"
            required
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            autoComplete="new-password"
          />
        </label>
        {msg ? <p className="plat-error">{msg}</p> : null}
        {ok ? (
          <p className="plat-ok">
            <CheckCircle2 size={16} aria-hidden="true" /> Senha definida com sucesso: já vale no próximo login.
          </p>
        ) : null}
        <div className="plat-nav">
          <span />
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? "Salvando…" : cta} <KeyRound size={15} aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );
}
