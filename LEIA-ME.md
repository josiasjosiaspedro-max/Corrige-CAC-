# Corrige+ (CAC) — versão 2.0 de validação iOS / navegador

Aplicativo web instalável (PWA) para professores da EREM Cônego Alexandre Cavalcanti, com o ícone institucional aprovado. **Não é ainda uma versão de produção homologada.**

## O que já funciona nesta versão

- Interface adaptável ao iPhone e ao computador, com ícone aprovado e atalhos PWA.
- Modo de demonstração local, sem criar conta: cadastrar turmas, estudantes, importar estudantes por CSV, criar avaliações com 5/10/15/20/30 questões A–E.
- Imprimir cartão-resposta A4 em branco ou um cartão por estudante, com QR Code (quando biblioteca externa disponível).
- Tirar foto usando a câmera ou selecionar foto; localizar quatro marcas pretas; reconhecer as bolhas preenchidas (OMR); ajuste manual dos quatro cantos e conferência de cada resposta.
- Confirmar correção, calcular nota 0–10, histórico e gráfico de percentual de acertos por questão; exportação CSV compatível com Excel.
- Modo com múltiplas contas por e-mail/senha e dados separados por professor via Supabase Auth + RLS (ativado após configuração).

## Importante antes de usar com estudantes reais

1. A leitura óptica foi testada com cartão digital gerado pelo aplicativo e com correção simulada. **Ainda é necessário validar com cartões impressos e fotos reais no Safari do iPhone**, especialmente em sombras, rasuras e folhas inclinadas.
2. A integração real com Supabase requer criar/configurar um projeto, executar o SQL e testar com pelo menos duas contas de professores. O pacote **não está conectado a banco de dados nem publicado**.
3. Nunca use dados pessoais reais de estudantes no modo demonstração: ele grava dados no navegador e não dispõe de controle por senha.
4. As contas existentes são independentes: um professor não visualiza as turmas, gabaritos ou notas de outro. Gestão escolar centralizada e compartilhamento de turmas **não fazem parte desta versão**.
5. Não há ainda sincronização offline em nuvem, login Google, importação direta XLSX, atribuição de pesos diferentes ou cartões de 100 questões.
6. É responsabilidade da escola avaliar o tratamento de dados pessoais conforme a LGPD, credenciais, consentimentos/bases legais, retenção e compartilhamento dos resultados.

## Testar imediatamente sem Supabase

Abra o arquivo `CorrigePlus_CAC_Teste_Navegador.html` do pacote complementar em um navegador, ou publique estes arquivos no GitHub Pages deixando `config.js` sem as credenciais. O aplicativo entrará automaticamente em **Demonstração local**. Cadastre dados fictícios para testar. Arquivos abertos via `file://` podem não dar acesso à câmera; para câmera no iPhone, publique sob HTTPS.

## Ativar contas individuais — sem mexer nos outros aplicativos

1. Crie um **projeto Supabase novo e exclusivo** para o Corrige+ (CAC). Não utilize a base já usada por outros aplicativos sem revisar tudo.
2. No projeto novo: `SQL Editor` → cole e execute **uma vez** o arquivo `supabase-schema.sql`. Confira se quatro tabelas foram criadas e todas estão com Row Level Security (RLS) ativo.
3. Em `Project Settings` / `API Keys`, copie a URL do projeto e a chave **PÚBLICA / publishable**. Insira-as em `config.js`. **NUNCA** copie `service_role` ou uma chave `sb_secret_` para arquivos públicos.
4. Configure `Authentication` para usar e-mail/senha e confirmação por e-mail; em `URL Configuration`, cadastre como Site URL e Redirect URLs o futuro endereço HTTPS do GitHub Pages.
5. Para cadastrar professores autorizados, habilite temporariamente `ALLOW_SIGNUP: true` em `config.js` e autorize/controlе as inscrições. Depois altere para `false`, valide os usuários no Supabase e, para limitar novos registros na origem, desabilite novos cadastros públicos nas configurações do Supabase Auth. **A chave pública e a interface não são suficientes para restringir quem pode se registrar**.
6. Publique `index.html`, `app.js`, `styles.css`, `config.js`, `manifest.webmanifest`, `service-worker.js` e a pasta `icons/` em repositório GitHub separado.
7. Ative GitHub Pages na raiz do ramo principal. Abra a URL HTTPS no iPhone pelo Safari. Escolha **Compartilhar → Adicionar à Tela de Início**.
8. Crie duas contas de teste. Na conta A cadastre uma turma e prova; na conta B confirme que não aparecem. Volte à A e confira a persistência após sair e entrar.
9. Teste QR, impressão, leitura OMR e correção com cartões físicos. Confirme cada nota manualmente antes de uso oficial.

## Estrutura de arquivos

- `index.html` — interface e referências a arquivos.
- `styles.css` — layout e impressão A4.
- `app.js` — telas, lógica de correção OMR e integração Supabase.
- `config.js` — configuração pública da conta Supabase, sem dados preenchidos.
- `supabase-schema.sql` — tabelas e políticas RLS por professor.
- `manifest.webmanifest`, `service-worker.js`, `icons/` — instalação PWA.
- `preview-iphone.png` e `preview-desktop.png` — imagens ilustrativas da interface.

## Tecnologia e segurança

- A leitura óptica é calculada localmente no navegador. Imagens de cartão não são enviadas ao servidor pelo código fornecido.
- Ao confirmar a nota no modo cloud, são enviados ao Supabase o nome/código do estudante, suas respostas e a nota.
- No Supabase, todas as quatro tabelas têm políticas RLS que validam o `teacher_id` contra `auth.uid()`; relações compostas impedem que um professor associe sua prova a turma/aluno de outro.
- O login tem recuperação de senha por e-mail. Links de convite/recuperação devem ter o endereço do aplicativo na lista de URLs autorizadas.
- Bibliotecas carregadas via CDN: Supabase JS v2.119.2, jsQR v1.4.0 e qrcodejs v1.0.0. Conexão com a internet é necessária no primeiro acesso para baixá-las.
- A PWA não substitui uma aplicação nativa publicada na App Store.

## Situação dos testes

- Teste automatizado Chromium em modo demonstração: cadastrar turma/estudante, prova, armazenar correção, exibir nota e layout em tela de iPhone — aprovado.
- Teste OMR sintético (10 questões): 10/10 alternativas reconhecidas corretamente.
- Testes em iPhone físico, leitura impressa, QR impresso, fluxo de e-mail real e isolamento RLS em Supabase remoto: **pendentes**.

Desenvolvimento: Corrige+ (CAC) · projeto escolar, versão 2.0 de validação (23/11/2026).
