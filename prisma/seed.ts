import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: 'test@example.com',
    },
    update: {},
    create: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'temporary-test-value',
    },
  });

  await prisma.device.upsert({
    where: {
      deviceKey: 'sensor-001',
    },
    update: {},
    create: {
      name: 'Living Room Sensor',
      deviceKey: 'sensor-001',
      type: 'temperature-humidity',
      location: 'Living Room',
      userId: user.id,
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });