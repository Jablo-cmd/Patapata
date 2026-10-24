// Permanently deletes accounts whose deletion grace period (14 days) has
// passed: first their files in Storage, then the auth user, which cascades
// to every row they own in the database. Run daily by a scheduled job.
import { deleteAuthUser, json, listAll, removeAll, requireServiceRole, rpc, select } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  const denied = requireServiceRole(req);
  if (denied) return denied;

  let ids: string[];
  try {
    ids = await rpc<string[]>('service_accounts_due_for_purge', { p_limit: 25 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }

  const results: { id: string; ok: boolean; files: number; error?: string }[] = [];
  for (const id of ids) {
    try {
      let files = 0;
      for (const bucket of ['avatars', 'post-media']) {
        const paths = await listAll(bucket, id);
        await removeAll(bucket, paths);
        files += paths.length;
      }
      const memberships = await select<{ conversation_id: string }[]>(
        'conversation_members',
        `select=conversation_id&user_id=eq.${id}`,
      );
      for (const m of memberships) {
        const paths = await listAll('message-media', `${m.conversation_id}/${id}`);
        await removeAll('message-media', paths);
        files += paths.length;
      }
      await deleteAuthUser(id);
      results.push({ id, ok: true, files });
    } catch (e) {
      results.push({ id, ok: false, files: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return json({ purged: results.filter((r) => r.ok).length, results });
});
