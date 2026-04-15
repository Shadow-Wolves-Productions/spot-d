import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function calculateSpotScore(profile, endorsementCount, savedByCount, revealedByCount, recentLogin, appliedToCasting, postedCasting, confirmedSpottedWith) {
  let score = 0;

  // PROFILE COMPLETENESS
  if (profile.profile_photo) score += 5;
  if (profile.bio) score += 5;
  if (profile.primary_role) score += 3;
  if (profile.city) score += 2;
  if (profile.imdb_link) score += 5;
  if (profile.showreel_link) score += 5;

  // VERIFIED IDENTITY
  if (profile.email_verified) score += 7;
  if (profile.phone_verified) score += 8;

  // ENDORSEMENTS / SPOTS
  if (endorsementCount >= 10) score += 25;
  else if (endorsementCount >= 6) score += 20;
  else if (endorsementCount >= 3) score += 14;
  else if (endorsementCount >= 1) score += 8;

  // SOCIAL CREDIBILITY
  if (savedByCount >= 15) score += 17;
  else if (savedByCount >= 5) score += 12;
  else if (savedByCount >= 1) score += 5;
  if (revealedByCount >= 3) score += 5;
  if (confirmedSpottedWith >= 1) score += 3;

  // APP ENGAGEMENT
  if (recentLogin) score += 3;
  if (appliedToCasting) score += 4;
  if (postedCasting) score += 3;

  return Math.min(Math.round(score), 100);
}

function calculatePercentile(score, allScores) {
  if (allScores.length === 0) return 100;
  const below = allScores.filter(s => s < score).length;
  return Math.round((below / allScores.length) * 100);
}

async function recalculateForProfile(base44, profileId) {
  const [profile] = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
  if (!profile) return null;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [endorsements, savedBy, revealedBy, castingApps, castingCalls, users, spottedA, spottedB] = await Promise.all([
    base44.asServiceRole.entities.Endorsement.filter({ profile_id: profileId }),
    base44.asServiceRole.entities.SavedProfile.filter({ profile_id: profileId }),
    base44.asServiceRole.entities.ContactReveal.filter({ profile_id: profileId }),
    base44.asServiceRole.entities.CastingApplication.filter({ applicant_user_id: profile.user_id }),
    base44.asServiceRole.entities.CastingCall.filter({ creator_user_id: profile.user_id }),
    base44.asServiceRole.entities.User.filter({ id: profile.user_id }),
    base44.asServiceRole.entities.SpottedWith.filter({ profile_id_a: profileId }),
    base44.asServiceRole.entities.SpottedWith.filter({ profile_id_b: profileId }),
  ]);

  const recentLogin = users.length > 0 && users[0].updated_date > sevenDaysAgo;
  const confirmedSpottedWith = [...spottedA, ...spottedB].filter(s => s.confirmed).length;

  const newScore = calculateSpotScore(
    profile,
    endorsements.length,
    savedBy.length,
    revealedBy.length,
    recentLogin,
    castingApps.length > 0,
    castingCalls.length > 0,
    confirmedSpottedWith
  );

  await base44.asServiceRole.entities.Profile.update(profileId, { spot_score: newScore });
  return newScore;
}

async function recalculateAllPercentiles(base44) {
  const allProfiles = await base44.asServiceRole.entities.Profile.list();
  const allScores = allProfiles.map(p => p.spot_score || 0);

  await Promise.all(allProfiles.map(p => {
    const percentile = calculatePercentile(p.spot_score || 0, allScores);
    return base44.asServiceRole.entities.Profile.update(p.id, { spot_percentile: percentile });
  }));
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const profileId = body.profile_id;

  if (!profileId) {
    // Recalculate all profiles (admin only)
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
    const allProfiles = await base44.asServiceRole.entities.Profile.list();
    await Promise.all(allProfiles.map(p => recalculateForProfile(base44, p.id)));
    await recalculateAllPercentiles(base44);
    return Response.json({ success: true, recalculated: allProfiles.length });
  }

  const newScore = await recalculateForProfile(base44, profileId);
  await recalculateAllPercentiles(base44);
  return Response.json({ success: true, spot_score: newScore });
});