import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { request_id, action } = await req.json();
  if (!request_id || !['accepted', 'declined'].includes(action)) {
    return Response.json({ error: 'Invalid params' }, { status: 400 });
  }

  const requests = await base44.asServiceRole.entities.SpotRequest.filter({ id: request_id });
  if (!requests.length) return Response.json({ error: 'Not found' }, { status: 404 });
  const spotReq = requests[0];

  if (spotReq.target_user_id !== user.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (spotReq.status !== 'pending') {
    return Response.json({ error: 'Already responded' }, { status: 400 });
  }

  await base44.asServiceRole.entities.SpotRequest.update(request_id, {
    status: action,
    responded_at: new Date().toISOString(),
  });

  const requesterProfiles = await base44.asServiceRole.entities.Profile.filter({ id: spotReq.requester_profile_id });
  const requesterUserId = requesterProfiles[0]?.user_id;

  if (action === 'accepted') {
    await base44.asServiceRole.entities.Endorsement.create({
      profile_id: spotReq.requester_profile_id,
      endorser_id: user.id,
      endorser_name: user.full_name,
      endorsement_type: spotReq.spot_type,
    });

    if (requesterUserId) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: requesterUserId,
        type: 'spot_accepted',
        title: `${user.full_name} spotted you!`,
        body: `as "${spotReq.spot_type}" — your SpotScore has been updated`,
        action_url: `/profile/${spotReq.requester_profile_id}`,
        link: `/profile/${spotReq.requester_profile_id}`,
        is_read: false,
      });
    }
  } else {
    if (requesterUserId) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: requesterUserId,
        type: 'spot_declined',
        title: 'Spot request update',
        body: `${user.full_name} isn't able to Spot you right now`,
        is_read: false,
      });
    }
  }

  return Response.json({ success: true });
});