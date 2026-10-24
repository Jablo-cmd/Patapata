-- Storage buckets and access policies.
--
--   avatars        public read (profile pictures and covers are part of the
--                  public profile card); writes only to "<uid>/...".
--   post-media     private; readable by the owner or anyone allowed to see a
--                  post that references the file. Served via signed URLs.
--   message-media  private; "<conversation_id>/<uid>/..." readable only by
--                  conversation members.
--
-- Size and type limits are enforced by the storage service; the app also
-- compresses images before upload (see src/lib/media.ts).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('post-media', 'post-media', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp']),
  ('message-media', 'message-media', false, 5 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function app.try_uuid(p text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

-- Avatars & covers
create policy "avatar owners read" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar owners upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
              and array_length(storage.foldername(name), 1) = 1);
create policy "avatar owners update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatar owners delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Post media
create policy "post media upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'post-media'
              and (storage.foldername(name))[1] = (select auth.uid())::text
              and array_length(storage.foldername(name), 1) = 1
              and app.is_active((select auth.uid())));
create policy "post media readable when post is visible" on storage.objects
  for select to authenticated
  using (bucket_id = 'post-media' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.post_media pm
               where pm.storage_path = name and app.can_view_post(pm.post_id, (select auth.uid())))
  ));
create policy "post media owners delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Message attachments
create policy "message media upload by permitted senders" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-media'
              and array_length(storage.foldername(name), 1) = 2
              and (storage.foldername(name))[2] = (select auth.uid())::text
              and app.can_send_in_conversation(app.try_uuid((storage.foldername(name))[1]), (select auth.uid())));
create policy "message media readable by members" on storage.objects
  for select to authenticated
  using (bucket_id = 'message-media'
         and app.is_conversation_member(app.try_uuid((storage.foldername(name))[1]), (select auth.uid())));

-- Replacing an avatar/cover queues the old file for deletion.
create or replace function app.profiles_media_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.avatar_path is not null and old.avatar_path is distinct from new.avatar_path then
    insert into app.storage_deletion_queue (bucket_id, object_path) values ('avatars', old.avatar_path);
  end if;
  if old.cover_path is not null and old.cover_path is distinct from new.cover_path then
    insert into app.storage_deletion_queue (bucket_id, object_path) values ('avatars', old.cover_path);
  end if;
  return new;
end;
$$;
create trigger profiles_media_cleanup after update of avatar_path, cover_path on public.profiles
  for each row execute function app.profiles_media_cleanup();

-- Avatar/cover paths must point at files that were actually uploaded.
create or replace function app.profiles_media_exists()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_path is not null and new.avatar_path is distinct from old.avatar_path
     and not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = new.avatar_path) then
    raise exception 'avatar_not_uploaded' using errcode = '22023';
  end if;
  if new.cover_path is not null and new.cover_path is distinct from old.cover_path
     and not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = new.cover_path) then
    raise exception 'cover_not_uploaded' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger profiles_media_exists before update of avatar_path, cover_path on public.profiles
  for each row execute function app.profiles_media_exists();
