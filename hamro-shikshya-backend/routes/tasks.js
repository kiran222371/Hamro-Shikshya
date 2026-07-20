import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import Task from "../models/Task.js";
import User from "../models/User.js";
import {
  createNotification,
  notifyClassStudents,
} from "../services/notificationService.js";

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
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },

  filename: (_req, file, cb) => {
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
  fileFilter: (_req, file, cb) => {
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

    if (user.isActive === false || user.accountStatus === "deactivated") {
      return res.status(403).json({ message: "This account is deactivated" });
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

const canManageTask = (user, task) => {
  if (user.role === "admin") {
    return true;
  }

  return (
    user.role === "teacher" &&
    String(task.teacherId) === String(user._id)
  );
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

    const cleanTitle = String(title).trim();
    const cleanSubject = subject ? String(subject).trim() : "";
    const cleanClassName = String(className).trim();
    const cleanSection = String(section).trim();
    const fileData = getFileData(req.file);

    const task = await Task.create({
      title: cleanTitle,
      subject: cleanSubject,
      description: description ? String(description).trim() : "",
      className: cleanClassName,
      section: cleanSection,
      classId: classId || "",
      dueDate: dueDate || null,
      schoolId: req.user.schoolId,
      teacherId: req.user._id,
      ...fileData,
    });

    await notifyClassStudents({
      schoolId: req.user.schoolId,
      className: cleanClassName,
      section: cleanSection,
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      type: "homework_created",
      title: "New Homework",
      message: `${cleanSubject || "New"} homework "${cleanTitle}" has been assigned.`,
      relatedId: task._id,
      relatedModel: "Task",
      relatedRoute: "/student/homework",
      metadata: {
        subject: cleanSubject,
        dueDate: task.dueDate,
      },
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

    const isResubmission = existingSubmissionIndex >= 0;

    const existingSubmission =
      isResubmission
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
      status: "Submitted",
      marks: null,
      feedback: "",
      checkedAt: null,
      checkedBy: null,
      teacherName: "",
      submittedAt: new Date(),
    };

    if (isResubmission) {
      task.submissions[existingSubmissionIndex].set(submissionData);
    } else {
      task.submissions.push(submissionData);
    }

    await task.save();

    await createNotification({
      recipientId: task.teacherId,
      recipientRole: "teacher",
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      schoolId: req.user.schoolId,
      type: isResubmission
        ? "homework_resubmitted"
        : "homework_submitted",
      title: isResubmission
        ? "Homework Resubmitted"
        : "Homework Submitted",
      message: `${req.user.name || "A student"} ${
        isResubmission ? "resubmitted" : "submitted"
      } "${task.title}".`,
      relatedId: task._id,
      relatedModel: "Task",
      relatedRoute: "/teacher/submissions",
      className: task.className,
      section: task.section,
      metadata: {
        studentId: req.user._id,
        subject: task.subject,
      },
    });

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

// ================= REVIEW HOMEWORK SUBMISSION =================
const reviewSubmission = async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only teacher or admin can review submissions",
      });
    }

    const { taskId, submissionId } = req.params;

    if (
      !mongoose.Types.ObjectId.isValid(taskId) ||
      !mongoose.Types.ObjectId.isValid(submissionId)
    ) {
      return res.status(400).json({
        message: "Invalid task or submission ID",
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
        message: "You cannot review a task from another school",
      });
    }

    if (!canManageTask(req.user, task)) {
      return res.status(403).json({
        message: "You can only review homework created by you",
      });
    }

    const submission = task.submissions.id(submissionId);

    if (!submission) {
      return res.status(404).json({
        message: "Submission not found",
      });
    }

    const marksValue = req.body.marks;
    const hasMarks =
      marksValue !== undefined &&
      marksValue !== null &&
      String(marksValue).trim() !== "";

    if (hasMarks) {
      const numericMarks = Number(marksValue);

      if (Number.isNaN(numericMarks) || numericMarks < 0) {
        return res.status(400).json({
          message: "Marks must be a valid positive number",
        });
      }

      submission.marks = numericMarks;
    }

    if (req.body.feedback !== undefined) {
      submission.feedback = String(req.body.feedback || "").trim();
    }

    if (req.body.status !== undefined) {
      submission.status = String(req.body.status || "Checked").trim();
    } else {
      submission.status = "Checked";
    }

    submission.checkedAt = new Date();
    submission.checkedBy = req.user._id;
    submission.teacherName = req.user.name || "";

    await task.save();

    await createNotification({
      recipientId: submission.studentId,
      recipientRole: "student",
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      schoolId: req.user.schoolId,
      type: "homework_reviewed",
      title: "Homework Reviewed",
      message: `Your homework "${task.title}" has been reviewed${
        hasMarks ? ` and marked ${submission.marks}` : ""
      }.`,
      relatedId: task._id,
      relatedModel: "Task",
      relatedRoute: "/student/homework",
      className: task.className,
      section: task.section,
      metadata: {
        submissionId: submission._id,
        marks: submission.marks,
        status: submission.status,
      },
    });

    return res.json({
      message: "Submission review saved successfully",
      submission,
      task,
    });
  } catch (error) {
    console.error("Review submission error:", error);

    return res.status(500).json({
      message: error.message || "Failed to review submission",
    });
  }
};

router.patch(
  "/:taskId/submissions/:submissionId",
  protect,
  reviewSubmission
);

router.put(
  "/:taskId/submissions/:submissionId",
  protect,
  reviewSubmission
);

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

    if (!canManageTask(req.user, task)) {
      return res.status(403).json({
        message: "You can only view submissions for homework created by you",
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
