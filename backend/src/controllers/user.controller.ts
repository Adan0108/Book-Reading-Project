import { Request, Response } from "express";
import * as UserService from "../services/user.service";
import { OK } from "../core/success.response";
import { BadRequestError } from "../core/error.response";

class UserController {
    /**
     * Get current user's profile
     * Method: GET
     */
    getMe = async (req: Request, res: Response) => {
      // req.user is populated by the 'authenticationV2' middleware
      if (!req.user || !req.user.uid) {
        throw new BadRequestError("Invalid user context");
      }
  
      const metadata = await UserService.getProfile(req.user.uid);
      
      // Standardized Success Response
      return new OK("Get profile success", metadata).send(res);
    };
  }
  
  export default new UserController();