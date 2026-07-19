import { createHmac } from "node:crypto";
import { verifyLineSignature } from "../api/line/webhook.js";

const secret = "local-test-secret";
const body = Buffer.from('{"events":[]}');
const signature = createHmac("sha256", secret).update(body).digest("base64");

if (!verifyLineSignature(body, signature, secret)) {
  throw new Error("valid signature rejected");
}

if (verifyLineSignature(Buffer.from('{"events":[1]}'), signature, secret)) {
  throw new Error("tampered body accepted");
}

if (verifyLineSignature(body, "invalid", secret)) {
  throw new Error("invalid signature accepted");
}

console.log("LINE raw-body signature tests passed");
