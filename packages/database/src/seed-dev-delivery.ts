/**
 * DEVELOPMENT-ONLY delivery/payment settings so checkout can be exercised locally.
 *   pnpm db:seed:dev-delivery
 *
 * - Enables Cash on Delivery in the dev database (production default stays OFF).
 * - Marks a set of Ahmedabad PIN codes as serviceable.
 * Refuses to run in production. Idempotent.
 */
import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run the dev delivery seed in production.');
  process.exit(1);
}

const prisma = new PrismaClient();

// Central / west Ahmedabad PIN codes used for local testing only.
const AHMEDABAD_PINS: [string, string][] = [
  ['380001', 'Lal Darwaja'],
  ['380006', 'Ellisbridge / Navrangpura'],
  ['380007', 'Paldi'],
  ['380008', 'Maninagar'],
  ['380009', 'Navrangpura'],
  ['380013', 'Naranpura'],
  ['380014', 'Usmanpura'],
  ['380015', 'Satellite'],
  ['380051', 'Jodhpur / Vejalpur'],
  ['380052', 'Memnagar'],
  ['380054', 'Bodakdev'],
  ['380058', 'Bopal'],
  ['380059', 'Thaltej'],
  ['380061', 'Ghatlodia'],
];

async function main() {
  await prisma.storeSettings.upsert({
    where: { id: 'default' },
    update: { codEnabled: true, deliveryEnabled: true },
    create: { id: 'default', codEnabled: true, deliveryEnabled: true },
  });
  for (const [pincode, area] of AHMEDABAD_PINS) {
    await prisma.serviceablePincode.upsert({
      where: { pincode },
      update: {},
      create: { pincode, area, city: 'Ahmedabad', isServiceable: true },
    });
  }
  console.log(`Dev delivery seed: COD enabled, ${AHMEDABAD_PINS.length} Ahmedabad PIN codes serviceable.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
