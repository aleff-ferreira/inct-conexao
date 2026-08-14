/**
 * ============================================================================
 *  Zona de exclusão DEFINITIVA de uma inscrição (LGPD), só SuperAdministrador
 * ============================================================================
 *  Usada nas fichas dos painéis de inscrição (Curso, Fitofarmas, Processo
 *  Seletivo). O apagamento é COMPLETO e IRREVERSÍVEL: a RPC da migração 015
 *  remove a linha, as versões arquivadas e tudo que a acompanha. Não existe
 *  lixeira nem desfazer, e é assim de propósito (pedido do dono, 13/08/2026):
 *  atender um pedido LGPD de exclusão significa não guardar cópia nenhuma.
 *
 *  SALVAGUARDAS DESTA TELA (a permissão real é a RPC, que exige superadmin):
 *   1. A zona só é RENDERIZADA para superadmin (quem monta decide via prop).
 *   2. Dois passos: o botão abre um aviso; nada é apagado no primeiro clique.
 *   3. Digitar a confirmação (o protocolo) arma o botão final. A comparação
 *      ignora maiúsculas (teclado de celular capitaliza sozinho) e colar
 *      funciona; a ideia não é dificultar, é impedir o clique distraído.
 *      Confirmação VAZIA nunca arma o botão.
 *   4. Se a exclusão terminar com pendência (ex.: PDFs que a Storage API não
 *      removeu), o aviso fica na tela até o "Entendi": nada se fecha em
 *      silêncio por cima de dado pessoal remanescente.
 *   5. Foco: abrir leva ao campo de confirmação; cancelar devolve ao botão.
 *      Erros e avisos saem em role="alert".
 * ============================================================================
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from "lucide-react";

export type ResultadoApagar = {
  ok: boolean;
  mensagem: string;
  /** Pendência pós-sucesso (ex.: PDFs que restaram no bucket). Fica na tela. */
  aviso?: string;
};

export function ApagarDefinitivo({
  alvo,
  confirmacao,
  detalhes,
  aoApagar,
  aoApagada,
}: {
  /** O que vai ser apagado, por extenso. Ex.: "a inscrição CBIO-0001, de Fulana". */
  alvo: string;
  /** Texto que a pessoa digita para armar o botão (em geral o protocolo). */
  confirmacao: string;
  /** Frase extra do módulo. Ex.: "A vaga volta a contar como livre na hora.". */
  detalhes?: string;
  /** Chama a RPC de exclusão. Nunca deve lançar: devolve { ok, mensagem, aviso? }. */
  aoApagar: () => Promise<ResultadoApagar>;
  /** Pós-sucesso: fechar a ficha e recarregar a lista. */
  aoApagada: () => void;
}) {
  const [aberta, setAberta] = useState(false);
  const [digitado, setDigitado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [avisoFinal, setAvisoFinal] = useState("");
  const jaAbriu = useRef(false);
  const abrirRef = useRef<HTMLButtonElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  // Foco acompanha a troca de árvore: abrir leva ao campo; fechar devolve ao
  // botão (só depois da primeira abertura, para não roubar o foco no mount).
  useEffect(() => {
    if (aberta) {
      campoRef.current?.focus();
    } else if (jaAbriu.current) {
      abrirRef.current?.focus();
    }
  }, [aberta]);

  const chave = (s: string) => s.trim().toLocaleUpperCase("pt-BR");
  const armada = chave(confirmacao).length > 0 && chave(digitado) === chave(confirmacao);
  const naoConfere = digitado.trim().length > 0 && !armada;

  const apagar = () => {
    if (!armada || ocupado) return;
    setOcupado(true);
    setErro("");
    aoApagar()
      .then((r) => {
        setOcupado(false);
        if (!r.ok) {
          setErro(r.mensagem);
        } else if (r.aviso) {
          setAvisoFinal(r.aviso);
        } else {
          aoApagada();
        }
      })
      .catch(() => {
        // Rede de segurança: aoApagar promete não lançar, mas se lançar a
        // zona não pode ficar travada em "Apagando…" para sempre.
        setOcupado(false);
        setErro("Não foi possível apagar agora. Tente de novo em instantes.");
      });
  };

  if (avisoFinal) {
    return (
      <div className="plat-apagar plat-apagar-aviso" role="alert">
        <p>
          <CheckCircle2 size={15} aria-hidden="true" /> <strong>Apagado, com uma pendência.</strong>{" "}
          {avisoFinal}
        </p>
        <div className="plat-apagar-acoes">
          <button type="button" className="button plat-ghost" onClick={aoApagada}>
            Entendi, voltar à lista
          </button>
        </div>
      </div>
    );
  }

  if (!aberta) {
    return (
      <div className="plat-apagar">
        <button
          ref={abrirRef}
          type="button"
          className="button plat-ghost plat-apagar-abrir"
          onClick={() => {
            jaAbriu.current = true;
            setAberta(true);
          }}
        >
          <Trash2 size={14} aria-hidden="true" /> Apagar definitivamente (LGPD)
        </button>
      </div>
    );
  }

  return (
    <div className="plat-apagar plat-apagar-aviso" role="group" aria-label="Exclusão definitiva" aria-busy={ocupado}>
      <p>
        <AlertTriangle size={15} aria-hidden="true" /> <strong>Isto apaga de vez {alvo}.</strong> Some a linha,
        somem as versões arquivadas e tudo que a acompanha. Não existe lixeira nem desfazer.{" "}
        {detalhes ? `${detalhes} ` : ""}
        Digite <code>{confirmacao}</code> para liberar o botão.
      </p>
      <div className="plat-apagar-acoes">
        <input
          ref={campoRef}
          type="text"
          value={digitado}
          onChange={(e) => setDigitado(e.target.value)}
          placeholder={confirmacao}
          aria-label={`Digite ${confirmacao} para confirmar a exclusão`}
          aria-describedby={naoConfere ? "plat-apagar-hint" : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          disabled={ocupado}
        />
        <button type="button" className="button plat-perigo" onClick={apagar} disabled={!armada || ocupado}>
          {ocupado ? (
            <Loader2 size={14} aria-hidden="true" className="plat-apagar-spin" />
          ) : (
            <Trash2 size={14} aria-hidden="true" />
          )}
          {ocupado ? "Apagando…" : "Apagar de vez"}
        </button>
        <button
          type="button"
          className="button plat-ghost"
          onClick={() => {
            setAberta(false);
            setDigitado("");
            setErro("");
          }}
          disabled={ocupado}
        >
          Cancelar
        </button>
      </div>
      {naoConfere ? (
        <p id="plat-apagar-hint" className="plat-apagar-hint">
          O texto ainda não confere com <code>{confirmacao}</code> (maiúsculas e minúsculas não importam).
        </p>
      ) : null}
      {erro ? (
        <p className="plat-apagar-erro" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
