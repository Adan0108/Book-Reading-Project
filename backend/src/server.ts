// src/server.ts

import 'dotenv/config'; // MUST BE THE VERY FIRST IMPORT
import app from './app';
import { pingMySQL } from './dbs/init.mysql';
import { redisService } from './dbs/init.redis';
// All other imports must come AFTER dotenv/config

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // You can initialize your DB connections here
  await pingMySQL();
  await redisService.connect();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();