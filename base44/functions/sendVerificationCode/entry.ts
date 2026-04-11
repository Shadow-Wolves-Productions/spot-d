import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, phone } = await req.json();
  if (!['email', 'phone'].includes(type)) return Response.json({ error: 'Invalid type' }, { status: 400 });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Invalidate old codes
  const existing = await base44.asServiceRole.entities.VerificationCode.filter({ user_id: user.id, type });
  for (const old of existing) {
    await base44.asServiceRole.entities.VerificationCode.update(old.id, { used: true });
  }

  await base44.asServiceRole.entities.VerificationCode.create({ user_id: user.id, code, type, expires_at, used: false });

  if (type === 'email') {
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: 'CineConnect — Your Verification Code',
      body: `Your CineConnect verification code is: <strong>${code}</strong><br><br>This code expires in 10 minutes.`
    });
  } else if (type === 'phone') {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhone) {
      return Response.json({ error: 'SMS not configured' }, { status: 503 });
    }

    const body = new URLSearchParams({
      From: fromPhone,
      To: phone,
      Body: `Your CineConnect verification code is: ${code}. Expires in 10 minutes.`
    });

    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
      },
      body
    });

    if (!twilioRes.ok) {
      const err = await twilioRes.json();
      return Response.json({ error: err.message || 'SMS failed' }, { status: 500 });
    }
  }

  return Response.json({ success: true });
});