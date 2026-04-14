import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const body = await req.json();
  const castingCall = body?.data;

  if (!castingCall) {
    return Response.json({ error: 'No casting call data' }, { status: 400 });
  }

  const callRoles = (castingCall.roles_needed || []).map((r) => r.toLowerCase());
  const callTitle = (castingCall.project_title || '').toLowerCase();
  const callDesc = (castingCall.description || '').toLowerCase();
  const callText = callTitle + ' ' + callDesc;

  // Fetch all active role alerts
  const alerts = await base44.asServiceRole.entities.RoleAlert.filter({ is_active: true });

  let notifCount = 0;

  for (const alert of alerts) {
    const alertRoles = (alert.roles || []).map((r) => r.toLowerCase());
    const alertKeywords = (alert.keywords || []).map((k) => k.toLowerCase());

    const roleMatch = alertRoles.some((r) => callRoles.includes(r));
    const keywordMatch = alertKeywords.some((k) => callText.includes(k));

    if (!roleMatch && !keywordMatch) continue;

    // Fetch the user to get their email
    const users = await base44.asServiceRole.entities.User.filter({ id: alert.user_id });
    const user = users?.[0];
    if (!user) continue;

    const notifTitle = `New casting call: ${castingCall.project_title}`;
    const matchReason = roleMatch
      ? `Matches your role alert`
      : `Matches keyword in your alert`;
    const notifBody = `${matchReason}. ${castingCall.project_type || 'Project'} · ${castingCall.location || 'Location TBD'} · ${castingCall.compensation || 'Compensation TBD'}`;

    // Create in-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: alert.user_id,
      type: 'role_alert',
      title: notifTitle,
      body: notifBody,
      link: '/casting',
      is_read: false,
      meta: { casting_call_id: castingCall.id },
    });

    notifCount++;

    // Send email if opted in
    if (alert.email_notifications && user.email) {
      const rolesStr = castingCall.roles_needed?.join(', ') || 'Various roles';
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: user.email,
        from_name: "Spot'd Alerts",
        subject: `🎬 Role Alert: ${castingCall.project_title}`,
        body: `
Hi ${user.full_name || 'there'},

A new casting call matches your Role Alert on Spot'd!

────────────────────────────
${castingCall.project_title}
${castingCall.project_type || ''} ${castingCall.location ? '· ' + castingCall.location : ''}
────────────────────────────

Roles needed: ${rolesStr}
Compensation: ${castingCall.compensation || 'TBD'}
${castingCall.shoot_dates ? 'Shoot dates: ' + castingCall.shoot_dates : ''}

${castingCall.description}

Apply now → https://spotd.io/casting

────────────────────────────
You're receiving this because you have a Role Alert set up on Spot'd.
To manage your alerts, visit your Dashboard.
        `.trim(),
      });
    }
  }

  return Response.json({ matched: notifCount });
});