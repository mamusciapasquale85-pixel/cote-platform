create table if not exists public.remarques (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_year_id uuid not null,
  teacher_id uuid not null,
  student_id uuid not null references public.students(id) on delete cascade,
  type text not null default 'discipline',
  text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists remarques_student_id_idx on public.remarques (student_id);
create index if not exists remarques_school_id_idx on public.remarques (school_id);
create index if not exists remarques_academic_year_id_idx on public.remarques (academic_year_id);
create index if not exists remarques_teacher_id_idx on public.remarques (teacher_id);

drop trigger if exists remarques_set_updated_at on public.remarques;
create trigger remarques_set_updated_at
before update on public.remarques
for each row execute function public.set_updated_at();
