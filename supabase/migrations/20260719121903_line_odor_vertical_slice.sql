-- Atomic server-only RPCs for the LINE odor vertical slice.
-- All user-facing tables remain protected by RLS. These RPCs are callable only
-- with the backend service role and intentionally remain SECURITY INVOKER.

grant usage on schema public to authenticated, service_role;
grant select on public.users, public.households, public.baseline_snapshots,
  public.improvements, public.odor_records, public.analysis_results,
  public.user_consents, public.deletion_requests to authenticated;
grant insert, update, delete on public.households, public.improvements,
  public.odor_records to authenticated;
grant all on public.users, public.households, public.baseline_snapshots,
  public.improvements, public.odor_records, public.analysis_results,
  public.webhook_events, public.user_consents, public.deletion_requests,
  public.audit_logs to service_role;

create or replace function public.complete_line_onboarding(
  p_line_user_id_hash text,
  p_line_user_id_encrypted text,
  p_litter_box_count smallint,
  p_observation_context text,
  p_privacy_version text,
  p_locale text default 'zh-TW',
  p_timezone text default 'Asia/Taipei'
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user public.users;
begin
  insert into public.users (
    line_user_id_hash, line_user_id_encrypted, state, locale
  ) values (
    p_line_user_id_hash, p_line_user_id_encrypted, 'BUILDING_BASELINE', p_locale
  )
  on conflict (line_user_id_hash) do update
    set line_user_id_encrypted = excluded.line_user_id_encrypted,
        state = case
          when public.users.state in ('NEW_USER', 'ONBOARDING')
            then 'BUILDING_BASELINE'::public.user_state
          else public.users.state
        end,
        locale = excluded.locale,
        updated_at = now()
  returning * into v_user;

  insert into public.households (
    user_id, litter_box_count, observation_context, timezone, completed_at
  ) values (
    v_user.id, p_litter_box_count, p_observation_context, p_timezone, now()
  )
  on conflict (user_id) do update
    set litter_box_count = excluded.litter_box_count,
        observation_context = excluded.observation_context,
        timezone = excluded.timezone,
        completed_at = now();

  insert into public.user_consents (user_id, privacy_version, accepted_at, source)
  values (v_user.id, p_privacy_version, now(), 'LIFF_ONBOARDING')
  on conflict (user_id) do update
    set privacy_version = excluded.privacy_version,
        accepted_at = now(), withdrawn_at = null, source = excluded.source;

  return jsonb_build_object(
    'state', v_user.state,
    'baselineProgress', jsonb_build_object('current', 0, 'required', 3)
  );
end;
$$;

create or replace function public.register_line_webhook_event(
  p_webhook_event_id text,
  p_event_type text,
  p_payload_sha256 text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_inserted integer;
begin
  insert into public.webhook_events (
    webhook_event_id, event_type, status, payload_sha256, processed_at
  ) values (
    p_webhook_event_id, p_event_type, 'PROCESSED', p_payload_sha256, now()
  ) on conflict (webhook_event_id) do nothing;
  get diagnostics v_inserted = row_count;
  return jsonb_build_object('duplicate', v_inserted = 0);
end;
$$;

create or replace function public.record_line_odor(
  p_line_user_id_hash text,
  p_odor_level smallint,
  p_source_event_id text,
  p_recorded_at timestamptz,
  p_local_date date,
  p_time_bucket public.time_bucket,
  p_webhook_event_id text default null,
  p_event_type text default 'postback',
  p_payload_sha256 text default null
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user public.users;
  v_record_id uuid;
  v_improvement_id uuid;
  v_baseline_ids uuid[];
  v_baseline_count integer;
  v_median numeric(2,1);
  v_bucket public.time_bucket;
  v_inserted integer;
  v_state public.user_state;
begin
  if p_webhook_event_id is not null then
    insert into public.webhook_events (
      webhook_event_id, event_type, status, payload_sha256
    ) values (
      p_webhook_event_id, p_event_type, 'RECEIVED', coalesce(p_payload_sha256, '')
    ) on conflict (webhook_event_id) do nothing;
    get diagnostics v_inserted = row_count;
    if v_inserted = 0 then
      return jsonb_build_object('duplicate', true);
    end if;
  end if;

  select * into v_user from public.users
  where line_user_id_hash = p_line_user_id_hash and deleted_at is null;

  if v_user.id is null then
    if p_webhook_event_id is not null then
      update public.webhook_events set
        status = 'IGNORED', processed_at = now(), error_code = 'USER_NOT_ONBOARDED'
      where webhook_event_id = p_webhook_event_id;
    end if;
    return jsonb_build_object('duplicate', false, 'errorCode', 'USER_NOT_ONBOARDED');
  end if;

  select id into v_improvement_id from public.improvements
  where user_id = v_user.id and status = 'ACTIVE'
  order by started_at desc limit 1;

  insert into public.odor_records (
    user_id, improvement_id, odor_level, recorded_at, local_date,
    time_bucket, source_event_id
  ) values (
    v_user.id, v_improvement_id, p_odor_level, p_recorded_at, p_local_date,
    p_time_bucket, p_source_event_id
  ) on conflict (source_event_id) do nothing
  returning id into v_record_id;

  if v_record_id is null then
    if p_webhook_event_id is not null then
      update public.webhook_events set status = 'PROCESSED', processed_at = now()
      where webhook_event_id = p_webhook_event_id;
    end if;
    return jsonb_build_object('duplicate', true);
  end if;

  select count(*)::integer into v_baseline_count
  from public.odor_records where user_id = v_user.id and improvement_id is null;
  v_baseline_count := least(v_baseline_count, 3);

  if v_improvement_id is null and v_baseline_count >= 3 then
    select array_agg(id order by recorded_at, id),
           percentile_cont(0.5) within group (order by odor_level)
      into v_baseline_ids, v_median
    from (
      select id, odor_level, recorded_at
      from public.odor_records
      where user_id = v_user.id and improvement_id is null
      order by recorded_at, id limit 3
    ) first_three;

    select time_bucket into v_bucket
    from public.odor_records
    where id = any(v_baseline_ids)
    group by time_bucket
    order by count(*) desc, time_bucket::text asc
    limit 1;

    if not exists (
      select 1 from public.baseline_snapshots where user_id = v_user.id
    ) then
      insert into public.baseline_snapshots (
        user_id, record_ids, median_level, dominant_time_bucket, rule_version
      ) values (v_user.id, v_baseline_ids, v_median, v_bucket, 'LINE_ODOR_MVP_SPEC_V1');
    end if;
    v_state := 'BASELINE_READY';
    update public.users set state = v_state, updated_at = now() where id = v_user.id;
  elsif v_improvement_id is not null then
    v_state := 'IMPROVEMENT_ACTIVE';
  else
    v_state := 'BUILDING_BASELINE';
    update public.users set state = v_state, updated_at = now() where id = v_user.id;
  end if;

  if p_webhook_event_id is not null then
    update public.webhook_events set status = 'PROCESSED', processed_at = now()
    where webhook_event_id = p_webhook_event_id;
  end if;

  return jsonb_build_object(
    'duplicate', false,
    'recordId', v_record_id,
    'state', v_state,
    'baselineProgress', jsonb_build_object('current', v_baseline_count, 'required', 3)
  );
end;
$$;

create or replace function public.start_line_improvement(
  p_line_user_id_hash text,
  p_type public.improvement_type,
  p_note varchar(80) default null
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_snapshot_id uuid;
  v_improvement public.improvements;
begin
  select id into v_user_id from public.users
  where line_user_id_hash = p_line_user_id_hash and deleted_at is null;
  if v_user_id is null then raise exception 'USER_NOT_FOUND'; end if;

  select * into v_improvement from public.improvements
  where user_id = v_user_id and status = 'ACTIVE' limit 1;
  if v_improvement.id is not null then
    return to_jsonb(v_improvement);
  end if;

  select id into v_snapshot_id from public.baseline_snapshots
  where user_id = v_user_id order by created_at desc limit 1;
  if v_snapshot_id is null then raise exception 'BASELINE_NOT_READY'; end if;

  insert into public.improvements (user_id, type, note, status, baseline_snapshot_id)
  values (v_user_id, p_type, nullif(trim(p_note), ''), 'ACTIVE', v_snapshot_id)
  returning * into v_improvement;
  update public.users set state = 'IMPROVEMENT_ACTIVE', updated_at = now()
  where id = v_user_id;
  return to_jsonb(v_improvement);
end;
$$;

create or replace function public.request_line_data_deletion(
  p_line_user_id_hash text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_request public.deletion_requests;
begin
  select id into v_user_id from public.users
  where line_user_id_hash = p_line_user_id_hash and deleted_at is null;
  if v_user_id is null then raise exception 'USER_NOT_FOUND'; end if;

  select * into v_request from public.deletion_requests
  where user_id = v_user_id and status in ('PENDING', 'PROCESSING')
  order by requested_at desc limit 1;
  if v_request.id is null then
    insert into public.deletion_requests (user_id, status)
    values (v_user_id, 'PENDING') returning * into v_request;
  end if;
  update public.users set state = 'DATA_DELETION_PENDING', updated_at = now()
  where id = v_user_id;
  return to_jsonb(v_request);
end;
$$;

revoke execute on function public.complete_line_onboarding(text,text,smallint,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.register_line_webhook_event(text,text,text) from public, anon, authenticated;
revoke execute on function public.record_line_odor(text,smallint,text,timestamptz,date,public.time_bucket,text,text,text) from public, anon, authenticated;
revoke execute on function public.start_line_improvement(text,public.improvement_type,varchar) from public, anon, authenticated;
revoke execute on function public.request_line_data_deletion(text) from public, anon, authenticated;
grant execute on function public.complete_line_onboarding(text,text,smallint,text,text,text,text) to service_role;
grant execute on function public.register_line_webhook_event(text,text,text) to service_role;
grant execute on function public.record_line_odor(text,smallint,text,timestamptz,date,public.time_bucket,text,text,text) to service_role;
grant execute on function public.start_line_improvement(text,public.improvement_type,varchar) to service_role;
grant execute on function public.request_line_data_deletion(text) to service_role;
