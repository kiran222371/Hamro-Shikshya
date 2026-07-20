import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import School from "../models/School.js";

const router = express.Router();

const cleanText = (value) => String(value || "").trim();

const cleanEmail = (value) => cleanText(value).toLowerCase();

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in backend environment variables");
  }

  return jwt.sign(
    {
      id: String(user._id),
      role: user.role,
      schoolId: String(user.schoolId?._id || user.schoolId),
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const buildUserResponse = (user, school = null) => {
  const schoolDoc = school || user.schoolId;

  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    schoolId: schoolDoc?._id || user.schoolId,
    schoolName: schoolDoc?.schoolName || schoolDoc?.name || "",
    className: user.className || "",
    section: user.section || "",
    phone: user.phone || "",
    profileImage: user.profileImage || "",
    isActive: user.isActive,
    accountStatus: user.accountStatus,
  };
};

// SIGNUP - creates first admin and school
router.post("/signup", async (req, res) => {
  try {
    const name = cleanText(req.body.name || req.body.fullName);
    const email = cleanEmail(req.body.email);
    const password = cleanText(req.body.password);
    const requestedRole = cleanText(req.body.role || "admin").toLowerCase();

    const schoolName = cleanText(
      req.body.schoolName ||
        req.body.school ||
        req.body.institutionName ||
        req.body.organizationName
    );

    if (!name || !email || !password || !schoolName) {
      return res.status(400).json({
        message: "Name, email, password and school name are required",
      });
    }

    const finalRole =
      requestedRole === "admin" || requestedRole === "principal"
        ? "admin"
        : requestedRole;

    if (finalRole !== "admin") {
      return res.status(400).json({
        message:
          "Only Admin / Principal can sign up first. Teachers and students must be added by the school admin.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
      });
    }

    let school = await School.findOne({
      schoolName: {
        $regex: `^${escapeRegex(schoolName)}$`,
        $options: "i",
      },
    });

    if (!school) {
      school = await School.create({
        schoolName,
        adminName: name,
        email,
        address: cleanText(req.body.address),
        phone: cleanText(req.body.phone),
        website: cleanText(req.body.website),
        principalName: cleanText(req.body.principalName),
        logoUrl: cleanText(req.body.logoUrl),
        isActive: true,
        addressDetails: {
          formattedAddress: cleanText(req.body.formattedAddress),
          addressLine1: cleanText(req.body.addressLine1 || req.body.address),
          municipality: cleanText(req.body.municipality),
          district: cleanText(req.body.district),
          province: cleanText(req.body.province),
          country: cleanText(req.body.country) || "Nepal",
          postalCode: cleanText(req.body.postalCode),
          placeId: cleanText(req.body.placeId),
          latitude:
            req.body.latitude !== undefined && req.body.latitude !== ""
              ? Number(req.body.latitude)
              : null,
          longitude:
            req.body.longitude !== undefined && req.body.longitude !== ""
              ? Number(req.body.longitude)
              : null,
        },
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
      message: "Admin account created successfully",
      token,
      user: buildUserResponse(user, school),
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: "User already exists with this email",
      });
    }

    return res.status(500).json({
      message: err.message || "Signup failed",
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = cleanText(req.body.password);

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).populate(
      "schoolId",
      "schoolName name email phone address logoUrl isActive"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.isActive || user.accountStatus === "deactivated") {
      return res.status(403).json({
        message: "This account has been deactivated",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);

    return res.status(200).json({
      message: "Login successful",
      token,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      message: err.message || "Login failed",
    });
  }
});

export default router;