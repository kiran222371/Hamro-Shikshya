import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import School from "../models/School.js";

const router = express.Router();

/* =====================================================
   HELPER FUNCTIONS
===================================================== */

const cleanText = (value) => String(value ?? "").trim();

const cleanEmail = (value) => cleanText(value).toLowerCase();

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const getSchoolIdValue = (schoolId) => {
  if (!schoolId) return null;

  // Handles both a normal ObjectId and a populated School document
  return schoolId._id || schoolId;
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

  const longitudeNumber = Number(longitude);
  const latitudeNumber = Number(latitude);

  if (
    !Number.isFinite(longitudeNumber) ||
    !Number.isFinite(latitudeNumber)
  ) {
    return null;
  }

  if (
    longitudeNumber < -180 ||
    longitudeNumber > 180 ||
    latitudeNumber < -90 ||
    latitudeNumber > 90
  ) {
    return null;
  }

  return [longitudeNumber, latitudeNumber];
};

const createToken = (user) => {
  const jwtSecret =
    process.env.JWT_SECRET || "hamro-shikshya-secret-key";

  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      schoolId: getSchoolIdValue(user.schoolId)?.toString() || null,
    },
    jwtSecret,
    {
      expiresIn: "7d",
    }
  );
};

/* =====================================================
   SIGNUP
   Creates a new school/college and its first admin
===================================================== */

