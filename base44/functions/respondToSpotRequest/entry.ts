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

  if (action === 'accepted') {
    // Create the Endorsement record
    await base44.asServiceRole.entities.Endorsement.create({
      profile_id: spotReq.requester_profile_id,
      endorser_id: user.id,
      endorser_name: user.full_name,
      endorsement_type: spotReq.spot_type,
    });

    // Notify requester
    const requesterProfiles = await base44.asServiceRole.entities.Profile.filter({ id: spotReq.requester_profile_id });
    const requesterUserId = requesterProfiles[0]?.user_id;
    if (requesterUserId) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: requesterUserId,
        type: 'endorsement',
        title: 'You were spotted!',
        body: `${user.full_name} spotted you as "${spotReq.spot_type}"`,
        link: `/profile/${spotReq.requester_profile_id}`,
      });
    }
  } else {
    // Declined — polite notification
    const requesterProfiles = await base44.asServiceRole.entities.Profile.filter({ id: spotReq.requester_profile_id });
    const requesterUserId = requesterProfiles[0]?.user_id;
    if (requesterUserId) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: requesterUserId,
        type: 'system',
        title: 'Spot request update',
        body: `Your Spot request to ${spotReq.target_profile_id ? user.full_name : 'someone'} was not accepted at this time.`,
      });
    }
  }

  return Response.json({ success: true });
});