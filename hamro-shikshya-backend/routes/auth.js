import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import School from "../models/School.js";

const router = express.Router();

const cleanText = (value) => String(value || "").trim();

const cleanEmail = (value) => cleanText(value).toLowerCase();

const normalizeRole = (role) => {
  const cleanRole = cleanText(role).toLowerCase();

  if (cleanRole === "principal") return "admin";
  if (cleanRole === "admin") return "admin";
  if (cleanRole === "teacher") return "teacher";
  if (cleanRole === "student") return "student";

  return "";
};

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in backend environment variables.");
  }

  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      schoolId: user.schoolId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const buildUserResponse = (user, school = null) => {
  const schoolData = school || user.schoolId;

  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    schoolId: schoolData?._id || user.schoolId,
    schoolName: schoolData?.schoolName || "",
    className: user.className || "",
    section: user.section || "",
    phone: user.phone || "",
    address: user.address || "",
    profileImage: user.profileImage || "",
    accountStatus: user.accountStatus || "active",
    isActive: user.isActive,
  };
};


router.post("/signup", async (req, res) => {
  try {
    const name = cleanText(req.body.name || req.body.fullName);
    const email = cleanEmail(req.body.email);
    const password = cleanText(req.body.password);
    const role = normalizeRole(req.body.role || "admin");

    const schoolName = cleanText(
      req.body.schoolName ||
        req.body.school ||
        req.body.school_name ||
        req.body.institutionName
    );

    if (!name || !email || !password || !schoolName) {
      return res.status(400).json({
        message: "Name, email, password and school name are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long.",
      });
    }

    if (role !== "admin") {
      return res.status(400).json({
        message:
          "Only Admin / Principal can sign up first. Teachers and students must be added by the school admin.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email.",
      });
    }

    let school = await School.findOne({
      schoolName: {
        $regex: `^${schoolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    });

    if (!school) {
      school = await School.create({
        schoolName,
        adminName: name,
        email,
        isActive: true,
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      schoolId: school._id,
      isActive: true,
      accountStatus: "active",
    });

    const token = createToken(user);

    return res.status(201).json({
      message: "Admin account created successfully.",
      token,
      user: buildUserResponse(user, school),
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);

    return res.status(500).json({
      message: err.message || "Signup failed. Please try again.",
    });
  }
});

// Optional alias, useful if frontend sends /auth/register
router.post("/register", async (req, res) => {
  try {
    req.url = "/signup";
    return router.handle(req, res);
  } catch (err) {
    console.error("REGISTER ERROR:", err);

    return res.status(500).json({
      message: err.message || "Registration failed.",
    });
  }
});


router.post("/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = cleanText(req.body.password);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email }).populate(
      "schoolId",
      "schoolName email phone address logoUrl isActive"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (user.accountStatus === "deactivated" || user.isActive === false) {
      return res.status(403).json({
        message: "Your account is deactivated. Please contact your school admin.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Invalid password.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      message: err.message || "Login failed. Please try again.",
    });
  }
});

// Optional alias, useful if frontend sends /auth/signin
router.post("/signin", async (req, res) => {
  try {
    req.url = "/login";
    return router.handle(req, res);
  } catch (err) {
    console.error("SIGNIN ERROR:", err);

    return res.status(500).json({
      message: err.message || "Signin failed.",
    });
  }
});

export default router;