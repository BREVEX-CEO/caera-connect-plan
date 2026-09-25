-- Drop enum types left behind by retired products (workspace messaging,
-- tenants, approvals, launch gates). Checked on the live project on
-- 2026-09-25: no column, function argument, return type or function body uses
-- any of them. No CASCADE, so this fails instead of dropping anything that
-- still depends on one.

DROP TYPE IF EXISTS
  public.approval_decision,
  public.approval_status,
  public.approval_subject,
  public.employment_status,
  public.feature_flag_stage,
  public.launch_gate_status,
  public.msg_grant_status,
  public.msg_link_kind,
  public.msg_member_role,
  public.msg_message_kind,
  public.msg_scope_badge,
  public.msg_thread_kind,
  public.tenant_kind,
  public.tenant_role,
  public.worker_type;
