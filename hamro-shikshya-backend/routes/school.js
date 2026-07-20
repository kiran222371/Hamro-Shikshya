import express from "express";
import mongoose from "mongoose";
import School from "../models/School.js";

const router = express.Router();

const isValidObjectId = (id) => {
  return Boolean(id) && mongoose.Types.ObjectId.isValid(String(id));
};

const cleanString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const escapeRegex = (value) => {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const hasValidCoordinates = (latitude, longitude) => {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};

const buildSchoolPayload = (body = {}) => {
  const addressDetailsInput = body.addressDetails || {};

  const latitude = toNumberOrNull(
    body.latitude ?? body.lat ?? addressDetailsInput.latitude
  );

  const longitude = toNumberOrNull(
    body.longitude ?? body.lng ?? body.lon ?? addressDetailsInput.longitude
  );

  const formattedAddress = cleanString(
    body.formattedAddress ||
      body.address ||
      addressDetailsInput.formattedAddress
  );

  const addressDetails = {
    formattedAddress,
    addressLine1: cleanString(
      body.addressLine1 || addressDetailsInput.addressLine1
    ),
    municipality: cleanString(
      body.municipality || body.city || addressDetailsInput.municipality
    ),
    district: cleanString(body.district || addressDetailsInput.district),
    province: cleanString(body.province || addressDetailsInput.province),
    country: cleanString(body.country || addressDetailsInput.country || "Nepal"),
    postalCode: cleanString(
      body.postalCode || body.zipCode || addressDetailsInput.postalCode
    ),
    placeId: cleanString(
      body.placeId || body.googlePlaceId || addressDetailsInput.placeId
    ),
    latitude,
    longitude,
  };

  const payload = {
    schoolName: cleanString(body.schoolName || body.name),
    address: formattedAddress,
    addressDetails,
    phone: cleanString(body.phone || body.contact),
    email: cleanString(body.email).toLowerCase(),
    website: cleanString(body.website),
    principalName: cleanString(body.principalName || body.principal),
    adminName: cleanString(body.adminName),
    logoUrl: cleanString(body.logoUrl),
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null) {
      delete payload[key];
    }
  });

  if (hasValidCoordinates(latitude, longitude)) {
    payload.location = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
  }

  return payload;
};

const findSchoolByIdentifier = async (identifier) => {
  const cleanIdentifier = cleanString(identifier);

  if (!cleanIdentifier) return null;

  if (isValidObjectId(cleanIdentifier)) {
    return School.findById(cleanIdentifier);
  }

  return School.findOne({
    schoolName: new RegExp(`^${escapeRegex(cleanIdentifier)}$`, "i"),
  });
};

const getSchoolProfile = async (req, res) => {
  try {
    const identifier =
      req.params.schoolId || req.query.schoolId || req.query.schoolName || "";

    if (!identifier) {
      return res.json({});
    }

    const school = await findSchoolByIdentifier(identifier);

    if (!school) {
      return res.status(404).json({ message: "School not found." });
    }

    return res.json({ school });
  } catch (error) {
    console.error("Get school profile error:", error);
    return res.status(500).json({ message: "Failed to load school profile." });
  }
};

const saveSchoolProfile = async (req, res) => {
  try {
    const identifier = req.params.schoolId || req.body.schoolId || "";
    const payload = buildSchoolPayload(req.body);

    if (!payload.schoolName) {
      return res.status(400).json({ message: "School name is required." });
    }

    let school;

    if (isValidObjectId(identifier)) {
      school = await School.findByIdAndUpdate(identifier, payload, {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      });
    } else if (cleanString(identifier)) {
      school = await School.findOneAndUpdate(
        {
          schoolName: new RegExp(`^${escapeRegex(identifier)}$`, "i"),
        },
        payload,
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
    } else {
      school = await School.findOneAndUpdate(
        {
          schoolName: new RegExp(`^${escapeRegex(payload.schoolName)}$`, "i"),
        },
        payload,
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        }
      );
    }

    return res.json({
      message: "School profile saved successfully.",
      school,
    });
  } catch (error) {
    console.error("Save school profile error:", error);
    return res.status(500).json({ message: "Failed to save school profile." });
  }
};

// Create / save school profile
router.post("/create", saveSchoolProfile);
router.post("/profile", saveSchoolProfile);

// Get school profile
router.get("/profile", getSchoolProfile);
router.get("/profile/:schoolId", getSchoolProfile);
router.get("/:schoolId", getSchoolProfile);

// Update school profile
router.put("/profile", saveSchoolProfile);
router.patch("/profile", saveSchoolProfile);
router.put("/profile/:schoolId", saveSchoolProfile);
router.patch("/profile/:schoolId", saveSchoolProfile);
router.put("/:schoolId", saveSchoolProfile);
router.patch("/:schoolId", saveSchoolProfile);

export default router;