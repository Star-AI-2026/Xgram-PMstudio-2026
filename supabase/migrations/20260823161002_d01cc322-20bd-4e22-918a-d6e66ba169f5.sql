-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  bio text,
  phone text,
  is_verified boolean NOT NULL DEFAULT false,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- CHATS
CREATE TABLE public.chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'direct',
  title text,
  description text,
  photo_url text,
  username text UNIQUE,
  is_public boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- CHAT MEMBERS
CREATE TABLE public.chat_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  is_pinned boolean NOT NULL DEFAULT false,
  is_muted boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_members TO authenticated;
GRANT ALL ON public.chat_members TO service_role;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

-- MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  attachment_url text,
  attachment_type text,
  attachment_name text,
  reply_to uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_chat_created_idx ON public.messages (chat_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- REACTIONS
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- HELPERS
CREATE OR REPLACE FUNCTION public.is_chat_member(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = _chat_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_chat_admin(_chat_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.chat_members WHERE chat_id = _chat_id AND user_id = _user_id AND role IN ('owner','admin'));
$$;

-- CHAT POLICIES
CREATE POLICY "chats_select_member_or_public" ON public.chats FOR SELECT TO authenticated
  USING (is_public OR public.is_chat_member(id, auth.uid()));
CREATE POLICY "chats_insert_own" ON public.chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "chats_update_admin" ON public.chats FOR UPDATE TO authenticated
  USING (public.is_chat_admin(id, auth.uid())) WITH CHECK (public.is_chat_admin(id, auth.uid()));
CREATE POLICY "chats_delete_owner" ON public.chats FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- MEMBER POLICIES
CREATE POLICY "members_select_same_chat" ON public.chat_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "members_insert" ON public.chat_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR public.is_chat_admin(chat_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.created_by = auth.uid())
  );
CREATE POLICY "members_update_self_or_admin" ON public.chat_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_admin(chat_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_chat_admin(chat_id, auth.uid()));
CREATE POLICY "members_delete_self_or_admin" ON public.chat_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_admin(chat_id, auth.uid()));

-- MESSAGE POLICIES
CREATE POLICY "messages_select_member" ON public.messages FOR SELECT TO authenticated
  USING (public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "messages_insert_member" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_chat_member(chat_id, auth.uid()));
CREATE POLICY "messages_update_own_or_admin" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = sender_id OR public.is_chat_admin(chat_id, auth.uid()))
  WITH CHECK (auth.uid() = sender_id OR public.is_chat_admin(chat_id, auth.uid()));
CREATE POLICY "messages_delete_own_or_admin" ON public.messages FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR public.is_chat_admin(chat_id, auth.uid()));

-- REACTION POLICIES
CREATE POLICY "reactions_select_member" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_chat_member(m.chat_id, auth.uid())));
CREATE POLICY "reactions_insert_own" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.messages m WHERE m.id = message_id AND public.is_chat_member(m.chat_id, auth.uid())));
CREATE POLICY "reactions_delete_own" ON public.message_reactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TIMESTAMPS
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER chats_updated_at BEFORE UPDATE ON public.chats FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- BUMP CHAT ON NEW MESSAGE
CREATE OR REPLACE FUNCTION public.bump_chat() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.chats SET updated_at = now() WHERE id = NEW.chat_id; RETURN NEW; END; $$;
CREATE TRIGGER messages_bump_chat AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_chat();

-- AUTO PROFILE
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE base_username text;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '', 'g');
  IF base_username = '' OR base_username IS NULL THEN base_username := 'user'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = base_username) THEN
    base_username := base_username || substr(replace(NEW.id::text, '-', ''), 1, 5);
  END IF;
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (NEW.id, base_username, COALESCE(NEW.raw_user_meta_data->>'display_name', base_username));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- REALTIME
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;