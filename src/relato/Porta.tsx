/**
 * A porta de entrada dos dois formulários de relato.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * A porta nasceu dentro de MeuAno.tsx e #/meu-laboratorio usava, no lugar dela,
 * o <AuthCard role="candidate"> da plataforma de seleções. O resultado é que o
 * líder de um Laboratório Associado abria o formulário do relatório anual e lia
 * "Entre para se inscrever", "sua inscrição fica salva até o fim do prazo" e um
 * convite a "Criar conta" — vocabulário do processo seletivo de bolsas, e um
 * caminho que não leva a lugar nenhum: quem não está em `ciclo_membros` não vira
 * membro do ciclo por auto-cadastro. O acesso vem do roster importado da
 * proposta; o login só reconhece quem já está lá.
 *
 * Extraído para módulo próprio, e não importado de MeuAno.tsx, porque importar
 * entre as duas telas faria o bundler juntá-las no mesmo chunk — e as duas somam
 * 224 kB de fonte, carregados sob demanda justamente para não pesar na home.
 *
 * O título e os parágrafos de abertura entram por props: o que muda entre as
 * duas telas é a conversa, não o mecanismo de entrada.
 */
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Mail } from "lucide-react";
import type { AuthState } from "../platform/auth";

export type PortaProps = {
  auth: AuthState;
  /** Vira o <h2> do cartão. */
  titulo: string;
  /** Os parágrafos de abertura — a conversa própria de cada formulário. */
  children: React.ReactNode;
};

export function Porta({ auth, titulo, children }: PortaProps) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"link" | "senha">("link");
  const [msg, setMsg] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const id = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [espera]);

  return (
    <div className="plat-card rel-porta">
      <h2>{titulo}</h2>

      {children}

      {auth.otpSentTo ? (
        <p className="plat-ok">
          <CheckCircle2 size={16} aria-hidden="true" /> Enviamos um link de entrada para{" "}
          <strong>{auth.otpSentTo}</strong>. Abra o e-mail <strong>neste mesmo navegador</strong> e clique no link.
        </p>
      ) : null}

      {modo === "link" ? (
        <form
          className="plat-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            setOcupado(true);
            const { error } = await auth.signIn(email);
            setOcupado(false);
            setMsg(error ?? "");
            if (!error) setEspera(60);
          }}
        >
          <div className="rel-campo">
            <label htmlFor="porta-email">Seu e-mail institucional</label>
            <input
              id="porta-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-describedby="porta-email-dica"
            />
            <small id="porta-email-dica" className="rel-dica">
              Use o mesmo e-mail em que recebeu o convite. É por ele que encontramos seu cadastro na equipe.
            </small>
          </div>
          {msg ? <p className="plat-error rel-erro">{msg}</p> : null}
          <div className="plat-nav rel-nav">
            <button type="button" className="plat-linkbtn" onClick={() => setModo("senha")}>
              Já tenho senha
            </button>
            <button className="button primary" type="submit" disabled={ocupado || espera > 0}>
              {ocupado
                ? "Enviando…"
                : espera > 0
                  ? `Reenviar em ${espera}s`
                  : auth.otpSentTo
                    ? "Me mande outro link"
                    : "Receber meu link de entrada"}{" "}
              <Mail size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : (
        <form
          className="plat-fields"
          onSubmit={async (e) => {
            e.preventDefault();
            setOcupado(true);
            const { error } = await auth.signInWithPassword(email, senha);
            setOcupado(false);
            setMsg(error ?? "");
          }}
        >
          <div className="rel-campo">
            <label htmlFor="porta-email-senha">E-mail</label>
            <input
              id="porta-email-senha"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="rel-campo">
            <label htmlFor="porta-senha">Senha</label>
            <input
              id="porta-senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {msg ? <p className="plat-error rel-erro">{msg}</p> : null}
          <div className="plat-nav rel-nav">
            <button type="button" className="plat-linkbtn" onClick={() => setModo("link")}>
              Prefiro receber um link
            </button>
            <button className="button primary" type="submit" disabled={ocupado}>
              {ocupado ? "Entrando…" : "Entrar"} <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
        </form>
      )}

      <AvisoDePrivacidade />
    </div>
  );
}

/** Aviso de privacidade, comum às duas telas. */
export function AvisoDePrivacidade() {
  return (
    <details className="rel-dica">
      <summary>Aviso de privacidade</summary>
      <p>
        Coletamos dados administrativos da equipe (nome, e-mail, vínculo, ORCID, ID Lattes) e o que você declarar de
        produção e atividades, para compor o relatório de resultados do INCT-CONEXAO e a prestação de contas ao CNPq.
        Não pedimos CPF, telefone, endereço nem data de nascimento.
      </p>
      <p>
        <strong>O que pode virar público:</strong> o seu resultado principal e o texto que você escrever para não
        especialistas. <strong>O que nunca é publicado:</strong> o campo de dificuldades, que vai direto ao Comitê
        Gestor e não passa pelo(a) líder do seu laboratório.
      </p>
      <p>
        Para acessar, corrigir ou pedir a eliminação dos seus dados, escreva para{" "}
        <a href="mailto:inctconexao@gmail.com">inctconexao@gmail.com</a>.
      </p>
    </details>
  );
}
