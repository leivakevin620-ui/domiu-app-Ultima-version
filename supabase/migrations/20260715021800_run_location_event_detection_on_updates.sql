drop trigger if exists auto_detect_geofence on public.driver_locations;

create trigger auto_detect_geofence
after insert or update of latitude, longitude, order_id
on public.driver_locations
for each row
when (new.order_id is not null)
execute function public.detect_geofence_event();
