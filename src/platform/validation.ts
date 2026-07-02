/** Validações puras usadas no wizard de inscrição (testáveis sem UI). */

/** CPF com dígitos verificadores (aceita com ou sem máscara). */
export function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (slice: string, factor: number) => {
    let sum = 0;
    for (const ch of slice) sum += Number(ch) * factor--;
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) && digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function formatCpf(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
}

/** Link de vídeo aceitável: YouTube, Vimeo, Google Drive ou URL https genérica. */
export function isValidVideoUrl(raw: string): boolean {
  const url = raw.trim();
  if (!/^https:\/\/\S+$/i.test(url)) return false;
  try {
    const u = new URL(url);
    return Boolean(u.hostname);
  } catch {
    return false;
  }
}

export function isValidEmail(raw: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw.trim());
}

/** Períodos elegíveis do edital 04/2026: do 2º ao antepenúltimo. */
export const PERIODOS = ["2º", "3º", "4º", "5º", "6º", "7º", "8º", "9º", "10º"];

/**
 * Limite de tamanho por documento. Carta/plano/Lattes são PDFs gerados
 * digitalmente (pequenos); só o histórico costuma ser digitalizado.
 * Mantém o pior caso do processo (~200 inscrições) dentro do 1 GB do
 * plano gratuito do Supabase.
 */
export const DOC_MAX_BYTES: Record<string, number> = {
  carta: 1 * 1024 * 1024,
  plano: 1 * 1024 * 1024,
  historico: 2 * 1024 * 1024,
  lattes: 1 * 1024 * 1024,
};

export function docMaxLabel(kind: string): string {
  const bytes = DOC_MAX_BYTES[kind] ?? 1024 * 1024;
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/**
 * Regra mínima de senha da comissão (alinhe com Authentication → Passwords
 * no painel do Supabase: mínimo 10 + proteção contra senhas vazadas).
 * Retorna a mensagem do problema, ou "" se a senha está ok.
 */
export function passwordIssue(password: string, confirm?: string): string {
  if (password.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (confirm !== undefined && password !== confirm) return "As senhas não conferem.";
  return "";
}

/**
 * Interpreta uma lista colada de e-mails (separados por quebra de linha,
 * vírgula, ponto-e-vírgula ou espaço): normaliza para minúsculas, remove
 * duplicados e separa os inválidos.
 */
export function parseEmailList(raw: string): { valid: string[]; invalid: string[] } {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    (isValidEmail(t) ? valid : invalid).push(t);
  }
  return { valid, invalid };
}
