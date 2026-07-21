-- DomiU Magdalena — contrato RPC v2 para pedidos manuales
-- Mantiene v1 como núcleo compatible y agrega datos complementarios en la misma transacción.

begin;

create or replace function public.create_manual_order_v2(p_actor_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_order_id uuid;
  v_reference text;
  v_draft_id uuid;
begin
  v_result:=public.create_manual_order_v1(p_actor_id,p_payload);
  v_order_id:=nullif(v_result->>'order_id','')::uuid;
  v_reference:=nullif(trim(p_payload->>'payment_reference'),'');
  v_draft_id:=nullif(p_payload->>'draft_id','')::uuid;

  if v_order_id is not null and v_reference is not null then
    update public.orders
    set payment_reference=v_reference,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('payment_reference_recorded',true)
    where id=v_order_id and created_by_user_id=p_actor_id and created_manually=true;
  end if;

  if v_order_id is not null and v_draft_id is not null then
    update public.manual_order_drafts
    set status='confirmed',confirmed_order_id=v_order_id,updated_at=now(),version=version+1
    where id=v_draft_id and actor_id=p_actor_id and status='draft';
  end if;

  return v_result;
end;
$$;

revoke all on function public.create_manual_order_v2(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_manual_order_v2(uuid,jsonb) to service_role;

comment on function public.create_manual_order_v2(uuid,jsonb) is
  'Contrato transaccional vigente para crear pedidos manuales, registrar referencia de pago y confirmar borrador.';

commit;
