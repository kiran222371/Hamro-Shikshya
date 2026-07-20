import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";

const router = express.Router();

const MANAGED_ROLES = ["teacher", "student"];
const ALL_ROLES = ["admin", "teacher", "student"];
const ACCOUNT_STATUSES = ["active", "deactivated"];
const STUDENT_STATUSES = [
  "active",
  "graduated",
  "transferred",
  "dropout",
  "suspended",
];

// ================= HELPER FUNCTIONS =================
const cleanString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const cleanEmail = (value) => cleanString(value).toLowerCase();

const getSchoolId = (user) => {
  return user?.schoolId?._id || user?.schoolId || "";
};

const isValidObjectId = (id) => {
  return id && mongoose.Types.ObjectId.isValid(String(id));
};

const escapeRegex = (value) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const publicUser = (user) => {
  const data = user?.toObject ? user.toObject() : user;

  if (!data) return data;

  delete data.password;
  delete data.__v;

  return data;
};

const parseMaybeJson = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
};

const cleanStringArray = (value) => {
  const parsed = parseMaybeJson(value, value);

  if (Array.isArray(parsed)) {
    return parsed.map((item) => cleanString(item)).filter(Boolean);
  }

  if (typeof parsed === "string") {
    return parsed
      .split(",")
      .map((item) => cleanString(item))
      .filter(Boolean);
  }

  return [];
};

const normalizeGuardian = (body) => {
  const guardian = parseMaybeJson(body.guardian, {});

  return {
    name: cleanString(guardian?.name || body.guardianName),
    phone: cleanString(guardian?.phone || body.guardianPhone),
    email: cleanEmail(guardian?.email || body.guardianEmail),
    relation: cleanString(guardian?.relation || body.guardianRelation),
  };
};

const normalizeAssignedClasses = (
  assignedClasses,
  fallbackClassName = "",
  fallbackSection = ""
) => {
  let parsed = parseMaybeJson(assignedClasses, []);

  if (!Array.isArray(parsed) && typeof parsed === "object" && parsed !== null) {
    parsed = [parsed];
  }

  if (!Array.isArray(parsed)) {
    parsed = [];
  }

  let cleaned = parsed
    .map((item) => ({
      className: cleanString(item?.className || item?.class),
      section: cleanString(item?.section),
      subjects: cleanStringArray(item?.subjects),
    }))
    .filter((item) => item.className && item.section);

  if (cleaned.length === 0 && fallbackClassName && fallbackSection) {
    cleaned = [
      {
        className: cleanString(fallbackClassName),
        section: cleanString(fallbackSection),
        subjects: [],
      },
    ];
  }

  return cleaned;
};

// ================= PROTECT MIDDLEWARE =================
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id || decoded._id || decoded.userId;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Logged-in user not found" });
    }

    if (user.accountStatus === "deactivated" || user.isActive === false) {
      return res.status(403).json({
        message: "Your account has been deactivated. Contact school admin.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Only admin can perform this action",
    });
  }

  next();
};

const checkAdminSchool = (req, res) => {
  const schoolId = getSchoolId(req.user);

  if (!schoolId || !isValidObjectId(schoolId)) {
    res.status(400).json({
      message: "Admin schoolId is missing or invalid",
    });

    return null;
  }

  return schoolId;
};

const findUserFromSameSchool = async (req, res, userId) => {
  if (!isValidObjectId(userId)) {
    res.status(400).json({ message: "Invalid user ID" });
    return null;
  }

  const schoolId = getSchoolId(req.user);

  const user = await User.findById(userId);

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return null;
  }

  if (String(getSchoolId(user)) !== String(schoolId)) {
    res.status(403).json({
      message: "You cannot manage a user from another school",
    });

    return null;
  }

  return user;
};

