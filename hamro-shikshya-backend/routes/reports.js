import express from "express";
import Notice from "../models/Notice.js";

const router = express.Router();

const cleanText = (value) => String(value || "").trim();

const buildClassId = (className, section = "") => {
  const cleanClassName = cleanText(className);
  const cleanSection = cleanText(section);

  if (!cleanClassName) return "";

  return cleanSection ? `${cleanClassName}-${cleanSection}` : cleanClassName;
};

const buildClassQuery = (classValue, section = "") => {
  const cleanClassValue = cleanText(classValue);
  const cleanSection = cleanText(section);

  const possibleClassIds = [
    cleanClassValue,
    buildClassId(cleanClassValue, cleanSection),
    buildClassId(cleanClassValue, cleanSection.toUpperCase()),
    buildClassId(cleanClassValue, cleanSection.toLowerCase()),
  ].filter(Boolean);

  const possibleSections = [
    cleanSection,
    cleanSection.toUpperCase(),
    cleanSection.toLowerCase(),
  ].filter(Boolean);

  if (cleanSection) {
    return {
      $or: [
        {
          className: cleanClassValue,
          section: { $in: possibleSections },
        },
        {
          classId: { $in: possibleClassIds },
        },
      ],
    };
  }

  return {
    $or: [
      { className: cleanClassValue },
      { classId: cleanClassValue },
      { classId: { $in: possibleClassIds } },
    ],
  };
};

// Create notice
router.post("/create", async (req, res) => {
  try {
    const {
      title,
      message,
      content,
      classId,
      className,
      section,
      schoolId,
      teacherId,
      teacherName,
      createdBy,
    } = req.body;

    const cleanTitle = cleanText(title);
    const cleanMessage = cleanText(message || content);
    const cleanContent = cleanText(content || message);
    const cleanClassName = cleanText(className);
    const cleanSection = cleanText(section);
    const finalClassId = cleanText(classId) || buildClassId(cleanClassName, cleanSection);

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Notice title is required.",
      });
    }

    if (!cleanMessage) {
      return res.status(400).json({
        success: false,
        message: "Notice content is required.",
      });
    }

    const notice = await Notice.create({
      title: cleanTitle,
      message: cleanMessage,
      content: cleanContent,
      classId: finalClassId,
      className: cleanClassName,
      section: cleanSection,
      schoolId: cleanText(schoolId),
      teacherId: cleanText(teacherId),
      teacherName: cleanText(teacherName),
      createdBy: cleanText(createdBy || teacherId || teacherName),
    });

    return res.status(201).json({
      success: true,
      message: "Notice created successfully.",
      data: notice,
    });
  } catch (err) {
    console.error("Create notice error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create notice.",
    });
  }
});

// Get all notices
router.get("/", async (req, res) => {
  try {
    const notices = await Notice.find().sort({
      createdAt: -1,
    });

    return res.status(200).json(notices);
  } catch (err) {
    console.error("Get notices error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load notices.",
    });
  }
});

// Get notices by class
router.get("/class/:classValue", async (req, res) => {
  try {
    const { classValue } = req.params;
    const { section } = req.query;

    const notices = await Notice.find(buildClassQuery(classValue, section)).sort({
      createdAt: -1,
    });

    return res.status(200).json(notices);
  } catch (err) {
    console.error("Get notices by class error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load class notices.",
    });
  }
});

// Get notices by school
router.get("/school/:schoolId", async (req, res) => {
  try {
    const notices = await Notice.find({
      schoolId: cleanText(req.params.schoolId),
    }).sort({
      createdAt: -1,
    });

    return res.status(200).json(notices);
  } catch (err) {
    console.error("Get notices by school error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load school notices.",
    });
  }
});

export default router;