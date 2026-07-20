import express from "express";
import mongoose from "mongoose";
import Subject from "../models/Subject.js";

const router = express.Router();

const isValidObjectId = (id) => {
  return Boolean(id) && mongoose.Types.ObjectId.isValid(String(id));
};

const cleanString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const getEducationLevel = (className) => {
  const classNumber = Number(className);

  if (classNumber >= 1 && classNumber <= 8) return "Basic";
  if (classNumber >= 9 && classNumber <= 10) return "Secondary";
  if (classNumber >= 11 && classNumber <= 12) return "Higher Secondary";

  return "General";
};

const buildSubjectPayload = (body = {}) => {
  const name = cleanString(body.name || body.subjectName);
  const subjectCode = cleanString(body.subjectCode || body.code);
  const className = cleanString(body.className || body.class);
  const section = cleanString(body.section) || "All";
  const stream = cleanString(body.stream) || "General";

  const payload = {
    name,
    subjectName: name,
    subjectCode,
    code: subjectCode,
    className,
    section,
    stream,
    type: cleanString(body.type) || "Compulsory",
    educationLevel: cleanString(body.educationLevel) || getEducationLevel(className),
    curriculumBoard:
      cleanString(body.curriculumBoard) || "Nepal Curriculum / NEB",
    fullMarks: toNumberOrNull(body.fullMarks),
    passMarks: toNumberOrNull(body.passMarks),
    creditHours: toNumberOrNull(body.creditHours),
    isActive:
      body.isActive === undefined || body.isActive === null
        ? true
        : Boolean(body.isActive),
  };

  if (isValidObjectId(body.teacherId)) {
    payload.teacherId = body.teacherId;
  } else if (body.teacherId === "" || body.teacherId === null) {
    payload.teacherId = null;
  }

  if (isValidObjectId(body.schoolId)) {
    payload.schoolId = body.schoolId;
  } else if (body.schoolId === "" || body.schoolId === null) {
    payload.schoolId = null;
  }

  return payload;
};

const NEPAL_SUBJECT_TEMPLATES = {
  basic: [
    "English",
    "Nepali",
    "Mathematics",
    "Science and Technology",
    "Social Studies and Human Values",
    "Health and Physical Education",
    "Computer / Local Subject",
  ],

  secondary: [
    "English",
    "Nepali",
    "Mathematics",
    "Science and Technology",
    "Social Studies",
    "Health, Population and Environment",
    "Computer Science",
    "Optional Mathematics",
    "Account",
    "Economics",
  ],

  science: [
    "English",
    "Nepali",
    "Social Studies and Life Skill",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Computer Science",
  ],

  management: [
    "English",
    "Nepali",
    "Social Studies and Life Skill",
    "Accountancy",
    "Economics",
    "Business Studies",
    "Marketing",
    "Finance",
    "Hotel Management",
    "Computer Science",
  ],

  humanities: [
    "English",
    "Nepali",
    "Social Studies and Life Skill",
    "Sociology",
    "Mass Communication",
    "Rural Development",
    "Psychology",
    "Population Studies",
    "Economics",
  ],

  education: [
    "English",
    "Nepali",
    "Social Studies and Life Skill",
    "Education and Development",
    "Instructional Pedagogy",
    "Child Development and Learning",
    "Nepali Education",
    "English Education",
  ],

  law: [
    "English",
    "Nepali",
    "Social Studies and Life Skill",
    "Legal Studies",
    "Constitutional Law",
    "Civil and Criminal Law",
    "Human Rights",
  ],
};

const getTemplateSubjects = (className, stream = "General") => {
  const classNumber = Number(className);
  const cleanStream = cleanString(stream).toLowerCase();

  if (classNumber >= 1 && classNumber <= 8) {
    return NEPAL_SUBJECT_TEMPLATES.basic;
  }

  if (classNumber >= 9 && classNumber <= 10) {
    return NEPAL_SUBJECT_TEMPLATES.secondary;
  }

  if (classNumber >= 11 && classNumber <= 12) {
    if (cleanStream.includes("science")) return NEPAL_SUBJECT_TEMPLATES.science;
    if (cleanStream.includes("management")) {
      return NEPAL_SUBJECT_TEMPLATES.management;
    }
    if (cleanStream.includes("humanities")) {
      return NEPAL_SUBJECT_TEMPLATES.humanities;
    }
    if (cleanStream.includes("education")) return NEPAL_SUBJECT_TEMPLATES.education;
    if (cleanStream.includes("law")) return NEPAL_SUBJECT_TEMPLATES.law;

    return [
      ...new Set([
        ...NEPAL_SUBJECT_TEMPLATES.science,
        ...NEPAL_SUBJECT_TEMPLATES.management,
        ...NEPAL_SUBJECT_TEMPLATES.humanities,
      ]),
    ];
  }

  return [];
};

