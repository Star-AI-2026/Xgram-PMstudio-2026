CREATE TABLE public.message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX message_reads_chat_user_idx ON public.message_reads (chat_id, user_id);
CREATE INDEX message_reads_message_idx ON public.message_reads (message_id);

GRANT SELECT, INSERT, DELETE ON public.message_reads TO authenticated;
GRANT ALL ON public.message_reads TO service_role;

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY message_reads_select_member ON public.message_reads
  FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));

CREATE POLICY message_reads_insert_own ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_chat_member(chat_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND m.chat_id = message_reads.chat_id AND m.sender_id <> auth.uid()
    )
  );

CREATE POLICY message_reads_delete_own ON public.message_reads
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.mark_messages_as_read(_chat_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _inserted integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.is_chat_member(_chat_id, _uid) THEN RAISE EXCEPTION 'not a member'; END IF;

  WITH ins AS (
    INSERT INTO public.message_reads (message_id, chat_id, user_id)
    SELECT m.id, m.chat_id, _uid
    FROM public.messages m
    WHERE m.chat_id = _chat_id
      AND m.sender_id <> _uid
      AND NOT EXISTS (
        SELECT 1 FROM public.message_reads r WHERE r.message_id = m.id AND r.user_id = _uid
      )
    ON CONFLICT (message_id, user_id) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _inserted FROM ins;

  UPDATE public.chat_members
  SET last_read_at = now()
  WHERE chat_id = _chat_id AND user_id = _uid;

  RETURN _inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.unread_counts()
RETURNS TABLE (chat_id uuid, unread_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT m.chat_id, count(*)::bigint
  FROM public.messages m
  JOIN public.chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = auth.uid()
  WHERE m.sender_id <> auth.uid()
    AND m.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.message_reads r
      WHERE r.message_id = m.id AND r.user_id = auth.uid()
    )
  GROUP BY m.chat_id;
$$;

GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unread_counts() TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER TABLE public.message_reads REPLICA IDENTITY FULL;