import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, old_data } = body;

    if (event.type === 'create') {
      // Notify the casting call creator
      const calls = await base44.asServiceRole.entities.CastingCall.filter({ id: data.casting_call_id });
      if (calls.length > 0) {
        const call = calls[0];
        await base44.asServiceRole.entities.Notification.create({
          user_id: call.creator_user_id,
          type: 'casting_match',
          title: `New application for ${call.project_title}`,
          body: `${data.applicant_name || 'Someone'} applied for ${data.role_applied_for || 'a role'}`,
          link: `/casting/applications?call=${call.id}`,
          is_read: false,
        });

        // Increment application_count
        await base44.asServiceRole.entities.CastingCall.update(call.id, {
          application_count: (call.application_count || 0) + 1,
        });
      }
    }

    if (event.type === 'update' && old_data && data.status !== old_data.status) {
      const now = new Date().toISOString();
      const statusField = {
        viewed: 'viewed_at',
        shortlisted: 'shortlisted_at',
        rejected: 'rejected_at',
        booked: 'booked_at',
      }[data.status];

      if (statusField && !data[statusField]) {
        await base44.asServiceRole.entities.CastingApplication.update(data.id, {
          [statusField]: now,
        });
      }
    }

    if (event.type === 'delete' && old_data) {
      // Decrement application_count
      const calls = await base44.asServiceRole.entities.CastingCall.filter({ id: old_data.casting_call_id });
      if (calls.length > 0) {
        const call = calls[0];
        await base44.asServiceRole.entities.CastingCall.update(call.id, {
          application_count: Math.max((call.application_count || 1) - 1, 0),
        });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});