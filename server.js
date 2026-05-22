require("dotenv").config();
const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const cors = require("cors");
const multer = require("multer");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const corsOptions = {
  origin: process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((url) => url.trim())
    : true,
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ensure uploads directory exists
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

// PostgreSQL connection
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false,
    })
  : new Pool({
      user: process.env.PGUSER || "postgres",
      host: process.env.PGHOST || "localhost",
      database: process.env.PGDATABASE || "auth_dashboard",
      password: process.env.PGPASSWORD || "postgres",
      port: Number(process.env.PGPORT) || 5433,
    });

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Initialize database
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(200);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(500);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(100);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS login_count INT DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
      EXCEPTION WHEN undefined_column THEN NULL; END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500),
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS activities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        action VARCHAR(255),
        details TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        message TEXT,
        type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(100) UNIQUE,
        expires_at TIMESTAMP,
        used BOOLEAN DEFAULT FALSE
      );
      
      CREATE TABLE IF NOT EXISTS user_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        total_activities INTEGER DEFAULT 0,
        last_active DATE,
        streak_days INTEGER DEFAULT 0,
        UNIQUE(user_id)
      );
    `);
    console.log("✅ Database ready");
  } catch (err) {
    console.error("DB init error:", err.message);
  } finally {
    client.release();
  }
}
initDB();

const JWT_SECRET = process.env.JWT_SECRET || "glass-dashboard-secret-2024";

async function authenticateToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied" });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid token" });
  }
}

// ============= AUTH ENDPOINTS =============
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "All fields required" });
  if (password.length < 6)
    return res
      .status(400)
      .json({ error: "Password must be at least 6 characters" });

  try {
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length)
      return res.status(400).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email",
      [name, email, hashed],
    );
    const userId = result.rows[0].id;

    await pool.query(
      "INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)",
      [userId, "Account Created", `User ${name} joined the platform`],
    );
    await pool.query(
      "INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)",
      [
        userId,
        "Welcome!",
        "Welcome to Glass Dashboard! Start exploring.",
        "success",
      ],
    );
    await pool.query("INSERT INTO user_stats (user_id) VALUES ($1)", [userId]);

    res.status(201).json({ message: "Account created!", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  try {
    const user = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (!user.rows.length)
      return res.status(401).json({ error: "Invalid credentials" });

    const valid = await bcrypt.compare(password, user.rows[0].password);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ userId: user.rows[0].id, email }, JWT_SECRET, {
      expiresIn: "7d",
    });
    await pool.query("INSERT INTO sessions (user_id, token) VALUES ($1, $2)", [
      user.rows[0].id,
      token,
    ]);
    await pool.query(
      "UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = $1",
      [user.rows[0].id],
    );
    await pool.query(
      "INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)",
      [user.rows[0].id, "Login", `Logged in from ${ip}`],
    );

    // Update streak
    await pool.query(
      `
      UPDATE user_stats 
      SET last_active = CURRENT_DATE,
          streak_days = CASE 
            WHEN last_active = CURRENT_DATE - INTERVAL '1 day' THEN streak_days + 1 
            WHEN last_active = CURRENT_DATE THEN streak_days 
            ELSE 1 
          END
      WHERE user_id = $1
    `,
      [user.rows[0].id],
    );

    res.json({
      token,
      user: {
        id: user.rows[0].id,
        name: user.rows[0].name,
        email: user.rows[0].email,
        avatar: user.rows[0].avatar,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ============= IMAGE UPLOAD - FIXED =============
app.post(
  "/api/upload-avatar",
  authenticateToken,
  upload.single("avatar"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      const optimizedFilename = `optimized-${req.file.filename}`;
      const optimizedPath = `uploads/${optimizedFilename}`;

      await sharp(req.file.path)
        .resize(200, 200, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(optimizedPath);

      fs.unlinkSync(req.file.path);

      const avatarUrl = `/${optimizedPath}`;
      await pool.query("UPDATE users SET avatar = $1 WHERE id = $2", [
        avatarUrl,
        req.userId,
      ]);
      await pool.query(
        "INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)",
        [req.userId, "Avatar Updated", "Uploaded new profile picture"],
      );

      res.json({
        message: "Avatar uploaded successfully!",
        avatarUrl: avatarUrl,
      });
    } catch (err) {
      console.error("Upload error:", err);
      res.status(500).json({ error: "Failed to upload image: " + err.message });
    }
  },
);

// ============= PROFILE ENDPOINTS =============
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    const user = await pool.query(
      "SELECT id, name, email, avatar, bio, location, website, login_count, last_login, created_at FROM users WHERE id = $1",
      [req.userId],
    );
    const stats = await pool.query(
      "SELECT total_activities, streak_days FROM user_stats WHERE user_id = $1",
      [req.userId],
    );
    res.json({ user: user.rows[0], stats: stats.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to load profile" });
  }
});

app.put("/api/update-profile", authenticateToken, async (req, res) => {
  const { name, bio, location, website, currentPassword, newPassword } =
    req.body;
  try {
    if (newPassword) {
      const user = await pool.query(
        "SELECT password FROM users WHERE id = $1",
        [req.userId],
      );
      const valid = await bcrypt.compare(
        currentPassword,
        user.rows[0].password,
      );
      if (!valid)
        return res.status(401).json({ error: "Current password incorrect" });
      const hashed = await bcrypt.hash(newPassword, 10);
      await pool.query(
        "UPDATE users SET name = $1, bio = $2, location = $3, website = $4, password = $5 WHERE id = $6",
        [
          name,
          bio || null,
          location || null,
          website || null,
          hashed,
          req.userId,
        ],
      );
    } else {
      await pool.query(
        "UPDATE users SET name = $1, bio = $2, location = $3, website = $4 WHERE id = $5",
        [name, bio || null, location || null, website || null, req.userId],
      );
    }
    await pool.query(
      "INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)",
      [req.userId, "Profile Updated", "Updated profile information"],
    );
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// ============= DASHBOARD DATA =============
app.get("/api/dashboard-data", authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM sessions WHERE last_activity > NOW() - INTERVAL '5 minutes') as active_sessions,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = CURRENT_DATE) as today_signups,
        (SELECT COUNT(*) FROM activities) as total_activities
    `);

    const user = await pool.query(
      "SELECT name, email, avatar, login_count FROM users WHERE id = $1",
      [req.userId],
    );
    const userStats = await pool.query(
      "SELECT streak_days FROM user_stats WHERE user_id = $1",
      [req.userId],
    );

    const activities = await pool.query(
      "SELECT action, details, created_at FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10",
      [req.userId],
    );

    const notifications = await pool.query(
      "SELECT id, title, message, type, is_read FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC LIMIT 5",
      [req.userId],
    );

    res.json({
      stats: {
        totalUsers: parseInt(stats.rows[0].total_users),
        activeSessions: parseInt(stats.rows[0].active_sessions),
        todaySignups: parseInt(stats.rows[0].today_signups),
        totalActivities: parseInt(stats.rows[0].total_activities),
      },
      user: {
        name: user.rows[0].name,
        email: user.rows[0].email,
        avatar: user.rows[0].avatar,
        loginCount: user.rows[0].login_count || 0,
        streakDays: userStats.rows[0]?.streak_days || 0,
      },
      activities: activities.rows.map((a) => ({
        action: a.action,
        details: a.details,
        time: new Date(a.created_at).toLocaleString(),
      })),
      notifications: notifications.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load data" });
  }
});

