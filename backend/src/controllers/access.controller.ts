import { Request, Response } from "express";
import * as AccessService from "../services/access.service";
import { CREATED, OK } from "../core/success.response";
import { BadRequestError } from "../core/error.response";
import { rtCookieName, rtCookieOptions, atCookieName, atCookieOptions } from "../utils/cookieOptions";
import { revokeAllSessions } from '../services/session.service';

class AccessController {
  // register = async (req: Request, res: Response) => {
  //   const { email, password } = req.body ?? {};
  //   if (!email || !password) throw new BadRequestError("email and password are required");
  //   const { user, tokens } = await AccessService.register(email, password);
  //   res.cookie(rtCookieName, tokens.refreshToken, rtCookieOptions);
  //   return new CREATED({
  //     message: "RegisterOK!",
  //     metadata: { user, tokens },
  //   }).send(res);
  // };

  registerEmail = async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    if (!email) throw new BadRequestError("Email is required");
    const metadata = await AccessService.registerEmail(email);
    return new OK("Verification code sent.", metadata).send(res);
  };

  verifyEmail = async (req: Request, res: Response) => {
    const { email, otp } = req.body ?? {};
    if (!email || !otp) throw new BadRequestError("Email and OTP are required");
    const metadata = await AccessService.verifyEmail(email, otp);
    return new OK("Email verified.", metadata).send(res);
  };

  setupPassword = async (req: Request, res: Response) => {
    const { email, password, username } = req.body ?? {};
    if (!email || !password || !username) {
      throw new BadRequestError("Email, password, and username are required");
    }
    const metadata = await AccessService.setupPassword(email, password, username, req.body.setupToken);
    return new CREATED({ message: "Account setup complete.", metadata }).send(res);
  };

  resendOtp = async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    if (!email) throw new BadRequestError("Email is required");
    const metadata = await AccessService.resendOtp(email);
    return new OK("Verification code resent.", metadata).send(res);
  };

  forgotPassword = async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    if (!email) throw new BadRequestError("Email is required");
    const metadata = await AccessService.forgotPassword(email);
    return new OK("Password reset code sent.", metadata).send(res);
  };

  resetPassword = async (req: Request, res: Response) => {
    const { email, otp, newPassword } = req.body ?? {};
    if (!email || !otp || !newPassword) {
      throw new BadRequestError("Email, OTP, and newPassword are required");
    }
    const metadata = await AccessService.resetPassword(email, otp, newPassword);
    return new OK("Password reset successfully.", metadata).send(res);
  };

  login = async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw new BadRequestError("email and password are required");
    const { user, tokens } = await AccessService.login(email, password);
    res.cookie(rtCookieName, tokens.refreshToken, rtCookieOptions); // set refresh token cookie
    res.cookie(atCookieName,tokens.accessToken,atCookieOptions);

    return new OK("LoginOK", { user, tokens: { accessToken: tokens.accessToken } }).send(res);
  };

  logout = async (req: Request, res: Response) => {
    if (!req.user) throw new BadRequestError("No auth context");
    const result = await AccessService.logout(req.user);
    res.clearCookie(rtCookieName, { path: "/" });
    res.clearCookie(atCookieName, { path: '/' });
    return new OK("LogoutOK", result).send(res);
  };

  refresh = async (req: Request, res: Response) => {
    if (!req.user) throw new BadRequestError("No user context");
    const tokens = await AccessService.refreshTokens(req.user);
    res.cookie(rtCookieName, tokens.refreshToken, rtCookieOptions);
    res.cookie(atCookieName,tokens.accessToken,atCookieOptions);

    return new OK("TokenRefreshed", { tokens: { accessToken: tokens.accessToken } }).send(res);
  };

  logoutAll = async (req: Request, res: Response) => {
    await revokeAllSessions(req.user!.uid);
    res.clearCookie(rtCookieName, { path: '/' });
    res.clearCookie(atCookieName, { path: '/' });
    return new OK('All sessions signed out.', { ok: true }).send(res);
  };

  session = async (req: Request,res: Response) => {
    res.setHeader('Cache-Control','no-store');
    return new OK('Session restored.',{tokens:{accessToken:req.cookies[atCookieName]}}).send(res);
  };
}

export default new AccessController();
