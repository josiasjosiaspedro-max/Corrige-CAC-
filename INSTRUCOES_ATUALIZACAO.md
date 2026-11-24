# Corrige+ (CAC) — v2.8: leitura completa da ata em partes

## O que mudou

- A coluna Nome é analisada verticalmente em pequenos trechos com sobreposição. Assim o aplicativo evita reduzir uma foto comprida inteira, preservando a legibilidade dos nomes menores.
- É possível reler **parte de cima**, **parte do meio** ou **parte de baixo** para recuperar nomes que o OCR ignorou.
- Os nomes encontrados em uma nova leitura se somam aos anteriores; nomes idênticos são deduplicados.
- Se o professor escolher outra foto, por exemplo a metade inferior da mesma ata, os nomes já encontrados ou corrigidos não são perdidos.
- A conferência manual permanece obrigatória. O OCR pode omitir, repetir com grafia diferente ou trocar letras, mesmo após esta melhoria.

## Como instalar pelo iPhone

No repositório https://github.com/josiasjosiaspedro-max/Corrige-CAC- substitua somente estes arquivos **na pasta principal**:

1. `app.js`
2. `styles.css`
3. `service-worker.js`

**Não mexa** em `icons`, `index.html`, `config.js`, no Supabase nem nas notas existentes.

Se o GitHub Pages exibir a versão antiga, atualize o Safari e feche e abra o aplicativo adicionado à tela inicial. O cache do PWA foi aumentado para v2.8.0.

## Teste na ata

1. Abra a turma e selecione a mesma foto.
2. Ajuste as bordas para deixar apenas a coluna **Nome**.
3. Toque em **Ler lista completa (em partes)**.
4. Confira a lista de nomes. Para recuperar os ausentes, toque em **Parte de cima**, **Parte do meio** ou **Parte de baixo**. As próximas leituras *acrescentam* nomes.
5. Se ainda faltarem nomes, fotografe separadamente a parte da ata que falta, selecione **Escolher foto** e repita a leitura. Os nomes anteriores serão preservados.
6. Confira as grafias e só então toque em **Confirmar e gerar tabela**.

**Privacidade:** não envie fotografias das listas nem nomes reais ao GitHub público. A leitura ocorre no dispositivo; apenas os nomes confirmados são armazenados no banco institucional para contas autorizadas.

**Validação:** o procedimento de união/deduplicação foi testado no navegador com resultados simulados de OCR e foram executados testes de regressão das outras telas. A precisão em fotografias reais precisa ser testada no iPhone; não há garantia de reconhecer 100% das linhas.
