# Scripts

Utility scripts for database seeding and user management. All scripts are run with `tsx` and require a `DATABASE_URL` environment variable pointing to the target database.

> **Note:** Never run these scripts against production without explicit confirmation. Use the staging database URL from `.env` for testing.

---

## Database Seeding

### `seed-admin-user.ts`

**What it does:** Creates (or updates) the Cedar Barrett admin account in the database. Uses `upsert` so it is safe to run multiple times — if the user already exists, it only sets `isAdmin: true`.

**When to run:** Once when bootstrapping a new database, or any time you need to ensure the admin account exists with admin privileges.

**Required env vars:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the target database |

**Example usage:**

```bash
# Against staging (sourced from .env)
DATABASE_URL="$(grep DATABASE_URL .env | cut -d= -f2-)" npx tsx scripts/seed-admin-user.ts

# Or via npm script (uses DATABASE_URL already in shell env)
npm run seed:admin

# Against a specific database
DATABASE_URL="postgresql://user:pass@host/db" npx tsx scripts/seed-admin-user.ts
```

**What gets created:**

| Field | Value |
|---|---|
| `email` | `cedarbarrett@gmail.com` |
| `name` | `Cedar Barrett` |
| `password` | `CedarAdmin2026!` (bcrypt hashed, cost 12) |
| `isAdmin` | `true` |
| `emailVerified` | current timestamp |

---

### `seed-test-user.ts`

**What it does:** Creates a standard test user account in the database. Uses `upsert` so it is idempotent — re-running it does not duplicate the user or change their data (the `update` payload is empty).

**When to run:** When setting up a staging or local database to have a known test account for manual QA or E2E tests.

**Required env vars:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the target database |

**Example usage:**

```bash
# Against staging
DATABASE_URL="$(grep DATABASE_URL .env | cut -d= -f2-)" npx tsx scripts/seed-test-user.ts

# Or via npm script
npm run seed:test

# Against a specific database
DATABASE_URL="postgresql://user:pass@host/db" npx tsx scripts/seed-test-user.ts
```

**What gets created:**

| Field | Value |
|---|---|
| `email` | `test@test.com` |
| `name` | `Test User` |
| `password` | `Test1234!` (bcrypt hashed, cost 12) |
| `emailVerified` | current timestamp |

---

### `seed-recipes.ts`

**What it does:** Seeds 30 curated, globally-inspired starter recipes into the database, all attributed to the admin user. Must be run **after** `seed-admin-user.ts` because it looks up the admin account to use as the recipe owner.

**When to run:** After `seed-admin-user.ts`, when you want a populated recipe library for development/demo purposes. Safe to run once; running it a second time will create duplicate recipe rows (there is no upsert guard on recipes).

**Required env vars:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the target database |

**Example usage:**

```bash
# Step 1 — ensure admin user exists
DATABASE_URL="postgresql://user:pass@host/db" npx tsx scripts/seed-admin-user.ts

# Step 2 — seed recipes (depends on admin user being present)
DATABASE_URL="postgresql://user:pass@host/db" npx tsx scripts/seed-recipes.ts
```

**Recipe catalogue (30 recipes):**

| # | Title | Cuisine | Difficulty |
|---|---|---|---|
| 1 | Classic Spaghetti Bolognese | Italian | medium |
| 2 | Vegan Chickpea Tikka Masala | Indian | easy |
| 3 | Baja Fish Tacos | Mexican | medium |
| 4 | Authentic Greek Salad | Mediterranean | easy |
| 5 | Quick Miso Soup | Japanese | easy |
| 6 | Steak Frites | French | medium |
| 7 | Thai Green Curry | Thai | medium |
| 8 | Lebanese Hummus | Middle Eastern | easy |
| 9 | Classic American Cheeseburger | American | easy |
| 10 | Mushroom Risotto | Italian | hard |
| 11 | Classic Pad Thai | Thai | medium |
| 12 | Fresh Caprese Salad | Italian | easy |
| 13 | Beef Stroganoff | European | medium |
| 14 | Sizzling Chicken Fajitas | Mexican | easy |
| 15 | Lemon Garlic Butter Shrimp | American | easy |
| 16 | Authentic Margherita Pizza | Italian | medium |
| 17 | Beef and Broccoli Stir Fry | Asian | easy |
| 18 | Traditional French Onion Soup | French | hard |
| 19 | Chunky Tableside Guacamole | Mexican | easy |
| 20 | Classic Shrimp Scampi | Italian | easy |
| 21 | Crispy Falafel Wraps | Middle Eastern | medium |
| 22 | Slow Cooker BBQ Pulled Pork | American | easy |
| 23 | Teriyaki Glazed Salmon | Japanese | easy |
| 24 | Classic Eggplant Parmesan | Italian | medium |
| 25 | Spicy Middle Eastern Shakshuka | Middle Eastern | easy |
| 26 | Grilled Chicken Caesar Salad | American | easy |
| 27 | Authentic Pho Bo (Beef Noodle Soup) | Vietnamese | hard |
| 28 | Chewy Chocolate Chip Cookies | American | easy |
| 29 | Indian Butter Chicken | Indian | medium |
| 30 | Caprese Panini | Italian | easy |

**Exported testable functions:**

- `buildRawText(recipe)` — converts a recipe object into a human-readable Markdown string (title, ingredients list, numbered steps, notes). Used to populate the `rawText` DB column.
- `buildRecipeRecord(recipe, userId)` — constructs the full Prisma `create` data object for a recipe, ready to be passed to `prisma.recipe.create({ data: ... })`.

---

## Running All Seeds (Quick Reference)

```bash
# Bootstrap a fresh database (staging example)
export DATABASE_URL="postgresql://..."

npx tsx scripts/seed-admin-user.ts
npx tsx scripts/seed-test-user.ts
npx tsx scripts/seed-recipes.ts
```
