-- 1) Creator can always read their own chat (fixes INSERT ... RETURNING failing RLS SELECT)
DROP POLICY IF EXISTS chats_select_member_or_public ON public.chats;
CREATE POLICY chats_select_member_or_public ON public.chats
  FOR SELECT TO authenticated
  USING (is_public OR created_by = auth.uid() OR public.is_chat_member(id, auth.uid()));

-- 2) Atomic, secure chat creation
CREATE OR REPLACE FUNCTION public.create_chat_with_members(
  _type text,
  _title text DEFAULT NULL,
  _description text DEFAULT NULL,
  _member_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _chat_id uuid;
  _member uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _type NOT IN ('direct','group','channel') THEN
    RAISE EXCEPTION 'invalid chat type: %', _type;
  END IF;

  INSERT INTO public.chats (type, title, description, created_by)
  VALUES (_type, _title, _description, _uid)
  RETURNING id INTO _chat_id;

  INSERT INTO public.chat_members (chat_id, user_id, role)
  VALUES (_chat_id, _uid, 'owner');

  FOREACH _member IN ARRAY COALESCE(_member_ids, '{}'::uuid[]) LOOP
    IF _member <> _uid THEN
      INSERT INTO public.chat_members (chat_id, user_id, role)
      VALUES (_chat_id, _member, 'member')
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  RETURN _chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_chat_with_members(text, text, text, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_chat_with_members(text, text, text, uuid[]) TO authenticated;