import { Request, Response } from "express";
import * as AccessService from "../services/access.service";
import { CREATED, OK } from "../core/success.response";
import { BadRequestError } from "../core/error.response";
import { rtCookieName, rtCookieOptions } from "../utils/cookieOptions";

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
    const metadata = await AccessService.setupPassword(email, password, username);
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

    return new OK("LoginOK", { user, tokens }).send(res);
  };

  logout = async (req: Request, res: Response) => {
    if (!req.user) throw new BadRequestError("No auth context");
    const result = await AccessService.logout({ uid: req.user.uid, jti: req.user.jti, exp: (req.user as any).exp });
    res.clearCookie(rtCookieName, { path: "/" });
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
    res.cookie(rtCookieName, tokens.refreshToken, rtCookieOptions);

    return new OK("TokenRefreshed", { tokens }).send(res);
  };
}

export default new AccessController();
