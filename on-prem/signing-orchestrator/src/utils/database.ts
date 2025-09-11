import { PrismaClient } from '@prisma/client';

// Global instance to avoid multiple connections in development
declare global {
  var __prisma: PrismaClient | undefined;
}

// Create a singleton Prisma client
const prisma = globalThis.__prisma || new PrismaClient({
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

export { prisma };
