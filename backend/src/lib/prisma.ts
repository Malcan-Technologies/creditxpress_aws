import { PrismaClient } from "@prisma/client";

// Enable query logging only in development or when DEBUG_PRISMA is set
const enableQueryLogging = process.env.NODE_ENV === 'development' || process.env.DEBUG_PRISMA === 'true';

// Create a single Prisma client instance with conditional logging
export const prisma = new PrismaClient({
  log: [
    {
      emit: 'stdout',
      level: 'query',
    },
    {
      emit: 'stdout',
      level: 'error',
    },
    {
      emit: 'stdout',
      level: 'warn',
    },
  ],
});
