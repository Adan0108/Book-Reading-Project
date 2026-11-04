import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import routes from "./routes";
import {readiness} from "./operations/readiness";




import swaggerUi from "swagger-ui-express";
import {createOpenApiDocument} from './operations/openapi';
import { createPaymentService } from "./payments/payment.service";
import { configuredPaymentProvider } from "./payments/stripe.provider";
import type { PaymentProvider } from "./payments/provider";
import { createPaymentRouter, createWebhookRouter } from "./routes/payments";

// Provider injection is a local composition seam for deterministic integration tests.
// There is no HTTP endpoint or environment switch that can select a fixture provider.
export function createHttpApp(paymentProvider?: PaymentProvider) {
  const app = express();
  app.set("trust proxy", process.env.TRUST_PROXY_CIDRS ? process.env.TRUST_PROXY_CIDRS.split(",").map(value=>value.trim()) : false);
  app.get("/health/live",(_req,res)=>res.json({status:"alive"}));
  app.get("/health/ready",async(_req,res)=>{const state=await readiness();res.status(state.ready?200:503).json(state)});
  const billing = createPaymentService(paymentProvider);
  app.use(morgan("dev"));
  app.use(helmet());
  app.use(compression());
  app.use(createWebhookRouter(billing));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  //
  app.use(
    cors({
      origin: [process.env.FRONTEND_URL || "http://localhost:8000"],
      credentials: true,
    }),
  );

  const swaggerDocument = createOpenApiDocument();
  app.get('/api-docs/openapi.json',(_req,res)=>res.json(swaggerDocument));
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use(cookieParser());
  app.use(
    "/v1/api",
    (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
    createPaymentRouter(billing),
  );
  // mount routes
  app.use("/", routes);

  // 404
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    const err: any = new Error("Not Found");
    err.status = 404;
    next(err);
  });

  // error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = Number.isInteger(err.status) && err.status>=400 && err.status<=599 ? err.status : 500;
    const response: any = {
      status: "error",
      message: status >= 500 && status !== 503 ? "The request could not be completed. Please try again." : err.message || "Internal Server Error",
    };

    // show stack only in development
    if (process.env.NODE_ENV === "development") {
      response.stack = err.stack;
    }

    console.error(`[ERROR] ${err.message}`);
    if (process.env.NODE_ENV === "development") {
      console.error(err.stack);
    }

    res.status(status).json(response);
  });

  return app;
}
export default createHttpApp(configuredPaymentProvider());
