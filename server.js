
require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI missing in .env");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60
}));
app.use(express.static(path.join(__dirname, "public")));

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, lowercase: true, trim: true, sparse: true, unique: true },
  phone: { type: String, trim: true, sparse: true, unique: true },
  password_hash: { type: String, required: true },
  role: {
    type: String,
    enum: ["customer", "admin", "employee", "partner"],
    default: "customer"
  },
  address: String,
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  last_login: Date
});

const User = mongoose.model("User", userSchema);

function makeToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d", issuer: "sgs-solution" }
  );
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    address: user.address
  };
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: mongoose.connection.readyState === 1,
    app: "SGS SOLUTION",
    database: "MongoDB Atlas",
    state: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected"
  });
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, phone, password, address } = req.body || {};

    if (!name?.trim() || !password || password.length < 8 ||
        (!email?.trim() && !phone?.trim())) {
      return res.status(400).json({
        error: "Name, email or phone, and password (8+ characters) are required."
      });
    }

    const normalizedEmail = email?.trim().toLowerCase() || undefined;
    const normalizedPhone = phone?.replace(/\s/g, "") || undefined;

    const conditions = [];
    if (normalizedEmail) conditions.push({ email: normalizedEmail });
    if (normalizedPhone) conditions.push({ phone: normalizedPhone });

    const existing = await User.findOne({ $or: conditions });

    if (existing) {
      return res.status(409).json({
        error: "An account with this email or phone already exists."
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      password_hash: await bcrypt.hash(password, 12),
      address: address?.trim() || "",
      role: "customer"
    });

    return res.status(201).json({
      token: makeToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: "This email or phone is already registered."
      });
    }
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({
        error: "Enter your email/phone and password."
      });
    }

    const value = identifier.trim();

    const user = await User.findOne({
      $or: [
        { email: value.toLowerCase() },
        { phone: value.replace(/\s/g, "") }
      ],
      active: true
    });

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({
        error: "Incorrect login details."
      });
    }

    user.last_login = new Date();
    await user.save();

    return res.json({
      token: makeToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", async (req, res) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ error: "Please log in." });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET,
      { issuer: "sgs-solution" }
    );

    const user = await User.findOne({
      _id: payload.id,
      active: true
    });

    if (!user) {
      return res.status(401).json({ error: "Account unavailable." });
    }

    return res.json({ user: publicUser(user) });
  } catch {
    return res.status(401).json({
      error: "Session expired. Please log in again."
    });
  }
});

app.use((error, req, res, next) => {
  console.error("Backend error:", error.message);
  res.status(500).json({
    error: "Server error. Check the VS Code terminal."
  });
});

async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB Atlas connected:", mongoose.connection.name);

  app.listen(PORT, () => {
    console.log(`SGS SOLUTION running at http://localhost:${PORT}`);
  });
}

start().catch(error => {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
});