// ================= CREATE TEACHER / STUDENT =================
router.post("/create", protect, adminOnly, async (req, res) => {
  try {
    const schoolId = checkAdminSchool(req, res);
    if (!schoolId) return;

    const {
      name,
      email,
      password,
      role,
      className,
      section,
      rollNumber,
      admissionNumber,
      studentCode,
      academicYear,
      stream,
      employeeId,
      qualification,
      accountStatus,
      studentStatus,
    } = req.body;

    const finalRole = cleanString(role).toLowerCase();

    if (!name || !email || !password || !finalRole) {
      return res.status(400).json({
        message: "Name, email, password and role are required",
      });
    }

    if (!MANAGED_ROLES.includes(finalRole)) {
      return res.status(400).json({
        message: "Role must be teacher or student",
      });
    }

    if (cleanString(password).length < 4) {
      return res.status(400).json({
        message: "Password must be at least 4 characters",
      });
    }

    const finalEmail = cleanEmail(email);

    const existingUser = await User.findOne({ email: finalEmail });

    if (existingUser) {
      return res.status(409).json({
        message: "This email is already used by another account",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const userData = {
      name: cleanString(name),
      email: finalEmail,
      password: hashedPassword,
      role: finalRole,
      schoolId,
      phone: cleanString(req.body.phone),
      address: cleanString(req.body.address),
      gender: ["male", "female", "other"].includes(cleanString(req.body.gender))
        ? cleanString(req.body.gender)
        : "",
      dateOfBirth: req.body.dateOfBirth ? new Date(req.body.dateOfBirth) : null,
      profileImage: cleanString(req.body.profileImage),
      accountStatus: ACCOUNT_STATUSES.includes(cleanString(accountStatus))
        ? cleanString(accountStatus)
        : "active",
      isActive: true,

      className: "",
      section: "",
      rollNumber: "",
      admissionNumber: "",
      studentCode: "",
      academicYear: "",
      stream: "",
      studentStatus: "active",
      guardian: {},

      employeeId: "",
      qualification: "",
      subjects: [],
      assignedClasses: [],
    };

    // ================= STUDENT DATA =================
    if (finalRole === "student") {
      const finalClassName = cleanString(className);
      const finalSection = cleanString(section);

      if (!finalClassName || !finalSection) {
        return res.status(400).json({
          message: "Class and section are required for student",
        });
      }

      userData.className = finalClassName;
      userData.section = finalSection;
      userData.rollNumber = cleanString(rollNumber);
      userData.admissionNumber = cleanString(admissionNumber);
      userData.studentCode = cleanString(studentCode);
      userData.academicYear = cleanString(academicYear);
      userData.stream = cleanString(stream);
      userData.studentStatus = STUDENT_STATUSES.includes(
        cleanString(studentStatus)
      )
        ? cleanString(studentStatus)
        : "active";
      userData.guardian = normalizeGuardian(req.body);
    }

    // ================= TEACHER DATA =================
    if (finalRole === "teacher") {
      const cleanAssignedClasses = normalizeAssignedClasses(
        req.body.assignedClasses,
        className,
        section
      );

      if (cleanAssignedClasses.length === 0) {
        return res.status(400).json({
          message: "At least one class and section is required for teacher",
        });
      }

      userData.employeeId = cleanString(employeeId);
      userData.qualification = cleanString(qualification);
      userData.subjects = cleanStringArray(req.body.subjects);
      userData.assignedClasses = cleanAssignedClasses;
    }

    const newUser = await User.create(userData);

    return res.status(201).json({
      message: `${finalRole} created successfully`,
      user: publicUser(newUser),
    });
  } catch (error) {
    console.error("Create user error:", error);

    return res.status(500).json({
      message: error.message || "Failed to create user",
    });
  }
});

// ================= GET LOGGED-IN USER =================
router.get("/me", protect, async (req, res) => {
  return res.status(200).json(publicUser(req.user));
});

// ================= GET USERS OF SAME SCHOOL =================
router.get("/", protect, async (req, res) => {
  try {
    const schoolId = getSchoolId(req.user);

    if (!schoolId || !isValidObjectId(schoolId)) {
      return res.status(400).json({
        message: "SchoolId not found for logged-in user",
      });
    }

    const query = {
      schoolId,
    };

    const role = cleanString(req.query.role).toLowerCase();
    const className = cleanString(req.query.className);
    const section = cleanString(req.query.section);
    const accountStatus = cleanString(req.query.accountStatus);
    const search = cleanString(req.query.search);

    if (role && ALL_ROLES.includes(role)) {
      query.role = role;
    }

    if (className) {
      query.className = className;
    }

    if (section) {
      query.section = section;
    }

    if (accountStatus && ACCOUNT_STATUSES.includes(accountStatus)) {
      query.accountStatus = accountStatus;
    }

    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");

      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { rollNumber: regex },
        { admissionNumber: regex },
        { employeeId: regex },
      ];
    }

    const users = await User.find(query)
      .select("-password")
      .sort({ role: 1, name: 1, createdAt: -1 });

    return res.status(200).json(users);
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load users",
    });
  }
});

// ================= GET ALL STUDENTS =================
router.get("/students", protect, async (req, res) => {
  try {
    const schoolId = getSchoolId(req.user);

    const students = await User.find({
      schoolId,
      role: "student",
    })
      .select("-password")
      .sort({ className: 1, section: 1, rollNumber: 1, name: 1 });

    return res.status(200).json(students);
  } catch (error) {
    console.error("Get students error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load students",
    });
  }
});

