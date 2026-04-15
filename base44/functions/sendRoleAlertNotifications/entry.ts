import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const castingCall = body?.data;

  if (!castingCall) {
    return Response.json({ error: 'No casting call data' }, { status: 400 });
  }

  if (!castingCall.is_active) return Response.json({ skipped: 'inactive' });

  // Check deadline
  if (castingCall.deadline && new Date(castingCall.deadline) < new Date()) {
    return Response.json({ skipped: 'past deadline' });
  }

  const callRoles = (castingCall.roles_needed || []).map((r) => r.toLowerCase());
  const callTitle = (castingCall.project_title || '').toLowerCase();
  const callDesc = (castingCall.description || '').toLowerCase();
  const callText = callTitle + ' ' + callDesc;
  const callLocation = (castingCall.location || '').toLowerCase();

  const alerts = await base44.asServiceRole.entities.RoleAlert.filter({ is_active: true });

  let notifCount = 0;

  for (const alert of alerts) {
    const alertRoles = (alert.roles || []).map((r) => r.toLowerCase());
    const alertKeywords = (alert.keywords || []).map((k) => k.toLowerCase());
    const alertLocations = (alert.locations || []).map((l) => l.toLowerCase());

    // Role match: if alert has roles, at least one must match; if empty, match all
    const roleMatch = alertRoles.length === 0 || alertRoles.some((r) => callRoles.includes(r));
    if (!roleMatch) continue;

    // Keyword match: if alert has keywords, at least one must appear in title/desc
    const keywordMatch = alertKeywords.length === 0 || alertKeywords.some((k) => callText.includes(k));
    if (!keywordMatch) continue;

    // Location match: if alert has locations, at least one must partially match
    const locationMatch = alertLocations.length === 0 || alertLocations.some((l) => callLocation.includes(l));
    if (!locationMatch) continue;

    // Deduplicate — skip if already notified for this call
    const existing = await base44.asServiceRole.entities.Notification.filter({
      user_id: alert.user_id,
      type: 'role_alert',
    });
    const alreadySent = existing.some((n) => n.meta?.casting_call_id === castingCall.id);
    if (alreadySent) continue;

    const users = await base44.asServiceRole.entities.User.filter({ id: alert.user_id });
    const user = users?.[0];
    if (!user) continue;

    const notifTitle = `New casting call: ${castingCall.project_title}`;
    const notifBody = `${castingCall.project_type || 'Project'} · ${castingCall.location || 'Location TBD'} · ${castingCall.compensation || 'Compensation TBD'}`;

    // Always create in-app notification immediately
    await base44.asServiceRole.entities.Notification.create({
      user_id: alert.user_id,
      type: 'role_alert',
      title: notifTitle,
      body: notifBody,
      action_url: '/casting',
      link: '/casting',
      is_read: false,
      meta: { casting_call_id: castingCall.id },
    });

    notifCount++;

    // Email: only send if frequency is "instant"
    if (alert.email_notifications && alert.frequency === 'instant' && user.email) {
      const rolesStr = castingCall.roles_needed?.join(', ') || 'Various roles';
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        from_name: "Spot'd Alerts",
        subject: `🎬 Role Alert: ${castingCall.project_title}`,
        body: `Hi ${user.full_name || 'there'},

A new casting call matches your Role Alert on Spot'd!

────────────────────────────
${castingCall.project_title}
${castingCall.project_type || ''} ${castingCall.location ? '· ' + castingCall.location : ''}
────────────────────────────

Roles needed: ${rolesStr}
Compensation: ${castingCall.compensation || 'TBD'}
${castingCall.shoot_dates ? 'Shoot dates: ' + castingCall.shoot_dates : ''}

${castingCall.description}

Apply now → https://spotd.app/casting

────────────────────────────
You're receiving this because you have a Role Alert on Spot'd.
Manage alerts at your Dashboard.`.trim(),
      });
      await base44.asServiceRole.entities.RoleAlert.update(alert.id, {
        last_sent_at: new Date().toISOString(),
      });
    }
  }

  return Response.json({ matched: notifCount });
});