// ============= ENHANCED ENDPOINTS =============
app.get("/api/recent-signups", authenticateToken, async (req, res) => {
  const users = await pool.query(
    "SELECT name, email, avatar, created_at FROM users ORDER BY created_at DESC LIMIT 5",
  );
  res.json({ users: users.rows });
});

app.get("/api/top-users", authenticateToken, async (req, res) => {
  const users = await pool.query(
    "SELECT name, login_count FROM users WHERE login_count > 0 ORDER BY login_count DESC LIMIT 5",
  );
  res.json({ users: users.rows });
});

app.get("/api/export-users", authenticateToken, async (req, res) => {
  const users = await pool.query(
    "SELECT id, name, email, login_count, created_at FROM users",
  );
  const csv = [["ID", "Name", "Email", "Login Count", "Joined Date"]];
  users.rows.forEach((u) =>
    csv.push([
      u.id,
      u.name,
      u.email,
      u.login_count || 0,
      new Date(u.created_at).toLocaleString(),
    ]),
  );
  res.json({ csv: csv.map((row) => row.join(",")).join("\n") });
});

app.get("/api/activities/all", authenticateToken, async (req, res) => {
  const offset = parseInt(req.query.offset) || 0;
  const activities = await pool.query(
    "SELECT action, details, created_at FROM activities WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10 OFFSET $2",
    [req.userId, offset],
  );
  res.json({ activities: activities.rows });
});

app.get("/api/activities/:type", authenticateToken, async (req, res) => {
  const { type } = req.params;
  let query =
    "SELECT action, details, created_at FROM activities WHERE user_id = $1";
  const params = [req.userId];
  if (type !== "all") {
    query += " AND LOWER(action) LIKE $2";
    params.push(`%${type.toLowerCase()}%`);
  }
  query += " ORDER BY created_at DESC LIMIT 20";
  const activities = await pool.query(query, params);
  res.json({ activities: activities.rows });
});

