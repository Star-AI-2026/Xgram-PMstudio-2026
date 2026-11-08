<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Contact discovery uses the authenticated, narrowly projected database lookup function rather than downloading profiles, because exact email matching must not expose addresses or private fields.
- Startup synchronization uses a single global status overlay and a waitable resync event for mounted chat views, because the main UI must remain hidden until recovery reads complete.
- Administration uses a dedicated encrypted HttpOnly cookie session backed by Cloud Auth and a server-validated user_roles row; privileged operations use server functions, not Edge Functions, to match the TanStack runtime.
- Moderation changes and audit entries run in one database transaction; restrictive ban policies and verification triggers preserve existing permission boundaries, and durable cleanup jobs prevent orphaned storage after conversation deletion.
