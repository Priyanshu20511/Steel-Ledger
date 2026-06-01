import pg from "../lib/db/node_modules/pg/lib/index.js";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const users = [
  { name: "Admin User", username: "admin", email: "admin@dsms.local", role: "admin" },
  { name: "Production User", username: "production", email: "production@dsms.local", role: "production" },
  { name: "Dispatch User", username: "dispatch", email: "dispatch@dsms.local", role: "dispatch" },
  { name: "Viewer User", username: "viewer", email: "viewer@dsms.local", role: "viewer" },
];

const pool = new Pool({ connectionString: databaseUrl });
const passwordHash = "$2b$10$McsmGBKwkzLEC6Kxk21.i.kqUzzgA8V9dgNg1pUOnmGUJOag678hS";

try {
  for (const user of users) {
    await pool.query(
      `
        INSERT INTO users (name, username, email, password_hash, role, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        ON CONFLICT (username)
        DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          status = 'active',
          updated_at = NOW()
      `,
      [user.name, user.username, user.email, passwordHash, user.role],
    );
  }

  console.log("Seeded default users:");
  console.log("admin / admin123");
  console.log("production / admin123");
  console.log("dispatch / admin123");
  console.log("viewer / admin123");
} finally {
  await pool.end();
}
