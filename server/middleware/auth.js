// ─── Authentication Middleware ───────────────────────────────────────
const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, name, role, division }
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Boss can access everything; others only their division
function divisionGuard(req, res, next) {
  // Boss bypasses division checks
  if (req.user.role === "boss" || req.user.division === "all") {
    return next();
  }
  // For routes with :id, we check in the route handler
  // For list routes, we filter in the query
  next();
}

module.exports = { authMiddleware, divisionGuard };
