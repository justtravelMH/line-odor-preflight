begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

insert into public.users (id, auth_user_id, line_user_id_hash, line_user_id_encrypted, state) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'hash-a', 'encrypted-a', 'BUILDING_BASELINE'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'hash-b', 'encrypted-b', 'BUILDING_BASELINE');

insert into public.odor_records (
  id, user_id, odor_level, local_date, time_bucket, source_event_id
) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 1, current_date, 'MORNING', 'rls-a'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 3, current_date, 'MORNING', 'rls-b');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

do $$
declare
  visible_count integer;
  changed_count integer;
begin
  select count(*) into visible_count from public.odor_records;
  if visible_count <> 1 then
    raise exception 'RLS cross-user read failed: expected 1 row, got %', visible_count;
  end if;

  update public.odor_records set odor_level = 0
  where id = '20000000-0000-4000-8000-000000000002';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'RLS cross-user update failed: changed % rows', changed_count;
  end if;
end;
$$;

rollback;
