-- Patch 2026-07-08: adiciona o orientador Felipe Sant’Anna Cavalcante (Rondonia / RO)
--   Lattes: http://lattes.cnpq.br/2723540144012951
-- Rode este bloco UMA vez no Supabase -> SQL Editor. E idempotente e nao exige redeploy:
-- os orientadores sao lidos do banco em tempo real, entao Felipe aparece no formulario
-- assim que o UPDATE rodar.

update public.editais
set config = jsonb_set(
  config,
  '{estados}',
  (
    select jsonb_agg(
      case when est->>'uf' = 'RO'
        then jsonb_set(est, '{orientadores}', $ro$["Adnilson de Almeida Silva", "Adriana Cristina da Silva Nunes", "Alexandre de Almeida e Silva", "Anderson Makoto Kayano", "Andreimar Martins Soares", "Angelo Laurence Covatti Terra", "Antonio Coutinho Neto", "Antônio Laffayete Pires da Silveira", "Arlindo Gonzaga Branco Junior", "Carolina Bioni Garcia Teles", "Chicoepab Suruí Dias", "Dorisvalder Dias Nunes", "Edney Costa Souza", "Elieth Afonso de Mesquita", "Elisabete Lourdes do Nascimento", "Estevão Rafael Fernandes", "Felipe Sant’Anna Cavalcante", "Gean Carla da Silva Sganderla", "Graziela Tosini Tejas", "João Paulo Assis Gobo", "Kayena Delaix Zaqueo", "Leidiane Amorim Soares", "Luís Marcelo Aranha Camargo", "Marcela Alvares Oliveira", "Marcela Milrea Araújo Barros", "Marcelo Lucian Ferronato", "Marcos Barros Luiz", "Maria Aurea Pinheiro de Almeida Silveira", "Michel Watanabe", "Mônica Pereira Lima Cunha", "Osvanda Silva de Moura", "Paulo Vilela Cruz", "Rafaela Diniz Sousa", "Reginaldo Martins da Silva de Souza", "Rodrigo Simões Silva", "Ronaldo de Almeida", "Rubiani de Cassia Pagotto", "Saymon de Albuquerque", "Sergio de Almeida Basano", "Sérgio Nunes de Jesus", "Wanderley Rodrigues Bastos", "William Cristian da Silva Pizzaia", "Wilson Gómez Manrique", "Xênia de Castro Barbosa"]$ro$::jsonb)
        else est
      end
    )
    from jsonb_array_elements(config->'estados') est
  )
)
where slug = 'selecao-ic-2026';

-- ----- verificacao (deve retornar 44 e depois 'true') -----
select jsonb_array_length(e->'orientadores') as n_orientadores_ro
from public.editais, jsonb_array_elements(config->'estados') e
where slug = 'selecao-ic-2026' and e->>'uf' = 'RO';

select e->'orientadores' ? 'Felipe Sant’Anna Cavalcante' as felipe_presente
from public.editais, jsonb_array_elements(config->'estados') e
where slug = 'selecao-ic-2026' and e->>'uf' = 'RO';
