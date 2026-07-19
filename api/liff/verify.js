import {
  LineTokenError,
  getOrCreateInternalUser,
  verifyLineAccessToken,
} from "../../lib/line-user.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({ status: "method_not_allowed" });
  }

  try {
    const body =
      typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    const lineUserId = await verifyLineAccessToken(body?.accessToken);
    const internalUser = await getOrCreateInternalUser(lineUserId);

    return response.status(200).json({
      status: "verified",
      internalUserId: internalUser.id,
    });
  } catch (error) {
    if (error instanceof LineTokenError || error instanceof SyntaxError) {
      return response.status(401).json({ status: "unauthorized" });
    }
    return response.status(500).json({ status: "processing_failed" });
  }
}
