-- DomiU Magdalena
-- Catálogo real de Santa Marta con separación estricta entre:
--   1. comercios habilitados para recibir pedidos;
--   2. fichas reales en validación, sin inventario ni precios fabricados.

update public.businesses
set logo_url = '/businesses/olma-wings-logo.svg',
    phone = coalesce(phone, '+57 310 6437059'),
    description = 'Alitas, tenders y carnes ahumadas con sabores de smokehouse en Santa Marta.',
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'catalog_status', 'live',
      'accepting_orders', true,
      'logo_source', 'Archivo oficial entregado por el negocio',
      'logo_background_removed', true,
      'address', 'Cl. 29h #21E-9, Comuna 1, Santa Marta, Magdalena',
      'source_verified_at', '2026-07-18'
    ),
    updated_at = now()
where slug = 'olma-wings-and-smokehouse';

-- Las fotos genéricas se retiran de la interfaz hasta contar con las originales.
update public.products
set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
      'previous_image_url', image_url,
      'image_status', 'pending_official',
      'image_source', 'Pendiente fotografía oficial de Olma Wings'
    ),
    image_url = null,
    updated_at = now()
where business_id = (
  select id from public.businesses where slug = 'olma-wings-and-smokehouse' limit 1
)
and deleted_at is null
and coalesce(metadata->>'image_status', '') <> 'verified';

do $$
declare
  v_owner uuid;