const createSubjectHandler = async (req, res) => {
  try {
    const payload = buildSubjectPayload(req.body);

    if (!payload.name || !payload.className) {
      return res.status(400).json({
        message: "Subject name and class are required.",
      });
    }

    const subject = await Subject.create(payload);

    return res.status(201).json({
      message: "Subject created successfully.",
      subject,
    });
  } catch (error) {
    console.error("Create subject error:", error);
    return res.status(500).json({ message: "Failed to create subject." });
  }
};

const getSubjectsHandler = async (req, res) => {
  try {
    const filter = {};

    const schoolId = req.params.schoolId || req.query.schoolId || "";
    const className = cleanString(req.query.className);
    const section = cleanString(req.query.section);
    const stream = cleanString(req.query.stream);
    const type = cleanString(req.query.type);

    if (isValidObjectId(schoolId)) {
      filter.schoolId = schoolId;
    }

    if (className) {
      filter.className = className;
    }

    if (section) {
      filter.section = section;
    }

    if (stream) {
      filter.stream = stream;
    }

    if (type) {
      filter.type = type;
    }

    const subjects = await Subject.find(filter)
      .populate("teacherId", "name email")
      .populate("schoolId", "schoolName")
      .sort({
        className: 1,
        section: 1,
        stream: 1,
        name: 1,
      });

    return res.json({ subjects });
  } catch (error) {
    console.error("Get subjects error:", error);
    return res.status(500).json({ message: "Failed to load subjects." });
  }
};

const updateSubjectHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid subject ID." });
    }

    const payload = buildSubjectPayload(req.body);

    if (!payload.name || !payload.className) {
      return res.status(400).json({
        message: "Subject name and class are required.",
      });
    }

    const subject = await Subject.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    })
      .populate("teacherId", "name email")
      .populate("schoolId", "schoolName");

    if (!subject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    return res.json({
      message: "Subject updated successfully.",
      subject,
    });
  } catch (error) {
    console.error("Update subject error:", error);
    return res.status(500).json({ message: "Failed to update subject." });
  }
};

const deleteSubjectHandler = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid subject ID." });
    }

    const deletedSubject = await Subject.findByIdAndDelete(id);

    if (!deletedSubject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    return res.json({ message: "Subject deleted successfully." });
  } catch (error) {
    console.error("Delete subject error:", error);
    return res.status(500).json({ message: "Failed to delete subject." });
  }
};

// Nepal subject template route
router.get("/templates/nepal", (req, res) => {
  const className = cleanString(req.query.className);
  const section = cleanString(req.query.section) || "All";
  const stream = cleanString(req.query.stream) || "General";

  const subjects = getTemplateSubjects(className, stream).map((name, index) => {
    const safeName = name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return {
      name,
      subjectName: name,
      subjectCode: `${safeName}-${className || "GEN"}`,
      code: `${safeName}-${className || "GEN"}`,
      className,
      section,
      stream,
      type:
        index <= 2 ||
        ["English", "Nepali", "Mathematics", "Social Studies and Life Skill"].includes(
          name
        )
          ? "Compulsory"
          : "Optional",
      educationLevel: getEducationLevel(className),
      curriculumBoard: "Nepal Curriculum / NEB",
    };
  });

  return res.json({
    className,
    section,
    stream,
    subjects,
  });
});

// Create subjects
router.post("/create", createSubjectHandler);
router.post("/", createSubjectHandler);

// Get subjects
router.get("/school/:schoolId", getSubjectsHandler);
router.get("/", getSubjectsHandler);

// Update subjects
router.put("/:id", updateSubjectHandler);
router.patch("/:id", updateSubjectHandler);

// Delete subjects
router.delete("/:id", deleteSubjectHandler);

export default router;