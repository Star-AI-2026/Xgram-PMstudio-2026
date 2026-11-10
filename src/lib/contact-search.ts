import { supabase } from "@/integrations/supabase/client";

export type ContactSearchResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  last_seen: string;
};

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

/**
 * Searches the existing profiles table through the authenticated Supabase
 * client. It never downloads the full directory: filtering and limits are
 * applied by PostgREST/database before rows are returned to the browser.
 * Email lookup is intentionally excluded because auth.users.email is not
 * exposed to normal authenticated clients and profiles has no email column.
 */
export async function searchProfiles(
  rawQuery: string,
  currentUserId: string,
): Promise<ContactSearchResult[]> {
  const raw = rawQuery.trim();
  const usernameOnly = raw.startsWith("@");
  const term = usernameOnly ? raw.slice(1).trim() : raw;

  if (term.length < 3 || term.length > 100 || (raw.includes("@") && !usernameOnly)) {
    return [];
  }

  const pattern = `%${escapeLike(term)}%`;
  const select = "id, username, display_name, avatar_url, is_verified, last_seen";

  const usernameRequest = supabase
    .from("profiles")
    .select(select)
    .neq("id", currentUserId)
    .ilike("username", pattern)
    .order("username", { ascending: true })
    .limit(25);

  const nameRequest = usernameOnly
    ? null
    : supabase
        .from("profiles")
        .select(select)
        .neq("id", currentUserId)
        .ilike("display_name", pattern)
        .order("display_name", { ascending: true })
        .limit(25);

  const usernameResult = await usernameRequest;
  if (usernameResult.error) throw usernameResult.error;

  let matchedRows: ContactSearchResult[] = (usernameResult.data ?? []) as ContactSearchResult[];
  if (!usernameOnly && nameRequest) {
    const nameResult = await nameRequest;
    if (nameResult.error) throw nameResult.error;
    matchedRows = [...matchedRows, ...((nameResult.data ?? []) as ContactSearchResult[])];
  }

  const unique = new Map<string, ContactSearchResult>();
  for (const row of matchedRows) {
    unique.set(row.id, row as ContactSearchResult);
  }

  const normalized = term.toLocaleLowerCase();
  return [...unique.values()]
    .sort((a, b) => {
      const aName = a.display_name.toLocaleLowerCase();
      const bName = b.display_name.toLocaleLowerCase();
      const aUser = a.username.toLocaleLowerCase();
      const bUser = b.username.toLocaleLowerCase();
      const aRank = aUser === normalized || aName === normalized
        ? 0
        : aName.startsWith(normalized) || aUser.startsWith(normalized) ? 1 : 2;
      const bRank = bUser === normalized || bName === normalized
        ? 0
        : bName.startsWith(normalized) || bUser.startsWith(normalized) ? 1 : 2;
      return aRank - bRank || aName.localeCompare(bName);
    })
    .slice(0, 30);
}
