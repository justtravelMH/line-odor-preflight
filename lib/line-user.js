export class LineTokenError extends Error {}

export async function verifyLineAccessToken(accessToken) {
  if (!accessToken) throw new LineTokenError("missing_token");

  const verificationResponse = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!verificationResponse.ok) throw new LineTokenError("invalid_or_expired");

  const verification = await verificationResponse.json();
  if (
    verification.client_id !== process.env.LINE_LOGIN_CHANNEL_ID ||
    verification.expires_in <= 0 ||
    !String(verification.scope ?? "").split(" ").includes("profile")
  ) {
    throw new LineTokenError("token_claims_rejected");
  }

  const profileResponse = await fetch("https://api.line.me/v2/profile", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!profileResponse.ok) throw new LineTokenError("profile_rejected");

  const profile = await profileResponse.json();
  if (!profile.userId) throw new LineTokenError("profile_missing_user");
  return profile.userId;
}

export async function getOrCreateInternalUser(lineUserId) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const databaseResponse = await fetch(
    `${supabaseUrl}/rest/v1/preflight_internal_users?on_conflict=line_user_id`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/json",
        prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify({
        line_user_id: lineUserId,
        last_verified_at: new Date().toISOString(),
      }),
    },
  );
  if (!databaseResponse.ok) throw new Error("internal_user_upsert_failed");

  const users = await databaseResponse.json();
  if (!users[0]?.id) throw new Error("internal_user_missing");
  return users[0];
}
