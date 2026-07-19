export default async function handler(request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  const result = {
    app: "ok",
    deployment: process.env.VERCEL_ENV ?? "local",
    database: "not_configured",
  };

  if (!supabaseUrl || !supabaseSecretKey) {
    return response.status(503).json(result);
  }

  try {
    const databaseResponse = await fetch(
      `${supabaseUrl}/rest/v1/preflight_checks?select=id&limit=1`,
      {
        headers: {
          apikey: supabaseSecretKey,
          authorization: `Bearer ${supabaseSecretKey}`,
        },
      },
    );

    result.database = databaseResponse.ok ? "ok" : "error";
    return response.status(databaseResponse.ok ? 200 : 503).json(result);
  } catch {
    result.database = "unreachable";
    return response.status(503).json(result);
  }
}
