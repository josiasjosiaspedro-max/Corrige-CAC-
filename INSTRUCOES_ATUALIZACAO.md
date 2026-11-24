# Corrige+ (CAC) — Correção v2.7: leitura apenas dos nomes da ata

Esta atualização resolve a dificuldade de reconhecimento em atas que incluem colunas de **Matrícula, Nome e Assinaturas**.

## O que foi alterado

- Depois de fotografar ou selecionar uma ata, o aplicativo mostra uma prévia com dois controles para delimitar **somente a coluna Nome**.
- O botão **Ler apenas os nomes** utiliza OCR local na região delimitada, ignorando matrícula e assinaturas, com filtros de cabeçalhos e ruído.
- O professor deve revisar os nomes na tela de conferência antes de salvar a turma.
- A fotografia não é enviada nem salva no Supabase; somente os nomes confirmados entram no diário.
- Os dados dos trimestres, disciplinas, AT1–AT5, Avaliação, notas manuais, NC, cartões com QR Code e correção óptica foram preservados.

## Atualização fácil pelo iPhone (sem pasta icons)

Acesse o repositório https://github.com/josiasjosiaspedro-max/Corrige-CAC- e substitua **apenas os três arquivos da pasta principal**:

1. `app.js`
2. `styles.css`
3. `service-worker.js`

Não é preciso alterar `icons/`, `config.js`, `index.html`, nem o banco Supabase.

Depois de confirmar a alteração, abra https://josiasjosiaspedro-max.github.io/Corrige-CAC-/ no Safari, atualize a página e feche/abra o app da tela inicial caso apareça a versão anterior (cache do aplicativo).

## Observações

- Em fotos que não tenham colunas padronizadas, ajuste os controles horizontalmente até que a região transparente contenha somente os nomes.
- Se a leitura estiver incompleta, aproxime a câmera, melhore a iluminação ou use uma imagem recortada diretamente da coluna Nome.
- A ferramenta de OCR precisa de internet para carregar os componentes na primeira utilização. A precisão não pode ser garantida em todas as imagens; confira cada nome antes de salvar.
- O CSV `Nomes_Turma_2_Ano_C_CorrigeCAC.csv` é uma alternativa extraída visualmente da foto enviada, com **39 nomes**. Confira os nomes antes do uso oficial.
- Não envie nomes de estudantes ao repositório público do GitHub. O CSV com nomes deve ficar apenas no dispositivo/conta segura do professor, e não deve ser incluído no ZIP de atualização.
