-- ============================================================================
--  INCT-CONEXAO · 011 — Documento .docx da pesquisa como anexo do relato
-- ============================================================================
--  Rode no SQL Editor DEPOIS de 001..010.
--  IDEMPOTENTE: rodável duas vezes sem erro e sem duplicar nada — cada
--  constraint é precedida do seu DROP CONSTRAINT IF EXISTS, o bucket é upsert
--  com ON CONFLICT (padrão da 005 §14), o UPDATE do config tem WHERE que o
--  torna no-op na segunda passada e a policy segue o padrão DROP IF EXISTS.
--
--  O PEDIDO QUE ESTA MIGRAÇÃO IMPLEMENTA
--  -------------------------------------
--  "existe a necessidade de ser possivel o pesquisador anexar um documento
--  docx com dados de sua pesquisa que poderao ser utilizados no relatorio
--  anual do inct" — e a decisão já tomada: o documento fica NO SITE
--  (relato_arquivos + bucket 'relatos'), nunca por e-mail, para que a
--  coordenação o ACHE e BAIXE no painel. Anexo que só o dono vê é um buraco
--  negro igual à caixa de entrada.
--
--  AS DECISÕES DE DIMENSIONAMENTO (fechadas, não rediscutir aqui)
--  --------------------------------------------------------------
--   1. .docx (application/vnd.openxmlformats-officedocument.wordprocessingml
--      .document) entra APENAS com uso='comprovante'. Imagem publicável
--      continua JPEG/PNG — um .docx não é publicável no site.
--   2. Teto de 10 MB (10485760) SÓ para .docx; pdf/jpeg/png CONTINUAM em 1 MB
--      (1048576). O CHECK de bytes vira condicional por mime. O
--      file_size_limit do bucket sobe para 10485760 porque ele é GLOBAL por
--      bucket — a contenção por tipo fica no CHECK da tabela + validação do
--      cliente (enviarArquivo em src/relato/api.ts). Um pdf de 5 MB enviado
--      por fora do cliente passa no bucket mas QUEBRA no CHECK da tabela, e
--      sem a linha em relato_arquivos o binário é órfão invisível ao painel.
--   3. .doc legado (application/msword) NÃO entra — binário de 2003, ninguém
--      audita o conteúdo com ferramenta moderna; quem tiver, salva como .docx
--      (o cliente diz isso na microcopia).
--
--  ORÇAMENTO DE STORAGE — a conta que autorizou o teto
--  ---------------------------------------------------
--  O plano gratuito do Supabase dá 1 GB de storage. 209 pessoas × 10 MB de
--  docx = 2 GB TEÓRICOS — acima do teto. A aposta (deliberada) é adesão
--  parcial: nem todos anexam, e quem anexa raramente chega a 10 MB. O painel
--  da coordenação mostra o total usado, e a query de monitoramento é:
--
--      select uso, mime, count(*) as arquivos,
--             sum(bytes) as bytes, pg_size_pretty(sum(bytes)::bigint) as total
--        from public.relato_arquivos
--       group by uso, mime order by sum(bytes) desc;
--      -- total geral: select pg_size_pretty(sum(bytes)::bigint)
--      --                from public.relato_arquivos;
--
--  Se o total se aproximar de 1 GB, as opções são (nesta ordem): pedir
--  compressão aos maiores, baixar o teto do docx no config (o cliente lê
--  `anexos.max_bytes_docx` de lá — nenhum deploy), ou pagar o plano.
--
--  DADOS EXISTENTES — por que os CHECKs novos não quebram nada
--  -----------------------------------------------------------
--  ADD CONSTRAINT valida TODAS as linhas já gravadas. As linhas existentes
--  são todas pdf/jpeg/png ≤ 1048576 (era o CHECK antigo): elas satisfazem o
--  mime novo (superconjunto), o bytes novo (o ramo não-docx é o teto antigo)
--  e o uso novo (vacuamente — nenhuma linha docx existe antes desta migração).
-- ============================================================================


-- ==================== 1. relato_arquivos — mime + bytes condicional =========
--  Os nomes relato_arquivos_mime_check / relato_arquivos_bytes_check são os
--  que o Postgres gerou para os CHECKs inline da 005 (§12): <tabela>_<coluna>_
--  check. O drop pega o da 005 na primeira passada e o desta na segunda.
alter table public.relato_arquivos
  drop constraint if exists relato_arquivos_mime_check;
alter table public.relato_arquivos
  add constraint relato_arquivos_mime_check
  check (mime in ('application/pdf','image/jpeg','image/png',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));

-- Teto condicional por mime (decisão 2). NÃO mexer no ramo de 1048576 sem
-- reler o orçamento no cabeçalho.
alter table public.relato_arquivos
  drop constraint if exists relato_arquivos_bytes_check;
