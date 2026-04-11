import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, phone } = await req.json();
  if (!['email', 'phone'].includes(type)) return Response.json({ error: 'Invalid type' }, { status: 400 });

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

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
      body: `<p>Your CineConnect verification code is:</p><h2 style="letter-spacing:6px;font-size:32px;">${code}</h2><p>This code expires in 10 minutes. If you didn't request this, ignore this email.</p>`
    });
  } else if (type === 'phone') {
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhone = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhone) {
      return Response.json({ error: 'SMS not configured. Please contact support.' }, { status: 503 });
    }

    const targetPhone = phone || '';
    if (!targetPhone) return Response.json({ error: 'No phone number provided' }, { status: 400 });

    const body = new URLSearchParams({
      From: fromPhone,
      To: targetPhone,
      Body: `Your CineConnect verification code is: ${code}. Valid for 10 minutes.`
    });

    const twilioRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`)
      },
      body
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      // Handle Twilio trial account limitation clearly
      if (twilioData.code === 21608 || (twilioData.message && twilioData.message.includes('unverified'))) {
        return Response.json({
          error: `SMS could not be sent: your phone number must first be verified in your Twilio account (trial accounts only). Visit console.twilio.com to add ${targetPhone} as a verified number.`,
          twilio_trial: true
        }, { status: 400 });
      }
      return Response.json({ error: twilioData.message || 'SMS failed' }, { status: 500 });
    }
  }

  return Response.json({ success: true });
});