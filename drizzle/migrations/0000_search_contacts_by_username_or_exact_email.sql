CREATE OR REPLACE FUNCTION public.search_xgram_contacts(_query text)
RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, is_verified boolean, last_seen timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE term text := lower(trim(_query));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF length(term) > 254 THEN RETURN; END IF;
  IF term ~ '^@[a-z0-9_]{3,32}$' THEN
    RETURN QUERY SELECT p.id, p.username, p.display_name, p.avatar_url, p.is_verified, p.last_seen
      FROM public.profiles p
      WHERE lower(p.username) LIKE replace(substring(term from 2), '_', '\_') || '%' ESCAPE '\'
        AND p.id <> auth.uid()
      ORDER BY p.username LIMIT 30;
  ELSIF term ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$' THEN
    RETURN QUERY SELECT p.id, p.username, p.display_name, p.avatar_url, p.is_verified, p.last_seen
      FROM auth.users u JOIN public.profiles p ON p.id = u.id
      WHERE lower(u.email) = term AND p.id <> auth.uid()
      LIMIT 1;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.search_xgram_contacts(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_xgram_contacts(text) TO authenticated;