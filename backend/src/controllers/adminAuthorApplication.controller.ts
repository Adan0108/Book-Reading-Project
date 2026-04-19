import type { Request, Response } from "express";
import { OK } from "../core/success.response";
import * as adminSvc from "../services/application.service";

export const list = async (req: Request, res: Response) => {
  const metadata = await adminSvc.listApplications(req.query);
  return new OK("OK", metadata).send(res);
};

export const detail = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const metadata = await adminSvc.getDetail(id);
  return new OK("OK", metadata).send(res);
};

export const markUnderReview = async (req: Request, res: Response) => {
  const adminId = (req as any).user?.uid;
  const id = Number(req.params.id);
  const metadata = await adminSvc.markUnderReview(id, Number(adminId));
  return new OK("OK", metadata).send(res);
};

export const approve = async (req: Request, res: Response) => {
  const adminId = (req as any).user?.uid;
  const id = Number(req.params.id);
  const metadata = await adminSvc.approve(id, Number(adminId), req.body);
  return new OK("Approved", metadata).send(res);
};

export const reject = async (req: Request, res: Response) => {
  const adminId = (req as any).user?.uid;
  const id = Number(req.params.id);
  const metadata = await adminSvc.reject(id, Number(adminId), req.body);
  return new OK("Rejected", metadata).send(res);
};