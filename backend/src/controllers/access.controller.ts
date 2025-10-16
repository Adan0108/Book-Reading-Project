import { Request, Response } from "express";
import * as AccessService from "../services/access.service";
import { CREATED, OK } from "../core/success.response";
import { BadRequestError } from "../core/error.response";

class AccessController {
  register = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new BadRequestError("email and password are required");
    const { user, tokens } = await AccessService.register(email, password);
    return new CREATED({
      message: "RegisterOK!",
      metadata: { user, tokens },
    }).send(res);
  };

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new BadRequestError("email and password are required");
    const { user, tokens } = await AccessService.login(email, password);
    return new OK("LoginOK", { user, tokens }).send(res);
  };

  logout = async (req: Request, res: Response) => {
    if (!req.user) throw new BadRequestError("No auth context");
    const result = await AccessService.logout({ uid: req.user.uid, jti: req.user.jti, exp: (req.user as any).exp });
    return new OK("LogoutOK", result).send(res);
  };

  refresh = async (req: Request, res: Response) => {
    if (!req.user) throw new BadRequestError("No user context");
    const tokens = await AccessService.refreshTokens(
      req.user.uid,
      req.user.email,
      req.user.jti,
      (req.user as any).exp
    );
    return new OK("TokenRefreshed", { tokens }).send(res);
  };
}

export default new AccessController();
