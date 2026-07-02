import { randomBytes } from "crypto";

export function generateCaptureToken() {
  return randomBytes(24).toString("base64url");
}
