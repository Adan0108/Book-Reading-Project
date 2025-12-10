import * as UserRepo from "../models/repositories/user.repo";
import * as ProfileRepo from "../models/repositories/userProfile.repo";
import { NotFoundError } from "../core/error.response";

export async function getProfile(userId: number) {
    const user = await UserRepo.findById(userId);
    if (!user) {
        throw new NotFoundError("User not found");
    }

    const profile = await ProfileRepo.findByUserId(userId);

    return {
        id: user.id,
        email: user.email,
        username: profile?.username ?? null, // Handle case where profile might be missing
    };
}