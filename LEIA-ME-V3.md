# Corrige+ (CAC) — versão 3.0

## Atualização no GitHub (pelo iPhone)

Para atualizar a instalação atual, substitua **somente** estes três arquivos na raiz do repositório `Corrige-CAC-`:

1. `app.js`
2. `styles.css`
3. `service-worker.js`

Não substitua a pasta `icons`, `config.js`, `index.html` ou as tabelas do Supabase. A logomarca escolar está incorporada em `app.js`; não há imagem adicional para enviar.

Depois de confirmar os commits, abra https://josiasjosiaspedro-max.github.io/Corrige-CAC-/ no Safari e atualize a página. Se necessário, feche e reabra o atalho da tela inicial para atualizar o cache da versão 3.0.

## Funcionalidades

- Menu separado: **Cadastros** (turmas, disciplinas e estudantes) e **Diário** (turma, disciplina, trimestre, notas).
- Até 3 trimestres; cada diário possui AT1–AT5 e Avaliação.
- Cadastro de turmas; disciplinas vinculadas às turmas; estudantes por fotografia da ata (OCR experimental), PDF original, CSV ou digitação manual.
- Leitura pela câmera após o professor tocar no nome do aluno no Diário; um único gabarito oficial e cartões iguais para todos.
- Conferência do aluno e das alternativas; cálculo da nota proporcional ao valor da atividade; questões erradas por aluno.
- Lançamento/edição manual de notas; marcação NC (não realizou); histórico da leitura mantido.
- Imprimir ou gerar PDF com 4 cartões em cada folha A4, com 4 marcas OMR por cartão.
- Exportar Diário do trimestre em PDF A4 paisagem com logomarca escolar pequena (1,5 cm) e CSV.
- Login individual e isolamento por professor no Supabase já existente (acesso real depende de autorização da escola).

## Observações importantes

- O repositório GitHub não deve conter dados reais de estudantes, documentos de atas nem arquivos CSV de turmas.
- O recurso de QR Code, quando disponível, identifica apenas a atividade no cartão; **não** identifica o estudante. A associação é feita pelo nome selecionado pelo professor antes da leitura.
- O OCR e a leitura OMR exigem teste com fotos reais no iPhone. Uma correção só deve ser salva após conferência do professor.
- A geração direta de PDFs usa uma biblioteca gratuita carregada da internet sob demanda. Sem ela, o Safari abre a impressão, onde é possível salvar o documento como PDF.
- O projeto utiliza GitHub Pages e o Supabase Free já existente, sujeito aos limites dos serviços. Não contratamos serviço pago.
- A versão 3.0 não exige migração no Supabase e não modifica a Agenda do Professor.

## Testes automatizados de desenvolvimento

- Interface de cadastros/diário: aprovado.
- Seleção de aluno, leitura OMR em cartão rasterizado, nota e erros: aprovado com cartão digital de teste.
- Impressão de 4 cartões por página A4: aprovado no PDF renderizado.
- Diário PDF de 39 estudantes em 2 páginas: aprovado no PDF renderizado (rota de impressão).
- Geração jsPDF: lógica executada com simulador local; ainda é necessário validar o download direto no Safari real.

Versão: 3.0 — pacote de desenvolvimento; não usar com registros oficiais antes de completar a validação real.
