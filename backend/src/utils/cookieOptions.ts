import type { CookieOptions } from "express";

export const rtCookieName = "rt"; // refresh token cookie name
export const atCookieName = 'at';

export const rtCookieOptions: CookieOptions = {
  httpOnly: true,                            // JS in browser can’t read it
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: "lax",                           // CSRF protection
  path: "/",                                 // cookie sent to all routes
  maxAge: 7 * 24 * 60 * 60 * 1000,           // 7 days
};
export const atCookieOptions: CookieOptions = {...rtCookieOptions,maxAge:15*60*1000};
