import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7: connection URL + env loading moved out of schema.prisma into here.
// Migrations use the direct (unpooled) URL — matches the old `directUrl`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
