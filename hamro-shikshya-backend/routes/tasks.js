import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import Task from "../models/Task.js";
import User from "../models/User.js";

const router = express.Router();

const uploadDir = path.join(process.cwd(), "uploads", "homework");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".txt",
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = file.originalname
      .replace(ext, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .slice(0, 40);

    cb(null, `${Date.now()}-${safeName}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(ext)) {
      return cb(
        new Error(
          "Invalid file type. Upload PDF, Word, PowerPoint, Excel, image, or text file."
        )
      );
    }

    cb(null, true);
  },
});

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const userId = decoded.id || decoded._id || decoded.userId;

    if (!userId) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({ message: "Logged-in user not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

const getFileData = (file) => {
  if (!file) {
    return {
      fileUrl: "",
      fileName: "",
      fileOriginalName: "",
      fileMimeType: "",
      fileSize: 0,
    };
  }

  return {
    fileUrl: `/uploads/homework/${file.filename}`,
    fileName: file.filename,
    fileOriginalName: file.originalname,
    fileMimeType: file.mimetype,
    fileSize: file.size,
  };
};

const isTeacherAssignedToClass = (teacher, className, section) => {
  const assignedClasses = Array.isArray(teacher.assignedClasses)
    ? teacher.assignedClasses
    : [];

  return assignedClasses.some((item) => {
    const assignedClass = String(item.className || item.class || "").trim();
    const assignedSection = String(item.section || "").trim().toLowerCase();

    return (
      assignedClass === String(className).trim() &&
      assignedSection === String(section).trim().toLowerCase()
    );
  });
};

// ================= CREATE TASK / HOMEWORK =================
router.post("/create", protect, upload.single("file"), async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only teacher or admin can create tasks",
      });
    }

    const {
      title,
      subject,
      description,
      className,
      section,
      classId,
      dueDate,
    } = req.body;

    if (!title || !className || !section) {
      return res.status(400).json({
        message: "Title, class and section are required",
      });
    }

    if (!req.user.schoolId) {
      return res.status(400).json({
        message: "Teacher school ID missing. Please login again.",
      });
    }

    if (req.user.role === "teacher") {
      const isAssigned = isTeacherAssignedToClass(
        req.user,
        className,
        section
      );

      if (!isAssigned) {
        return res.status(403).json({
          message: "You are not assigned to this class",
        });
      }
    }

    const fileData = getFileData(req.file);

    const task = await Task.create({
      title: String(title).trim(),
      subject: subject ? String(subject).trim() : "",
      description: description ? String(description).trim() : "",
      className: String(className).trim(),
      section: String(section).trim(),
      classId: classId || "",
      dueDate: dueDate || null,
      schoolId: req.user.schoolId,
      teacherId: req.user._id,
      ...fileData,
    });

    return res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);

    return res.status(500).json({
      message: error.message || "Failed to create task",
    });
  }
});

// ================= GET TASKS BY CLASS =================
router.get("/class/:className", protect, async (req, res) => {
  try {
    const { className } = req.params;
    const { section } = req.query;

    if (!className) {
      return res.status(400).json({
        message: "Class name is required",
      });
    }

    const query = {
      schoolId: req.user.schoolId,
      className: String(className).trim(),
    };

    if (section) {
      query.section = String(section).trim();
    }

    const tasks = await Task.find(query)
      .populate("teacherId", "name email")
      .populate("submissions.studentId", "name email className section")
      .sort({ createdAt: -1 });

    const cleanedTasks = tasks.map((task) => {
      const obj = task.toObject();

      if (req.user.role === "student") {
        obj.submissions = (obj.submissions || []).filter((submission) => {
          const submissionStudentId = String(
            submission.studentId?._id || submission.studentId || ""
          );

          return submissionStudentId === String(req.user._id);
        });
      }

      return obj;
    });

    return res.json(cleanedTasks);
  } catch (error) {
    console.error("Get tasks error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load tasks",
    });
  }
});

// ================= SUBMIT HOMEWORK =================
router.post("/:taskId/submit", protect, upload.single("file"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can submit homework",
      });
    }

    const { taskId } = req.params;
    const { answer, submissionText, fileUrl } = req.body;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (String(task.schoolId) !== String(req.user.schoolId)) {
      return res.status(403).json({
        message: "You cannot submit task from another school",
      });
    }

    if (
      String(task.className) !== String(req.user.className) ||
      String(task.section).toLowerCase() !==
        String(req.user.section).toLowerCase()
    ) {
      return res.status(403).json({
        message: "This task is not for your class",
      });
    }

    const text = answer || submissionText || "";
    const fileData = getFileData(req.file);

    if (!text.trim() && !fileData.fileUrl && !fileUrl) {
      return res.status(400).json({
        message: "Submission text or file is required",
      });
    }

    if (!Array.isArray(task.submissions)) {
      task.submissions = [];
    }

    const existingSubmissionIndex = task.submissions.findIndex(
      (item) => String(item.studentId) === String(req.user._id)
    );

    const existingSubmission =
      existingSubmissionIndex >= 0
        ? task.submissions[existingSubmissionIndex]
        : null;

    const submissionData = {
      studentId: req.user._id,
      studentName: req.user.name || "",
      answer: text,
      submissionText: text,
      fileUrl:
        fileData.fileUrl ||
        fileUrl ||
        existingSubmission?.fileUrl ||
        "",
      fileName:
        fileData.fileName ||
        existingSubmission?.fileName ||
        "",
      fileOriginalName:
        fileData.fileOriginalName ||
        existingSubmission?.fileOriginalName ||
        "",
      fileMimeType:
        fileData.fileMimeType ||
        existingSubmission?.fileMimeType ||
        "",
      fileSize:
        fileData.fileSize ||
        existingSubmission?.fileSize ||
        0,
      submittedAt: new Date(),
    };

    if (existingSubmissionIndex >= 0) {
      task.submissions[existingSubmissionIndex].set(submissionData);
    } else {
      task.submissions.push(submissionData);
    }

    await task.save();

    return res.json({
      message: "Homework submitted successfully",
      task,
    });
  } catch (error) {
    console.error("Submit homework error:", error);

    return res.status(500).json({
      message: error.message || "Failed to submit homework",
    });
  }
});

// ================= GET SUBMISSIONS BY STUDENT =================
router.get("/submissions/student/:studentId", protect, async (req, res) => {
  try {
    const { studentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({
        message: "Invalid student ID",
      });
    }

    if (
      req.user.role === "student" &&
      String(req.user._id) !== String(studentId)
    ) {
      return res.status(403).json({
        message: "Students can only view their own submissions",
      });
    }

    const tasks = await Task.find({
      schoolId: req.user.schoolId,
      "submissions.studentId": studentId,
    }).sort({ createdAt: -1 });

    const submissions = [];

    tasks.forEach((task) => {
      const studentSubmissions = task.submissions.filter(
        (item) => String(item.studentId) === String(studentId)
      );

      studentSubmissions.forEach((submission) => {
        submissions.push({
          taskId: task._id,
          taskTitle: task.title,
          className: task.className,
          section: task.section,
          submission,
        });
      });
    });

    return res.json(submissions);
  } catch (error) {
    console.error("Get student submissions error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load student submissions",
    });
  }
});

// ================= GET SUBMISSIONS BY TASK =================
router.get("/:taskId/submissions", protect, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only teacher or admin can view submissions",
      });
    }

    const { taskId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(taskId).populate(
      "submissions.studentId",
      "name email className section"
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (String(task.schoolId) !== String(req.user.schoolId)) {
      return res.status(403).json({
        message: "You cannot view task from another school",
      });
    }

    return res.json(task.submissions || []);
  } catch (error) {
    console.error("Get submissions error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load submissions",
    });
  }
});

export default router;