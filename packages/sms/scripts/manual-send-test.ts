import { createSmsSender } from "../src/index";

async function main() {
  const apiKey = process.env.SEMAPHORE_API_KEY;
  const to = process.argv[2];
  const message = process.argv[3] ?? "Confirmly test message";

  if (!apiKey) {
    console.error("Set SEMAPHORE_API_KEY in the environment before running this script.");
    process.exit(1);
  }
  if (!to) {
    console.error("Usage: tsx scripts/manual-send-test.ts <phone> [message]");
    process.exit(1);
  }

  const sender = createSmsSender("semaphore", { apiKey, senderName: process.env.SEMAPHORE_SENDER_NAME });
  const result = await sender.sendSms(to, message);
  console.log(JSON.stringify(result, null, 2));
}

main();
