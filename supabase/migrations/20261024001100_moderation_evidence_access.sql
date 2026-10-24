-- Moderators may view a message attachment only when that exact file is
-- part of a report's evidence. They still cannot browse conversations.
create or replace function app.is_reported_attachment(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reports r
    where r.target_type = 'message' and r.evidence ->> 'attachment_path' = p_path
  );
$$;
grant execute on function app.is_reported_attachment(text) to authenticated;

create policy "staff read reported message attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'message-media'
    and app.is_staff((select auth.uid()))
    and app.is_reported_attachment(name)
  );

-- Keep files that are evidence in an unresolved report until it is resolved.
create or replace function public.service_claim_storage_deletions(p_limit int default 200)
returns table (id bigint, bucket_id text, object_path text)
language sql
security definer
set search_path = ''
as $$
  update app.storage_deletion_queue q set processed_at = now()
  where q.id in (
    select d.id from app.storage_deletion_queue d
    where d.processed_at is null
      and not exists (
        select 1 from public.reports r
        where r.status in ('open', 'in_review')
          and (r.evidence ->> 'attachment_path' = d.object_path
               or r.evidence -> 'media' ? d.object_path)
      )
    order by d.id
    limit p_limit
  )
  returning q.id, q.bucket_id, q.object_path;
$$;
revoke execute on function public.service_claim_storage_deletions(int) from public, anon, authenticated;
