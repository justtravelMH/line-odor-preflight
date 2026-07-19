import {
  LineTokenError,
  getOrCreateInternalUser,
  verifyLineAccessToken,
} from "../../lib/line-user.js";

export default async function handler(request, response) {
  try {
    const authorization = request.headers.authorization ?? "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;
    const lineUserId = await verifyLineAccessToken(accessToken);
    const internalUser = await getOrCreateInternalUser(lineUserId);
    const requestedOwner = request.query?.owner;

    if (requestedOwner && requestedOwner !== internalUser.id) {
      return response.status(403).json({ status: "cross_user_denied" });
    }

    return response.status(200).json({
      status: "owner_verified",
      internalUserId: internalUser.id,
    });
  } catch (error) {
    if (error instanceof LineTokenError) {
      return response.status(401).json({ status: "unauthorized" });
    }
    return response.status(500).json({ status: "processing_failed" });
  }
}
