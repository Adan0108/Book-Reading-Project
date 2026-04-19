import type { Request, Response } from "express";
import { OK, CREATED } from "../core/success.response";
import * as authorAppService from "../services/application.service";

function getClientIp(req: Request) {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

export const submit = async (req: Request, res: Response) => {
  const uid = (req as any).user?.uid;
  const ip = getClientIp(req);
  const userAgent = String(req.headers["user-agent"] ?? "unknown");

  const metadata = await authorAppService.submitApplication(Number(uid), req.body, { ip: String(ip), userAgent });
  return new CREATED({ message: "Application submitted", metadata }).send(res);
};

export const getMyLatest = async (req: Request, res: Response) => {
  const uid = (req as any).user?.uid;
  const metadata = await authorAppService.getMyLatest(Number(uid));
  return new OK("OK", metadata).send(res);
};

export const withdraw = async (req: Request, res: Response) => {
  const uid = (req as any).user?.uid;
  const id = Number(req.params.id);
  const metadata = await authorAppService.withdraw(Number(uid), id);
  return new OK("Withdrawn", metadata).send(res);
};