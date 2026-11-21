import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: connection URL + env loading moved out of schema.prisma into here.
// Migrations use the direct (unpooled) URL — matches the old `directUrl`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // process.env, not env(): env() throws when unset, which broke `npm ci` (postinstall generate) in any checkout without .env. No DATABASE_URL fallback on purpose — migrate must fail loudly rather than hit the wrong DB.
    url: process.env.DIRECT_URL,
  },
});
