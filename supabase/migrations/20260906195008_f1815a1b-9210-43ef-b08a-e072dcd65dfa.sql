REVOKE EXECUTE ON FUNCTION public.mark_messages_as_read(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.unread_counts() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unread_counts() TO authenticated;