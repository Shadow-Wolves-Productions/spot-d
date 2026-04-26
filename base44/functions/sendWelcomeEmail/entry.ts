import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow service role calls (from admin/bulk import) or authenticated users
    const { user_id, profile_id, tier } = await req.json();

    if (!user_id || !profile_id) {
      return Response.json({ error: 'user_id and profile_id are required' }, { status: 400 });
    }

    // Fetch user and profile
    const [users, profiles] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ id: user_id }),
      base44.asServiceRole.entities.Profile.filter({ id: profile_id }),
    ]);

    const user = users[0];
    const profile = profiles[0];

    if (!user || !profile) {
      return Response.json({ error: 'User or profile not found' }, { status: 404 });
    }

    const firstName = (profile.preferred_name || profile.full_name || '').split(' ')[0] || 'there';
    const spotScore = profile.spot_score || 0;
    const profileSlug = profile.profile_slug || profile_id;
    const tierLabel = (tier || 'pro').toUpperCase();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Spot'd</title>
</head>
<body style="margin:0;padding:0;background-color:#0D0D0D;font-family:'DM Sans',Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0D0D0D;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          
          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-family:'Sora',Arial,sans-serif;font-size:24px;font-weight:700;color:#E8FC6C;letter-spacing:-0.5px;">Spot'd</span>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #2A2A2A;">
              <h1 style="margin:0 0 12px 0;font-family:'Sora',Arial,sans-serif;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Hey ${firstName},
              </h1>
              <p style="margin:0;font-size:16px;line-height:1.6;color:#cccccc;">
                Your Spot'd profile has been created and is <strong style="color:#ffffff;">live in the directory.</strong>
              </p>
            </td>
          </tr>

          <!-- PRO access callout -->
          <tr>
            <td style="padding:28px 0;border-bottom:1px solid #2A2A2A;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#888888;font-weight:600;">Your plan</p>
                    <h2 style="margin:0 0 12px 0;font-family:'Sora',Arial,sans-serif;font-size:22px;font-weight:700;color:#E8FC6C;">
                      12 months of ${tierLabel} access — on us.
                    </h2>
                    <p style="margin:0;font-size:14px;color:#888888;">No credit card needed. No catch.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What it means -->
          <tr>
            <td style="padding:28px 0;border-bottom:1px solid #2A2A2A;">
              <p style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.08em;">What that means for you</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${[
                  'Unlimited contact reveals',
                  'Full portfolio uploads',
                  'Priority placement in search',
                  'Advanced filters',
                ].map(item => `
                <tr>
                  <td style="padding:6px 0;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:24px;vertical-align:top;padding-top:2px;">
                          <span style="display:inline-block;width:8px;height:8px;background-color:#E8FC6C;border-radius:50%;"></span>
                        </td>
                        <td style="font-size:15px;color:#ffffff;line-height:1.5;">${item}</td>
                      </tr>
                    </table>
                  </td>
                </tr>`).join('')}
              </table>
            </td>
          </tr>

          <!-- Sign in -->
          <tr>
            <td style="padding:28px 0;border-bottom:1px solid #2A2A2A;">
              <p style="margin:0 0 8px 0;font-size:14px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.08em;">Access your profile</p>
              <p style="margin:0 0 16px 0;font-size:15px;color:#cccccc;line-height:1.6;">
                Head to <a href="https://getspotd.app/login" style="color:#E8FC6C;text-decoration:none;font-weight:600;">getspotd.app/login</a> and enter your email address. We'll send you a one-time code to sign in — no password needed.
              </p>
            </td>
          </tr>

          <!-- Recommendations -->
          <tr>
            <td style="padding:28px 0;border-bottom:1px solid #2A2A2A;">
              <p style="margin:0 0 16px 0;font-size:14px;font-weight:600;color:#888888;text-transform:uppercase;letter-spacing:0.08em;">Once you're in, we recommend</p>
              ${[
                ['1', 'Add a profile photo'],
                ['2', 'Link your showreel'],
                ['3', 'Add your credits'],
              ].map(([num, text]) => `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
                <tr>
                  <td style="width:32px;vertical-align:top;">
                    <span style="display:inline-block;width:24px;height:24px;background-color:#1A1A1A;border:1px solid #2A2A2A;border-radius:6px;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#E8FC6C;">${num}</span>
                  </td>
                  <td style="font-size:15px;color:#ffffff;line-height:1.5;vertical-align:middle;">${text}</td>
                </tr>
              </table>`).join('')}
            </td>
          </tr>

          <!-- SpotScore -->
          <tr>
            <td style="padding:28px 0;border-bottom:1px solid #2A2A2A;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1A1A1A;border:1px solid #2A2A2A;border-radius:12px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px 0;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:#888888;">Your SpotScore</p>
                    <p style="margin:0;font-family:'Sora',Arial,sans-serif;font-size:32px;font-weight:700;color:#E8FC6C;">${spotScore}<span style="font-size:16px;color:#888888;font-weight:400;">/100</span></p>
                    <p style="margin:8px 0 0 0;font-size:13px;color:#888888;">Complete your profile to climb the rankings.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sign off -->
          <tr>
            <td style="padding:28px 0 32px 0;">
              <p style="margin:0 0 4px 0;font-size:15px;color:#cccccc;">Welcome to the crew.</p>
              <p style="margin:0;font-size:15px;color:#888888;">— The Spot'd team</p>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding-bottom:48px;">
              <a href="https://getspotd.app/u/${profileSlug}" style="display:inline-block;background-color:#E8FC6C;color:#0D0D0D;text-decoration:none;font-family:'Sora',Arial,sans-serif;font-size:15px;font-weight:700;padding:14px 32px;border-radius:8px;letter-spacing:-0.2px;">
                View your profile →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid #2A2A2A;padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#555555;line-height:1.6;">
                You're receiving this because your profile was created on Spot'd.<br/>
                <a href="https://getspotd.app" style="color:#555555;">getspotd.app</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send the email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: user.email,
      from_name: "Spot'd",
      subject: "Your Spot'd profile is live 🎬",
      body: htmlBody,
    });

    // Log the send on the profile
    await base44.asServiceRole.entities.Profile.update(profile_id, {
      welcome_email_sent: true,
      welcome_email_sent_at: new Date().toISOString(),
    });

    return Response.json({ success: true, sent_to: user.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});