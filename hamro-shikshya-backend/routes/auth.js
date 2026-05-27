import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import School from "../models/School.js";

const router = express.Router();

const cleanText = (value) => String(value || "").trim();

const cleanEmail = (value) => cleanText(value).toLowerCase();

const normalizeRole = (role) => {
  const cleanedRole = cleanText(role).toLowerCase();

  if (cleanedRole === "principal") return "admin";
  if (cleanedRole === "admin") return "admin";
  if (cleanedRole === "teacher") return "teacher";
  if (cleanedRole === "student") return "student";

  return "admin";
};

const getValidCoordinates = (body = {}) => {
  const longitude =
    body.longitude ??
    body.lng ??
    body.addressDetails?.longitude ??
    body.addressDetails?.lng ??
    body.location?.coordinates?.[0];

  const latitude =
    body.latitude ??
    body.lat ??
    body.addressDetails?.latitude ??
    body.addressDetails?.lat ??
    body.location?.coordinates?.[1];

  const lngNumber = Number(longitude);
  const latNumber = Number(latitude);

  if (!Number.isFinite(lngNumber) || !Number.isFinite(latNumber)) {
    return null;
  }

  return [lngNumber, latNumber];
};

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      schoolId: user.schoolId,
    },
    process.env.JWT_SECRET || "hamro-shikshya-secret-key",
    { expiresIn: "7d" }
  );
}

// SIGNUP - creates a new school and a new admin account
router.post("/signup", async (req, res) => {
  try {
    const body = req.body || {};

    const name = cleanText(body.name || body.fullName || body.adminName);
    const email = cleanEmail(body.email);
    const password = String(body.password || "");
    const role = normalizeRole(body.role);
    const schoolName = cleanText(body.schoolName || body.nameOfSchool);

    if (!name || !email || !password || !schoolName) {
      return res.status(400).json({
        message: "Name, email, password and school name are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    if (role !== "admin") {
      return res.status(400).json({
        message:
          "Only admin accounts can be created from signup. Teachers and students must be added by the school admin.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "An account already exists with this email",
      });
    }

    const addressDetails = {
      formattedAddress: cleanText(
        body.formattedAddress || body.addressDetails?.formattedAddress
      ),
      addressLine1: cleanText(
        body.addressLine1 || body.address || body.addressDetails?.addressLine1
      ),
      municipality: cleanText(
        body.municipality || body.addressDetails?.municipality
      ),
      district: cleanText(body.district || body.addressDetails?.district),
      province: cleanText(body.province || body.addressDetails?.province),
      country: cleanText(body.country || body.addressDetails?.country) || "Nepal",
      postalCode: cleanText(
        body.postalCode || body.addressDetails?.postalCode
      ),
      placeId: cleanText(body.placeId || body.addressDetails?.placeId),
      latitude:
        body.latitude ??
        body.lat ??
        body.addressDetails?.latitude ??
        null,
      longitude:
        body.longitude ??
        body.lng ??
        body.addressDetails?.longitude ??
        null,
    };

    const coordinates = getValidCoordinates(body);

    const schoolPayload = {
      schoolName,

      // legacy field, useful if your old database index still checks "name"
      name: schoolName,

      address: cleanText(body.address || addressDetails.formattedAddress),
      addressDetails,
      phone: cleanText(body.phone),
      email,
      website: cleanText(body.website),
      principalName: cleanText(body.principalName),
      adminName: name,
      logoUrl: cleanText(body.logoUrl),
      isActive: true,
    };

    if (coordinates) {
      schoolPayload.location = {
        type: "Point",
        coordinates,
      };
    }

    // This creates a new school every time.
    // That means unlimited admin signups are allowed as long as email is different.
    const school = await School.create(schoolPayload);

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      schoolId: school._id,
      accountStatus: "active",
      isActive: true,
    });

    const token = createToken(user);

    return res.status(201).json({
      message: "Admin account created successfully",
      token,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: school._id,
        schoolName: school.schoolName,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);

    if (err.code === 11000) {
      if (err.keyPattern?.email || err.keyValue?.email) {
        return res.status(400).json({
          message: "An account already exists with this email",
        });
      }

      if (err.keyPattern?.name || err.keyValue?.name !== undefined) {
        return res.status(400).json({
          message:
            "Old MongoDB school name index is blocking signup. Delete the old schools index called name_1 from MongoDB Atlas.",
        });
      }

      return res.status(400).json({
        message: "Duplicate record found. Please use different details.",
      });
    }

    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: Object.values(err.errors)
          .map((item) => item.message)
          .join(", "),
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
    const email = cleanEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).populate(
      "schoolId",
      "schoolName name"
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account has no password saved. Please create a new account or reset this user in the database.",
      });
    }

    if (user.accountStatus === "deactivated" || user.isActive === false) {
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
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId?._id || user.schoolId,
        schoolName:
          user.schoolId?.schoolName || user.schoolId?.name || "",
        className: user.className || "",
        section: user.section || "",
      },
    });
  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      message: err.message || "Login failed",
    });
  }
});

export default router;