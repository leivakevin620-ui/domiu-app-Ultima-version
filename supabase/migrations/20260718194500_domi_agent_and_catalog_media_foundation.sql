-- DomiU Magdalena
-- Fundamentos de Domi por perfil y control verificable de imágenes de catálogo.
-- Domi es un asistente de IA; no se representa como consciente ni como persona humana.

create table if not exists public.domi_agent_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_scope text not null check (role_scope in ('customer','merchant','courier','admin')),
  assistant_name text not null default 'Domi',
  memory_consent boolean not null default false,
  personalization_enabled boolean not null default true,
  preferences jsonb not null default '{}'::jsonb,
  behavior_summary jsonb not null default '{}'::jsonb,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domi_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in (
    'food_preference','business_preference','delivery_preference','app_learning',
    'inventory_pattern','menu_opportunity','courier_work_pattern','admin_operation'
  )),
  memory_key text not null,
  memory_value jsonb not null,
  confidence numeric(4,3) not null default 0.500 check (confidence between 0 and 1),
  source_type text not null default 'interaction' check (source_type in ('interaction','order_history','inventory','explicit_user','system')),
  source_reference_id uuid,
  is_sensitive boolean not null default false,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, memory_key)
);

create index if not exists idx_domi_memories_user_category
on public.domi_memories(user_id, category, updated_at desc);

create table if not exists public.domi_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_scope text not null check (role_scope in ('customer','merchant','courier','admin')),
  title text,
  status text not null default 'active' check (status in ('active','archived','deleted')),
  context_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.domi_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.domi_conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  sender_type text not null check (sender_type in ('user','assistant','system','tool')),
  content text not null,
  tool_name text,
  tool_result jsonb,
  safety_labels text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_domi_messages_conversation
on public.domi_messages(conversation_id, created_at);

create table if not exists public.domi_role_capabilities (
  role_scope text not null check (role_scope in ('customer','merchant','courier','admin')),
  capability_key text not null,
  description text not null,
  requires_confirmation boolean not null default false,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_scope, capability_key)
);

insert into public.domi_role_capabilities (role_scope, capability_key, description, requires_confirmation)
values
  ('customer','recommend_products','Recomendar productos y comercios según preferencias, disponibilidad y ubicación.',false),
  ('customer','explain_order','Explicar precios, estados, tiempos, pagos y seguimiento de pedidos.',false),
  ('customer','manage_memory','Mostrar, corregir o eliminar preferencias recordadas con autorización.',true),
  ('merchant','inventory_coach','Detectar productos con bajo inventario, rotación y riesgo de agotarse.',false),
  ('merchant','menu_audit','Identificar faltantes, precios inconsistentes, imágenes pendientes y oportunidades de menú.',false),
  ('merchant','draft_catalog_changes','Preparar cambios de inventario o menú antes de que el comercio los confirme.',true),
  ('courier','explain_balance','Explicar ganancias, efectivo cobrado, saldo y liquidaciones sin modificar valores.',false),
  ('courier','work_coach','Explicar uso de la app, jornada, pedidos, mapa, incidencias y buenas prácticas.',false),
  ('admin','operations_summary','Resumir la operación, alertas, comercios cerrados, pedidos y repartidores.',false),
  ('admin','financial_explanation','Explicar liquidaciones y diferencias usando únicamente el libro contable.',false),
  ('admin','draft_admin_action','Preparar acciones administrativas que siempre requieren confirmación humana.',true)
on conflict (role_scope, capability_key) do update set
  description = excluded.description,
  requires_confirmation = excluded.requires_confirmation,
  is_enabled = true;

create table if not exists public.catalog_image_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending','brief_ready','generated','merchant_review','approved','rejected','failed'
  )),
  product_snapshot jsonb not null,
  generation_brief text not null,
  negative_requirements text not null default 'No inventar marcas, ingredientes, tamaños, empaques, acompañamientos ni características no verificadas.',
  output_aspect_ratio text not null default '4:3',
  output_min_width integer not null default 1600 check (output_min_width >= 800),
  generated_image_url text,
  original_reference_url text,
  provider text,
  provider_job_id text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id)
);

create index if not exists idx_catalog_image_jobs_status
on public.catalog_image_jobs(status, created_at);

