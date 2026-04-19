const bcrypt = require("bcrypt");

async function main() {
  const userPassword = "User123!";
  const adminPassword = "Admin123!";

  const userHash = await bcrypt.hash(userPassword, 10);
  const adminHash = await bcrypt.hash(adminPassword, 10);

  console.log("USER PASSWORD:", userPassword);
  console.log("USER HASH:", userHash);
  console.log("ADMIN PASSWORD:", adminPassword);
  console.log("ADMIN HASH:", adminHash);
}

main().catch(console.error);