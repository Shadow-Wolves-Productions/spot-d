import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, code } = await req.json();

  const codes = await base44.asServiceRole.entities.VerificationCode.filter({ user_id: user.id, type, used: false });
  const valid = codes.find((c) => c.code === code && new Date(c.expires_at) > new Date());

  if (!valid) return Response.json({ error: 'Invalid or expired code' }, { status: 400 });

  await base44.asServiceRole.entities.VerificationCode.update(valid.id, { used: true });

  const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
  if (profiles.length > 0) {
    const profile = profiles[0];
    const updateData = type === 'email' ? { email_verified: true } : { phone_verified: true };

    // Also auto-verify union if union_number is set and user has a non-Non-Union status
    const hasUnion = profile.union_status?.some((u) => u !== 'Non-Union');
    if (profile.union_number && hasUnion) {
      updateData.union_verified = true;
    }

    await base44.asServiceRole.entities.Profile.update(profile.id, updateData);

    // Recalculate full CineScore
    await base44.asServiceRole.functions.invoke('recalculateCineScore', {});
  }

  return Response.json({ success: true });
});