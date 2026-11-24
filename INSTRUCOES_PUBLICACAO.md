# Corrige+ (CAC) — Versão 2.6 · Disciplinas e diários trimestrais

## Novidade principal

Cada professor cadastra as **disciplinas que leciona** e escolhe **quais disciplinas trabalha em cada turma**. As listas de estudantes são cadastradas uma única vez por turma, preferencialmente usando foto da ata, e a aplicação mostra tabelas independentes por **turma + disciplina + trimestre**.

Cada um dos **três trimestres letivos** contém as seis colunas: **AT1, AT2, AT3, AT4, AT5 e Avaliação**. O título do diário exibe explicitamente a disciplina, a turma e o trimestre selecionados.

## Funcionalidades mantidas

- Login individual por professor autorizado no Supabase.
- Cadastro de turmas e importação de estudantes por foto de ata (OCR no dispositivo, com revisão antes de salvar); cadastro manual/CSV alternativos.
- Cadastro e associação de disciplinas às turmas.
- Geração de cartões-resposta individuais com QR Code de avaliação e estudante, impressão e leitura experimental OMR por câmera ou imagem.
- Valor máximo da prova configurável; cálculo proporcional da nota conforme acertos.
- Exibição de alternativas e números das questões erradas.
- Lançamento e edição direta de notas, inclusive notas originadas por leitura óptica (a correção original é preservada).
- Registro **NC** quando o estudante não realizou a atividade.
- Exportação CSV de uma disciplina/trimestre ou da disciplina ao longo dos três trimestres.
- Mesmo ícone e identidade visual da escola.

## Publicar no GitHub Pages

1. Extraia `CorrigeCAC_v2_6_PARA_GITHUB.zip`.
2. Abra o repositório https://github.com/josiasjosiaspedro-max/Corrige-CAC-.
3. Acesse **Add file → Upload files** e envie `index.html`, `app.js`, `styles.css`, `config.js`, `manifest.webmanifest`, `service-worker.js` e a pasta `icons`, substituindo os arquivos antigos. Mantenha a estrutura da pasta `icons`.
4. Confirme **Commit changes**.
5. Abra https://josiasjosiaspedro-max.github.io/Corrige-CAC-/ no Safari, atualize e, se estiver como aplicativo na Tela de Início, feche e abra novamente para atualizar o cache.

O banco de dados compartilhado do projeto Supabase `Agenda-Professor-EREM-CAC` **já recebeu** as tabelas `cac_subjects` e `cac_classroom_subjects` e os campos de disciplina das avaliações e notas. A tabela `agenda_state` não foi alterada. Não é necessário executar uma migração SQL manual nem contratar novo plano.

## Início do trabalho

1. Entre com a conta aprovada da escola ou escolha **Experimentar com dados fictícios** para uma demonstração isolada.
2. Em **Turmas**, cadastre a turma e fotografe a ata para importar os nomes. Confira os nomes antes de confirmar.
3. Em **Disciplinas**, cadastre as disciplinas que você leciona e **vincule-as às turmas** marcando os botões correspondentes.
4. Em **Diário**, selecione turma, disciplina e 1º, 2º ou 3º trimestre. As colunas AT1–AT5 e Avaliação aparecem para cada estudante.
5. Toque numa célula para digitar/editar a nota, marcar **NC** ou limpar o lançamento manual. O símbolo ↗ leva à correção original, quando houver.
6. Em **Atividades**, escolha a mesma turma, disciplina e trimestre, crie a atividade com valor e gabarito, imprima os cartões com QR Code e utilize **Leitor**.

## Contas dos professores

O Supabase ainda não possui contas aprovadas para o Corrige+. Após conferir presencialmente a identidade de cada professor, um responsável autorizado pode aprovar o UUID mostrado na tela **Aguardando autorização**, no SQL Editor do projeto existente:

```sql
insert into public.cac_authorized_teachers (teacher_id)
values ('UUID_DO_PROFESSOR_CONFIRMADO')
on conflict (teacher_id) do nothing;
```

Preserve o `Site URL` do projeto usado pela Agenda do Professor e adicione `https://josiasjosiaspedro-max.github.io/Corrige-CAC-/` às **Additional Redirect URLs** da autenticação.

## Segurança, limites e validação

- Não use nomes, fotos de atas ou notas reais no **modo demonstração**. Ele não sincroniza com o banco.
- As fotos da ata não são armazenadas pelo app; apenas os nomes revisados e confirmados seguem para o Supabase.
- Todas as tabelas `cac_*` têm RLS, com controle por proprietário e autorização.
- A leitura OCR depende da legibilidade da ata; confira os nomes antes de salvar.
- **A leitura OMR de cartões impressos pelo iPhone ainda é experimental e precisa de validação em condições reais**, assim como a sincronização entre contas reais de professores.
- A atualização não contratou serviços pagos; o uso do Supabase Free e GitHub Pages continua sujeito a limites e condições dos respectivos serviços. Não há garantia de operação gratuita sem restrições no futuro.
- No Supabase, a recomendação de segurança sobre senhas vazadas está pendente e deve ser revisada sem prejudicar a Agenda do Professor.
