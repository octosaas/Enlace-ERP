import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/core/database/schema.ts',
  out: './src/core/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgresql://enlace_user:enlace_dev_pass_2026@localhost:5432/enlace_erp',
  },
  verbose: true,
  strict: true,
});
