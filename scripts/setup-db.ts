import { loadEnvConfig } from "@next/env";
import {
  closeMongoConnection,
  getReadingsCollection,
  getCommandsCollection,
} from "../src/lib/mongodb";

loadEnvConfig(process.cwd());

async function main() {
  await Promise.all([getReadingsCollection(), getCommandsCollection()]);
  console.log("MongoDB siap: koleksi pembacaan capped (maks. 50) dan device_commands.");
  await closeMongoConnection();
}

main().catch((error: unknown) => {
  console.error("Gagal menyiapkan MongoDB:", error);
  process.exit(1);
});
