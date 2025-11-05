import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { v4 as uuidv4 } from "uuid";
import cookieParser from "cookie-parser";
import cors from "cors";
import routes from "./routes";
import { runMigrationsOnce } from "./dbs/migrate";
import { pingMySQL } from "./dbs/init.mysql";
import { initRedis } from "./dbs/init.redis";
import { runUserCleanup } from "./services/cleanup.service";

const app = express();
const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

(async function initDatastores() {
  try {
    await pingMySQL();              // log: [MySQL] ping OK
    await runMigrationsOnce();

    // Schedule the cleanup task after the database is ready
    console.log("[Scheduler] Starting user cleanup task...");
    // Run the cleanup task immediately on startup...
    runUserCleanup();
    // ...and then run it again every 24 hours.
    setInterval(runUserCleanup, ONE_DAY_IN_MS);
    
  } catch (e) {
    console.error("[MySQL] init failed:", (e as Error).message);
  }

  try {
    await initRedis();              // log: [Redis] connection established / events
  } catch (e) {
    console.error("[Redis] init failed:", (e as Error).message);
  }
})();

// middlewares cơ bản
app.use(morgan("dev"));
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//
app.use(cors({
  origin:[process.env.FRONTEND_URL || "http://localhost:8000"],
  credentials: true,
}));


app.use(cookieParser());
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
  const status = err.status || 500;
  const response: any = {
    status: "error",
    message: err.message || "Internal Server Error",
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


export default app;
