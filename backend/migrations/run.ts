// Tiny migration runner. Reads every .sql file in this directory in lex order
// and executes it. Safe to re-run; the SQL files use IF NOT EXISTS.
//
// Usage: npm run migrate
//
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../src/db/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const files = (await readdir(__dirname))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const db = getDb();
  for (const f of files) {
    console.log(`Running ${f}...`);
    const sql = await readFile(join(__dirname, f), "utf-8");
    await db.query(sql);
    console.log(`  ok`);
  }
  await db.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
