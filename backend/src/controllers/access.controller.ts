import { Request, Response } from "express";
import * as AccessService from "../services/access.service";
import { CREATED, OK } from "../core/success.response";
import { BadRequestError } from "../core/error.response";

class AccessController {
  register = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new BadRequestError("email and password are required");

    const user = await AccessService.register(email, password);
    return new CREATED({
      message: "RegisterOK!",
      metadata: { user },
    }).send(res);
  };

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new BadRequestError("email and password are required");

    const user = await AccessService.login(email, password);
    // TODO: issue tokens here and attach via cookie/header
    return new OK("LoginOK", { user }).send(res);
  };

  logout = async (_req: Request, res: Response) => {
    const result = await AccessService.logout();
    return new OK("LogoutOK", result).send(res);
  };
}

export default new AccessController();
