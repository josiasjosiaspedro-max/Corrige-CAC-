-- Corrige+ (CAC) · 2.0 · Cole no SQL Editor de um PROJETO SUPABASE NOVO E EXCLUSIVO.
-- Cada professor só pode ver/alterar registros com teacher_id = auth.uid().
-- Não executar em projetos já usados por outros aplicativos sem antes revisar o esquema.
-- Segurança: RLS em todas as tabelas, fks compostas para impedir associação entre professores.

create table if not exists public.cac_classrooms (
  id uuid primary key,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  grade text not null default '',
  shift text not null default 'Integral',
  year integer not null default extract(year from current_date)::integer check (year between 2020 and 2100),
  created_at timestamptz not null default now(),
  unique (teacher_id,id)
);
create table if not exists public.cac_students (
  id uuid primary key,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  classroom_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 100),
  code text not null default '',
  created_at timestamptz not null default now(),
  unique (teacher_id,id),
  constraint cac_students_classroom_teacher_fk foreign key (teacher_id,classroom_id)
    references public.cac_classrooms(teacher_id,id) on delete restrict
);
create table if not exists public.cac_exams (
  id uuid primary key,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  classroom_id uuid,
  name text not null check (length(trim(name)) between 1 and 100),
  group_name text not null default '',
  question_count integer not null check (question_count in (5,10,15,20,30)),
  answer_key jsonb not null check (jsonb_typeof(answer_key)='array' and jsonb_array_length(answer_key)=question_count),
  created_at timestamptz not null default now(),
  unique (teacher_id,id),
  constraint cac_exams_classroom_teacher_fk foreign key (teacher_id,classroom_id)
    references public.cac_classrooms(teacher_id,id) on delete restrict
);
create table if not exists public.cac_results (
  id uuid primary key,
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exam_id uuid not null,
  student_id uuid,
  student_name text not null check (length(trim(student_name)) between 1 and 100),
  student_code text not null default '',
  answers jsonb not null check (jsonb_typeof(answers)='array' and jsonb_array_length(answers)=question_count),
  hits integer not null check (hits >= 0 and hits <= question_count),
  score numeric(5,2) not null check (score >= 0 and score <= 10),
  question_count integer not null check (question_count in (5,10,15,20,30)),
  created_at timestamptz not null default now(),
  unique (teacher_id,id),
  constraint cac_results_exam_teacher_fk foreign key (teacher_id,exam_id)
    references public.cac_exams(teacher_id,id) on delete restrict,
  constraint cac_results_student_teacher_fk foreign key (teacher_id,student_id)
    references public.cac_students(teacher_id,id) on delete set null (student_id)
);

create index if not exists cac_classrooms_teacher on public.cac_classrooms(teacher_id);
create index if not exists cac_students_teacher_classroom on public.cac_students(teacher_id,classroom_id);
create index if not exists cac_exams_teacher_classroom on public.cac_exams(teacher_id,classroom_id);
create index if not exists cac_results_teacher_exam on public.cac_results(teacher_id,exam_id);

alter table public.cac_classrooms enable row level security;
alter table public.cac_students enable row level security;
alter table public.cac_exams enable row level security;
alter table public.cac_results enable row level security;

-- A SQL é pensada para rodar somente uma vez em um projeto novo.
create policy "cac_classrooms_own_select" on public.cac_classrooms for select to authenticated using ((select auth.uid()) = teacher_id);
create policy "cac_classrooms_own_insert" on public.cac_classrooms for insert to authenticated with check ((select auth.uid()) = teacher_id);
create policy "cac_classrooms_own_update" on public.cac_classrooms for update to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);
create policy "cac_classrooms_own_delete" on public.cac_classrooms for delete to authenticated using ((select auth.uid()) = teacher_id);

create policy "cac_students_own_select" on public.cac_students for select to authenticated using ((select auth.uid()) = teacher_id);
create policy "cac_students_own_insert" on public.cac_students for insert to authenticated with check ((select auth.uid()) = teacher_id);
create policy "cac_students_own_update" on public.cac_students for update to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);
create policy "cac_students_own_delete" on public.cac_students for delete to authenticated using ((select auth.uid()) = teacher_id);

create policy "cac_exams_own_select" on public.cac_exams for select to authenticated using ((select auth.uid()) = teacher_id);
create policy "cac_exams_own_insert" on public.cac_exams for insert to authenticated with check ((select auth.uid()) = teacher_id);
create policy "cac_exams_own_update" on public.cac_exams for update to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);
create policy "cac_exams_own_delete" on public.cac_exams for delete to authenticated using ((select auth.uid()) = teacher_id);

create policy "cac_results_own_select" on public.cac_results for select to authenticated using ((select auth.uid()) = teacher_id);
create policy "cac_results_own_insert" on public.cac_results for insert to authenticated with check ((select auth.uid()) = teacher_id);
create policy "cac_results_own_update" on public.cac_results for update to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);
create policy "cac_results_own_delete" on public.cac_results for delete to authenticated using ((select auth.uid()) = teacher_id);

-- Expor APENAS o necessário à API, sempre com RLS:
grant usage on schema public to authenticated;
grant select,insert,update,delete on public.cac_classrooms,public.cac_students,public.cac_exams,public.cac_results to authenticated;
revoke all on public.cac_classrooms,public.cac_students,public.cac_exams,public.cac_results from anon;

-- Verificação opcional: 4 linhas e RLS ativo (= true).
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename like 'cac_%';
