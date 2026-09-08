import { randomBytes } from "node:crypto";
import { prisma } from "@confirmly/db";
import { hashPassword } from "../auth/password";

interface ProvisionArgs {
  clinicName: string;
  timezone: string;
  smsSenderName: string;
  ownerEmail: string;
}

function parseArgs(): ProvisionArgs {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    args.set(key, rest.join("="));
  }

  const clinicName = args.get("clinic-name");
  const ownerEmail = args.get("owner-email");
  const timezone = args.get("timezone") ?? "Asia/Manila";
  const smsSenderName = args.get("sms-sender-name") ?? clinicName ?? "";

  if (!clinicName || !ownerEmail) {
    console.error(
      "Usage: pnpm --filter @confirmly/api exec tsx src/scripts/provision-clinic.ts " +
        "--clinic-name=\"Some Dental Clinic\" --owner-email=owner@clinic.test " +
        "[--timezone=Asia/Manila] [--sms-sender-name=SomeDental]",
    );
    process.exit(1);
  }

  return { clinicName, timezone, smsSenderName, ownerEmail };
}

function generateTempPassword(): string {
  return randomBytes(9).toString("base64url");
}

async function main() {
  const { clinicName, timezone, smsSenderName, ownerEmail } = parseArgs();

  const existingClinic = await prisma.clinic.findFirst({ where: { name: clinicName } });
  if (existingClinic) {
    console.error(`A clinic named "${clinicName}" already exists (id=${existingClinic.id}). Aborting.`);
    process.exit(1);
  }

  const clinic = await prisma.clinic.create({
    data: {
      name: clinicName,
      timezone,
      smsSenderName,
      subscriptionStatus: "active",
    },
  });

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const owner = await prisma.staffUser.create({
    data: {
      clinicId: clinic.id,
      email: ownerEmail,
      passwordHash,
      role: "owner",
    },
  });

  console.log("Clinic provisioned:");
  console.log(`  Clinic ID:   ${clinic.id}`);
  console.log(`  Clinic name: ${clinic.name}`);
  console.log(`  Owner email: ${owner.email}`);
  console.log(`  Temp password: ${tempPassword}`);
  console.log("");
  console.log("Have the owner log in and change their password on first login.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
