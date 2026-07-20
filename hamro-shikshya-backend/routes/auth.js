import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import School from "../models/School.js";

const router = express.Router();

const cleanText = (value) => String(value || "").trim();

const normalizeEmail = (email) => cleanText(email).toLowerCase();

const normalizeRole = (role) => {
  const cleanedRole = cleanText(role).toLowerCase();

  if (cleanedRole === "principal") return "admin";
  if (cleanedRole === "admin") return "admin";
  if (cleanedRole === "teacher") return "teacher";
  if (cleanedRole === "student") return "student";

  return "";
};

const escapeRegExp = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing in backend environment variables.");
  }

  return secret;
};

const createToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      schoolId: user.schoolId?._id || user.schoolId,
    },
    getJwtSecret(),
    {
      expiresIn: "7d",
    }
  );
};

const buildSchoolPayload = (body = {}) => {
  const schoolName = cleanText(body.schoolName || body.school || body.institutionName);

  const address = cleanText(body.address);
  const phone = cleanText(body.phone || body.contact);
  const email = normalizeEmail(body.schoolEmail || body.email);
  const website = cleanText(body.website);
  const principalName = cleanText(body.principalName || body.principal);
  const adminName = cleanText(body.adminName || body.name);

  const latitude =
    body.latitude !== undefined && body.latitude !== null && body.latitude !== ""
      ? Number(body.latitude)
      : null;

  const longitude =
    body.longitude !== undefined && body.longitude !== null && body.longitude !== ""
      ? Number(body.longitude)
      : null;

  const payload = {
    schoolName,
    address,
    phone,
    email,
    website,
    principalName,
    adminName,
    logoUrl: cleanText(body.logoUrl),
    isActive: true,
    addressDetails: {
      formattedAddress: cleanText(body.formattedAddress || body.address),
      addressLine1: cleanText(body.addressLine1 || body.address),
      municipality: cleanText(body.municipality),
      district: cleanText(body.district),
      province: cleanText(body.province),
      country: cleanText(body.country) || "Nepal",
      postalCode: cleanText(body.postalCode),
      placeId: cleanText(body.placeId),
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    },
  };

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    payload.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
  }

  return payload;
};

const formatUserResponse = (user, school = null) => {
  const populatedSchool =
    school ||
    (user.schoolId && typeof user.schoolId === "object" ? user.schoolId : null);

  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    schoolId: populatedSchool?._id || user.schoolId,
    schoolName: populatedSchool?.schoolName || "",
    className: user.className || "",
    section: user.section || "",
    rollNumber: user.rollNumber || "",
    studentCode: user.studentCode || "",
    employeeId: user.employeeId || "",
    profileImage: user.profileImage || "",
    isActive: user.isActive,
    accountStatus: user.accountStatus,
  };
};

// SIGNUP - first account must be admin/principal
const signupHandler = async (req, res) => {
  try {
    const name = cleanText(req.body.name || req.body.fullName);
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");
    const schoolName = cleanText(req.body.schoolName || req.body.school);
    const finalRole = normalizeRole(req.body.role || "admin");

    if (!name || !email || !password || !schoolName) {
      return res.status(400).json({
        message: "Name, email, password and school name are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters.",
      });
    }

    if (finalRole !== "admin") {
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
        $regex: `^${escapeRegExp(schoolName)}$`,
        $options: "i",
      },
    });

    if (!school) {
      const schoolPayload = buildSchoolPayload({
        ...req.body,
        schoolName,
        adminName: name,
        schoolEmail: req.body.schoolEmail || "",
      });

      school = await School.create(schoolPayload);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      schoolId: school._id,
      phone: cleanText(req.body.phone),
      address: cleanText(req.body.address),
      isActive: true,
      accountStatus: "active",
    });

    const token = createToken(user);

    return res.status(201).json({
      message: "Admin account created successfully.",
      token,
      user: formatUserResponse(user, school),
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);

    return res.status(500).json({
      message: err.message || "Signup failed.",
    });
  }
};

// LOGIN
const loginHandler = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({ email }).populate(
      "schoolId",
      "schoolName email logoUrl isActive"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    if (user.isActive === false || user.accountStatus === "deactivated") {
      return res.status(403).json({
        message: "This account is deactivated. Please contact your school admin.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account has no password saved. Delete this user from MongoDB and sign up again.",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Invalid email or password.",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful.",
      token,
      user: formatUserResponse(user),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      message: err.message || "Login failed.",
    });
  }
};

router.post("/signup", signupHandler);
router.post("/register", signupHandler);

router.post("/login", loginHandler);
router.post("/signin", loginHandler);

export default router;