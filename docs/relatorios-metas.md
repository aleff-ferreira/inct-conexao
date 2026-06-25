# Relatórios de resultados por meta (privado, no Google Drive)

Sistema para os **líderes de grupo** verem as **metas** que assumiram e enviarem,
de forma **privada**, os **relatórios de resultados** de cada meta. Tudo fica no
**seu Google Drive** (da coordenação), sem servidor e sem banco de dados.

## Como funciona (resumo)

```
Seu Drive
 └─ INCT-Relatorios/
     ├─ CONEXAO-Clima & Saúde Única/        ← compartilhada SÓ com o líder desse grupo
     │   ├─ LEIA-ME — como enviar relatórios
     │   ├─ M1 — <título da meta>/
     │   │     ├─ M1 — RESULTADOS (preencher)   ← o líder escreve os resultados
     │   │     └─ (líder arrasta o PDF do relatório aqui)
     │   └─ M2 — <título da meta>/ ...
     └─ CONEXAO-Bioprospecção e Bioeconomia/  ← compartilhada SÓ com o líder desse grupo
         └─ ...
```

- Cada grupo tem **uma pasta**, compartilhada **somente com o líder daquele
  grupo** → um líder nunca vê os arquivos de outro grupo.
- Dentro, **uma subpasta por meta**, com um documento de resultados e o lugar
  para o líder soltar o PDF.
- Você (coordenação) vê e organiza tudo, no seu próprio Drive.

> **Por que não um Google Formulário?** O campo de "envio de arquivo" do Google
> Forms só existe em contas **Google Workspace (pagas)** — não aparece numa conta
> `@gmail` comum (verificado, 2026). As pastas privadas resolvem o mesmo, de
> graça, na sua conta atual. *(Se um dia o INCT tiver uma conta Workspace, dá
> para migrar para um formulário por grupo — fica ainda mais automático.)*

## Configurar (uma vez, ~10 min)

Um script monta toda a estrutura e já compartilha cada pasta com o líder certo
(a parte mais sensível — para não compartilhar a pasta errada com a pessoa errada).

1. Abra **https://script.google.com** → **Novo projeto**.
2. Apague o código de exemplo e **cole o conteúdo de
   [`scripts/relatorios-drive.gs`](../scripts/relatorios-drive.gs)**.
3. No topo do script, edite a lista **`GRUPOS`**: para cada grupo, preencha
   - `nome` do grupo,
   - `liderEmail` (o e-mail **Google** do líder),
   - as **`metas`** reais do projeto (código, título e descrição).
4. Menu **Executar** → função **`criarEstrutura`** → **Autorizar** (é a sua conta
   acessando o seu próprio Drive).
5. Abra o painel **Execução / Logs**: ele imprime o **link da pasta de cada
   grupo**. Envie a cada líder o link da pasta **do grupo dele**.

Rodar de novo é seguro: não duplica pastas nem apaga o que os líderes já
escreveram — só cria o que falta. Então você pode **adicionar grupos/metas**
depois e rodar de novo.

## O que o líder faz (instruções em português — já vão dentro do "LEIA-ME")

1. Abre o **link da pasta** do grupo (recebe um e-mail do Google avisando do
   compartilhamento).
2. Entra na **subpasta da meta**.
3. Abre o documento **"RESULTADOS (preencher)"** e escreve os resultados.
4. **Arrasta o PDF** do relatório para a mesma subpasta.

Pronto — fica salvo no seu Drive, privado.

## Pontos de atenção

- **Cada líder precisa de uma conta Google** (qualquer e-mail Google serve) para
  receber o acesso privado à pasta. Quem não tiver, cria uma gratuita — ou, como
  alternativa menos privada, você gera para o grupo um link "qualquer pessoa com
  o link pode editar" (isola de outros grupos, mas quem tiver o link vê aquela
  pasta).
- **Nunca** compartilhe **uma única pasta com todos os líderes**: num Drive
  compartilhado, todo colaborador vê os arquivos dos outros. O script já evita
  isso (uma pasta por grupo, um líder por pasta).
- **Espaço:** os PDFs ocupam o **seu** espaço do Google (15 GB grátis,
  compartilhados com Gmail/Fotos). Se encher, dá para apagar antigos ou assinar
  o Google One. Oriente os líderes a enviarem PDFs leves.
- **Backup:** como tudo está no seu Drive, baixe uma cópia das pastas de tempos
  em tempos (Drive → botão direito → Fazer download) para guardar localmente.

## Alternativa manual (sem o script)

Se preferir não usar o script: no Drive, crie `INCT-Relatorios`; dentro, uma
pasta por grupo; em cada pasta de grupo, uma subpasta por meta. Em cada pasta de
**grupo**, clique em **Compartilhar** e adicione **apenas o e-mail daquele
líder** como **Editor**. Envie o link de cada pasta ao líder respectivo. (O
script só automatiza exatamente isso, com menos risco de erro.)
