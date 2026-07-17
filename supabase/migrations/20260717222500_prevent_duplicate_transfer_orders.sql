create unique index if not exists orders_unique_active_transfer_reference
  on public.orders(customer_id, business_id, payment_reference)
  where payment_method = 'transfer'
    and payment_reference is not null
    and deleted_at is null
    and status <> 'cancelled';
