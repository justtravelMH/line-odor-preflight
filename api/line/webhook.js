import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const config = {
  api: { bodyParser: false },
};

async function readRawBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export function verifyLineSignature(rawBody, signature, channelSecret) {
  if (!signature || !channelSecret) return false;

  const expected = createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");
  const received = Buffer.from(signature);
  const calculated = Buffer.from(expected);

  return (
    received.length === calculated.length &&
    timingSafeEqual(received, calculated)
  );
}

async function recordEvent(event, index, rawBody) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  const webhookEventId =
    event.webhookEventId ??
    createHash("sha256").update(rawBody).update(String(index)).digest("hex");

  const databaseResponse = await fetch(
    `${supabaseUrl}/rest/v1/preflight_line_events?on_conflict=webhook_event_id`,
    {
      method: "POST",
      headers: {
        apikey: secretKey,
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/json",
        prefer: "resolution=ignore-duplicates,return=representation",
      },
      body: JSON.stringify({
        webhook_event_id: webhookEventId,
        event_type: event.type,
        message_type: event.message?.type ?? null,
        source_type: event.source?.type ?? null,
      }),
    },
  );

  if (!databaseResponse.ok) throw new Error("event_record_failed");
  const inserted = await databaseResponse.json();
  return { webhookEventId, duplicate: inserted.length === 0 };
}

async function updateReplyStatus(webhookEventId, replyStatus) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  await fetch(
    `${supabaseUrl}/rest/v1/preflight_line_events?webhook_event_id=eq.${encodeURIComponent(webhookEventId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: secretKey,
        authorization: `Bearer ${secretKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reply_status: replyStatus }),
    },
  );
}

async function replyToLine(replyToken, text) {
  const replyResponse = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });

  if (!replyResponse.ok) throw new Error("line_reply_failed");
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ status: "method_not_allowed" });
  }

  const rawBody = await readRawBody(request);
  const signature = request.headers["x-line-signature"];

  if (
    !verifyLineSignature(
      rawBody,
      signature,
      process.env.LINE_CHANNEL_SECRET,
    )
  ) {
    return response.status(400).json({ status: "invalid_signature" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return response.status(400).json({ status: "invalid_json" });
  }

  try {
    for (const [index, event] of (payload.events ?? []).entries()) {
      const recorded = await recordEvent(event, index, rawBody);
      if (recorded.duplicate || !event.replyToken) continue;

      let replyText = null;
      if (event.type === "follow") {
        replyText = "✅ LINE Webhook 連線成功";
      } else if (event.type === "message" && event.message?.type === "text") {
        replyText = "✅ 測試訊息已收到";
      }

      if (replyText) {
        try {
          await replyToLine(event.replyToken, replyText);
          await updateReplyStatus(recorded.webhookEventId, "sent");
        } catch {
          await updateReplyStatus(recorded.webhookEventId, "failed");
          throw new Error("reply_failed");
        }
      } else {
        await updateReplyStatus(recorded.webhookEventId, "not_applicable");
      }
    }

    return response.status(200).json({ status: "ok" });
  } catch {
    return response.status(500).json({ status: "processing_failed" });
  }
}
