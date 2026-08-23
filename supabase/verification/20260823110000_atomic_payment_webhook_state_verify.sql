-- Prove the writer exists, is server-only, and refuses the same provider event
-- twice. The transaction is rolled back so verification leaves no audit row.
begin;

do $$
begin
  if to_regprocedure(
    'public.apply_payment_webhook_event(text,text,timestamptz,text,text,text,text,uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,text,boolean)'
  ) is null then
    raise exception 'atomic payment webhook function is missing';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.apply_payment_webhook_event(text,text,timestamptz,text,text,text,text,uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,text,boolean)',
    'execute'
  ) then
    raise exception 'authenticated clients can execute the payment writer';
  end if;
end;
$$;

select public.apply_payment_webhook_event(
  'verify_atomic_payment_event', 'adjustment.updated', now(), 'sandbox', null,
  'ignore', 'verification', null, null, null, null, null, null, null, null,
  null, null, false
);

do $$
declare _result text;
begin
  select public.apply_payment_webhook_event(
    'verify_atomic_payment_event', 'adjustment.updated', now(), 'sandbox', null,
    'ignore', 'verification', null, null, null, null, null, null, null, null,
    null, null, false
  ) into _result;
  if _result <> 'duplicate' then
    raise exception 'duplicate payment event was not refused: %', _result;
  end if;
end;
$$;

rollback;
