import { PrismaClient } from '@prisma/client';
import { mockCategories, mockProducts, mockCoupons, mockSurveyQuestions, mockAdminUsers } from '@20mart/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding 20Mart database...');

  // 1. Seed Categories
  for (const cat of mockCategories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        name: cat.name,
        slug: cat.slug,
        itemCount: cat.itemCount,
        colorCode: cat.color,
        imageUrl: cat.image,
      },
    });
  }

  // 2. Seed Admin Users
  for (const adm of mockAdminUsers) {
    await prisma.adminUser.upsert({
      where: { email: adm.email },
      update: {},
      create: {
        name: adm.name,
        email: adm.email,
        role: adm.role,
        password: '$2a$12$eXampleHashedPasswordForDemoEnvironment1234',
        isActive: adm.status === 'ACTIVE',
      },
    });
  }

  console.log('20Mart database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