// ================= GET ALL TEACHERS =================
router.get("/teachers", protect, async (req, res) => {
  try {
    const schoolId = getSchoolId(req.user);

    const teachers = await User.find({
      schoolId,
      role: "teacher",
    })
      .select("-password")
      .sort({ name: 1 });

    return res.status(200).json(teachers);
  } catch (error) {
    console.error("Get teachers error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load teachers",
    });
  }
});

// ================= GET STUDENTS BY CLASS =================
router.get("/class/:className", protect, async (req, res) => {
  try {
    const schoolId = getSchoolId(req.user);
    const className = cleanString(req.params.className);
    const section = cleanString(req.query.section);

    if (!className) {
      return res.status(400).json({
        message: "Class name is required",
      });
    }

    const query = {
      schoolId,
      role: "student",
      className,
    };

    if (section) {
      query.section = section;
    }

    const students = await User.find(query)
      .select("-password")
      .sort({ section: 1, rollNumber: 1, name: 1 });

    return res.status(200).json(students);
  } catch (error) {
    console.error("Get students by class error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load class students",
    });
  }
});

// ================= GET ONE USER =================
router.get("/:userId", protect, async (req, res) => {
  try {
    const user = await findUserFromSameSchool(req, res, req.params.userId);
    if (!user) return;

    return res.status(200).json(publicUser(user));
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load user",
    });
  }
});

// ================= UPDATE USER =================
const updateUserHandler = async (req, res) => {
  try {
    const user = await findUserFromSameSchool(req, res, req.params.userId);
    if (!user) return;

    if (user.role === "admin") {
      return res.status(403).json({
        message: "Admin account cannot be edited from this route",
      });
    }

    const updates = {};

    if (req.body.name !== undefined) updates.name = cleanString(req.body.name);

    if (req.body.email !== undefined) {
      const finalEmail = cleanEmail(req.body.email);

      if (!finalEmail) {
        return res.status(400).json({
          message: "Email cannot be empty",
        });
      }

      const emailOwner = await User.findOne({
        email: finalEmail,
        _id: { $ne: user._id },
      });

      if (emailOwner) {
        return res.status(409).json({
          message: "This email is already used by another account",
        });
      }

      updates.email = finalEmail;
    }

    if (req.body.phone !== undefined) updates.phone = cleanString(req.body.phone);
    if (req.body.address !== undefined)
      updates.address = cleanString(req.body.address);

    if (req.body.gender !== undefined) {
      const gender = cleanString(req.body.gender);
      updates.gender = ["", "male", "female", "other"].includes(gender)
        ? gender
        : "";
    }

    if (req.body.dateOfBirth !== undefined) {
      updates.dateOfBirth = req.body.dateOfBirth
        ? new Date(req.body.dateOfBirth)
        : null;
    }

    if (req.body.profileImage !== undefined) {
      updates.profileImage = cleanString(req.body.profileImage);
    }

    if (req.body.accountStatus !== undefined) {
      const status = cleanString(req.body.accountStatus);

      if (!ACCOUNT_STATUSES.includes(status)) {
        return res.status(400).json({
          message: "Invalid account status",
        });
      }

      updates.accountStatus = status;
      updates.isActive = status === "active";
    }

    if (req.body.isActive !== undefined) {
      updates.isActive =
        req.body.isActive === true || req.body.isActive === "true";
      updates.accountStatus = updates.isActive ? "active" : "deactivated";
    }

    let finalRole = user.role;

    if (req.body.role !== undefined) {
      const requestedRole = cleanString(req.body.role).toLowerCase();

      if (!MANAGED_ROLES.includes(requestedRole)) {
        return res.status(400).json({
          message: "Role must be teacher or student",
        });
      }

      finalRole = requestedRole;
      updates.role = requestedRole;
    }

    // ================= UPDATE STUDENT =================
    if (finalRole === "student") {
      const finalClassName =
        req.body.className !== undefined
          ? cleanString(req.body.className)
          : user.className;

      const finalSection =
        req.body.section !== undefined
          ? cleanString(req.body.section)
          : user.section;

      if (!finalClassName || !finalSection) {
        return res.status(400).json({
          message: "Class and section are required for student",
        });
      }

      updates.className = finalClassName;
      updates.section = finalSection;

      if (req.body.rollNumber !== undefined) {
        updates.rollNumber = cleanString(req.body.rollNumber);
      }

      if (req.body.admissionNumber !== undefined) {
        updates.admissionNumber = cleanString(req.body.admissionNumber);
      }

      if (req.body.studentCode !== undefined) {
        updates.studentCode = cleanString(req.body.studentCode);
      }

      if (req.body.academicYear !== undefined) {
        updates.academicYear = cleanString(req.body.academicYear);
      }

      if (req.body.stream !== undefined) {
        updates.stream = cleanString(req.body.stream);
      }

      if (req.body.studentStatus !== undefined) {
        const status = cleanString(req.body.studentStatus);

        if (!STUDENT_STATUSES.includes(status)) {
          return res.status(400).json({
            message: "Invalid student status",
          });
        }

        updates.studentStatus = status;
      }

      if (
        req.body.guardian !== undefined ||
        req.body.guardianName !== undefined ||
        req.body.guardianPhone !== undefined ||
        req.body.guardianEmail !== undefined ||
        req.body.guardianRelation !== undefined
      ) {
        updates.guardian = normalizeGuardian(req.body);
      }

      updates.employeeId = "";
      updates.qualification = "";
      updates.subjects = [];
      updates.assignedClasses = [];
    }

    // ================= UPDATE TEACHER =================
    if (finalRole === "teacher") {
      let cleanAssignedClasses = user.assignedClasses || [];

      if (
        req.body.assignedClasses !== undefined ||
        req.body.className !== undefined ||
        req.body.section !== undefined
      ) {
        cleanAssignedClasses = normalizeAssignedClasses(
          req.body.assignedClasses,
          req.body.className,
          req.body.section
        );
      }

      if (!cleanAssignedClasses || cleanAssignedClasses.length === 0) {
        return res.status(400).json({
          message: "At least one class and section is required for teacher",
        });
      }

      if (req.body.employeeId !== undefined) {
        updates.employeeId = cleanString(req.body.employeeId);
      }

      if (req.body.qualification !== undefined) {
        updates.qualification = cleanString(req.body.qualification);
      }

      if (req.body.subjects !== undefined) {
        updates.subjects = cleanStringArray(req.body.subjects);
      }

      updates.assignedClasses = cleanAssignedClasses;

      updates.className = "";
      updates.section = "";
      updates.rollNumber = "";
      updates.admissionNumber = "";
      updates.studentCode = "";
      updates.academicYear = "";
      updates.stream = "";
      updates.studentStatus = "active";
      updates.guardian = {};
    }

    Object.assign(user, updates);

    const savedUser = await user.save();

    return res.status(200).json({
      message: "User updated successfully",
      user: publicUser(savedUser),
    });
  } catch (error) {
    console.error("Update user error:", error);

    return res.status(500).json({
      message: error.message || "Failed to update user",
    });
  }
};

