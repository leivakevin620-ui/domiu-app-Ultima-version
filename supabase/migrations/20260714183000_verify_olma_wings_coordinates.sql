do $migration$
declare
  v_business_id uuid;
begin
  select id into v_business_id
  from public.businesses
  where slug = 'olma-wings-and-smokehouse'
    and deleted_at is null
  limit 1;

  if v_business_id is null then
    raise notice 'Olma Wings no existe todavía; se omite la ubicación verificada.';
    return;
  end if;

  update public.businesses
  set latitude = 11.22603270355503,
      longitude = -74.1897235511212,
      updated_at = now()
  where id = v_business_id;

  update public.business_addresses
  set latitude = 11.22603270355503,
      longitude = -74.1897235511212,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'coordinates_source', 'verified_business_record',
        'location_verified', true
      ),
      updated_at = now()
  where business_id = v_business_id
    and is_primary = true
    and deleted_at is null;
end
$migration$;
