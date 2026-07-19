-- Private service tables intentionally have no user policies and no grants.
revoke all on public.webhook_events, public.audit_logs from anon, authenticated;

-- The preflight helper may exist on older project databases, but it is not part
-- of this repository's empty-database migration chain.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

create index if not exists analysis_results_user_id_idx on public.analysis_results(user_id);
create index if not exists analysis_results_improvement_id_idx on public.analysis_results(improvement_id);
create index if not exists baseline_snapshots_user_id_idx on public.baseline_snapshots(user_id);
create index if not exists improvements_baseline_snapshot_id_idx on public.improvements(baseline_snapshot_id);
create index if not exists odor_records_user_id_idx on public.odor_records(user_id);
create index if not exists odor_records_improvement_id_idx on public.odor_records(improvement_id);
