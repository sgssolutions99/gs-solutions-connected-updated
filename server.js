require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- REQUIRED ENVIRONMENT VARIABLES ----------
if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing in environment variables.");
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters.");
}

// ---------- SECURITY & CORS ----------
app.use(helmet({ contentSecurityPolicy: false }));

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const normalizedOrigin = origin
    ? origin.replace(/\/$/, "")
    : "";

  // If CORS_ORIGINS is configured, allow only those origins.
  // If it is empty, allow cross-origin requests temporarily.
  const allowed =
    !origin ||
    allowedOrigins.length === 0 ||
    allowedOrigins.includes(normalizedOrigin);

  if (allowed && origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(allowed ? 204 : 403);
  }

  if (!allowed) {
    return res.status(403).json({
      success: false,
      error: "This website origin is not allowed."
    });
  }

  next();
});

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.use(
  "/api/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(
  "/api/appointments",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Serve frontend files too, if this project contains a public folder.
app.use(express.static(require("path").join(__dirname, "public")));

// ---------- USER MODEL ----------
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    sparse: true,
    unique: true
  },
  phone: { type: String, trim: true, sparse: true, unique: true },
  password_hash: { type: String, required: true },
  role: {
    type: String,
    enum: ["customer", "admin", "employee", "partner"],
    default: "customer"
  },
  address: { type: String, default: "" },
  active: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  last_login: Date
});

const User = mongoose.model("User", userSchema);

// ---------- APPOINTMENT MODEL ----------
const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 25 },
  email: { type: String, trim: true, default: "", maxlength: 150 },
  service: { type: String, trim: true, default: "", maxlength: 150 },
  date: { type: String, required: true, trim: true, maxlength: 30 },
  time: { type: String, required: true, trim: true, maxlength: 30 },
  address: { type: String, trim: true, default: "", maxlength: 500 },
  message: { type: String, trim: true, default: "", maxlength: 2000 },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  status: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending"
  },
  created_at: { type: Date, default: Date.now }
});

const Appointment = mongoose.model("Appointment", appointmentSchema);

// ---------- AUTH HELPERS ----------
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

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Please log in first."
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "sgs-solution"
    });

    const user = await User.findOne({
      _id: payload.id,
      active: true
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Account unavailable. Please log in again."
      });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Your session has expired. Please log in again."
    });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      error: "Admin access required."
    });
  }
  next();
}

// ---------- HEALTH CHECK ----------
app.get("/api/health", (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    ok: connected,
    app: "SGS SOLUTION",
    database: "MongoDB Atlas",
    state: connected ? "connected" : "disconnected"
  });
});

// ---------- CUSTOMER REGISTRATION ----------
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, phone, password, address } = req.body || {};

    if (
      !name?.trim() ||
      typeof password !== "string" ||
      password.length < 8 ||
      (!email?.trim() && !phone?.trim())
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Name, email or phone, and a password of at least 8 characters are required."
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
        success: false,
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
      success: true,
      token: makeToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "This email or phone is already registered."
      });
    }
    next(error);
  }
});

// ---------- LOGIN ----------
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};

    if (
      typeof identifier !== "string" ||
      !identifier.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
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
        success: false,
        error: "Incorrect login details."
      });
    }

    user.last_login = new Date();
    await user.save();

    return res.json({
      success: true,
      token: makeToken(user),
      user: publicUser(user)
    });
  } catch (error) {
    next(error);
  }
});

// ---------- CURRENT USER ----------
app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({
    success: true,
    user: publicUser(req.user)
  });
});

// ---------- CREATE APPOINTMENT ----------
app.post("/api/appointments", async (req, res, next) => {
  try {
    const body = req.body || {};

    // Accept common field names used by appointment forms.
    const name = body.name || body.customerName || body.fullName;
    const phone = body.phone || body.mobile || body.mobileNumber;
    const email = body.email || "";
    const service =
      body.service || body.serviceType || body.plan || body.package || "";
    const date =
      body.date || body.appointmentDate || body.bookingDate;
    const time =
      body.time || body.appointmentTime || body.bookingTime || body.slot;
    const address = body.address || body.location || "";
    const message = body.message || body.notes || body.description || "";

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof date !== "string" ||
      !date.trim() ||
      typeof time !== "string" ||
      !time.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "Please provide your name, phone, appointment date and time."
      });
    }

    const appointment = await Appointment.create({
      name: name.trim(),
      phone: phone.trim(),
      email: typeof email === "string" ? email.trim() : "",
      service: typeof service === "string" ? service.trim() : "",
      date: date.trim(),
      time: time.trim(),
      address: typeof address === "string" ? address.trim() : "",
      message: typeof message === "string" ? message.trim() : "",
      user_id: req.user?._id || null
    });

    return res.status(201).json({
      success: true,
      message: "Appointment request submitted successfully.",
      appointment: {
        id: appointment._id.toString(),
        status: appointment.status,
        date: appointment.date,
        time: appointment.time
      }
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        error: "Please check the appointment details and try again."
      });
    }
    next(error);
  }
});

// ---------- CUSTOMER: VIEW OWN APPOINTMENTS ----------
app.get("/api/appointments/mine", authenticate, async (req, res, next) => {
  try {
    const appointments = await Appointment.find({
      user_id: req.user._id
    }).sort({ created_at: -1 });

    res.json({ success: true, appointments });
  } catch (error) {
    next(error);
  }
});

// ---------- ADMIN: VIEW ALL APPOINTMENTS ----------
app.get(
  "/api/appointments",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const appointments = await Appointment.find()
        .sort({ created_at: -1 })
        .limit(500);

      res.json({ success: true, appointments });
    } catch (error) {
      next(error);
    }
  }
);

// ---------- ADMIN: UPDATE APPOINTMENT STATUS ----------
app.patch(
  "/api/appointments/:id/status",
  authenticate,
  requireAdmin,
  async (req, res, next) => {
    try {
      const allowedStatuses = [
        "pending",
        "confirmed",
        "cancelled",
        "completed"
      ];

      const { status } = req.body || {};

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error:
            "Status must be pending, confirmed, cancelled or completed."
        });
      }

      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          error: "Invalid appointment ID."
        });
      }

      const appointment = await Appointment.findByIdAndUpdate(
        req.params.id,
        { status },
        { new: true, runValidators: true }
      );

      if (!appointment) {
        return res.status(404).json({
          success: false,
          error: "Appointment not found."
        });
      }

      res.json({
        success: true,
        message: "Appointment status updated.",
        appointment
      });
    } catch (error) {
      next(error);
    }
  }
);

// ---------- API 404 ----------
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found."
  });
});

// ---------- ERROR HANDLER ----------
app.use((error, req, res, next) => {
  console.error("Backend error:", error.message);

  if (res.headersSent) return next(error);

  res.status(500).json({
    success: false,
    error: "Server error. Check the Render logs."
  });
});

// ---------- START SERVER ----------
async function start() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB Atlas connected:", mongoose.connection.name);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SGS SOLUTION server listening on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
});