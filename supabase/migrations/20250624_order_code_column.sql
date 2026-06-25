alter table public.orders
add column if not exists order_code text;

create unique index if not exists orders_order_code_unique_idx
on public.orders(order_code)
where order_code is not null;
