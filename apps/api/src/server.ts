import { loadEnv } from "./env";
import { buildApp } from "./app";
import { createSmsService } from "./services/sms";
import { startReminderDispatchJob } from "./jobs/reminder-dispatch";

const env = loadEnv();
const app = buildApp(env);

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then((address) => {
    app.log.info(`confirmly api listening on ${address}`);
    const smsService = createSmsService(env);
    startReminderDispatchJob(env, smsService);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
