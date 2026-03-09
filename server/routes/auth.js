// ─── Auth Routes ────────────────────────────────────────────────────
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

// GET /api/auth/users — list all active users (for login screen)
// No auth required — just shows names and roles, no sensitive data
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, sub_role, division, avatar_color
       FROM users WHERE active = true
       ORDER BY
         CASE role WHEN 'boss' THEN 0 ELSE 1 END,
         division,
         role,
         name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/auth/login — authenticate with user ID + PIN
router.post("/login", async (req, res) => {
  const { userId, pin } = req.body;

  if (!userId || !pin) {
    return res.status(400).json({ error: "User ID and PIN are required" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND active = true",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];
    const validPin = await bcrypt.compare(pin, user.pin);

    if (!validPin) {
      return res.status(401).json({ error: "Incorrect PIN" });
    }

    // Generate JWT (expires in 30 days — long-lived for shop workers)
    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        role: user.role,
        sub_role: user.sub_role,
        division: user.division,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        sub_role: user.sub_role,
        division: user.division,
        avatar_color: user.avatar_color,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// PUT /api/auth/change-pin — change your PIN (authenticated)
router.put("/change-pin", authMiddleware, async (req, res) => {
  const { currentPin, newPin } = req.body;

  if (!currentPin || !newPin) {
    return res.status(400).json({ error: "Current and new PIN required" });
  }

  if (!/^\d{4,6}$/.test(newPin)) {
    return res.status(400).json({ error: "PIN must be 4-6 digits" });
  }

  try {
    const result = await pool.query("SELECT pin FROM users WHERE id = $1", [req.user.id]);
    const validPin = await bcrypt.compare(currentPin, result.rows[0].pin);

    if (!validPin) {
      return res.status(401).json({ error: "Current PIN is incorrect" });
    }

    const hashed = await bcrypt.hash(newPin, 10);
    await pool.query("UPDATE users SET pin = $1 WHERE id = $2", [hashed, req.user.id]);

    res.json({ message: "PIN updated successfully" });
  } catch (err) {
    console.error("Change PIN error:", err);
    res.status(500).json({ error: "Failed to change PIN" });
  }
});

module.exports = router;
