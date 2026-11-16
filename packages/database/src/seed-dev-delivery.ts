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
  // P4: deliverable = PIN → active delivery area → active warehouse. Dev-only location below.
  const zone = await prisma.deliveryZone.upsert({ where: { name: 'Ahmedabad (dev)' }, update: { isActive: true }, create: { name: 'Ahmedabad (dev)' } });
  for (const [pincode, area] of AHMEDABAD_PINS) {
    await prisma.serviceablePincode.upsert({
      where: { pincode },
      update: { zoneId: zone.id },
      create: { pincode, area, city: 'Ahmedabad', isServiceable: true, zoneId: zone.id },
    });
  }
  // Stock recorded before P4 sits on the migration's PRIMARY placeholder (SETUP). In DEV ONLY, give it a
  // test address and activate it so local checkout works; otherwise create a dev location.
  const devAddress = { addressLine1: 'Dev test location (not real)', city: 'Ahmedabad', state: 'Gujarat', pinCode: '380015' };
  const primary = await prisma.warehouse.findUnique({ where: { code: 'PRIMARY' } });
  const wh = primary
    ? await prisma.warehouse.update({
        where: { id: primary.id },
        data: primary.pinCode === '000000' ? { ...devAddress, name: 'Primary location (dev seed)', status: 'ACTIVE' } : { status: 'ACTIVE' },
      })
    : await prisma.warehouse.upsert({ where: { code: 'DEV-AMD' }, update: { status: 'ACTIVE' }, create: { code: 'DEV-AMD', name: 'Dev location', status: 'ACTIVE', ...devAddress } });
  await prisma.warehouseDeliveryZone.upsert({
    where: { warehouseId_zoneId: { warehouseId: wh.id, zoneId: zone.id } },
    update: { isActive: true },
    create: { warehouseId: wh.id, zoneId: zone.id, priority: 1 },
  });
  console.log(`Dev delivery seed: COD enabled, ${AHMEDABAD_PINS.length} Ahmedabad PIN codes in "${zone.name}", served by ${wh.code} (ACTIVE).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
