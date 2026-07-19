export default function handler(request, response) {
  response.status(200).json({
    channelIdConfigured: Boolean(process.env.LINE_CHANNEL_ID),
    channelSecretConfigured: Boolean(process.env.LINE_CHANNEL_SECRET),
    channelAccessTokenConfigured: Boolean(
      process.env.LINE_CHANNEL_ACCESS_TOKEN,
    ),
  });
}
