import { loadEnvConfig } from "@next/env";
import {
  closeMongoConnection,
  getReadingsCollection,
  getCommandsCollection,
  getMessagesCollection,
} from "../src/lib/mongodb";

loadEnvConfig(process.cwd());

async function main() {
  await Promise.all([
    getReadingsCollection(),
    getCommandsCollection(),
    getMessagesCollection(),
  ]);
  console.log(
    "MongoDB siap: pembacaan capped (maks. 50), device_commands, dan sensor_messages.",
  );
  await closeMongoConnection();
}

main().catch((error: unknown) => {
  console.error("Gagal menyiapkan MongoDB:", error);
  process.exit(1);
});
