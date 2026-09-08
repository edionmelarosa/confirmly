import { hash } from "@node-rs/argon2";
import { prisma } from "../src/index";

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

const CLINIC_ID = "clinic1";
const STAFF_EMAIL = "dev@confirmly.test";
const STAFF_PASSWORD = "devpassword123";

async function main() {
  const clinic = await prisma.clinic.upsert({
    where: { id: CLINIC_ID },
    update: {},
    create: {
      id: CLINIC_ID,
      name: "Dev Test Clinic",
      timezone: "Asia/Manila",
      smsSenderName: "DevClinic",
      subscriptionStatus: "active",
    },
  });

  const passwordHash = await hash(STAFF_PASSWORD, ARGON2_OPTIONS);
  const staffUser = await prisma.staffUser.upsert({
    where: { clinicId_email: { clinicId: clinic.id, email: STAFF_EMAIL } },
    update: {},
    create: {
      clinicId: clinic.id,
      email: STAFF_EMAIL,
      passwordHash,
      role: "staff",
    },
  });

  const patient = await prisma.patient.upsert({
    where: { clinicId_phone: { clinicId: clinic.id, phone: "+639171234567" } },
    update: {},
    create: {
      clinicId: clinic.id,
      name: "Juan Dela Cruz",
      phone: "+639171234567",
    },
  });

  console.log("Seeded:");
  console.log(`  Clinic:    id="${clinic.id}" name="${clinic.name}"`);
  console.log(`  Staff:     email="${staffUser.email}" password="${STAFF_PASSWORD}"`);
  console.log(`  Patient:   name="${patient.name}" phone="${patient.phone}"`);
  console.log("");
  console.log("Log in at http://localhost:3000/login with:");
  console.log(`  Clinic ID: ${clinic.id}`);
  console.log(`  Email:     ${staffUser.email}`);
  console.log(`  Password:  ${STAFF_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