router.put("/:userId", protect, adminOnly, updateUserHandler);
router.patch("/:userId", protect, adminOnly, updateUserHandler);

// ================= ACTIVATE / DEACTIVATE USER =================
router.patch("/:userId/status", protect, adminOnly, async (req, res) => {
  try {
    const user = await findUserFromSameSchool(req, res, req.params.userId);
    if (!user) return;

    if (user.role === "admin") {
      return res.status(403).json({
        message: "Admin account cannot be deactivated from this route",
      });
    }

    const accountStatus = cleanString(req.body.accountStatus);

    if (!ACCOUNT_STATUSES.includes(accountStatus)) {
      return res.status(400).json({
        message: "accountStatus must be active or deactivated",
      });
    }

    user.accountStatus = accountStatus;
    user.isActive = accountStatus === "active";

    await user.save();

    return res.status(200).json({
      message:
        accountStatus === "active"
          ? "User activated successfully"
          : "User deactivated successfully",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      message: error.message || "Failed to update user status",
    });
  }
});

// ================= RESET USER PASSWORD =================
router.patch("/:userId/reset-password", protect, adminOnly, async (req, res) => {
  try {
    const user = await findUserFromSameSchool(req, res, req.params.userId);
    if (!user) return;

    if (user.role === "admin") {
      return res.status(403).json({
        message: "Admin password cannot be reset from this route",
      });
    }

    const newPassword = cleanString(req.body.newPassword || req.body.password);

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({
        message: "New password must be at least 4 characters",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    return res.status(200).json({
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return res.status(500).json({
      message: error.message || "Failed to reset password",
    });
  }
});

// ================= DELETE USER =================
router.delete("/:userId", protect, adminOnly, async (req, res) => {
  try {
    const user = await findUserFromSameSchool(req, res, req.params.userId);
    if (!user) return;

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({
        message: "You cannot delete your own account",
      });
    }

    if (user.role === "admin") {
      return res.status(403).json({
        message: "Admin account cannot be deleted from this route",
      });
    }

    await User.findByIdAndDelete(user._id);

    return res.status(200).json({
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return res.status(500).json({
      message: error.message || "Failed to delete user",
    });
  }
});

export default router;