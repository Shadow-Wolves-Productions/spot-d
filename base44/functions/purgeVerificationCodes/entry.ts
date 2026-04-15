import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Runs every 24 hours. Deletes used or expired VerificationCode records
// to keep the table clean and remove sensitive plaintext codes.

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const now = new Date().toISOString();

  const allCodes = await base44.asServiceRole.entities.VerificationCode.list('-created_date', 500);

  const toDelete = allCodes.filter((c) => c.used === true || c.expires_at < now);

  await Promise.all(toDelete.map((c) => base44.asServiceRole.entities.VerificationCode.delete(c.id)));

  return Response.json({ deleted: toDelete.length });
});