router.post("/signup", async (req, res) => {
  let createdSchool = null;

  try {
    const body = req.body || {};

    const name = cleanText(
      body.name ||
        body.fullName ||
        body.adminName
    );

    const email = cleanEmail(body.email);
    const password = String(body.password || "");

    const schoolName = cleanText(
      body.schoolName ||
        body.nameOfSchool ||
        body.institutionName
    );

    const requestedRole = cleanText(
      body.role || "admin"
    ).toLowerCase();

    /* -----------------------------
       Required-field validation
    ----------------------------- */

    if (!name) {
      return res.status(400).json({
        message: "Admin name is required",
      });
    }

    if (!email) {
      return res.status(400).json({
        message: "Admin email is required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long",
      });
    }

    if (!schoolName) {
      return res.status(400).json({
        message: "School or college name is required",
      });
    }

    /*
      Public signup is only for creating the first admin.

      Teachers and students must be created later by that
      school's authenticated admin.
    */
    if (
      requestedRole !== "admin" &&
      requestedRole !== "principal"
    ) {
      return res.status(400).json({
        message:
          "Only school admin accounts can be created through public signup. Teachers and students must be created by their school admin.",
      });
    }

    /* -----------------------------
       Check existing account
    ----------------------------- */

    const existingUser = await User.findOne({ email })
      .select("_id email")
      .lean();

    if (existingUser) {
      return res.status(409).json({
        message: "An account already exists with this email",
      });
    }

    /* -----------------------------
       Prepare school address
    ----------------------------- */

    const latitudeValue =
      body.latitude ??
      body.lat ??
      body.addressDetails?.latitude ??
      body.addressDetails?.lat ??
      null;

    const longitudeValue =
      body.longitude ??
      body.lng ??
      body.addressDetails?.longitude ??
      body.addressDetails?.lng ??
      null;

    const latitudeNumber =
      latitudeValue !== null && latitudeValue !== ""
        ? Number(latitudeValue)
        : null;

    const longitudeNumber =
      longitudeValue !== null && longitudeValue !== ""
        ? Number(longitudeValue)
        : null;

    const addressDetails = {
      formattedAddress: cleanText(
        body.formattedAddress ||
          body.addressDetails?.formattedAddress
      ),

      addressLine1: cleanText(
        body.addressLine1 ||
          body.address ||
          body.addressDetails?.addressLine1
      ),

      municipality: cleanText(
        body.municipality ||
          body.addressDetails?.municipality
      ),

      district: cleanText(
        body.district ||
          body.addressDetails?.district
      ),

      province: cleanText(
        body.province ||
          body.addressDetails?.province
      ),

      country:
        cleanText(
          body.country ||
            body.addressDetails?.country
        ) || "Nepal",

      postalCode: cleanText(
        body.postalCode ||
          body.addressDetails?.postalCode
      ),

      placeId: cleanText(
        body.placeId ||
          body.addressDetails?.placeId
      ),

      latitude: Number.isFinite(latitudeNumber)
        ? latitudeNumber
        : null,

      longitude: Number.isFinite(longitudeNumber)
        ? longitudeNumber
        : null,
    };

    const coordinates = getValidCoordinates(body);

    const schoolPayload = {
      schoolName,

      address: cleanText(
        body.address ||
          addressDetails.formattedAddress ||
          addressDetails.addressLine1
      ),

      addressDetails,

      phone: cleanText(body.phone),

      /*
        This is the institution contact email.
        It initially uses the admin's email when a separate
        schoolEmail has not been provided.
      */
      email: cleanEmail(
        body.schoolEmail || body.institutionEmail || email
      ),

      website: cleanText(body.website),

      principalName: cleanText(
        body.principalName || name
      ),

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

    /* -----------------------------
       Hash password before creating
       database records
    ----------------------------- */

    const hashedPassword = await bcrypt.hash(password, 10);

    /* -----------------------------
       Create the school
    ----------------------------- */

    createdSchool = await School.create(schoolPayload);

    /* -----------------------------
       Create the school's first admin
    ----------------------------- */

    let adminUser;

    try {
      adminUser = await User.create({
        name,
        email,
        password: hashedPassword,
        role: "admin",
        schoolId: createdSchool._id,
        accountStatus: "active",
        isActive: true,
      });
    } catch (userCreationError) {
      /*
        If admin creation fails, remove the school that was
        just created. This prevents empty/orphan schools.
      */
      await School.findByIdAndDelete(createdSchool._id).catch(
        (cleanupError) => {
          console.error(
            "Failed to remove school after admin creation error:",
            cleanupError
          );
        }
      );

      createdSchool = null;

      throw userCreationError;
    }

    const token = createToken(adminUser);

    return res.status(201).json({
      message:
        "School and admin account created successfully",

      token,

      user: {
        _id: adminUser._id,
        id: adminUser._id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        schoolId: createdSchool._id,
        schoolName: createdSchool.schoolName,
        accountStatus:
          adminUser.accountStatus || "active",
        isActive: adminUser.isActive !== false,
      },

      school: {
        _id: createdSchool._id,
        id: createdSchool._id,
        schoolName: createdSchool.schoolName,
        address: createdSchool.address || "",
        phone: createdSchool.phone || "",
        email: createdSchool.email || "",
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    /*
      Extra cleanup protection. Normally cleanup happens in
      the inner catch, but this protects against other errors.
    */
    if (createdSchool?._id) {
      const adminForSchool = await User.findOne({
        schoolId: createdSchool._id,
        role: "admin",
      })
        .select("_id")
        .lean()
        .catch(() => null);

      if (!adminForSchool) {
        await School.findByIdAndDelete(
          createdSchool._id
        ).catch((cleanupError) => {
          console.error(
            "School cleanup error:",
            cleanupError
          );
        });
      }
    }

    /* -----------------------------
       MongoDB duplicate errors
    ----------------------------- */

    if (error.code === 11000) {
      const duplicateField =
        Object.keys(error.keyPattern || {})[0] ||
        Object.keys(error.keyValue || {})[0] ||
        "";

      if (duplicateField === "email") {
        return res.status(409).json({
          message:
            "An account already exists with this email",
        });
      }

      if (
        duplicateField === "name" ||
        error.keyValue?.name !== undefined
      ) {
        return res.status(409).json({
          message:
            "An old MongoDB index called name_1 is blocking school registration. Delete the name_1 index from the schools collection in MongoDB Atlas.",
        });
      }

      if (
        duplicateField === "schoolName" ||
        error.keyValue?.schoolName !== undefined
      ) {
        return res.status(409).json({
          message:
            "This school name is currently blocked by a unique MongoDB index. Remove the unique schoolName index so institutions with similar names can register.",
        });
      }

      return res.status(409).json({
        message:
          "A record with these details already exists",
      });
    }

    /* -----------------------------
       Mongoose validation errors
    ----------------------------- */

    if (error.name === "ValidationError") {
      const validationMessages = Object.values(
        error.errors || {}
      )
        .map((item) => item.message)
        .filter(Boolean);

      return res.status(400).json({
        message:
          validationMessages.join(", ") ||
          "Please check the information and try again",
      });
    }

    return res.status(500).json({
      message:
        error.message ||
        "Unable to create the school admin account",
    });
  }
});

/* =====================================================
   LOGIN
===================================================== */

router.post("/login", async (req, res) => {
  try {
    const email = cleanEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        message: "Please enter a valid email address",
      });
    }

    const user = await User.findOne({ email }).populate(
      "schoolId",
      "schoolName address phone email isActive"
    );

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        message:
          "This account does not have a password. Please contact the school administrator.",
      });
    }

    if (
      user.accountStatus === "deactivated" ||
      user.accountStatus === "inactive" ||
      user.isActive === false
    ) {
      return res.status(403).json({
        message:
          "This account has been deactivated. Please contact your school administrator.",
      });
    }

    if (
      user.schoolId &&
      user.schoolId.isActive === false
    ) {
      return res.status(403).json({
        message:
          "This school account has been deactivated",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);

    const schoolId = getSchoolIdValue(user.schoolId);

    return res.status(200).json({
      message: "Login successful",

      token,

      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,

        schoolId: schoolId || null,

        schoolName:
          user.schoolId?.schoolName || "",

        className: user.className || "",
        section: user.section || "",

        assignedClasses:
          user.assignedClasses || [],

        accountStatus:
          user.accountStatus || "active",

        isActive: user.isActive !== false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message:
        error.message ||
        "Unable to log in. Please try again.",
    });
  }
});

export default router;