// ─── Seed Database with Team Members ────────────────────────────────
// Run: npm run db:seed
// Default PIN for all users: 1234 (change after first login)

require("dotenv").config();
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const DEFAULT_PIN = "1234";

const users = [
  // Boss
  { name: "Boss", role: "boss", sub_role: "Owner", division: "all", avatar_color: "#f0c040" },

  // Metal Shop — Fabricators
  { name: "Reid", role: "fabricator", sub_role: "Fabricator", division: "metal", avatar_color: "#7c9aff" },
  { name: "Walter", role: "fabricator", sub_role: "Fabricator", division: "metal", avatar_color: "#7c9aff" },
  { name: "Valdir", role: "fabricator", sub_role: "Fabricator", division: "metal", avatar_color: "#7c9aff" },
  { name: "Gabriel", role: "fabricator", sub_role: "Fabricator", division: "metal", avatar_color: "#7c9aff" },
  { name: "Guilherme", role: "fabricator", sub_role: "Fabricator", division: "metal", avatar_color: "#7c9aff" },

  // Metal Shop — Installers
  { name: "Mario", role: "installer", sub_role: "Installer", division: "metal", avatar_color: "#60b0ff" },
  { name: "Toma", role: "installer", sub_role: "Installer", division: "metal", avatar_color: "#60b0ff" },

  // Granite Shop — Cutting
  { name: "Henry", role: "cutter", sub_role: "Cutting", division: "granite", avatar_color: "#f06090" },
  { name: "Gabriel G.", role: "cutter", sub_role: "Cutting", division: "granite", avatar_color: "#f06090" },

  // Granite Shop — Polishing & Preparing
  { name: "Juvencio", role: "polisher", sub_role: "Polishing & Prep", division: "granite", avatar_color: "#a070e0" },
  { name: "Alex", role: "polisher", sub_role: "Polishing & Prep", division: "granite", avatar_color: "#a070e0" },
  { name: "Osman", role: "polisher", sub_role: "Polishing & Prep", division: "granite", avatar_color: "#a070e0" },

  // Granite Shop — Installers
  { name: "Fierro", role: "installer", sub_role: "Installer", division: "granite", avatar_color: "#e08060" },
  { name: "Gusti", role: "installer", sub_role: "Installer", division: "granite", avatar_color: "#e08060" },
  { name: "Ariel", role: "installer", sub_role: "Installer", division: "granite", avatar_color: "#e08060" },
  { name: "Fernando", role: "installer", sub_role: "Installer", division: "granite", avatar_color: "#e08060" },
];

async function seed() {
  console.log("🌱 Seeding FabTrack database...\n");

  try {
    const hashedPin = await bcrypt.hash(DEFAULT_PIN, 10);

    // Clear existing users (careful in production!)
    await pool.query("DELETE FROM users");

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (name, pin, role, sub_role, division, avatar_color)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [u.name, hashedPin, u.role, u.sub_role, u.division, u.avatar_color]
      );
      console.log(`  ✅ ${u.name} (${u.sub_role} — ${u.division})`);
    }

    console.log(`\n✅ Seeded ${users.length} users. Default PIN: ${DEFAULT_PIN}`);
    console.log("⚠️  Have each user change their PIN after first login!\n");
  } catch (err) {
    console.error("❌ Seed error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
