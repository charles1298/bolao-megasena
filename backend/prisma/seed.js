/**
 * Seed: Cria o usuário admin padrão.
 * Execute: node prisma/seed.js
 *
 * IMPORTANTE: Altere a senha antes de ir para produção!
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_INITIAL_PASSWORD || 'MudeSuaSenha@123';
  const hash = await bcrypt.hash(password, 12);

  const admin = await prisma.user.upsert({
    where: { nickname: 'admin' },
    update: {},
    create: {
      nickname: 'admin',
      passwordHash: hash,
      role: 'admin',
    },
  });

  console.log('✅ Admin criado:', admin.nickname);
  console.log('⚠️  Troque a senha imediatamente após o primeiro login!');
  console.log('⚠️  Ative o 2FA em /api/admin/totp/setup');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
