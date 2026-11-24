# Corrige+ CAC — atualização 2.9

## Atualização no iPhone

Substitua APENAS `app.js` e `service-worker.js` na raiz do repositório `Corrige-CAC-`. NÃO envie arquivos de alunos ao repositório público.

## Importação de ata

1. Entre em **Turmas**, escolha a turma.
2. Prefira **Importar PDF original da ata** quando disponível. Arquivos com texto selecionável podem permitir a extração dos nomes sem OCR.
3. Para foto: selecione somente a coluna Nome e toque em **Ler os nomes por linhas**. O app tentará identificar as linhas físicas da tabela; caso não consiga, continuará pela leitura em partes da versão 2.8.
4. Compare a contagem com a ata, corrija os nomes na tela de conferência e confirme apenas quando a lista estiver completa.
5. Também é possível importar a lista CSV já preparada (39 nomes).

Nenhum esquema do Supabase foi modificado nesta atualização.

### Limitações

O OCR não garante 100% de precisão: fotos pequenas, imagens em baixa resolução, reflexos e PDFs escaneados podem perder caracteres. O PDF só permite extração direta se contiver texto selecionável. No modo de demonstração, não use nomes reais de alunos.
