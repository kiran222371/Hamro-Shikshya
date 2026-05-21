import express from "express";
import Attendance from "../models/Attendance.js";

const router = express.Router();

const cleanText = (value) => String(value || "").trim();

const buildClassId = (className, section = "") => {
  const cleanClassName = cleanText(className);
  const cleanSection = cleanText(section);

  if (!cleanClassName) return "";

  return cleanSection ? `${cleanClassName}-${cleanSection}` : cleanClassName;
};

const getDateRange = (dateValue) => {
  const date = dateValue ? new Date(dateValue) : new Date();

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
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

// Save or update attendance
router.post("/mark", async (req, res) => {
  try {
    const {
      studentId,
      studentName,
      classId,
      className,
      section,
      status,
      date,
      schoolId,
      teacherId,
      markedBy,
    } = req.body;

    const cleanStudentId = cleanText(studentId);
    const cleanClassName = cleanText(className);
    const cleanSection = cleanText(section);
    const finalClassId = cleanText(classId) || buildClassId(cleanClassName, cleanSection);

    if (!cleanStudentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    if (!finalClassId && !cleanClassName) {
      return res.status(400).json({
        success: false,
        message: "Class is required.",
      });
    }

    const finalStatus = ["Present", "Absent", "Late"].includes(status)
      ? status
      : "Present";

    const { start, end } = getDateRange(date);

    const savedRecord = await Attendance.findOneAndUpdate(
      {
        studentId: cleanStudentId,
        date: {
          $gte: start,
          $lte: end,
        },
        $or: [
          { classId: finalClassId },
          {
            className: cleanClassName,
            section: cleanSection,
          },
        ],
      },
      {
        $set: {
          studentId: cleanStudentId,
          studentName: cleanText(studentName),
          classId: finalClassId,
          className: cleanClassName,
          section: cleanSection,
          status: finalStatus,
          date: start,
          schoolId: cleanText(schoolId),
          teacherId: cleanText(teacherId),
          markedBy: cleanText(markedBy || teacherId),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Attendance saved successfully.",
      data: savedRecord,
    });
  } catch (err) {
    console.error("Mark attendance error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to save attendance.",
    });
  }
});

// Optional bulk attendance route
router.post("/mark-bulk", async (req, res) => {
  try {
    const { records } = req.body;

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Attendance records are required.",
      });
    }

    const savedRecords = [];

    for (const item of records) {
      const cleanStudentId = cleanText(item.studentId);
      const cleanClassName = cleanText(item.className);
      const cleanSection = cleanText(item.section);
      const finalClassId =
        cleanText(item.classId) || buildClassId(cleanClassName, cleanSection);

      if (!cleanStudentId || (!finalClassId && !cleanClassName)) continue;

      const { start, end } = getDateRange(item.date);

      const savedRecord = await Attendance.findOneAndUpdate(
        {
          studentId: cleanStudentId,
          date: {
            $gte: start,
            $lte: end,
          },
          $or: [
            { classId: finalClassId },
            {
              className: cleanClassName,
              section: cleanSection,
            },
          ],
        },
        {
          $set: {
            studentId: cleanStudentId,
            studentName: cleanText(item.studentName),
            classId: finalClassId,
            className: cleanClassName,
            section: cleanSection,
            status: ["Present", "Absent", "Late"].includes(item.status)
              ? item.status
              : "Present",
            date: start,
            schoolId: cleanText(item.schoolId),
            teacherId: cleanText(item.teacherId),
            markedBy: cleanText(item.markedBy || item.teacherId),
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

      savedRecords.push(savedRecord);
    }

    return res.status(200).json({
      success: true,
      message: "Bulk attendance saved successfully.",
      data: savedRecords,
    });
  } catch (err) {
    console.error("Bulk attendance error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to save bulk attendance.",
    });
  }
});

// Get attendance by class
router.get("/class/:classValue", async (req, res) => {
  try {
    const { classValue } = req.params;
    const { section, date } = req.query;

    const query = buildClassQuery(classValue, section);

    if (date) {
      const { start, end } = getDateRange(date);

      query.date = {
        $gte: start,
        $lte: end,
      };
    }

    const records = await Attendance.find(query).sort({
      date: -1,
      createdAt: -1,
    });

    return res.status(200).json(records);
  } catch (err) {
    console.error("Get attendance by class error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load attendance.",
    });
  }
});

// Get attendance by student
router.get("/student/:studentId", async (req, res) => {
  try {
    const records = await Attendance.find({
      studentId: cleanText(req.params.studentId),
    }).sort({
      date: -1,
      createdAt: -1,
    });

    return res.status(200).json(records);
  } catch (err) {
    console.error("Get attendance by student error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load student attendance.",
    });
  }
});

export default router;