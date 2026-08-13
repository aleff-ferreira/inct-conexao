-- ============================================================================
--  INCT-CONEXAO · 014 — o documento da pesquisa é OBRIGATÓRIO para enviar
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001→013 (qualquer uma das 013; esta não toca
--  nas funções que a 013_identidade protege). IDEMPOTENTE: create or replace +
--  drop trigger if exists.
--
--  A DECISÃO (dono, 13/08/2026): o documento com dados da pesquisa (Word/PDF,
--  migração 011) deixou de ser opcional — sem ele o relato não pode ser
--  ENVIADO. A Tela 2 já bloqueia no cliente; este arquivo torna a regra
--  verdade DO BANCO, porque o envio é um UPDATE direto em `relatos` via
--  PostgREST e regra que só existe na tela é promessa, não garantia — o mesmo
--  raciocínio do `enforce_relato_window` (005), que é o molde deste trigger.
--
--  VALE PARA TODO MUNDO, coordenação inclusive: a decisão foi "obrigatório",
--  sem exceção. Se um dia a coordenação precisar enviar em nome de alguém sem
--  documento, o caminho é anexar o documento (ela pode), não furar a regra.
-- ============================================================================

create or replace function public.exigir_documento_no_envio()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Só na TRANSIÇÃO para 'enviado' (re-salvar um relato já enviado não
  -- reavalia): é o mesmo recorte do enforce_relato_window.
  if new.status = 'enviado' and old.status is distinct from 'enviado' then
    if not exists (select 1 from public.relato_arquivos a
                    where a.relato_id = new.id
                      and a.uso = 'comprovante') then
      -- O token DOCUMENTO_OBRIGATORIO é lido por erroDeRelato (api.ts), que
      -- devolve a frase amigável da tela. Mudar o token = mudar lá também.
      raise exception 'DOCUMENTO_OBRIGATORIO: anexe o documento com dados da sua pesquisa (Tela 2) antes de enviar.';
    end if;
  end if;
  return new;
end; $$;

revoke execute on function public.exigir_documento_no_envio() from public, anon, authenticated;

drop trigger if exists relatos_exige_documento on public.relatos;
create trigger relatos_exige_documento
  before update on public.relatos
  for each row execute function public.exigir_documento_no_envio();


-- ============================================================ SANIDADE ====
-- Esperado: 2 linhas, ok = true.
select * from (values
  ('trigger relatos_exige_documento existe e é BEFORE UPDATE',
     exists (select 1 from pg_trigger t
              where t.tgname = 'relatos_exige_documento'
                and t.tgrelid = 'public.relatos'::regclass
                and (t.tgtype & 2) = 2       -- BEFORE
                and (t.tgtype & 16) = 16)),  -- UPDATE
  ('a função exige comprovante na transição para enviado',
     (select prosrc like '%DOCUMENTO_OBRIGATORIO%'
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'exigir_documento_no_envio'))
) as sanidade(item, ok);
