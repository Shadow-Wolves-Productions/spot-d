import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called on schedule: daily at 8am UTC and weekly Monday 8am UTC
// mode: "daily" or "weekly" passed via function_args
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const mode = body?.args?.mode || 'daily';

  const alerts = await base44.asServiceRole.entities.RoleAlert.filter({
    is_active: true,
    email_notifications: true,
    frequency: mode,
  });

  let emailsSent = 0;

  // Get active casting calls with future deadlines
  const allCalls = await base44.asServiceRole.entities.CastingCall.filter({ is_active: true });
  const now = new Date();
  const recentCalls = allCalls.filter((c) => {
    if (c.deadline && new Date(c.deadline) < now) return false;
    const created = new Date(c.created_date);
    const hoursAgo = (now - created) / (1000 * 60 * 60);
    return mode === 'daily' ? hoursAgo <= 25 : hoursAgo <= 169;
  });

  for (const alert of alerts) {
    const alertRoles = (alert.roles || []).map((r) => r.toLowerCase());
    const alertKeywords = (alert.keywords || []).map((k) => k.toLowerCase());
    const alertLocations = (alert.locations || []).map((l) => l.toLowerCase());

    const matched = recentCalls.filter((c) => {
      const callRoles = (c.roles_needed || []).map((r) => r.toLowerCase());
      const callText = ((c.project_title || '') + ' ' + (c.description || '')).toLowerCase();
      const callLocation = (c.location || '').toLowerCase();
      const roleMatch = alertRoles.length === 0 || alertRoles.some((r) => callRoles.includes(r));
      const kwMatch = alertKeywords.length === 0 || alertKeywords.some((k) => callText.includes(k));
      const locMatch = alertLocations.length === 0 || alertLocations.some((l) => callLocation.includes(l));
      return roleMatch && kwMatch && locMatch;
    });

    if (matched.length === 0) continue;

    const users = await base44.asServiceRole.entities.User.filter({ id: alert.user_id });
    const user = users?.[0];
    if (!user?.email) continue;

    const listItems = matched.map((c) =>
      `• ${c.project_title} (${c.project_type || 'Project'}) — ${c.location || 'Location TBD'} — ${c.compensation || 'TBD'}`
    ).join('\n');

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: "Spot'd Alerts",
      subject: `🎬 Your ${mode} casting alert — ${matched.length} new call${matched.length > 1 ? 's' : ''}`,
      body: `Hi ${user.full_name || 'there'},

Here are the latest casting calls matching your Role Alert on Spot'd:

${listItems}

View all → https://spotd.app/casting

────────────────────────────
Manage alerts at your Dashboard.`.trim(),
    });

    await base44.asServiceRole.entities.RoleAlert.update(alert.id, {
      last_sent_at: new Date().toISOString(),
    });
    emailsSent++;
  }

  return Response.json({ mode, emailsSent });
});