/**
 * Traduz erros crus do Postgres/PostgREST para mensagens amigáveis em PT-BR,
 * usadas na UI pública do candidato. Nunca renderize `error.message` direto:
 * "duplicate key value violates unique constraint..." assusta o candidato no
 * pior momento (dia da abertura) e some a orientação de como se recuperar.
 */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const m = raw.toLowerCase();

  // Inscrição já registrada (colisão no UNIQUE de protocolo ou de edital+usuário).
  if (m.includes("duplicate key") || m.includes("já foi registrada"))
    return "Sua inscrição já foi registrada. Recarregue a página para revisá-la ou editá-la.";

  // Protocolo não gerado (trigger ausente/indisponível) — não deixar vazar o
  // erro cru do Postgres; orientar a tentar de novo / avisar a coordenação.
  if (m.includes("not-null") || m.includes("null value in column \"protocolo\"") || m.includes("violates not-null"))
    return "Não foi possível gerar o protocolo agora. Tente enviar novamente em instantes. Se persistir, contate a coordenação.";

  // Janela do edital (trigger enforce_edital_window).
  if (m.includes("fora do período") || m.includes("edital não está aberto"))
    return "As inscrições não estão abertas neste momento. Confira o cronograma do processo seletivo.";

  // Rede (checar antes do schema cache: "failed to fetch" contém "fetch").
  if (m.includes("networkerror") || m.includes("failed to fetch") || m.includes("network request failed"))
    return "Falha de conexão. Verifique sua internet e tente novamente.";

  // Cache de schema do PostgREST / indisponibilidade temporária.
  if (m.includes("pgrst") || m.includes("schema cache"))
    return "Instabilidade temporária no servidor. Aguarde alguns instantes e tente novamente.";

  // Arquivo acima do limite / storage.
  if (m.includes("payload too large") || m.includes("exceeded the maximum"))
    return "Um dos arquivos excede o tamanho permitido. Reduza o PDF e tente novamente.";

  // Fallback: nossas próprias mensagens já são PT-BR e orientam o candidato
  // (ex.: "Envie o documento em PDF.") — passam direto; só o vazio vira genérico.
  return raw || "Não foi possível concluir. Tente novamente em instantes.";
}
