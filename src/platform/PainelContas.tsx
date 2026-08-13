import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import {
  addToAllowlist,
  listAllowlist,
  listProfiles,
  removeFromAllowlist,
  setProfileRole,
} from "./api";
import { parseEmailList } from "./validation";
import type { Profile, StaffAllowlistEntry } from "./types";

/**
 * Administração de Contas (#/gestao?area=contas) — o antigo card "Equipe" da
 * aba do Processo Seletivo, promovido a painel próprio na migração 012.
 *
 * POR QUE UM PAINEL SEPARADO: gerir CONTAS (quem entra no site e com que
 * papel) não é tarefa de um processo seletivo específico — é governança do
 * site inteiro. O painel é exclusivo de SuperAdministradores, e a exclusão
 * não é só visual: as políticas RLS da 012 devolvem zero linhas da allowlist
 * e negam escrita em papéis a quem não é superadmin. Este componente é a
 * janela; a fechadura fica no banco.
 *
 * O papel SuperAdministrador(a) herda tudo que Administrador(a) pode em todo
 * o site (is_admin() da 012 inclui superadmin) e soma a gerência de contas.
 */

const ROLE_LABEL: Record<Profile["role"], string> = {
  superadmin: "SuperAdministrador(a)",
  admin: "Administrador(a)",
  avaliador: "Avaliador(a)",
  candidato: "Candidato(a)",
};

export default function PainelContas({ myId }: { myId: string }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [allowlist, setAllowlist] = useState<StaffAllowlistEntry[]>([]);
  const [paste, setPaste] = useState("");
  const [pasteRole, setPasteRole] = useState<StaffAllowlistEntry["role"]>("avaliador");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteMsg, setPasteMsg] = useState("");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    listProfiles().then(setProfiles).catch((e) => setMsg(e instanceof Error ? e.message : "Falha ao carregar."));
    listAllowlist().then(setAllowlist).catch(() => setAllowlist([]));
  }, []);

  const addEmails = async () => {
    const { valid, invalid } = parseEmailList(paste);
    if (!valid.length) {
      setPasteMsg(invalid.length ? `Nenhum e-mail válido. Confira: ${invalid.join(", ")}` : "Cole ao menos um e-mail.");
      return;
    }
    setPasteBusy(true);
    try {
      const promoted = await addToAllowlist(valid, pasteRole);
      setAllowlist(await listAllowlist());
      setProfiles(await listProfiles());
      setPaste("");
      setPasteMsg(
        `${valid.length} e-mail(s) pré-autorizados como ${ROLE_LABEL[pasteRole]}` +
          (promoted ? `; ${promoted} conta(s) existente(s) promovida(s)` : "") +
          (invalid.length ? `. Ignorados (inválidos): ${invalid.join(", ")}` : "."),
      );
    } catch (e) {
      setPasteMsg(e instanceof Error ? e.message : "Falha ao salvar a lista.");
    } finally {
      setPasteBusy(false);
    }
  };

  const rows = (profiles ?? []).filter(
    (p) => !q || `${p.email} ${p.full_name ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="plat-eval">
      <div className="plat-card">
        <h3>
          <UserPlus size={18} aria-hidden="true" /> Pré-autorizar acesso
        </h3>
        <p className="plat-hint">
          Cole os e-mails (um por linha, ou separados por vírgula). Quem estiver na lista cria a
          própria conta em <strong>#/gestao → “Primeiro acesso? Criar conta”</strong> e já nasce com o papel
          escolhido: sem senha temporária e sem painel do Supabase. Quem já tinha conta de candidato é
          promovido na hora.
        </p>
        <textarea
          className="plat-paste"
          rows={4}
          placeholder={"avaliadora1@instituicao.br\navaliador2@instituicao.br"}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <div className="plat-nav">
          <select
            className="plat-role-select"
            value={pasteRole}
            onChange={(e) => setPasteRole(e.target.value as StaffAllowlistEntry["role"])}
            aria-label="Papel para os e-mails colados"
          >
            <option value="avaliador">Avaliador(a)</option>
            <option value="admin">Administrador(a)</option>
            <option value="superadmin">SuperAdministrador(a)</option>
          </select>
          <button className="button primary" onClick={addEmails} disabled={pasteBusy}>
            {pasteBusy ? "Salvando…" : "Adicionar à lista"} <UserPlus size={15} aria-hidden="true" />
          </button>
        </div>
        {pasteMsg ? <p className="plat-ok">{pasteMsg}</p> : null}
        {allowlist.length ? (
          <ul className="plat-allowlist">
            {allowlist.map((a) => (
              <li key={a.email}>
                <span>
                  {a.email} <small>({ROLE_LABEL[a.role]})</small>
                </span>
                <button
                  className="plat-linkbtn"
                  title="Remover da lista (não rebaixa quem já criou conta)"
                  onClick={async () => {
                    await removeFromAllowlist(a.email);
                    setAllowlist((prev) => prev.filter((x) => x.email !== a.email));
                  }}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="plat-empty">Nenhum e-mail pré-autorizado ainda.</p>
        )}
      </div>

      <div className="plat-card">
        <h3>Contas e papéis</h3>
        <p className="plat-hint">
          Todas as contas do site e seus papéis. Ninguém altera o próprio papel, nem
          SuperAdministradores(as), e o banco impede rebaixar o último SuperAdministrador,
          para o site nunca ficar sem quem possa gerir contas.
        </p>
        <div className="plat-filters">
          <input placeholder="Buscar por e-mail ou nome…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {msg ? <p className="plat-error">{msg}</p> : null}
        {profiles === null ? (
          <p className="plat-empty">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="plat-empty">Nenhum perfil encontrado.</p>
        ) : (
          <div className="edital-table-wrap">
            <table className="edital-table">
              <thead>
                <tr>
                  <th>E-mail</th>
                  <th>Nome</th>
                  <th>Papel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td data-label="E-mail">{p.email}</td>
                    <td data-label="Nome">{p.full_name || "n/d"}</td>
                    <td data-label="Papel">
                      {p.id === myId ? (
                        <span title="Você não pode alterar o próprio papel.">{ROLE_LABEL[p.role]} (você)</span>
                      ) : (
                        <select
                          className="plat-role-select"
                          value={p.role}
                          onChange={async (e) => {
                            const role = e.target.value as Profile["role"];
                            try {
                              await setProfileRole(p.id, role);
                              setProfiles((prev) => prev?.map((x) => (x.id === p.id ? { ...x, role } : x)) ?? null);
                              setMsg("");
                            } catch (err) {
                              setMsg(err instanceof Error ? err.message : "Falha ao salvar o papel.");
                            }
                          }}
                        >
                          {(Object.keys(ROLE_LABEL) as Profile["role"][]).map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABEL[r]}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
