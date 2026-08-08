-- Bloque 6 — Índice de estudiantes, clasificación de cursos y búsqueda
-- (SPEC-ESTUDIANTES-CLASIFICACION.md §1.2).
--
-- Aditiva: crea `public.categories`, la puebla con los seis slugs vigentes,
-- añade la FK `courses.category → categories.slug` y quita el CHECK
-- constraint sobre `courses.category` que restringía el dominio a esos seis
-- valores fijos. Sin quitar el CHECK no puede haber CRUD de categorías;
-- eliminar un CHECK no borra columna ni renombra nada, así que se mantiene
-- dentro del espíritu "aditivo/reversible" del CLAUDE.md.
--
-- Idempotente: `if not exists`, `on conflict do nothing`, bloques `do $$`
-- que buscan el constraint por nombre real (auto-generado por Postgres).

-- ============================================================
-- 1) Tabla categories
-- ============================================================
-- `slug` es la clave estable que aparece en `courses.category` y en el
-- catálogo (URLs, filtros). `label` es editable desde el CRUD admin —
-- renombrar "Enfermería" por una etiqueta de contenido (§4.5) no exige
-- migrar datos, basta con actualizar el label.
create table if not exists public.categories (
  id          uuid default uuid_generate_v4() primary key,
  slug        text unique not null,
  label       text not null,
  order_index integer not null default 0,
  created_at  timestamptz default now()
);

-- ============================================================
-- 2) Poblar con los seis valores existentes
-- ============================================================
-- El orden numérico deja espacio para insertar categorías nuevas sin
-- reordenar. Los labels replican los de `src/lib/categories.ts`.
insert into public.categories (slug, label, order_index) values
  ('soporte-vital',           'Soporte vital',              1),
  ('procedimientos-clinicos', 'Procedimientos clínicos',    2),
  ('bioseguridad',            'Bioseguridad',               3),
  ('farmacologia',            'Farmacología',               4),
  ('urgencias',               'Urgencias y emergencias',    5),
  ('enfermeria',              'Enfermería',                 6)
on conflict (slug) do nothing;

-- ============================================================
-- 3) Quitar el CHECK sobre courses.category
-- ============================================================
-- El constraint tiene nombre auto-generado. Lo localizamos por su
-- definición (contiene "category") y hacemos DROP si existe. El campo
-- `category` sigue siendo `text not null`; solo desaparece la lista fija.
do $$
declare
  cname text;
begin
  select conname into cname
    from pg_constraint
   where conrelid = 'public.courses'::regclass
     and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%category%'
   limit 1;
  if cname is not null then
    execute format('alter table public.courses drop constraint %I', cname);
  end if;
end$$;

-- ============================================================
-- 4) FK courses.category → categories.slug
-- ============================================================
-- Aditiva: garantiza integridad referencial (no puede haber cursos con un
-- slug de categoría inexistente) sin cambiar el tipo ni el nombre de la
-- columna. Reversible con DROP CONSTRAINT.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'courses_category_fk'
       and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_category_fk
      foreign key (category) references public.categories(slug);
  end if;
end$$;

-- ============================================================
-- 5) RLS de categories
-- ============================================================
-- Lectura pública (para el catálogo, no requiere sesión) y escritura solo
-- para admin. El service role bypasea igual.
alter table public.categories enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );
