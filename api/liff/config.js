export default function handler(request, response) {
  response.status(200).json({
    liffId: process.env.LIFF_ID ?? null,
    configured: Boolean(
      process.env.LIFF_ID && process.env.LINE_LOGIN_CHANNEL_ID,
    ),
  });
}
