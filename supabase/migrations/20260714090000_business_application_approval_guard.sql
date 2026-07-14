-- Prevent two concurrent approvals from creating more than one active business
-- for the same business application.

create unique index if not exists businesses_application_id_unique_active_idx
on public.businesses ((metadata ->> 'application_id'))
where deleted_at is null
  and metadata ? 'application_id'
  and nullif(metadata ->> 'application_id', '') is not null;
