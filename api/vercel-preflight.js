export default function handler(request, response) {
  response.status(200).json({
    app: "line-odor-preflight",
    function: "ok",
    environmentCheck: process.env.PREFLIGHT_PUBLIC_MARKER === "enabled",
    deployment: process.env.VERCEL_ENV ?? "local",
  });
}
