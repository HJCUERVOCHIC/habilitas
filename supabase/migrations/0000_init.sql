-- Habilitas — Migración inicial (slice 0)
-- Fuente: HABILITAS-STACK.md §7 (schema, RLS, índices, vista) + trigger de alta de usuario.
-- Idempotente donde es razonable, pensada para aplicarse una sola vez.

-- ============================================================
-- Extensiones
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- búsqueda por texto

-- ============================================================
-- Tablas
-- ============================================================

-- users — extendida de auth.users (Supabase Auth gestiona auth.users)
create table public.users (
  id            uuid references auth.users(id) on delete cascade primary key,
  full_name     text not null,
  profession    text,
  city          text,
  country       text default 'Colombia',
  rethus_number text,
  avatar_url    text,
  role          text default 'student'
                check (role in ('student', 'admin', 'instructor')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- courses
create table public.courses (
  id                 uuid default uuid_generate_v4() primary key,
  slug               text unique not null,
  title              text not null,
  subtitle           text,
  description        text,
  category           text not null
                     check (category in (
                       'soporte-vital', 'procedimientos-clinicos', 'bioseguridad',
                       'farmacologia', 'urgencias', 'enfermeria'
                     )),
  duration_hours     numeric(4,1),
  difficulty         text check (difficulty in ('basico', 'intermedio', 'avanzado')),
  price_cop          integer,              -- null = gratis en el MVP
  published          boolean default false,
  instructor_id      uuid references public.users(id),
  cert_validity_days integer default 365,
  pass_score         integer default 70,   -- puntaje mínimo %
  max_attempts       integer default 3,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- modules
create table public.modules (
  id          uuid default uuid_generate_v4() primary key,
  course_id   uuid references public.courses(id) on delete cascade not null,
  title       text not null,
  order_index integer not null,
  created_at  timestamptz default now()
);

-- lessons
create table public.lessons (
  id              uuid default uuid_generate_v4() primary key,
  module_id       uuid references public.modules(id) on delete cascade not null,
  title           text not null,
  order_index     integer not null,
  content_type    text not null
                  check (content_type in ('video', 'pdf', 'slides', 'image', 'text')),
  content_url     text,         -- URL base en R2 (nunca expuesta directamente)
  content_r2_key  text,         -- key real: courses/slug/mod1/clase1.mp4
  duration_min    integer,
  transcript      text,
  created_at      timestamptz default now()
);

-- enrollments
create table public.enrollments (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references public.users(id) on delete cascade not null,
  course_id    uuid references public.courses(id) on delete cascade not null,
  enrolled_at  timestamptz default now(),
  completed_at timestamptz,
  unique(user_id, course_id)
);

-- lesson_progress
create table public.lesson_progress (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.users(id) on delete cascade not null,
  lesson_id      uuid references public.lessons(id) on delete cascade not null,
  completed      boolean default false,
  completed_at   timestamptz,
  time_spent_sec integer default 0,
  last_position  integer default 0,  -- segundos (para video)
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  unique(user_id, lesson_id)
);

-- evaluations (1:1 con courses)
create table public.evaluations (
  id           uuid default uuid_generate_v4() primary key,
  course_id    uuid references public.courses(id) on delete cascade not null unique,
  title        text not null default 'Evaluación Final',
  duration_min integer default 45,
  instructions text,
  created_at   timestamptz default now()
);

-- questions
create table public.questions (
  id               uuid default uuid_generate_v4() primary key,
  evaluation_id    uuid references public.evaluations(id) on delete cascade not null,
  order_index      integer not null,
  text             text not null,
  context          text,              -- caso clínico opcional
  options          jsonb not null,    -- array de strings
  correct_option   integer not null,  -- índice 0-based
  feedback_correct text,
  feedback_wrong   text,
  created_at       timestamptz default now()
);

-- eval_attempts
create table public.eval_attempts (
  id             uuid default uuid_generate_v4() primary key,
  user_id        uuid references public.users(id) on delete cascade not null,
  evaluation_id  uuid references public.evaluations(id) on delete cascade not null,
  attempt_number integer not null,
  score          integer,            -- 0-100
  passed         boolean,
  answers        jsonb,              -- { question_id: option_index }
  time_spent_sec integer,
  started_at     timestamptz default now(),
  submitted_at   timestamptz
);

-- certificates
create table public.certificates (
  id                      uuid default uuid_generate_v4() primary key,
  cert_id                 text unique not null,  -- 'HAB-2026-4872'
  user_id                 uuid references public.users(id) on delete cascade not null,
  course_id               uuid references public.courses(id) on delete cascade not null,
  eval_attempt_id         uuid references public.eval_attempts(id),
  score                   integer not null,
  status                  text default 'valid'
                          check (status in ('valid', 'expired', 'revoked')),
  issued_at               timestamptz default now(),
  expires_at              timestamptz not null,
  revoked_at              timestamptz,
  revoke_reason           text,
  -- Snapshot al momento de emisión
  professional_name       text not null,
  professional_profession text,
  instructor_name         text,
  instructor_role         text,
  verify_url              text
);

-- ============================================================
-- Función: generate_cert_id  → 'HAB-YYYY-NNNN'
-- ============================================================
create or replace function generate_cert_id()
returns text as $$
declare
  year_part text := extract(year from now())::text;
  seq_num   text := lpad(
    (select count(*) + 1 from public.certificates
     where extract(year from issued_at) = extract(year from now()))::text,
    4, '0'
  );
begin
  return 'HAB-' || year_part || '-' || seq_num;
end;
$$ language plpgsql;

-- ============================================================
-- Trigger: crear fila en public.users al registrarse (auth.users)
-- (HABILITAS-ESPECIFICACION §5.9 RF-9.2)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.users           enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.eval_attempts   enable row level security;
alter table public.certificates    enable row level security;
alter table public.courses         enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.evaluations     enable row level security;
alter table public.questions       enable row level security;

-- Políticas de usuario
create policy "users_own"       on public.users           for all    using (auth.uid() = id);
create policy "enrollments_own" on public.enrollments     for all    using (auth.uid() = user_id);
create policy "progress_own"    on public.lesson_progress for all    using (auth.uid() = user_id);
create policy "attempts_own"    on public.eval_attempts   for all    using (auth.uid() = user_id);
create policy "certs_own_read"  on public.certificates    for select using (auth.uid() = user_id);

-- Certificados: lectura pública (para verificación por cert_id)
create policy "certs_public_verify" on public.certificates for select using (true);

-- Cursos y contenido: lectura pública si publicado
create policy "courses_public_read" on public.courses
  for select using (published = true);

create policy "modules_public_read" on public.modules
  for select using (
    exists (select 1 from public.courses where id = course_id and published = true)
  );

-- Lecciones: solo usuarios inscritos
create policy "lessons_enrolled_read" on public.lessons
  for select using (
    exists (
      select 1 from public.enrollments e
      join public.modules m on m.id = module_id
      where e.user_id = auth.uid() and e.course_id = m.course_id
    )
  );

-- Admin: acceso total a cursos
create policy "admin_all" on public.courses
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Índices
-- ============================================================
create index on public.enrollments(user_id);
create index on public.enrollments(course_id);
create index on public.lesson_progress(user_id, lesson_id);
create index on public.eval_attempts(user_id, evaluation_id);
create index on public.certificates(cert_id);
create index on public.certificates(user_id);
create index on public.modules(course_id, order_index);
create index on public.lessons(module_id, order_index);

-- ============================================================
-- Vista: progreso por curso
-- ============================================================
create view public.course_progress as
select
  e.user_id,
  e.course_id,
  count(lp.id) filter (where lp.completed = true) as lessons_completed,
  count(l.id)                                      as lessons_total,
  round(
    count(lp.id) filter (where lp.completed = true)::numeric
    / nullif(count(l.id), 0) * 100
  ) as progress_pct
from public.enrollments e
join public.modules m on m.course_id = e.course_id
join public.lessons l on l.module_id = m.id
left join public.lesson_progress lp
  on lp.lesson_id = l.id and lp.user_id = e.user_id
group by e.user_id, e.course_id;

-- La vista respeta la RLS del usuario que consulta (no del owner).
alter view public.course_progress set (security_invoker = on);