begin
  select id into v_owner
  from public.profiles
  where role = 'admin' and deleted_at is null
  order by created_at
  limit 1;

  if v_owner is null then
    raise notice 'No existe administrador para administrar las fichas de catálogo.';
    return;
  end if;

  insert into public.businesses (
    owner_id, name, slug, description, cuisine_type, business_type,
    phone, website, rating, total_ratings, is_verified, is_active, metadata
  ) values
  (v_owner, 'Éxito Santa Marta Centro', 'exito-santa-marta-centro',
   'Supermercado real de Santa Marta. Catálogo informativo en proceso de validación.',
   'Supermercado', 'supermarket', null, 'https://www.exito.com', 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 5 #19-20, Santa Marta','hours','Lunes a sábado 8:00 a. m. - 9:00 p. m.; domingo 9:00 a. m. - 6:00 p. m.','source_name','Localizador oficial de Almacenes Éxito','source_verified_at','2026-07-18')),

  (v_owner, 'Éxito Libertador', 'exito-libertador-santa-marta',
   'Supermercado real de Santa Marta. Catálogo informativo en proceso de validación.',
   'Supermercado', 'supermarket', null, 'https://www.exito.com', 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Avenida El Libertador #23-1, Comuna 4, Santa Marta','hours','Todos los días 8:00 a. m. - 9:00 p. m.','source_name','Localizador oficial de Almacenes Éxito','source_verified_at','2026-07-18')),

  (v_owner, 'Éxito Buenavista Santa Marta', 'exito-buenavista-santa-marta',
   'Supermercado real de Santa Marta. Catálogo informativo en proceso de validación.',
   'Supermercado', 'supermarket', null, 'https://www.exito.com', 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 29A #9A-14 Local 56, Santa Marta','hours','Lunes a sábado 8:00 a. m. - 9:00 p. m.; domingo 8:30 a. m. - 9:00 p. m.','source_name','Localizador oficial de Almacenes Éxito','source_verified_at','2026-07-18')),

  (v_owner, 'Oliva Panadería y Pastelería', 'oliva-panaderia-santa-marta',
   'Panadería, pastelería, desayunos y platos fuertes en Santa Marta. Catálogo en validación.',
   'Panadería', 'bakery', '+57 317 7506407', 'https://oliva.com.co', 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 4 #26-40 Local 113, Santa Marta','source_name','Sitio oficial de Oliva Panadería y Pastelería','source_verified_at','2026-07-18')),

  (v_owner, 'Celia Pizzería', 'celia-pizzeria-santa-marta',
   'Pizzería artesanal con masa madre en Santa Marta. Catálogo en validación.',
   'Pizza', 'restaurant', '+57 313 3592131', null, 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 14 #15-14, Santa Marta','hours','Todos los días 5:30 p. m. - 11:00 p. m.','source_name','Ficha pública del establecimiento','source_verified_at','2026-07-18')),

  (v_owner, 'Mammamia', 'mammamia-santa-marta',
   'Restaurante italiano y pizzería en el centro de Santa Marta. Catálogo en validación.',
   'Italiana', 'restaurant', null, null, 4.9, 13, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Calle 19 #3-99, Comuna 2, Santa Marta','source_name','Ficha pública del establecimiento','source_verified_at','2026-07-18')),

  (v_owner, 'Alitas Donde Ryan', 'alitas-donde-ryan-santa-marta',
   'Restaurante de alitas en Santa Marta. Catálogo y precios en validación.',
   'Comida Rápida', 'restaurant', '+57 302 4457921', null, 5.0, 2, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Calle 5 #9A-03, Comuna 3, Santa Marta','hours','Todos los días 12:00 m. - 12:00 a. m.','source_name','Ficha pública del establecimiento','source_verified_at','2026-07-18')),

  (v_owner, 'Droguería La Economía Libertador', 'drogueria-la-economia-libertador',
   'Droguería real de Santa Marta. Ficha informativa en validación; pedidos aún no habilitados.',
   'Farmacia', 'pharmacy', '+57 605 3699090', null, 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Avenida El Libertador #18-61, Santa Marta','hours','Todos los días 7:00 a. m. - 9:00 p. m.','source_name','Directorio público del establecimiento','source_verified_at','2026-07-18')),

  (v_owner, 'Droguería La Economía Centro', 'drogueria-la-economia-centro',
   'Droguería real de Santa Marta. Ficha informativa en validación; pedidos aún no habilitados.',
   'Farmacia', 'pharmacy', null, null, 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Calle 22 #2-07, Comuna 2, Santa Marta','hours','Todos los días 7:00 a. m. - 9:00 p. m.','phone_public','(605) 3699090','source_name','Waze y directorio público','source_verified_at','2026-07-18')),

  (v_owner, 'La Rebaja Central Santa Marta', 'la-rebaja-central-santa-marta',
   'Droguería real de Santa Marta. Ficha informativa en validación; pedidos aún no habilitados.',
   'Farmacia', 'pharmacy', null, null, 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 5 #19-40, Santa Marta','source_name','Directorio de sucursales y ficha pública','source_verified_at','2026-07-18')),

  (v_owner, 'La Rebaja Rodadero Centro', 'la-rebaja-rodadero-centro',
   'Droguería real del sector Rodadero. Ficha informativa en validación; pedidos aún no habilitados.',
   'Farmacia', 'pharmacy', null, null, 0, 0, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 3 #8-09, El Rodadero, Santa Marta','source_name','Directorio público de sucursales','source_verified_at','2026-07-18')),

  (v_owner, 'Santa Marta Liquors', 'santa-marta-liquors',
   'Comercio local de bebidas en Santa Marta. Catálogo no habilitado.',
   'Licorera', 'liquor_store', '+57 301 6642089', null, 4.4, 96, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Calle 29 #23-84, Santa Marta','source_name','Ficha pública del establecimiento','source_verified_at','2026-07-18','age_restricted',true)),

  (v_owner, 'Licores Santa Marta 24/7', 'licores-santa-marta-24-7',
   'Comercio local de bebidas en Santa Marta. Catálogo no habilitado.',
   'Licorera', 'liquor_store', '+57 302 8536586', null, 4.6, 14, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 36A #14-27, Santa Marta','hours','24 horas','source_name','Ficha pública del establecimiento','source_verified_at','2026-07-18','age_restricted',true)),

  (v_owner, 'Guarapitos Santa Marta', 'guarapitos-santa-marta',
   'Comercio especializado de bebidas en el Centro Histórico. Catálogo no habilitado.',
   'Licorera', 'liquor_store', '+57 312 3155555', null, 4.8, 31, false, true,
   jsonb_build_object('catalog_status','preview','accepting_orders',false,'address','Carrera 3A #17-27, Centro Histórico, CC REX local 8, Santa Marta','source_name','Ficha pública del establecimiento','source_verified_at','2026-07-18','age_restricted',true))

  on conflict (slug) do update set
    name = excluded.name,
    description = excluded.description,
    cuisine_type = excluded.cuisine_type,
    business_type = excluded.business_type,
    phone = excluded.phone,
    website = excluded.website,
    rating = excluded.rating,
    total_ratings = excluded.total_ratings,
    metadata = excluded.metadata,
    is_active = true,
    updated_at = now();
end $$;