alter table public.relato_arquivos
  add constraint relato_arquivos_bytes_check
  check (bytes >= 0 and bytes <=
         case when mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
              then 10485760 else 1048576 end);

-- Decisão 1: .docx só como comprovante/documento da pesquisa. `imagem_publicavel`
-- alimenta a cessão de imagem e o material publicável do site — um .docx ali
-- seria um binário editável fingindo ser imagem.
alter table public.relato_arquivos
  drop constraint if exists relato_arquivos_docx_uso;
alter table public.relato_arquivos
  add constraint relato_arquivos_docx_uso
  check (mime <> 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
         or uso = 'comprovante');


-- ==================================== 2. bucket 'relatos' — teto global =====
--  MESMO upsert da 005 §14. O file_size_limit é por BUCKET (não por mime):
--  sobe para 10485760 para deixar o docx passar; quem segura pdf/jpeg/png em
--  1 MB é o CHECK da seção 1 + a validação do cliente (ver decisão 2).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('relatos', 'relatos', false, 10485760,
        array['application/pdf','image/jpeg','image/png',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ============================= 3. config do ciclo — o cliente lê daqui ======
--  `limitesDeAnexo()` (src/relato/config.ts) já lê `anexos` do config; o teto
--  do docx entra como `max_bytes_docx` para o cliente validar ANTES do upload
--  sem constante nova no código. O merge (`||` sobre o objeto existente)
--  preserva max_por_relato / max_imagens_por_item que a 005 semeou.
--  O WHERE torna a segunda passada um no-op (não dispara touch_updated_at).
update public.relatorio_ciclos
   set config = jsonb_set(
         config,
         '{anexos}',
         coalesce(config -> 'anexos', '{}'::jsonb) || jsonb_build_object(
           'mimes', jsonb_build_array(
             'application/pdf','image/jpeg','image/png',
             'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
           'max_bytes_docx', 10485760))
 where coalesce(config #>> '{anexos,max_bytes_docx}', '') <> '10485760'
    or not coalesce(config #> '{anexos,mimes}', '[]'::jsonb)
           @> '"application/vnd.openxmlformats-officedocument.wordprocessingml.document"'::jsonb;


-- ==================== 4. storage — leitura da coordenação (CONFERIDA) =======
--  Conferência feita na 005 §14: `relatos_bucket_read` JÁ inclui
--  public.is_coordenacao_geral() — a coordenação já lê qualquer pasta do
--  bucket, então o download no painel funciona. A policy é RECRIADA aqui,
--  idêntica, de propósito: (a) a 011 sozinha passa a garantir a invariante de
--  que o anexo não é buraco negro, sem depender de ninguém reler a 005;
--  (b) se alguma manutenção manual tiver derrubado a policy, esta passada a
--  restaura. Mesmo padrão is_coordenacao das tabelas (a variante _geral
--  existe porque storage.objects não tem coluna de ciclo).
drop policy if exists relatos_bucket_read on storage.objects;
create policy relatos_bucket_read on storage.objects
  for select to authenticated
  using (bucket_id = 'relatos'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.is_coordenacao_geral()));


-- ================================================= 5. SANIDADE (SELECT) =====
--  Deve devolver 6 linhas, todas ok = true.
select verificacao, ok from (values
  ('1. mime_check aceita docx',
   (select pg_get_constraintdef(oid) like '%wordprocessingml%'
      from pg_constraint
     where conname = 'relato_arquivos_mime_check'
       and conrelid = 'public.relato_arquivos'::regclass)),
  ('2. bytes_check condicional (10485760 p/ docx)',
   (select pg_get_constraintdef(oid) like '%10485760%'
       and pg_get_constraintdef(oid) like '%1048576%'
      from pg_constraint
     where conname = 'relato_arquivos_bytes_check'
       and conrelid = 'public.relato_arquivos'::regclass)),
  ('3. docx restrito a uso=comprovante',
   exists (select 1 from pg_constraint
            where conname = 'relato_arquivos_docx_uso'
              and conrelid = 'public.relato_arquivos'::regclass)),
  ('4. bucket relatos: 10 MB + docx na lista',
   (select file_size_limit = 10485760
       and allowed_mime_types @> array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
      from storage.buckets where id = 'relatos')),
  ('5. config do ciclo com anexos.max_bytes_docx',
   not exists (select 1 from public.relatorio_ciclos
                where coalesce(config #>> '{anexos,max_bytes_docx}', '') <> '10485760')),
  ('6. policy de leitura do bucket (dono + coordenação)',
   exists (select 1 from pg_policies
            where schemaname = 'storage' and tablename = 'objects'
              and policyname = 'relatos_bucket_read'
              and qual like '%is_coordenacao_geral%'))
) as v (verificacao, ok)
order by verificacao;
