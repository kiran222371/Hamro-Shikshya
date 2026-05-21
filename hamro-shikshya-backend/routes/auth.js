import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import School from "../models/School.js";

const router = express.Router();

function createToken(user) {
  return jwt.sign(
    {
      id: user._id,
      role: user.role,
      schoolId: user.schoolId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// SIGNUP - only Admin / Principal creates school first
router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, role, schoolName } = req.body;

    if (!name || !email || !password || !schoolName) {
      return res.status(400).json({
        message: "Name, email, password and school name are required",
      });
    }

    const finalRole = role === "admin" || role === "principal" ? "admin" : role;

    if (finalRole !== "admin") {
      return res.status(400).json({
        message: "Only Admin / Principal can sign up first. Teachers and students must be added by the school admin.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with this email",
      });
    }

    let school = await School.findOne({
      name: schoolName.trim(),
    });

    if (!school) {
      school = await School.create({
        name: schoolName.trim(),
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "admin",
      schoolId: school._id,
    });

    const token = createToken(user);

    res.status(201).json({
      message: "Admin account created successfully",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId,
        schoolName: school.name,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({ email }).populate("schoolId", "name");

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Invalid password",
      });
    }

    const token = createToken(user);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolId: user.schoolId?._id || user.schoolId,
        schoolName: user.schoolId?.name || "",
        className: user.className,
        section: user.section,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
    });
  }
});

export default router;