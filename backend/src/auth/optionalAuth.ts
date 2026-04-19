import asyncHandler from "../helpers/asyncHandler";
import { AuthFailureError, NotFoundError } from "../core/error.response";
import { getByUserId } from "../models/repositories/userKeys.repo";
import { HEADER, AccessPayload, verifyJWT, isRevoked } from "./checkAuth"; 
// ^ adjust path if your auth file name isn't checkAuth.ts

/** Optional Access Token auth:
 * - If NO Authorization header => guest (next)
 * - If Authorization exists => requires x-client-id and validates token
 * - Attaches req.user + req.keyStore when valid
 */
export const optionalAuthenticationV2 = asyncHandler(async (req, _res, next) => {
  const auth = req.headers[HEADER.AUTHORIZATION];

  // 1) No Authorization => public guest
  if (!auth) return next();

  // 2) Authorization exists => must have x-client-id to pick correct keypair
  const cid = req.headers[HEADER.CLIENT_ID];
  const userId = Number(Array.isArray(cid) ? cid[0] : cid);
  if (!userId || Number.isNaN(userId)) {
    throw new AuthFailureError("Invalid Request (x-client-id)");
  }

  const keyPair = await getByUserId(userId);
  if (!keyPair) throw new NotFoundError("Key pair not found");

  const bearer = Array.isArray(auth) ? auth[0] : auth;
  const raw = bearer.includes(" ") ? bearer.split(" ")[1] : bearer;

  try {
    const decoded = verifyJWT<AccessPayload>(raw, keyPair.public_key);

    if (decoded.uid !== userId) throw new AuthFailureError("Invalid user (AT)");
    if (await isRevoked(decoded.uid, decoded.jti)) throw new AuthFailureError("Token revoked");

    req.user = decoded;
    req.keyStore = { publicKey: keyPair.public_key, privateKey: keyPair.private_key };

    return next();
  } catch (err: any) {
    if (err?.name === "TokenExpiredError") {
      throw new AuthFailureError("Access token expired");
    }
    throw err;
  }
});
