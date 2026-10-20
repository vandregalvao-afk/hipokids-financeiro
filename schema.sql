-- Hipokids Financeiro: esquema inicial do banco (Supabase / Postgres)
-- Como usar: Supabase > SQL Editor > cole este arquivo inteiro > Run.

-- 1) Quem pode acessar os dados (só usuários cadastrados aqui)
create table if not exists public.membros (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.eh_membro()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.membros where user_id = auth.uid());
$$;
revoke execute on function public.eh_membro() from public;
revoke execute on function public.eh_membro() from anon;
grant execute on function public.eh_membro() to authenticated;

-- 2) Tabelas
create table if not exists public.categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.vendas (
  id uuid primary key default gen_random_uuid(),
  data date not null default current_date,
  valor numeric(12,2) not null check (valor > 0),
  canal text,
  forma_pagamento text,
  observacao text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.contas_pagar (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  categoria_id uuid references public.categorias(id) on delete set null,
  fornecedor text,
  valor numeric(12,2) not null check (valor > 0),
  vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente','pago')),
  pago_em date,
  forma_pagamento text,
  observacao text,
  grupo_id uuid,
  parcela int,
  total_parcelas int,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.contas_receber (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  cliente text,
  valor numeric(12,2) not null check (valor > 0),
  previsao date not null,
  status text not null default 'pendente' check (status in ('pendente','recebido')),
  recebido_em date,
  forma_pagamento text,
  observacao text,
  grupo_id uuid,
  parcela int,
  total_parcelas int,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- Base para o controle de estoque (ainda sem tela no app)
create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sku text,
  categoria text,
  tamanho text,
  custo numeric(12,2),
  preco numeric(12,2),
  estoque_atual int not null default 0,
  estoque_minimo int not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists vendas_data_idx on public.vendas (data);
create index if not exists pagar_venc_idx on public.contas_pagar (vencimento);
create index if not exists pagar_status_idx on public.contas_pagar (status);
create index if not exists pagar_categoria_idx on public.contas_pagar (categoria_id);
create index if not exists receber_prev_idx on public.contas_receber (previsao);
create index if not exists receber_status_idx on public.contas_receber (status);

-- 3) Segurança: só membros leem e gravam
alter table public.membros        enable row level security;
alter table public.categorias     enable row level security;
alter table public.vendas         enable row level security;
alter table public.contas_pagar   enable row level security;
alter table public.contas_receber enable row level security;
alter table public.produtos       enable row level security;

drop policy if exists "ver proprio registro" on public.membros;
create policy "ver proprio registro" on public.membros
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "membros acessam" on public.categorias;
create policy "membros acessam" on public.categorias
  for all to authenticated using (public.eh_membro()) with check (public.eh_membro());

drop policy if exists "membros acessam" on public.vendas;
create policy "membros acessam" on public.vendas
  for all to authenticated using (public.eh_membro()) with check (public.eh_membro());

drop policy if exists "membros acessam" on public.contas_pagar;
create policy "membros acessam" on public.contas_pagar
  for all to authenticated using (public.eh_membro()) with check (public.eh_membro());

drop policy if exists "membros acessam" on public.contas_receber;
create policy "membros acessam" on public.contas_receber
  for all to authenticated using (public.eh_membro()) with check (public.eh_membro());

drop policy if exists "membros acessam" on public.produtos;
create policy "membros acessam" on public.produtos
  for all to authenticated using (public.eh_membro()) with check (public.eh_membro());

-- 4) Categorias de despesa iniciais
insert into public.categorias (nome) values
  ('Mercadoria (fornecedores)'),
  ('Impostos (MEI)'),
  ('Empréstimos'),
  ('Cartão de crédito'),
  ('Feiras e eventos'),
  ('Embalagens'),
  ('Marketing'),
  ('Frete'),
  ('Contas fixas'),
  ('Outros')
on conflict (nome) do nothing;

-- 5) DEPOIS de criar os usuários (Authentication > Users), rode esta linha
--    para liberar o acesso deles:
-- insert into public.membros (user_id) select id from auth.users on conflict do nothing;
