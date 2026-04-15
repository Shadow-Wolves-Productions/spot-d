import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function calculateCineScore(profile, endorsementCount, castingCount) {
  let score = 0;
  if (profile.full_name) score += 4;
  if (profile.profile_photo) score += 8;
  if (profile.primary_role) score += 5;
  if (profile.bio) score += 8;
  if (profile.city) score += 3;
  if (profile.experience_level) score += 4;
  if (profile.years_of_experience > 0) score += 3;
  if (profile.email) score += 2;
  if (profile.phone) score += 2;
  if (profile.imdb_link) score += 6;
  if (profile.showreel_link) score += 6;
  if (profile.website) score += 2;
  if (profile.instagram || profile.linkedin) score += 2;
  if (profile.credits?.length > 0) score += Math.min(profile.credits.length * 2, 10);
  if (profile.union_status?.length > 0) score += 2;
  if (profile.headshots?.length > 0) score += 4;
  if (profile.special_skills?.length > 0) score += 2;
  if (profile.languages_spoken?.length > 0) score += 2;
  if (profile.willing_to_travel) score += 1;
  if (profile.email_verified) score += 8;
  if (profile.phone_verified) score += 6;
  if (profile.union_verified) score += 6;
  if (profile.imdb_verified) score += 8;
  score += Math.min(endorsementCount * 2, 10);
  score += Math.min(castingCount * 2, 6);
  return Math.min(Math.round(score), 100);
}

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

    // Apply verification flag to profile object for score calculation
    const updatedProfile = { ...profile, ...updateData };

    // Auto-verify union if union number is set and has a real union membership
    const hasUnion = profile.union_status?.some((u) => u !== 'Non-Union');
    if (profile.union_number && hasUnion) {
      updateData.union_verified = true;
      updatedProfile.union_verified = true;
    }

    const [endorsements, castingApps] = await Promise.all([
      base44.asServiceRole.entities.Endorsement.filter({ profile_id: profile.id }),
      base44.asServiceRole.entities.CastingApplication.filter({ applicant_user_id: user.id }),
    ]);

    const newScore = calculateCineScore(updatedProfile, endorsements.length, castingApps.length);
    updateData.spot_score = newScore;

    await base44.asServiceRole.entities.Profile.update(profile.id, updateData);
  }

  return Response.json({ success: true });
});