-- 1. New accounts default to English
ALTER TABLE public.profiles ALTER COLUMN language SET DEFAULT 'en';

-- 2. Group / channel permission settings
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS send_messages_policy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS send_media_policy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS send_files_policy text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS send_links_policy text NOT NULL DEFAULT 'everyone';

DO $$ BEGIN
  ALTER TABLE public.chats ADD CONSTRAINT chats_permission_values CHECK (
    send_messages_policy IN ('everyone','admins')
    AND send_media_policy IN ('everyone','admins')
    AND send_files_policy IN ('everyone','admins')
    AND send_links_policy IN ('everyone','admins')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Posting permission enforced in the database
CREATE OR REPLACE FUNCTION public.can_post_in_chat(
  _chat_id uuid,
  _user_id uuid,
  _has_attachment boolean DEFAULT false,
  _attachment_type text DEFAULT NULL,
  _content text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE c record;
BEGIN
  IF NOT public.is_chat_member(_chat_id, _user_id) THEN RETURN false; END IF;
  IF public.is_chat_admin(_chat_id, _user_id) THEN RETURN true; END IF;

  SELECT type, send_messages_policy, send_media_policy, send_files_policy, send_links_policy
    INTO c FROM public.chats WHERE id = _chat_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF c.type = 'direct' THEN RETURN true; END IF;

  IF c.send_messages_policy = 'admins' THEN RETURN false; END IF;

  IF _has_attachment THEN
    IF COALESCE(_attachment_type,'') LIKE 'image/%'
       OR COALESCE(_attachment_type,'') LIKE 'video/%'
       OR COALESCE(_attachment_type,'') LIKE 'audio/%' THEN
      IF c.send_media_policy = 'admins' THEN RETURN false; END IF;
    ELSE
      IF c.send_files_policy = 'admins' THEN RETURN false; END IF;
    END IF;
  END IF;

  IF c.send_links_policy = 'admins' AND COALESCE(_content,'') ~* '(https?://|www\.)' THEN
    RETURN false;
  END IF;

  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.can_post_in_chat(uuid, uuid, boolean, text, text) TO authenticated;

DROP POLICY IF EXISTS messages_insert_member ON public.messages;
CREATE POLICY messages_insert_member ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND public.can_post_in_chat(chat_id, auth.uid(), attachment_url IS NOT NULL, attachment_type, content)
);

-- 4. Members must never be able to promote themselves
CREATE OR REPLACE FUNCTION public.guard_member_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND COALESCE(current_setting('xgram.role_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'roles can only be changed through set_member_role()';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS chat_members_guard_role ON public.chat_members;
CREATE TRIGGER chat_members_guard_role
BEFORE UPDATE ON public.chat_members
FOR EACH ROW EXECUTE FUNCTION public.guard_member_role_change();

CREATE OR REPLACE FUNCTION public.set_member_role(_chat_id uuid, _user_id uuid, _role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target_role text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _role NOT IN ('admin','member') THEN RAISE EXCEPTION 'invalid role'; END IF;
  IF NOT public.is_chat_admin(_chat_id, _uid) THEN RAISE EXCEPTION 'not allowed'; END IF;

  SELECT role INTO _target_role FROM public.chat_members
   WHERE chat_id = _chat_id AND user_id = _user_id;
  IF _target_role IS NULL THEN RAISE EXCEPTION 'not a member of this chat'; END IF;
  IF _target_role = 'owner' THEN RAISE EXCEPTION 'the owner role cannot be changed'; END IF;

  IF _target_role = 'admin' AND _role = 'member'
     AND NOT EXISTS (
       SELECT 1 FROM public.chat_members
        WHERE chat_id = _chat_id AND user_id = _uid AND role = 'owner'
     ) THEN
    RAISE EXCEPTION 'only the owner can remove an admin';
  END IF;

  PERFORM set_config('xgram.role_change', 'on', true);
  UPDATE public.chat_members SET role = _role
   WHERE chat_id = _chat_id AND user_id = _user_id;
  PERFORM set_config('xgram.role_change', 'off', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;

-- 5. Adding members is an admin action
CREATE OR REPLACE FUNCTION public.add_chat_members(_chat_id uuid, _member_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _member uuid;
  _added integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_chat_admin(_chat_id, _uid) THEN RAISE EXCEPTION 'not allowed'; END IF;

  FOREACH _member IN ARRAY COALESCE(_member_ids, '{}'::uuid[]) LOOP
    INSERT INTO public.chat_members (chat_id, user_id, role)
    VALUES (_chat_id, _member, 'member')
    ON CONFLICT DO NOTHING;
    IF FOUND THEN _added := _added + 1; END IF;
  END LOOP;

  UPDATE public.chats SET updated_at = now() WHERE id = _chat_id;
  RETURN _added;
END; $$;

GRANT EXECUTE ON FUNCTION public.add_chat_members(uuid, uuid[]) TO authenticated;

DROP POLICY IF EXISTS members_insert ON public.chat_members;
CREATE POLICY members_insert ON public.chat_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_chat_admin(chat_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.created_by = auth.uid())
  OR (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.is_public)
  )
);

-- 6. Live updates for group settings and membership
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;