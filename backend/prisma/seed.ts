// =============================================================================
// Prisma Seed — creates the default department taxonomy (which the Gemini
// classifier's `departmentCode` output is matched against) and one ADMIN
// account so you can log in immediately after `npm run prisma:migrate`.
//
// Run with: npm run prisma:seed
// =============================================================================
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: 'Roads & Transportation', code: 'ROADS', description: 'Potholes, road damage, signage' },
  { name: 'Sanitation', code: 'SANITATION', description: 'Garbage, illegal dumping, litter' },
  { name: 'Water Utilities', code: 'WATER', description: 'Leaks, drainage, water main issues' },
  { name: 'Electrical', code: 'ELECTRICAL', description: 'Streetlights, power lines' },
  { name: 'Parks & Recreation', code: 'PARKS', description: 'Trees, park facilities' },
  { name: 'Public Safety', code: 'PUBLIC_SAFETY', description: 'Hazards posing immediate risk' },
  { name: 'General / Unclassified', code: 'OTHER', description: 'Fallback queue for manual triage' },
];

async function main(): Promise<void> {
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: dept.code },
      update: {},
      create: dept,
    });
  }
  console.log(`Seeded ${DEPARTMENTS.length} departments.`);

  const adminEmail = 'admin@safestreet.local';
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('ChangeMe123!', 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: 'SafeStreet Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });
    console.log(`Seeded default admin: ${adminEmail} / ChangeMe123! (change this immediately)`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
