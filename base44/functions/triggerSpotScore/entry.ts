import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automation-triggered score recalculation — receives entity event payload
// Resolves profile_id from various entity types and calls recalculateSpotScore logic inline

function calculateSpotScore(profile, endorsementCount, savedByCount, revealedByCount, recentLogin, appliedToCasting, postedCasting) {
  let score = 0;
  if (profile.profile_photo) score += 5;
  if (profile.bio) score += 5;
  if (profile.primary_role) score += 3;
  if (profile.city) score += 2;
  if (profile.imdb_link) score += 5;
  if (profile.showreel_link) score += 5;
  if (profile.email_verified) score += 7;
  if (profile.phone_verified) score += 8;
  if (endorsementCount >= 10) score += 25;
  else if (endorsementCount >= 6) score += 20;
  else if (endorsementCount >= 3) score += 14;
  else if (endorsementCount >= 1) score += 8;
  if (savedByCount >= 15) score += 20;
  else if (savedByCount >= 5) score += 12;
  else if (savedByCount >= 1) score += 5;
  if (revealedByCount >= 3) score += 5;
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
  const profiles = await base44.asServiceRole.entities.Profile.filter({ id: profileId });
  if (!profiles.length) return;
  const profile = profiles[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [endorsements, savedBy, revealedBy, castingApps, castingCalls, users] = await Promise.all([
    base44.asServiceRole.entities.Endorsement.filter({ profile_id: profileId }),
    base44.asServiceRole.entities.SavedProfile.filter({ profile_id: profileId }),
    base44.asServiceRole.entities.ContactReveal.filter({ profile_id: profileId }),
    base44.asServiceRole.entities.CastingApplication.filter({ applicant_user_id: profile.user_id }),
    base44.asServiceRole.entities.CastingCall.filter({ creator_user_id: profile.user_id }),
    base44.asServiceRole.entities.User.filter({ id: profile.user_id }),
  ]);

  const recentLogin = users.length > 0 && users[0].updated_date > sevenDaysAgo;
  const newScore = calculateSpotScore(profile, endorsements.length, savedBy.length, revealedBy.length, recentLogin, castingApps.length > 0, castingCalls.length > 0);
  await base44.asServiceRole.entities.Profile.update(profileId, { spot_score: newScore });
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
  const body = await req.json().catch(() => ({}));
  const { event, data } = body;

  if (!event) return Response.json({ error: 'No event' }, { status: 400 });

  const entityName = event.entity_name;
  let profileId = null;

  if (entityName === 'Profile') {
    profileId = event.entity_id;
  } else if (entityName === 'Endorsement' && data?.profile_id) {
    profileId = data.profile_id;
  } else if (entityName === 'SavedProfile' && data?.profile_id) {
    profileId = data.profile_id;
  } else if (entityName === 'ContactReveal' && data?.profile_id) {
    profileId = data.profile_id;
  } else if (entityName === 'CastingApplication' && data?.applicant_user_id) {
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: data.applicant_user_id });
    if (profiles.length) profileId = profiles[0].id;
  } else if (entityName === 'CastingCall' && data?.creator_user_id) {
    const profiles = await base44.asServiceRole.entities.Profile.filter({ user_id: data.creator_user_id });
    if (profiles.length) profileId = profiles[0].id;
  }

  if (profileId) {
    await recalculateForProfile(base44, profileId);
    await recalculateAllPercentiles(base44);
  }

  return Response.json({ success: true, profileId });
});