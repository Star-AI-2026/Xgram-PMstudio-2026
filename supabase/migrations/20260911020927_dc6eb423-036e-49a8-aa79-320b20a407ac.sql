-- Trigger-only functions: not callable through the API at all
REVOKE ALL ON FUNCTION public.guard_member_role_change() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.bump_chat() FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, public;

-- Policy helpers: keep EXECUTE for signed-in users (RLS needs it), drop anonymous access
REVOKE ALL ON FUNCTION public.is_chat_member(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_chat_admin(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.can_post_in_chat(uuid, uuid, boolean, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_chat_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_chat_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_post_in_chat(uuid, uuid, boolean, text, text) TO authenticated;

-- App actions: signed-in users only
REVOKE ALL ON FUNCTION public.create_chat_with_members(text, text, text, uuid[]) FROM anon, public;
REVOKE ALL ON FUNCTION public.mark_messages_as_read(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.unread_counts() FROM anon, public;
REVOKE ALL ON FUNCTION public.set_member_role(uuid, uuid, text) FROM anon, public;
REVOKE ALL ON FUNCTION public.add_chat_members(uuid, uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_chat_with_members(text, text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_as_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unread_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_chat_members(uuid, uuid[]) TO authenticated;