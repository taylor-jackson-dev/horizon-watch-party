/**
 * Environment preflight — validate the *shape* of every deploy-critical env var,
 * and (when the shape is valid) confirm the database actually connects.
 *
 * The point: catch the whole class of mistakes that turn into hours of live
 * debugging — a literal placeholder left in a value, a dropped `@`, a missing
 * `https://`, a trailing slash, an unencoded special character, a stale password —
 * in seconds, before deploying.
 *
 *   Local:  `npm run check:env`   (loads .env.local)
 *   CI/prod: run with the platform environment already populated.
 *
 * See docs/ENVIRONMENT.md for the exact correct value of each variable per
 * environment (local uses the direct DB host; Vercel/Railway use the pooler).
 */
import { PrismaClient } from "@prisma/client";

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
const add = (name: string, ok: boolean, detail: string) => {
  results.push({ name, ok, detail });
};

// Values that are obviously still placeholders — a value should never be one of these.
const PLACEHOLDERS = [
  "THE_PASSWORD",
  "your-password",
  "your-value",
  "changeme",
  "placeholder",
  "example.com",
];

function looksLikePlaceholder(v: string): boolean {
  const low = v.toLowerCase();
  return PLACEHOLDERS.some((p) => low.includes(p.toLowerCase()));
}

function checkHttpUrl(name: string, { allowLocalhost = false } = {}): void {
  const raw = process.env[name];
  if (!raw) return add(name, false, "missing");
  if (raw !== raw.trim()) return add(name, false, "has leading/trailing whitespace");
  if (looksLikePlaceholder(raw)) return add(name, false, "still contains a placeholder");
  if (raw.endsWith("/")) return add(name, false, "must not end with a trailing slash");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return add(name, false, "not a valid URL (missing https:// ?)");
  }
  const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.protocol !== "https:" && !(allowLocalhost && isLocal && u.protocol === "http:")) {
    return add(name, false, `protocol must be https:// (got ${u.protocol})`);
  }
  if (!u.hostname) return add(name, false, "missing host");
  add(name, true, `${u.protocol}//${u.host}`);
}

function checkPostgresUrl(name: string): boolean {
  const raw = process.env[name];
  if (!raw) {
    add(name, false, "missing");
    return false;
  }
  if (raw !== raw.trim()) {
    add(name, false, "has leading/trailing whitespace");
    return false;
  }
  if (looksLikePlaceholder(raw)) {
    add(name, false, "still contains a placeholder (e.g. THE_PASSWORD)");
    return false;
  }
  if (!/^postgres(ql)?:\/\//.test(raw)) {
    add(name, false, "must start with postgresql://");
    return false;
  }
  const atCount = (raw.match(/@/g) || []).length;
  if (atCount !== 1) {
    add(name, false, `must contain exactly one '@' (found ${atCount}) — the password may have lost or absorbed it`);
    return false;
  }
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    add(name, false, "unparseable — a special char in the password likely needs URL-encoding (use an alphanumeric password)");
    return false;
  }
  if (!u.password) {
    add(name, false, "no password in the connection string");
    return false;
  }
  if (!u.hostname || !u.port) {
    add(name, false, "missing host or port");
    return false;
  }
  // Supabase pooler hosts require the `postgres.<ref>` username form.
  if (u.hostname.includes("pooler.supabase.com") && !u.username.includes(".")) {
    add(name, false, `pooler host needs username 'postgres.<project-ref>', got '${u.username}'`);
    return false;
  }
  add(name, true, `user=${u.username} host=${u.hostname}:${u.port}`);
  return true;
}

function checkSecret(name: string, minLen = 16): void {
  const raw = process.env[name];
  if (!raw) return add(name, false, "missing");
  if (raw.length < minLen) return add(name, false, `suspiciously short (<${minLen} chars)`);
  add(name, true, `present (${raw.length} chars)`);
}

async function testDbConnection(name: string): Promise<void> {
  const url = process.env[name];
  if (!url) return;
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    await prisma.$queryRaw`SELECT 1`;
    add(`${name} → connect`, true, "authenticated + reachable");
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e)
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean);
    add(`${name} → connect`, false, msg ?? "connection failed");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function main(): Promise<void> {
  checkHttpUrl("NEXTAUTH_URL", { allowLocalhost: true });
  checkHttpUrl("NEXT_PUBLIC_APP_URL", { allowLocalhost: true });
  checkHttpUrl("NEXT_PUBLIC_SOCKET_URL", { allowLocalhost: true });
  checkSecret("NEXTAUTH_SECRET");
  const dbShapeOk = checkPostgresUrl("DATABASE_URL");
  const directShapeOk = checkPostgresUrl("DIRECT_URL");

  if (!process.argv.includes("--no-connect")) {
    if (dbShapeOk) await testDbConnection("DATABASE_URL");
    if (directShapeOk) await testDbConnection("DIRECT_URL");
  }

  const pad = Math.max(...results.map((r) => r.name.length));
  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    // eslint-disable-next-line no-console
    console.log(`${r.ok ? "✓" : "✗"}  ${r.name.padEnd(pad)}  ${r.detail}`);
  }
  // eslint-disable-next-line no-console
  console.log(
    failed === 0
      ? "\n✅ All env checks passed."
      : `\n❌ ${failed} check(s) failed — fix before deploying (see docs/ENVIRONMENT.md).`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

void main();
