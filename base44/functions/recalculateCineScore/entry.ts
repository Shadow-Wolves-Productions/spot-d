import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

function calculateCineScore(profile, endorsementCount, castingCount) {
  let score = 0;

  // Profile completeness
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

  // Verification bonuses
  if (profile.email_verified) score += 8;
  if (profile.phone_verified) score += 6;
  if (profile.union_verified) score += 6;
  if (profile.imdb_verified) score += 8;

  // Engagement bonuses
  score += Math.min(endorsementCount * 2, 10); // up to +10 for endorsements
  score += Math.min(castingCount * 2, 6);       // up to +6 for casting participation

  return Math.min(Math.round(score), 100);
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: user.id });
  if (!profiles.length) return Response.json({ error: 'No profile found' }, { status: 404 });

  const profile = profiles[0];

  const [endorsements, castingApps] = await Promise.all([
    base44.asServiceRole.entities.Endorsement.filter({ profile_id: profile.id }),
    base44.asServiceRole.entities.CastingApplication.filter({ applicant_user_id: user.id }),
  ]);

  const newScore = calculateCineScore(profile, endorsements.length, castingApps.length);

  await base44.asServiceRole.entities.Profile.update(profile.id, { spot_score: newScore });

  return Response.json({ success: true, spot_score: newScore });
});