---
name: Drizzle CHECK constraint drift
description: drizzle-kit push says "no changes" even when a CHECK constraint expression has changed — requires manual ALTER TABLE to fix.
---

## Rule
When you add or remove values from a `check()` constraint in a Drizzle schema, `drizzle-kit push` will report "No changes detected" and silently leave the old constraint in the DB.

**Why:** Drizzle's push diffing does not compare CHECK constraint expression text — it considers them equal if the constraint name already exists.

**How to apply:**
1. After modifying any `check(name, sql`...`)` expression, verify with:
   ```sql
   SELECT cc.check_clause
   FROM information_schema.check_constraints cc
   JOIN information_schema.table_constraints tc ON cc.constraint_name = tc.constraint_name
   WHERE tc.table_name = 'your_table';
   ```
2. If it doesn't match the schema file, fix manually:
   ```sql
   ALTER TABLE your_table DROP CONSTRAINT IF EXISTS constraint_name;
   ALTER TABLE your_table ADD CONSTRAINT constraint_name CHECK (...new values...);
   ```

**Example:** `apq_status_check` on `auction_player_queue` — was `('pending', 'sold', 'skipped')` in DB but schema had `('pending', 'sold', 'skipped', 'called')`. Push said "no changes". Fixed with DROP + ADD CONSTRAINT.
