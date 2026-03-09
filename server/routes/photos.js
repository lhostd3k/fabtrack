// ─── Photo Upload Routes ────────────────────────────────────────────
const router = require("express").Router();
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const pool = require("../db/pool");
const { authMiddleware } = require("../middleware/auth");

router.use(authMiddleware);

// Ensure upload directories exist
const uploadDir = process.env.UPLOAD_DIR || "./uploads";
const thumbDir = path.join(uploadDir, "thumbs");
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(thumbDir, { recursive: true });

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|heic|heif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype.split("/")[1]);
    if (ext || mime) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed (jpg, png, webp, heic)"));
    }
  },
});

// ── POST /api/photos/:projectId — upload photos to a project ──
router.post("/:projectId", upload.array("photos", 10), async (req, res) => {
  try {
    const projectId = req.params.projectId;

    // Verify project exists
    const project = await pool.query("SELECT id FROM projects WHERE id = $1", [projectId]);
    if (project.rows.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }

    const uploaded = [];

    for (const file of req.files) {
      // Generate thumbnail
      const thumbFilename = `thumb_${file.filename}`;
      const thumbPath = path.join(thumbDir, thumbFilename);

      try {
        await sharp(file.path)
          .resize(400, 400, { fit: "cover" })
          .jpeg({ quality: 80 })
          .toFile(thumbPath);
      } catch (sharpErr) {
        console.warn("Thumbnail generation failed, using original:", sharpErr.message);
      }

      // Save to database
      const result = await pool.query(
        `INSERT INTO photos (project_id, user_id, filename, original_name, file_path, thumb_path, file_size, mime_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          projectId,
          req.user.id,
          file.filename,
          file.originalname,
          `/uploads/${file.filename}`,
          `/uploads/thumbs/${thumbFilename}`,
          file.size,
          file.mimetype,
        ]
      );

      // Add timeline entry
      await pool.query(
        `INSERT INTO timeline_entries (project_id, user_id, user_name, entry_type, content, metadata)
         VALUES ($1, $2, $3, 'photo', $4, $5)`,
        [
          projectId,
          req.user.id,
          req.user.name,
          `Photo uploaded: ${file.originalname}`,
          JSON.stringify({ photo_id: result.rows[0].id, filename: file.filename }),
        ]
      );

      uploaded.push(result.rows[0]);
    }

    // Touch project updated_at
    await pool.query("UPDATE projects SET updated_at = NOW() WHERE id = $1", [projectId]);

    res.status(201).json({ uploaded, count: uploaded.length });
  } catch (err) {
    console.error("Photo upload error:", err);
    res.status(500).json({ error: "Failed to upload photos" });
  }
});

// ── DELETE /api/photos/:photoId — delete a photo ──
router.delete("/:photoId", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM photos WHERE id = $1 RETURNING file_path, thumb_path",
      [req.params.photoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Delete files from disk
    const photo = result.rows[0];
    const filePath = path.join(".", photo.file_path);
    const thumbFilePath = path.join(".", photo.thumb_path);

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(thumbFilePath)) fs.unlinkSync(thumbFilePath);

    res.json({ message: "Photo deleted" });
  } catch (err) {
    console.error("Error deleting photo:", err);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

module.exports = router;
