-- Profile-photo storage: a public `avatars` bucket + RLS on storage.objects.
--
-- Profile photos were only kept in the local Zustand store (a data URL), so
-- they never persisted to Supabase, didn't survive a reinstall / new device,
-- and weren't visible to other users. The app now uploads the picked image to
-- this bucket and stores its public URL in profiles.avatar_url (which
-- AuthBootstrap already loads into me.picture).
--
-- Layout: objects are keyed `<user_id>/<filename>`, so a user can only write
-- under their own folder. The bucket is public-read (avatars are shown to
-- everyone who can see the profile).

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read (the bucket is public; this makes the intent explicit + works
-- even if the project later flips bucket-level public off).
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- A user may write/replace/remove only objects in their own `<uid>/…` folder.
create policy "Users upload their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
