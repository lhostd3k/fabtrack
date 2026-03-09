// ─── Project Routes ─────────────────────────────────────────────────
const router = require("express").Router();
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

// ── GET /api/projects — list projects (filtered by division) ──
router.get("/", async (req, res) => {
  try {
    const { status, type, client, division, search, limit = 50, offset = 0 } = req.query;
    const user = req.user;

    let where = [];
    let params = [];
    let idx = 1;

    // Division filtering: boss sees all, others see their division
    if (user.role === "boss" || user.division === "all") {
      if (division && division !== "all") {
        where.push(`p.division = $${idx++}`);
        params.push(division);
      }
    } else {
      where.push(`p.division = $${idx++}`);
      params.push(user.division);
    }

    if (status) {
      where.push(`p.status = $${idx++}`);
      params.push(status);
    }

    if (type) {
      where.push(`p.project_type = $${idx++}`);
      params.push(type);
    }

    if (client) {
      where.push(`p.client_name ILIKE $${idx++}`);
      params.push(`%${client}%`);
    }

    if (search) {
      where.push(`(p.name ILIKE $${idx} OR p.client_name ILIKE $${idx} OR p.address ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    params.push(parseInt(limit));
    params.push(parseInt(offset));

    const result = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*) FROM photos ph WHERE ph.project_id = p.id) AS photo_count,
              (SELECT COUNT(*) FROM timeline_entries t WHERE t.project_id = p.id) AS update_count
       FROM projects p
       ${whereClause}
       ORDER BY p.updated_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    // Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM projects p ${whereClause}`,
      params.slice(0, -2) // exclude limit/offset
    );

    res.json({
      projects: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (err) {
    console.error("Error fetching projects:", err);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// ── GET /api/projects/stats — dashboard stats ──
router.get("/stats", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT division, status, COUNT(*)::int as count
       FROM projects
       WHERE status != 'Completed'
       GROUP BY division, status
       ORDER BY division, status`
    );

    // Build structured response
    const stats = { metal: {}, granite: {} };
    for (const row of result.rows) {
      if (stats[row.division]) {
        stats[row.division][row.status] = row.count;
      }
    }

    // Get items at powder coat with details
    const pcItems = await pool.query(
      `SELECT id, name, client_name, project_type, status
       FROM projects
       WHERE division = 'metal'
         AND status IN ('Ready for Powder Coat', 'Sent to Powder Coat', 'At Powder Coat')
       ORDER BY status, name`
    );

    res.json({ stats, powderCoatItems: pcItems.rows });
  } catch (err) {
    console.error("Error fetching stats:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── GET /api/projects/:id — single project with timeline ──
router.get("/:id", async (req, res) => {
  try {
    const project = await pool.query("SELECT * FROM projects WHERE id = $1", [req.params.id]);

    if (project.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const p = project.rows[0];

    // Division check (non-boss users)
    if (req.user.role !== "boss" && req.user.division !== "all" && p.division !== req.user.division) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Get timeline
    const timeline = await pool.query(
      `SELECT * FROM timeline_entries
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    // Get photos
    const photos = await pool.query(
      `SELECT id, filename, file_path, thumb_path, original_name, created_at
       FROM photos
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({
      ...p,
      timeline: timeline.rows,
      photos: photos.rows,
    });
  } catch (err) {
    console.error("Error fetching project:", err);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// ── POST /api/projects — create project ──
router.post("/", async (req, res) => {
  try {
    const { name, client_name, address, project_type, division, description, assigned_team, due_date, status } = req.body;

    if (!name || !client_name || !project_type || !division || !status) {
      return res.status(400).json({ error: "Missing required fields: name, client_name, project_type, division, status" });
    }

    // Non-boss users can only create in their division
    if (req.user.role !== "boss" && req.user.division !== "all" && division !== req.user.division) {
      return res.status(403).json({ error: "Cannot create projects in another division" });
    }

    const result = await pool.query(
      `INSERT INTO projects (name, client_name, address, project_type, division, description, assigned_team, due_date, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, client_name, address, project_type, division, description, assigned_team, due_date, status, req.user.id]
    );

    const project = result.rows[0];

    // Add initial timeline entry
    await pool.query(
      `INSERT INTO timeline_entries (project_id, user_id, user_name, entry_type, content)
       VALUES ($1, $2, $3, 'status', $4)`,
      [project.id, req.user.id, req.user.name, status]
    );

    res.status(201).json(project);
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// ── PUT /api/projects/:id — update project details ──
router.put("/:id", async (req, res) => {
  try {
    const { name, client_name, address, project_type, description, assigned_team, due_date } = req.body;

    const result = await pool.query(
      `UPDATE projects SET
        name = COALESCE($1, name),
        client_name = COALESCE($2, client_name),
        address = COALESCE($3, address),
        project_type = COALESCE($4, project_type),
        description = COALESCE($5, description),
        assigned_team = COALESCE($6, assigned_team),
        due_date = COALESCE($7, due_date),
        updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [name, client_name, address, project_type, description, assigned_team, due_date, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error updating project:", err);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// ── PUT /api/projects/:id/status — update status (creates timeline entry) ──
router.put("/:id/status", async (req, res) => {
  try {
    const { status, note, checklist } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    // Get current status
    const current = await pool.query("SELECT status, division FROM projects WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const oldStatus = current.rows[0].status;

    // Update project status
    await pool.query(
      "UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2",
      [status, req.params.id]
    );

    // Create timeline entry for status change
    await pool.query(
      `INSERT INTO timeline_entries (project_id, user_id, user_name, entry_type, content, metadata)
       VALUES ($1, $2, $3, 'status', $4, $5)`,
      [req.params.id, req.user.id, req.user.name, status, JSON.stringify({ old_status: oldStatus })]
    );

    // If a note was included with the status change, add that too
    if (note && note.trim()) {
      await pool.query(
        `INSERT INTO timeline_entries (project_id, user_id, user_name, entry_type, content)
         VALUES ($1, $2, $3, 'note', $4)`,
        [req.params.id, req.user.id, req.user.name, note.trim()]
      );
    }

    // If checklist was submitted (powder coat), save it
    if (checklist) {
      await pool.query(
        `INSERT INTO checklist_completions (project_id, user_id, checklist, completed)
         VALUES ($1, $2, $3, true)`,
        [req.params.id, req.user.id, JSON.stringify(checklist)]
      );
    }

    res.json({ message: "Status updated", oldStatus, newStatus: status });
  } catch (err) {
    console.error("Error updating status:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ── POST /api/projects/:id/notes — add a note ──
router.post("/:id/notes", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Note content is required" });
    }

    const result = await pool.query(
      `INSERT INTO timeline_entries (project_id, user_id, user_name, entry_type, content)
       VALUES ($1, $2, $3, 'note', $4)
       RETURNING *`,
      [req.params.id, req.user.id, req.user.name, content.trim()]
    );

    // Touch project updated_at
    await pool.query("UPDATE projects SET updated_at = NOW() WHERE id = $1", [req.params.id]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error adding note:", err);
    res.status(500).json({ error: "Failed to add note" });
  }
});

// ── DELETE /api/projects/:id — delete project (boss only) ──
router.delete("/:id", async (req, res) => {
  if (req.user.role !== "boss") {
    return res.status(403).json({ error: "Only the boss can delete projects" });
  }

  try {
    const result = await pool.query("DELETE FROM projects WHERE id = $1 RETURNING id", [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ message: "Project deleted" });
  } catch (err) {
    console.error("Error deleting project:", err);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

module.exports = router;
