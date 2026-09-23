import "./instrument";
import { loadEnv } from "./env";
import { buildApp } from "./app";
import { createSmsService } from "./services/sms";
import { startReminderDispatchJob } from "./jobs/reminder-dispatch";

const env = loadEnv();
const smsService = createSmsService(env);
const app = buildApp(env, smsService);

app
  .listen({ port: env.PORT, host: "0.0.0.0" })
  .then((address) => {
    app.log.info(`confirmly api listening on ${address}`);
    startReminderDispatchJob(smsService, env);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