app.get("/api/activity-chart", authenticateToken, async (req, res) => {
  const chartData = await pool.query(
    `
    SELECT DATE(created_at) as date, COUNT(*) as count 
    FROM activities 
    WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `,
    [req.userId],
  );
  res.json({ chartData: chartData.rows });
});

app.get("/api/leaderboard", authenticateToken, async (req, res) => {
  const leaderboard = await pool.query(`
    SELECT u.name, u.avatar, COUNT(a.id) as activity_count 
    FROM users u 
    LEFT JOIN activities a ON u.id = a.user_id 
    WHERE a.created_at > NOW() - INTERVAL '7 days'
    GROUP BY u.id 
    ORDER BY activity_count DESC 
    LIMIT 10
  `);
  res.json({ leaderboard: leaderboard.rows });
});

app.post("/api/mark-notification-read", authenticateToken, async (req, res) => {
  const { notificationId } = req.body;
  await pool.query(
    "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
    [notificationId, req.userId],
  );
  res.json({ message: "Notification marked as read" });
});

app.post("/api/forgot-password", async (req, res) => {
  res.json({
    message: "Password reset link would be sent to your email",
    demo: true,
  });
});

app.post("/api/logout", authenticateToken, async (req, res) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (token) await pool.query("DELETE FROM sessions WHERE token = $1", [token]);
  res.json({ message: "Logged out" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log("✅ All features ready!");
});

// ============= USER MANAGEMENT (Admin) =============

// Get all users (for admin panel)
app.get("/api/admin/users", authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you can add an is_admin column)
    const user = await pool.query("SELECT is_admin FROM users WHERE id = $1", [
      req.userId,
    ]);
    // For demo, let's allow all logged-in users to see users list
    // In production, check if user.is_admin === true

    const users = await pool.query(`
      SELECT id, name, email, avatar, login_count, 
             TO_CHAR(last_login, 'YYYY-MM-DD HH24:MI:SS') as last_login,
             TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS') as created_at,
             status
      FROM users 
      ORDER BY created_at DESC
    `);
    res.json({ users: users.rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

// Add new user (admin or self-registration)
app.post("/api/admin/users", authenticateToken, async (req, res) => {
  const { name, email, password, isAdmin } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ error: "Name, email, and password are required" });
  }

  try {
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rows.length) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (name, email, password, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, name, email",
      [name, email, hashedPassword, isAdmin || false],
    );

    await pool.query(
      "INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)",
      [req.userId, "User Added", `Added new user: ${name} (${email})`],
    );

    res
      .status(201)
      .json({ message: "User added successfully", user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Failed to add user" });
  }
});

// Update user
app.put("/api/admin/users/:id", authenticateToken, async (req, res) => {
  const userId = req.params.id;
  const { name, email, isAdmin, status } = req.body;

  try {
    await pool.query(
      "UPDATE users SET name = $1, email = $2, is_admin = $3, status = $4 WHERE id = $5",
      [name, email, isAdmin || false, status || "active", userId],
    );

    await pool.query(
      "INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)",
      [req.userId, "User Updated", `Updated user ID: ${userId}`],
    );

    res.json({ message: "User updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

// Delete user
app.delete("/api/admin/users/:id", authenticateToken, async (req, res) => {
  const userId = req.params.id;

  // Prevent deleting yourself
  if (parseInt(userId) === req.userId) {
    return res
      .status(400)
      .json({ error: "You cannot delete your own account" });
  }

  try {
    // Get user info before deleting for activity log
    const user = await pool.query(
      "SELECT name, email FROM users WHERE id = $1",
      [userId],
    );

    await pool.query("DELETE FROM users WHERE id = $1", [userId]);

    await pool.query(
      "INSERT INTO activities (user_id, action, details) VALUES ($1, $2, $3)",
      [
        req.userId,
        "User Deleted",
        `Deleted user: ${user.rows[0]?.name || userId}`,
      ],
    );

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Get user by ID (for editing)
app.get("/api/admin/users/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await pool.query(
      "SELECT id, name, email, is_admin, status, login_count, created_at, last_login FROM users WHERE id = $1",
      [userId],
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({ user: user.rows[0] });
  } catch (err) {
    console.error("Error loading user:", err);
    res.status(500).json({ error: "Failed to load user" });
  }
});

// Add is_admin column to users table if not exists
async function addAdminColumn() {
  const client = await pool.connect();
  try {
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
      EXCEPTION WHEN duplicate_column THEN NULL; END $$;
    `);
    console.log("✅ Admin column verified");
  } catch (err) {
    console.error("Error adding admin column:", err.message);
  } finally {
    client.release();
  }
}
addAdminColumn();
