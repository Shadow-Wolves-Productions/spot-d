import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function normalize(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function wordOverlap(a, b) {
  const setA = new Set(normalize(a).split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(normalize(b).split(/\s+/).filter(w => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let matches = 0;
  for (const w of setA) { if (setB.has(w)) matches++; }
  return matches / Math.max(setA.size, setB.size);
}

function matchConfidence(a, b) {
  if (normalize(a) === normalize(b)) return 'exact';
  if (wordOverlap(a, b) >= 0.8) return 'fuzzy';
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    // Allow scheduled automation (no user) or admin
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const allProfiles = await base44.asServiceRole.entities.Profile.list('-created_date', 500);
  const profilesWithCredits = allProfiles.filter(p => p.credits?.length > 0);

  let created = 0;
  let updated = 0;

  for (let i = 0; i < profilesWithCredits.length; i++) {
    for (let j = i + 1; j < profilesWithCredits.length; j++) {
      const pA = profilesWithCredits[i];
      const pB = profilesWithCredits[j];

      const idA = pA.id < pB.id ? pA.id : pB.id;
      const idB = pA.id < pB.id ? pB.id : pA.id;
      const profileA = pA.id < pB.id ? pA : pB;
      const profileB = pA.id < pB.id ? pB : pA;

      const matchedProjects = [];
      let bestConfidence = null;

      for (const creditA of profileA.credits) {
        for (const creditB of profileB.credits) {
          const conf = matchConfidence(creditA.project_title, creditB.project_title);
          if (conf) {
            const title = creditA.project_title;
            if (!matchedProjects.includes(title)) matchedProjects.push(title);
            if (conf === 'exact') bestConfidence = 'exact';
            else if (!bestConfidence) bestConfidence = 'fuzzy';
          }
        }
      }

      if (matchedProjects.length === 0) continue;

      const existing = await base44.asServiceRole.entities.SpottedWith.filter({
        profile_id_a: idA,
        profile_id_b: idB,
      });

      if (existing.length > 0) {
        const current = existing[0];
        const allMatched = Array.from(new Set([...(current.projects_matched || [current.project_title]), ...matchedProjects]));
        await base44.asServiceRole.entities.SpottedWith.update(current.id, {
          projects_matched: allMatched,
          times_matched: allMatched.length,
          match_confidence: bestConfidence,
        });
        updated++;
      } else {
        await base44.asServiceRole.entities.SpottedWith.create({
          profile_id_a: idA,
          profile_id_b: idB,
          project_title: matchedProjects[0],
          projects_matched: matchedProjects,
          match_confidence: bestConfidence,
          times_matched: matchedProjects.length,
          confirmed: false,
        });
        created++;
      }
    }
  }

  return Response.json({ success: true, created, updated, profiles_scanned: profilesWithCredits.length });
});