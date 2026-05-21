import express from "express";
import mongoose from "mongoose";
import Exam from "../models/Exam.js";

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

// Create exam
router.post("/create", async (req, res) => {
  try {
    const {
      title,
      classId,
      className,
      section,
      subject,
      date,
      maxMarks,
      totalMarks,
      schoolId,
      teacherId,
    } = req.body;

    const cleanTitle = cleanText(title);
    const cleanSubject = cleanText(subject);
    const cleanClassName = cleanText(className);
    const cleanSection = cleanText(section);
    const finalClassId = cleanText(classId) || buildClassId(cleanClassName, cleanSection);
    const finalMaxMarks = Number(maxMarks || totalMarks);

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: "Exam title is required.",
      });
    }

    if (!cleanSubject) {
      return res.status(400).json({
        success: false,
        message: "Subject is required.",
      });
    }

    if (!finalClassId && !cleanClassName) {
      return res.status(400).json({
        success: false,
        message: "Class is required.",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Exam date is required.",
      });
    }

    if (!finalMaxMarks || finalMaxMarks <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid max marks is required.",
      });
    }

    const exam = await Exam.create({
      title: cleanTitle,
      subject: cleanSubject,
      classId: finalClassId,
      className: cleanClassName,
      section: cleanSection,
      date,
      maxMarks: finalMaxMarks,
      schoolId: cleanText(schoolId),
      teacherId: cleanText(teacherId),
    });

    return res.status(201).json({
      success: true,
      message: "Exam created successfully.",
      data: exam,
    });
  } catch (err) {
    console.error("Create exam error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to create exam.",
    });
  }
});

// Get exams by class
router.get("/class/:classValue", async (req, res) => {
  try {
    const { classValue } = req.params;
    const { section } = req.query;

    const exams = await Exam.find(buildClassQuery(classValue, section)).sort({
      date: -1,
      createdAt: -1,
    });

    return res.status(200).json(exams);
  } catch (err) {
    console.error("Get exams by class error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load exams.",
    });
  }
});

// Save or update student exam marks
router.post("/:examId/marks", async (req, res) => {
  try {
    const { examId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam ID.",
      });
    }

    const {
      studentId,
      studentName,
      obtainedMarks,
      marksObtained,
      remarks,
      teacherId,
      schoolId,
    } = req.body;

    const cleanStudentId = cleanText(studentId);

    if (!cleanStudentId) {
      return res.status(400).json({
        success: false,
        message: "Student ID is required.",
      });
    }

    const finalObtainedMarks = Number(obtainedMarks ?? marksObtained);

    if (Number.isNaN(finalObtainedMarks)) {
      return res.status(400).json({
        success: false,
        message: "Valid obtained marks is required.",
      });
    }

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    const markData = {
      studentId: cleanStudentId,
      studentName: cleanText(studentName),
      obtainedMarks: finalObtainedMarks,
      marksObtained: finalObtainedMarks,
      remarks: cleanText(remarks),
      teacherId: cleanText(teacherId),
      schoolId: cleanText(schoolId),
      savedAt: new Date(),
    };

    const existingMarkIndex = exam.marks.findIndex(
      (mark) => String(mark.studentId) === cleanStudentId
    );

    if (existingMarkIndex >= 0) {
      exam.marks[existingMarkIndex] = {
        ...exam.marks[existingMarkIndex].toObject(),
        ...markData,
      };
    } else {
      exam.marks.push(markData);
    }

    await exam.save();

    return res.status(200).json({
      success: true,
      message: "Exam mark saved successfully.",
      data: exam,
    });
  } catch (err) {
    console.error("Save exam marks error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to save exam marks.",
    });
  }
});

// Get marks for one exam
router.get("/:examId/marks", async (req, res) => {
  try {
    const { examId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(examId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid exam ID.",
      });
    }

    const exam = await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        message: "Exam not found.",
      });
    }

    return res.status(200).json(exam.marks || []);
  } catch (err) {
    console.error("Get exam marks error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load exam marks.",
    });
  }
});

// Get all marks by student
router.get("/student/:studentId/marks", async (req, res) => {
  try {
    const studentId = cleanText(req.params.studentId);

    const exams = await Exam.find({
      "marks.studentId": studentId,
    }).sort({
      date: -1,
      createdAt: -1,
    });

    const results = exams.map((exam) => {
      const mark = exam.marks.find(
        (item) => String(item.studentId) === String(studentId)
      );

      return {
        examId: exam._id,
        examTitle: exam.title,
        subject: exam.subject,
        classId: exam.classId,
        className: exam.className,
        section: exam.section,
        date: exam.date,
        maxMarks: exam.maxMarks,
        mark,
      };
    });

    return res.status(200).json(results);
  } catch (err) {
    console.error("Get student marks error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Failed to load student marks.",
    });
  }
});

export default router;