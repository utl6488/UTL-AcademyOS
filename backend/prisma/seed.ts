/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const demoSlug = 'demo-institute';

  const tenant = await prisma.tenant.upsert({
    where: { slug: demoSlug },
    update: {},
    create: {
      name: 'Demo Institute',
      slug: demoSlug,
    },
  });

  const users: Array<{
    email: string;
    name: string;
    role: 'SUPER_ADMIN' | 'INSTITUTE_OWNER' | 'TEACHER' | 'STUDENT';
  }> = [
    { email: 'super@utl.local', name: 'Platform Admin', role: 'SUPER_ADMIN' },
    { email: 'owner@demo.local', name: 'Demo Owner', role: 'INSTITUTE_OWNER' },
    { email: 'teacher@demo.local', name: 'Demo Teacher', role: 'TEACHER' },
    { email: 'student@demo.local', name: 'Demo Student', role: 'STUDENT' },
  ];

  const passwordHash = await argon2.hash('changeme123');
  const now = new Date();

  for (const u of users) {
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: u.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        emailVerifiedAt: now,
        status: 'ACTIVE',
      },
    });
  }

  console.log(`✓ Seeded tenant '${tenant.slug}' + ${users.length} users (password: changeme123)`);
}

main()
  .catch(async (err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
