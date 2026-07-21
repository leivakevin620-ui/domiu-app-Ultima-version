-- Atomic manual order confirmation. Service-role only.

create or replace function public.confirm_manual_order(
  p_actor_id uuid,
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.profiles%rowtype;
  v_business public.businesses%rowtype;
  v_branch public.business_addresses%rowtype;
  v_customer public.profiles%rowtype;
  v_address public.addresses%rowtype;
  v_product public.products%rowtype;
  v_variant public.product_variants%rowtype;
  v_driver public.drivers%rowtype;
  v_item jsonb;
  v_normalized_items jsonb := '[]'::jsonb;
  v_item_row jsonb;
  v_order public.orders%rowtype;
  v_existing public.orders%rowtype;
  v_order_item_id uuid;
  v_customer_id uuid;
  v_address_id uuid;
  v_branch_id uuid;
  v_business_id uuid;
  v_courier_id uuid;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_item_total numeric;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_surcharge numeric := 0;
  v_tip numeric := 0;
  v_delivery_fee numeric := 0;
  v_distance numeric := 0;
  v_payment_method public.payment_method := 'cash';
  v_payment_status public.payment_status := 'pending';
  v_initial_status public.order_status := 'confirmed';
  v_delivery_type text := 'delivery';
  v_channel text;
  v_admin_override boolean := false;
  v_fee_override boolean := false;
  v_allow_custom boolean := false;
  v_allow_fee_override boolean := false;
  v_request_hash text;
  v_order_number text;
  v_custom boolean;
  v_customer_snapshot jsonb;
  v_address_snapshot jsonb;
  v_business_snapshot jsonb;
  v_draft_id uuid;
begin
  if p_actor_id is null then raise exception 'Actor requerido'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'Solicitud inválida'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 12 or length(trim(p_idempotency_key)) > 120 then
    raise exception 'Clave de idempotencia inválida';
  end if;

  select * into v_actor from public.profiles where id = p_actor_id and deleted_at is null;
  if v_actor.id is null or v_actor.status <> 'active'::public.user_status then
    raise exception 'La cuenta creadora no está activa';
  end if;
  if v_actor.role not in ('admin'::public.user_role,'merchant'::public.user_role) then
    raise exception 'No tienes permiso para crear pedidos manuales';
  end if;

  begin
    v_business_id := (p_payload->>'businessId')::uuid;
  exception when others then
    raise exception 'Negocio inválido';
  end;
  select * into v_business from public.businesses where id = v_business_id and deleted_at is null;
  if v_business.id is null then raise exception 'El negocio no existe'; end if;
  if v_actor.role = 'merchant'::public.user_role and v_business.owner_id <> p_actor_id then
    raise exception 'El negocio no pertenece a esta cuenta';
  end if;

  v_admin_override := v_actor.role = 'admin'::public.user_role
    and coalesce((p_payload->>'adminOverride')::boolean,false);
  if v_admin_override and length(trim(coalesce(p_payload->>'administrativeReason',''))) < 5 then
    raise exception 'Debes indicar el motivo administrativo de la excepción';
  end if;

  if not (coalesce(v_business.is_active,false) and coalesce(v_business.is_verified,false)
      and coalesce(v_business.is_accepting_orders,false) and v_business.operations_status='open')
    and not v_admin_override then
    raise exception 'El negocio está cerrado, inactivo o restringido';
  end if;

  begin
    v_branch_id := nullif(p_payload->>'branchId','')::uuid;
  exception when others then
    raise exception 'Sucursal inválida';
  end;
  if v_branch_id is not null then
    select * into v_branch from public.business_addresses
    where id=v_branch_id and business_id=v_business_id and deleted_at is null;
  else
    select * into v_branch from public.business_addresses
    where business_id=v_business_id and deleted_at is null
    order by is_primary desc, updated_at desc nulls last limit 1;
  end if;
  if v_branch.id is null then raise exception 'El negocio no tiene una sucursal válida'; end if;
  if not coalesce(v_branch.is_active,false) and not v_admin_override then
    raise exception 'La sucursal está inactiva';
  end if;
  v_branch_id := v_branch.id;

  v_request_hash := md5(p_payload::text);
  select * into v_existing from public.orders
  where created_by_user_id=p_actor_id and idempotency_key=trim(p_idempotency_key)
  limit 1;
  if v_existing.id is not null then
    if v_existing.manual_request_hash is distinct from v_request_hash then
      raise exception 'La clave de idempotencia ya fue usada con datos diferentes';
    end if;
    return jsonb_build_object(
      'orderId',v_existing.id,
      'orderNumber',v_existing.order_number,
      'status',v_existing.status,
      'totalAmount',v_existing.total_amount,
      'idempotent',true
    );
  end if;

  begin
    v_customer_id := nullif(p_payload->>'customerId','')::uuid;
  exception when others then
    raise exception 'Cliente registrado inválido';
  end;
  if v_customer_id is not null then
    select * into v_customer from public.profiles
    where id=v_customer_id and role='customer'::public.user_role and deleted_at is null;
    if v_customer.id is null then raise exception 'El cliente registrado no existe'; end if;
    if v_customer.status <> 'active'::public.user_status then raise exception 'El cliente registrado no está activo'; end if;
    v_customer_snapshot := jsonb_build_object(
      'type','registered','id',v_customer.id,
      'name',trim(concat_ws(' ',v_customer.first_name,v_customer.last_name)),
      'phone',v_customer.phone,'email',v_customer.email
    );
  else
    if length(trim(coalesce(p_payload#>>'{customer,name}',''))) < 3 then raise exception 'Nombre del cliente invitado requerido'; end if;
    if length(regexp_replace(coalesce(p_payload#>>'{customer,phone}',''),'\D','','g')) < 7 then raise exception 'Teléfono del cliente invitado inválido'; end if;
    v_customer_snapshot := jsonb_build_object(
      'type','guest',
      'name',trim(p_payload#>>'{customer,name}'),
      'phone',regexp_replace(p_payload#>>'{customer,phone}','\D','','g'),
      'email',nullif(trim(coalesce(p_payload#>>'{customer,email}','')),''),
      'notes',nullif(trim(coalesce(p_payload#>>'{customer,notes}','')),'')
    );
  end if;

  v_delivery_type := coalesce(nullif(p_payload->>'deliveryType',''),'delivery');
  if v_delivery_type not in ('delivery','pickup') then raise exception 'Tipo de entrega inválido'; end if;

  if v_delivery_type='delivery' then
    begin
      v_address_id := nullif(p_payload->>'addressId','')::uuid;
    exception when others then
      raise exception 'Dirección registrada inválida';
    end;
    if v_address_id is not null then
      select * into v_address from public.addresses where id=v_address_id and deleted_at is null;
      if v_address.id is null then raise exception 'La dirección no existe'; end if;
      if v_customer_id is null or v_address.user_id <> v_customer_id then
        raise exception 'La dirección no pertenece al cliente registrado';
      end if;
    else
      if length(trim(coalesce(p_payload#>>'{address,street}',''))) < 5 then raise exception 'Dirección de entrega requerida'; end if;
      insert into public.addresses(
        user_id,type,label,street_address,city,state_province,country,latitude,longitude,
        instructions,is_primary,neighborhood,formatted_address,place_id,metadata
      ) values (
        null,'other','Pedido manual',trim(p_payload#>>'{address,street}'),
        coalesce(nullif(trim(p_payload#>>'{address,city}'),''),'Santa Marta'),
        nullif(trim(coalesce(p_payload#>>'{address,state}','')),''),'Colombia',
        nullif(p_payload#>>'{address,latitude}','')::numeric,
        nullif(p_payload#>>'{address,longitude}','')::numeric,
        nullif(trim(coalesce(p_payload#>>'{address,instructions}','')),''),false,
        nullif(trim(coalesce(p_payload#>>'{address,neighborhood}','')),''),
        nullif(trim(coalesce(p_payload#>>'{address,formattedAddress}','')),''),
        nullif(trim(coalesce(p_payload#>>'{address,placeId}','')),''),
        jsonb_build_object('source','manual_order','actor_id',p_actor_id,'guest_address',v_customer_id is null)
      ) returning * into v_address;
      v_address_id := v_address.id;
    end if;
    v_address_snapshot := jsonb_build_object(
      'street',v_address.street_address,'city',v_address.city,'state',v_address.state_province,
      'country',v_address.country,'neighborhood',v_address.neighborhood,
      'instructions',v_address.instructions,'latitude',v_address.latitude,'longitude',v_address.longitude,
      'formattedAddress',v_address.formatted_address,'placeId',v_address.place_id
    );
  else
    v_address_id := null;
    v_address_snapshot := jsonb_build_object(
      'type','pickup','branchId',v_branch.id,
      'street',v_branch.street_address,'city',v_branch.city,
      'latitude',v_branch.latitude,'longitude',v_branch.longitude
    );
  end if;

  if jsonb_typeof(p_payload->'items') <> 'array' or jsonb_array_length(p_payload->'items') < 1 then
    raise exception 'Agrega al menos un producto';
  end if;
  if jsonb_array_length(p_payload->'items') > 50 then raise exception 'El pedido supera el máximo de productos'; end if;

  v_allow_custom := v_actor.role='admin'::public.user_role or coalesce(v_business.allow_custom_manual_products,false);
  for v_item in select value from jsonb_array_elements(p_payload->'items')
  loop
    v_custom := coalesce((v_item->>'isCustom')::boolean,false);
    v_quantity := greatest(coalesce((v_item->>'quantity')::integer,0),0);
    if v_quantity < 1 or v_quantity > 99 then raise exception 'Cantidad de producto inválida'; end if;

    if v_custom then
      if not v_allow_custom then raise exception 'El negocio no tiene permiso para artículos personalizados'; end if;
      if length(trim(coalesce(v_item->>'name',''))) < 2 then raise exception 'Nombre del artículo personalizado requerido'; end if;
      v_unit_price := coalesce((v_item->>'unitPrice')::numeric,-1);
      if v_unit_price < 0 then raise exception 'Precio personalizado inválido'; end if;
      v_item_total := v_unit_price*v_quantity;
      v_item_row := jsonb_build_object(
        'productId',null,'variantId',null,'quantity',v_quantity,'unitPrice',v_unit_price,
        'itemTotal',v_item_total,'isCustom',true,'name',trim(v_item->>'name'),
        'sku',null,'description',nullif(trim(coalesce(v_item->>'description','')),''),
        'instructions',nullif(trim(coalesce(v_item->>'instructions','')),''),
        'variant',null,'modifiers',coalesce(v_item->'modifiers','[]'::jsonb),
        'productSnapshot',jsonb_build_object('custom',true,'name',trim(v_item->>'name'),'unitPrice',v_unit_price)
      );
    else
      begin
        v_product_id := (v_item->>'productId')::uuid;
      exception when others then
        raise exception 'Producto inválido';
      end;
      select * into v_product from public.products
      where id=v_product_id and business_id=v_business_id and deleted_at is null
      for update;
      if v_product.id is null then raise exception 'Un producto no pertenece al negocio seleccionado'; end if;
      if v_product.status <> 'available'::public.product_status and not v_admin_override then
        raise exception 'El producto % no está disponible',v_product.name;
      end if;

      begin
        v_variant_id := nullif(v_item->>'variantId','')::uuid;
      exception when others then
        raise exception 'Variante inválida';
      end;
      v_unit_price := case
        when v_product.discount_price is not null and v_product.discount_price >= 0 and v_product.discount_price < v_product.price
          then v_product.discount_price
        else v_product.price
      end;

      if v_variant_id is not null then
        select * into v_variant from public.product_variants
        where id=v_variant_id and product_id=v_product.id
        for update;
        if v_variant.id is null or not coalesce(v_variant.is_active,false) then raise exception 'La variante seleccionada no está disponible'; end if;
        if coalesce(v_variant.quantity_available,0) < v_quantity then raise exception 'Inventario insuficiente para la variante de %',v_product.name; end if;
        v_unit_price := v_unit_price+coalesce(v_variant.price_modifier,0);
        update public.product_variants
        set quantity_available=quantity_available-v_quantity,updated_at=now()
        where id=v_variant.id and quantity_available>=v_quantity;
        if not found then raise exception 'Inventario modificado por otro pedido. Revisa la variante de %',v_product.name; end if;
      else
        if coalesce(v_product.quantity_available,0) < v_quantity then raise exception 'Inventario insuficiente para %',v_product.name; end if;
        update public.products
        set quantity_available=quantity_available-v_quantity,updated_at=now()
        where id=v_product.id and quantity_available>=v_quantity;
        if not found then raise exception 'Inventario modificado por otro pedido. Revisa %',v_product.name; end if;
      end if;

      v_item_total := v_unit_price*v_quantity;
      v_item_row := jsonb_build_object(
        'productId',v_product.id,'variantId',v_variant_id,'quantity',v_quantity,
        'unitPrice',v_unit_price,'itemTotal',v_item_total,'isCustom',false,
        'name',v_product.name,'sku',v_product.sku,'description',v_product.description,
        'instructions',nullif(trim(coalesce(v_item->>'instructions','')),''),
        'variant',case when v_variant_id is null then null else jsonb_build_object(
          'id',v_variant.id,'name',v_variant.name,'values',v_variant.values,
          'priceModifier',v_variant.price_modifier,'skuSuffix',v_variant.sku_suffix
        ) end,
        'modifiers',coalesce(v_item->'modifiers','[]'::jsonb),
        'productSnapshot',jsonb_build_object(
          'id',v_product.id,'name',v_product.name,'sku',v_product.sku,
          'price',v_product.price,'discountPrice',v_product.discount_price,
          'unitPriceCharged',v_unit_price,'businessId',v_product.business_id
        )
      );
    end if;

    v_subtotal := v_subtotal+v_item_total;
    v_normalized_items := v_normalized_items||jsonb_build_array(v_item_row);
    v_product_id := null;
    v_variant_id := null;
  end loop;

  v_discount := greatest(coalesce((p_payload->>'discountAmount')::numeric,0),0);
  v_surcharge := greatest(coalesce((p_payload->>'surchargeAmount')::numeric,0),0);
  v_tip := greatest(coalesce((p_payload->>'tipAmount')::numeric,0),0);
  if v_discount > v_subtotal then raise exception 'El descuento supera el subtotal'; end if;
  if (v_discount>0 or v_surcharge>0) and v_actor.role<>'admin'::public.user_role then
    raise exception 'Solo un administrador autorizado puede aplicar descuentos o recargos manuales';
  end if;
  if (v_discount>0 or v_surcharge>0) and length(trim(coalesce(p_payload->>'administrativeReason',''))) < 5 then
    raise exception 'Debes indicar el motivo del descuento o recargo';
  end if;

  v_fee_override := coalesce((p_payload->>'deliveryFeeOverridden')::boolean,false);
  v_allow_fee_override := v_actor.role='admin'::public.user_role or coalesce(v_business.allow_manual_delivery_fee_override,false);
  if v_fee_override and not v_allow_fee_override then raise exception 'No tienes permiso para modificar la tarifa de domicilio'; end if;
  if v_fee_override and length(trim(coalesce(p_payload->>'deliveryFeeOverrideReason',''))) < 5 then
    raise exception 'Debes indicar el motivo de la tarifa manual';
  end if;
  v_delivery_fee := case when v_delivery_type='pickup' then 0 else greatest(coalesce((p_payload->>'deliveryFee')::numeric,0),0) end;
  v_distance := greatest(coalesce((p_payload->>'distanceKm')::numeric,0),0);

  begin
    v_payment_method := coalesce(nullif(p_payload->>'paymentMethod',''),'cash')::public.payment_method;
    v_payment_status := coalesce(nullif(p_payload->>'paymentStatus',''),'pending')::public.payment_status;
  exception when others then
    raise exception 'Método o estado de pago inválido';
  end;
  if v_payment_status='completed'::public.payment_status
    and v_payment_method<>'cash'::public.payment_method
    and length(trim(coalesce(p_payload->>'paymentReference',''))) < 3 then
    raise exception 'La referencia de pago es obligatoria para registrar el pedido como pagado';
  end if;

  begin
    v_courier_id := nullif(p_payload->>'courierId','')::uuid;
  exception when others then
    raise exception 'Repartidor inválido';
  end;
  if v_courier_id is not null then
    if v_actor.role<>'admin'::public.user_role then raise exception 'El comercio no puede asignar repartidor directamente'; end if;
    if v_delivery_type='pickup' then raise exception 'Un pedido para recoger no requiere repartidor'; end if;
    select * into v_driver from public.drivers
    where id=v_courier_id and is_active=true and is_verified=true and status='available'::public.driver_status
    for update;
    if v_driver.id is null then raise exception 'El repartidor no está disponible o autorizado'; end if;
    if not exists(select 1 from public.profiles p where p.id=v_courier_id and p.status='active'::public.user_status and p.role='courier'::public.user_role) then
      raise exception 'La cuenta del repartidor no está activa';
    end if;
    v_initial_status := 'assigned'::public.order_status;
  else
    begin
      v_initial_status := coalesce(nullif(p_payload->>'initialStatus',''),'confirmed')::public.order_status;
    exception when others then
      raise exception 'Estado inicial inválido';
    end;
    if v_initial_status not in ('pending'::public.order_status,'confirmed'::public.order_status) then
      raise exception 'El estado inicial no está permitido';
    end if;
  end if;

  v_channel := coalesce(nullif(p_payload->>'salesChannel',''),'other');
  if v_channel not in ('whatsapp','phone','in_person','instagram','facebook','direct_message','other') then
    raise exception 'Canal de origen inválido';
  end if;
  if v_channel='other' and length(trim(coalesce(p_payload->>'salesChannelOther',''))) < 2 then
    raise exception 'Describe el canal de origen';
  end if;

  v_business_snapshot := jsonb_build_object(
    'id',v_business.id,'name',v_business.name,'phone',v_business.phone,
    'branchId',v_branch.id,'branchName',v_branch.name,
    'branchAddress',v_branch.street_address,'branchCity',v_branch.city
  );

  v_order_number := public.generate_order_number();
  insert into public.orders(
    order_number,order_code,order_type,customer_id,business_id,courier_id,delivery_address_id,
    status,payment_status,payment_method,subtotal,delivery_fee,discount_amount,tax_amount,total_amount,
    special_instructions,metadata,pickup_address_id,route_distance_km,route_duration_minutes,route_source,
    payment_reference,created_manually,creation_source,created_by_user_id,created_by_role,created_from_panel,
    branch_id,guest_customer,customer_snapshot,delivery_address_snapshot,business_snapshot,sales_channel,
    sales_channel_other,delivery_type,delivery_fee_source,delivery_fee_overridden,delivery_fee_override_reason,
    currency,kitchen_notes,courier_notes,internal_notes,payment_notes,administrative_reason,idempotency_key,
    manual_request_hash,amount_paid,surcharge_amount,tip_amount,customer_phone
  ) values (
    v_order_number,v_order_number,'manual_order',v_customer_id,v_business_id,v_courier_id,v_address_id,
    v_initial_status,v_payment_status,v_payment_method,v_subtotal,v_delivery_fee,v_discount,0,0,
    nullif(trim(coalesce(p_payload->>'generalNotes','')),''),
    jsonb_build_object(
      'source','manual_order','manual_admin_override',v_admin_override,
      'assignment_mode',case when v_courier_id is null then 'public' else 'manual' end,
      'raw_external_text',left(nullif(coalesce(p_payload->>'rawExternalText',''),''),4000),
      'address_warning_confirmed',coalesce((p_payload->>'addressWarningConfirmed')::boolean,false),
      'request_hash',v_request_hash
    ),
    v_branch.id,v_distance,coalesce((p_payload->>'durationMinutes')::integer,0),
    case when v_fee_override then 'manual_override' when v_distance>0 then 'manual_distance' else 'fallback' end,
    nullif(trim(coalesce(p_payload->>'paymentReference','')),''),true,'manual',p_actor_id,v_actor.role::text,
    case when v_actor.role='admin'::public.user_role then 'admin' else 'merchant' end,
    v_branch.id,case when v_customer_id is null then v_customer_snapshot else null end,
    v_customer_snapshot,v_address_snapshot,v_business_snapshot,v_channel,
    nullif(trim(coalesce(p_payload->>'salesChannelOther','')),''),v_delivery_type,
    case when v_delivery_type='pickup' then 'pickup' when v_fee_override then 'manual' when v_distance>0 then 'automatic' else 'fallback' end,
    v_fee_override,nullif(trim(coalesce(p_payload->>'deliveryFeeOverrideReason','')),''),'COP',
    nullif(trim(coalesce(p_payload->>'kitchenNotes','')),''),
    nullif(trim(coalesce(p_payload->>'courierNotes','')),''),
    nullif(trim(coalesce(p_payload->>'internalNotes','')),''),
    nullif(trim(coalesce(p_payload->>'paymentNotes','')),''),
    nullif(trim(coalesce(p_payload->>'administrativeReason','')),''),trim(p_idempotency_key),v_request_hash,
    greatest(coalesce((p_payload->>'amountPaid')::numeric,0),0),v_surcharge,v_tip,
    coalesce(v_customer.phone,v_customer_snapshot->>'phone')
  ) returning * into v_order;

  for v_item_row in select value from jsonb_array_elements(v_normalized_items)
  loop
    insert into public.order_items(
      order_id,product_id,quantity,unit_price,item_total,variant_selections,special_instructions,
      product_name_snapshot,product_sku_snapshot,product_snapshot,variant_snapshot,modifiers_snapshot,
      is_custom_product,custom_description
    ) values (
      v_order.id,nullif(v_item_row->>'productId','')::uuid,(v_item_row->>'quantity')::integer,
      (v_item_row->>'unitPrice')::numeric,(v_item_row->>'itemTotal')::numeric,
      v_item_row->'variant',nullif(v_item_row->>'instructions',''),v_item_row->>'name',
      nullif(v_item_row->>'sku',''),coalesce(v_item_row->'productSnapshot','{}'::jsonb),
      v_item_row->'variant',coalesce(v_item_row->'modifiers','[]'::jsonb),
      coalesce((v_item_row->>'isCustom')::boolean,false),nullif(v_item_row->>'description','')
    ) returning id into v_order_item_id;

    if not coalesce((v_item_row->>'isCustom')::boolean,false) then
      insert into public.manual_order_inventory_movements(
        order_id,order_item_id,product_id,variant_id,movement_type,quantity,actor_id,reason,metadata
      ) values (
        v_order.id,v_order_item_id,(v_item_row->>'productId')::uuid,
        nullif(v_item_row->>'variantId','')::uuid,'decrement',(v_item_row->>'quantity')::integer,
        p_actor_id,'Confirmación de pedido manual',jsonb_build_object('unit_price',v_item_row->>'unitPrice')
      );
    end if;
  end loop;

  insert into public.order_tracking(order_id,status,notes)
  values(v_order.id,v_order.status,'Pedido manual confirmado desde el panel '||case when v_actor.role='admin' then 'administrativo' else 'del negocio' end);

  insert into public.audit_log(
    user_id,user_email,user_role,action,entity_type,entity_id,details,result,metadata
  ) values (
    p_actor_id,v_actor.email,v_actor.role::text,'manual_order_created','orders',v_order.id::text,
    jsonb_build_object(
      'businessId',v_business.id,'branchId',v_branch.id,'orderNumber',v_order.order_number,
      'customerType',case when v_customer_id is null then 'guest' else 'registered' end,
      'salesChannel',v_channel,'deliveryType',v_delivery_type,'itemKinds',jsonb_array_length(v_normalized_items),
      'subtotal',v_order.subtotal,'deliveryFee',v_order.delivery_fee,'totalAmount',v_order.total_amount,
      'deliveryFeeOverridden',v_fee_override,'initialStatus',v_order.status,'courierId',v_courier_id,
      'idempotencyKey',trim(p_idempotency_key),'administrativeReason',nullif(trim(coalesce(p_payload->>'administrativeReason','')),'')
    ),'success',jsonb_build_object('source','confirm_manual_order_rpc')
  );

  begin
    v_draft_id := nullif(p_payload->>'draftId','')::uuid;
  exception when others then
    v_draft_id := null;
  end;
  if v_draft_id is not null then
    update public.manual_order_drafts
    set status='converted',converted_order_id=v_order.id,updated_at=now()
    where id=v_draft_id and actor_id=p_actor_id and status='draft';
  end if;

  return jsonb_build_object(
    'orderId',v_order.id,'orderNumber',v_order.order_number,'status',v_order.status,
    'subtotal',v_order.subtotal,'deliveryFee',v_order.delivery_fee,'serviceFee',v_order.service_fee,
    'totalAmount',v_order.total_amount,'customerType',case when v_customer_id is null then 'guest' else 'registered' end,
    'idempotent',false
  );
end;
$$;

revoke all on function public.confirm_manual_order(uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.confirm_manual_order(uuid,jsonb,text) to service_role;

comment on function public.confirm_manual_order(uuid,jsonb,text) is
  'Creates a manual order atomically after validating actor, tenant, branch, customer, products, prices, inventory and idempotency.';
