import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, code } = await req.json();

  const codes = await base44.asServiceRole.entities.VerificationCode.filter({ user_id: user.id, type, used: false });
  const valid = codes.find((c) => c.code === code && new Date(c.expires_at) > new Date());

  if (!valid) return Response.json({ error: 'Invalid or expired code' }, { status: 400 });

  // Mark used
  await base44.asServiceRole.entities.VerificationCode.update(valid.id, { used: true });

  // Update profile verification flag
  const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
  if (profiles.length > 0) {
    const updateData = type === 'email' ? { email_verified: true } : { phone_verified: true };
    const profile = profiles[0];
    const currentScore = profile.cine_score || 0;
    await base44.asServiceRole.entities.Profile.update(profile.id, {
      ...updateData,
      cine_score: Math.min(currentScore + 10, 100)
    });
  }

  return Response.json({ success: true });
});