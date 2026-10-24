// Deletes storage files queued by the database (deleted posts and messages,
// replaced avatars). Files that are evidence in an open report are kept until
// the report is resolved. Run hourly by a scheduled job.
import { json, removeAll, requireServiceRole, rpc } from '../_shared/admin.ts';

type Row = { id: number; bucket_id: string; object_path: string };

Deno.serve(async (req) => {
  const denied = requireServiceRole(req);
  if (denied) return denied;

  let rows: Row[];
  try {
    rows = await rpc<Row[]>('service_claim_storage_deletions', { p_limit: 500 });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }

  const byBucket = new Map<string, { ids: number[]; paths: string[] }>();
  for (const row of rows) {
    const entry = byBucket.get(row.bucket_id) ?? { ids: [], paths: [] };
    entry.ids.push(row.id);
    entry.paths.push(row.object_path);
    byBucket.set(row.bucket_id, entry);
  }

  let removed = 0;
  const failed: number[] = [];
  for (const [bucket, { ids, paths }] of byBucket) {
    try {
      await removeAll(bucket, paths);
      removed += paths.length;
    } catch {
      failed.push(...ids);
    }
  }
  if (failed.length) {
    await rpc('service_release_storage_deletions', { p_ids: failed }).catch(() => undefined);
  }
  return json({ removed, retried: failed.length });
});