insert into public.catalog_image_jobs (
  product_id,
  business_id,
  status,
  product_snapshot,
  generation_brief,
  original_reference_url
)
select
  p.id,
  p.business_id,
  'brief_ready',
  jsonb_build_object(
    'product_id', p.id,
    'business_id', p.business_id,
    'business_name', b.name,
    'product_name', p.name,
    'description', p.description,
    'price_cop', p.price,
    'discount_price_cop', p.discount_price,
    'metadata', coalesce(p.metadata, '{}'::jsonb)
  ),
  concat(
    'Fotografía comercial hiperrealista del producto exacto "', p.name,
    '" del comercio "', b.name, '". ',
    case when nullif(trim(coalesce(p.description, '')), '') is null
      then 'No existe descripción verificada; usar únicamente una composición neutra y no inventar ingredientes.'
      else concat('Descripción verificada: ', p.description, '. ')
    end,
    'Fondo limpio coherente con la identidad DomiU, luz natural de estudio, producto completo, sin texto superpuesto, sin logotipos inventados, sin cambiar presentación ni cantidad.'
  ),
  p.image_url
from public.products p
join public.businesses b on b.id = p.business_id
where p.deleted_at is null
  and b.deleted_at is null
  and coalesce(b.metadata->>'catalog_status', 'live') = 'live'
  and (
    p.image_url is null
    or coalesce(p.metadata->>'image_status', '') in ('pending_official','pending_generated','')
  )
on conflict (product_id) do update set
  product_snapshot = excluded.product_snapshot,
  generation_brief = excluded.generation_brief,
  original_reference_url = excluded.original_reference_url,
  updated_at = now();

create or replace view public.merchant_catalog_quality_v
with (security_invoker = true)
as
select
  b.id as business_id,
  b.owner_id,
  b.name as business_name,
  count(p.id)::integer as total_products,
  count(p.id) filter (where p.status = 'available')::integer as available_products,
  count(p.id) filter (where coalesce(p.quantity_available, 0) <= 0)::integer as out_of_stock_products,
  count(p.id) filter (where coalesce(p.quantity_available, 0) between 1 and 5)::integer as low_stock_products,
  count(p.id) filter (where p.image_url is null)::integer as products_without_image,
  count(p.id) filter (where p.price is null or p.price <= 0)::integer as products_without_valid_price,
  count(j.id) filter (where j.status in ('pending','brief_ready','generated','merchant_review'))::integer as images_pending_review,
  count(j.id) filter (where j.status = 'approved')::integer as images_approved
from public.businesses b
left join public.products p on p.business_id = b.id and p.deleted_at is null
left join public.catalog_image_jobs j on j.product_id = p.id
group by b.id, b.owner_id, b.name;

alter table public.domi_agent_profiles enable row level security;
alter table public.domi_memories enable row level security;
alter table public.domi_conversations enable row level security;
alter table public.domi_messages enable row level security;
alter table public.domi_role_capabilities enable row level security;
alter table public.catalog_image_jobs enable row level security;

create policy domi_profiles_owner_or_admin_read on public.domi_agent_profiles
for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy domi_profiles_owner_update on public.domi_agent_profiles
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy domi_memories_owner_read on public.domi_memories
for select to authenticated using (user_id = auth.uid());

create policy domi_memories_owner_delete on public.domi_memories
for delete to authenticated using (user_id = auth.uid());

create policy domi_conversations_owner_all on public.domi_conversations
for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy domi_messages_owner_read on public.domi_messages
for select to authenticated using (user_id = auth.uid());

create policy domi_capabilities_authenticated_read on public.domi_role_capabilities
for select to authenticated using (is_enabled = true);

create policy catalog_image_jobs_merchant_or_admin_read on public.catalog_image_jobs
for select to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy catalog_image_jobs_merchant_review on public.catalog_image_jobs
for update to authenticated using (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

comment on table public.domi_memories is
'Memoria opcional y controlada por cada usuario. No debe guardar información sensible sin consentimiento explícito.';
comment on table public.catalog_image_jobs is
'Cola de imágenes basada únicamente en datos verificados del producto; toda imagen requiere revisión del comercio antes de publicarse.';
