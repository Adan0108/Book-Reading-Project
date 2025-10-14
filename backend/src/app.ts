import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
//import { v4 as uuidv4 } from "uuid";
import routes from "./routes";

import cookieParser from "cookie-parser"; // npm install cookie-parser 
                                          // npm install -D @types/cookie-parser

import { pingMySQL } from "./dbs/init.mysql";
import { redisService } from "./dbs/init.redis";

const app = express();

(async function initDatastores() {
  try {
    await pingMySQL();              // log: [MySQL] ping OK
  } catch (e) {
    console.error("[MySQL] init failed:", (e as Error).message);
  }

  try {
    await redisService.getClient();              // log: [Redis] connection established / events
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

app.use(cookieParser()); // 2. USE IT HERE

// mount routes
// app.use("/", routes);
app.use("/v1/api", routes);

// 404
app.use((_req: Request, _res: Response, next: NextFunction) => {
  const err: any = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal Server Error"
  });
});

export default app;
