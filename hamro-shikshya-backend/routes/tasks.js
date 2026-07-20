import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import fs from "fs";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Subject from "../models/Subject.js";
import {
  createNotification,
  notifyClassStudents,
} from "../services/notificationService.js";

const router = express.Router();

/* =====================================================
   FILE UPLOAD CONFIGURATION
===================================================== */

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

    cb(null, `${Date.now()}-${safeName || "homework"}${ext}`);
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

    return cb(null, true);
  },
});

/* =====================================================
   GENERAL HELPERS
===================================================== */

const cleanText = (value) => String(value ?? "").trim();

const escapeRegExp = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactText = (value) => ({
  $regex: `^${escapeRegExp(value)}$`,
  $options: "i",
});

const isValidObjectId = (value) =>
  Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));

const getEntityId = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    return cleanText(value._id || value.id);
  }

  return cleanText(value);
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

const removeUploadedFile = (file) => {
  if (!file?.path) return;

  try {
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.warn("Could not remove unused uploaded file:", error.message);
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

const getSubjectName = (subject) =>
  cleanText(subject?.name || subject?.subjectName);

const getSubjectCode = (subject) =>
  cleanText(subject?.subjectCode || subject?.code).toUpperCase();

const getSubjectSections = (subject) => {
  const sections = Array.isArray(subject?.sections)
    ? subject.sections.map(cleanText).filter(Boolean)
    : [];

  const legacySection = cleanText(subject?.section);

  if (legacySection && !sections.includes(legacySection)) {
    sections.push(legacySection);
  }

  return sections.length > 0 ? sections : ["All"];
};

const subjectAppliesToSection = (subject, section) => {
  const cleanSection = cleanText(section).toLowerCase();
  const sections = getSubjectSections(subject).map((item) =>
    item.toLowerCase()
  );

  return (
    sections.includes("all") ||
    !cleanSection ||
    sections.includes(cleanSection)
  );
};

const getSubjectTeacherIds = (subject) => {
  const ids = [];

  const legacyTeacherId = getEntityId(subject?.teacherId);

  if (legacyTeacherId) {
    ids.push(legacyTeacherId);
  }

  if (Array.isArray(subject?.teacherIds)) {
    subject.teacherIds.forEach((teacher) => {
      const teacherId = getEntityId(teacher);

      if (teacherId && !ids.includes(teacherId)) {
        ids.push(teacherId);
      }
    });
  }

  return ids;
};

const getTeacherSubjectNames = (teacher) => {
  if (!Array.isArray(teacher?.subjects)) {
    return [];
  }

  return teacher.subjects
    .map((subject) => {
      if (typeof subject === "string") {
        return cleanText(subject).toLowerCase();
      }

      return cleanText(
        subject?.name || subject?.subjectName || subject?.subject
      ).toLowerCase();
    })
    .filter(Boolean);
};

const isTeacherAssignedToClass = (teacher, className, section) => {
  const targetClass = cleanText(className);
  const targetSection = cleanText(section).toLowerCase();

  const assignedClasses = Array.isArray(teacher?.assignedClasses)
    ? teacher.assignedClasses
    : [];

  const matchesAssignedClass = assignedClasses.some((item) => {
    const assignedClass = cleanText(item?.className || item?.class);
    const assignedSection = cleanText(item?.section).toLowerCase();

    return (
      assignedClass === targetClass &&
      (!assignedSection ||
        assignedSection === "all" ||
        assignedSection === targetSection)
    );
  });

  if (matchesAssignedClass) {
    return true;
  }

  const legacyClass = cleanText(teacher?.className || teacher?.class);
  const legacySection = cleanText(teacher?.section).toLowerCase();

  return (
    legacyClass === targetClass &&
    (!legacySection ||
      legacySection === "all" ||
      legacySection === targetSection)
  );
};

const canManageTask = (user, task) => {
  if (user.role === "admin") {
    return true;
  }

  return (
    user.role === "teacher" &&
    String(task.teacherId?._id || task.teacherId) === String(user._id)
  );
};

const isLateSubmission = (dueDate) => {
  if (!dueDate) return false;

  const due = new Date(dueDate);

  if (Number.isNaN(due.getTime())) {
    return false;
  }

  due.setHours(23, 59, 59, 999);

  return new Date() > due;
};

/* =====================================================
   AUTHENTICATION
===================================================== */

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
    return next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

/* =====================================================
   SUBJECT RESOLUTION AND VALIDATION
===================================================== */

const resolveSubjectForTask = async ({
  body,
  user,
  className,
  section,
}) => {
  const subjectId = cleanText(body.subjectId);
  const suppliedSubjectName = cleanText(body.subjectName || body.subject);
  const suppliedSubjectCode = cleanText(body.subjectCode || body.code);
  const suppliedStream = cleanText(body.stream);
  const suppliedAcademicYear = cleanText(body.academicYear);

  let subject = null;

  if (subjectId) {
    if (!isValidObjectId(subjectId)) {
      const error = new Error("The selected subject ID is invalid.");
      error.statusCode = 400;
      throw error;
    }

    subject = await Subject.findOne({
      _id: subjectId,
      schoolId: user.schoolId,
    });
  } else if (suppliedSubjectName || suppliedSubjectCode) {
    const identityConditions = [];

    if (suppliedSubjectCode) {
      identityConditions.push(
        { subjectCode: exactText(suppliedSubjectCode) },
        { code: exactText(suppliedSubjectCode) }
      );
    }

    if (suppliedSubjectName) {
      identityConditions.push(
        { name: exactText(suppliedSubjectName) },
        { subjectName: exactText(suppliedSubjectName) }
      );
    }

    const filter = {
      schoolId: user.schoolId,
      className: exactText(className),
      isActive: true,
      $and: [
        {
          $or: [
            { section: exactText(section) },
            { sections: exactText(section) },
            { section: exactText("All") },
            { sections: exactText("All") },
          ],
        },
        {
          $or: identityConditions,
        },
      ],
    };

    if (suppliedStream) {
      filter.$and.push({
        $or: [
          { stream: exactText(suppliedStream) },
          { stream: exactText("General") },
        ],
      });
    }

    if (suppliedAcademicYear) {
      filter.$and.push({
        $or: [
          { academicYear: exactText(suppliedAcademicYear) },
          { academicYear: exactText("") },
        ],
      });
    }

    subject = await Subject.findOne(filter).sort({
      academicYear: -1,
      sortOrder: 1,
      name: 1,
    });
  }

  if (!subject) {
    const error = new Error(
      "Please select a valid subject configured by the school for this class and section."
    );
    error.statusCode = 400;
    throw error;
  }

  if (subject.isActive === false) {
    const error = new Error("The selected subject is inactive.");
    error.statusCode = 400;
    throw error;
  }

  if (String(subject.schoolId) !== String(user.schoolId)) {
    const error = new Error("The selected subject belongs to another school.");
    error.statusCode = 403;
    throw error;
  }

  if (cleanText(subject.className) !== cleanText(className)) {
    const error = new Error(
      `The selected subject is not configured for Class ${cleanText(className)}.`
    );
    error.statusCode = 400;
    throw error;
  }

  if (!subjectAppliesToSection(subject, section)) {
    const error = new Error(
      `The selected subject is not configured for Section ${cleanText(section)}.`
    );
    error.statusCode = 400;
    throw error;
  }

  if (user.role === "teacher") {
    const assignedTeacherIds = getSubjectTeacherIds(subject);
    const teacherId = String(user._id);

    if (
      assignedTeacherIds.length > 0 &&
      !assignedTeacherIds.includes(teacherId)
    ) {
      const error = new Error(
        "This subject is assigned to another teacher. Ask the administrator to update the subject assignment."
      );
      error.statusCode = 403;
      throw error;
    }

    if (assignedTeacherIds.length === 0) {
      const teacherSubjectNames = getTeacherSubjectNames(user);
      const selectedSubjectName = getSubjectName(subject).toLowerCase();

      if (
        teacherSubjectNames.length > 0 &&
        !teacherSubjectNames.includes(selectedSubjectName)
      ) {
        const error = new Error(
          "This subject is not included in your teacher subject assignment."
        );
        error.statusCode = 403;
        throw error;
      }
    }
  }

  return {
    subject,
    snapshot: {
      subjectId: subject._id,
      subject: getSubjectName(subject),
      subjectName: getSubjectName(subject),
      subjectCode: getSubjectCode(subject),
      subjectType: cleanText(subject.type),
      stream: cleanText(subject.stream) || "General",
      academicYear: cleanText(subject.academicYear),
      curriculumBoard:
        cleanText(subject.curriculumBoard) || "Nepal Curriculum / NEB",
      curriculumVersion: cleanText(subject.curriculumVersion),
    },
  };
};

/* =====================================================
   TASK QUERY HELPERS
===================================================== */

const buildTaskQuery = (req, extraFilter = {}) => {
  const query = {
    schoolId: req.user.schoolId,
    ...extraFilter,
  };

  const requestedClass = cleanText(
    req.query.className || req.query.class
  );
  const classId = cleanText(req.query.classId);
  const section = cleanText(req.query.section);
  const subjectId = cleanText(req.query.subjectId);
  const subjectName = cleanText(req.query.subjectName || req.query.subject);
  const subjectCode = cleanText(req.query.subjectCode);
  const teacherId = cleanText(req.query.teacherId);
  const stream = cleanText(req.query.stream);
  const academicYear = cleanText(req.query.academicYear);
  const status = cleanText(req.query.status);

  if (req.user.role === "student") {
    query.className = cleanText(req.user.className);
    query.section = cleanText(req.user.section);
    query.status = "Published";
  } else {
    if (requestedClass) {
      query.className = requestedClass;
    }

    if (section) {
      query.section = section;
    }

    if (status) {
      query.status = status;
    }
  }

  if (classId) {
    query.classId = classId;
  }

  if (subjectId) {
    if (isValidObjectId(subjectId)) {
      query.subjectId = subjectId;
    } else {
      query._id = null;
    }
  }

  if (subjectName) {
    query.$and = [
      ...(query.$and || []),
      {
        $or: [
          { subjectName: exactText(subjectName) },
          { subject: exactText(subjectName) },
        ],
      },
    ];
  }

  if (subjectCode) {
    query.subjectCode = exactText(subjectCode);
  }

  if (teacherId && req.user.role !== "student") {
    query.teacherId = teacherId;
  }

  if (stream) {
    query.stream = exactText(stream);
  }

  if (academicYear) {
    query.academicYear = exactText(academicYear);
  }

  return query;
};

const populateTaskQuery = (query) =>
  query
    .populate("teacherId", "name email")
    .populate(
      "subjectId",
      "name subjectName subjectCode code type className section sections stream academicYear curriculumBoard curriculumVersion fullMarks passMarks creditHours isActive"
    )
    .populate("submissions.studentId", "name email className section stream");

const cleanTasksForUser = (tasks, user) =>
  tasks.map((task) => {
    const obj = task.toObject();

    if (user.role === "student") {
      obj.submissions = (obj.submissions || []).filter((submission) => {
        const submissionStudentId = String(
          submission.studentId?._id || submission.studentId || ""
        );

        return submissionStudentId === String(user._id);
      });
    }

    return obj;
  });

const sendTaskList = async (req, res, query) => {
  const tasks = await populateTaskQuery(Task.find(query)).sort({
    createdAt: -1,
  });

  return res.json(cleanTasksForUser(tasks, req.user));
};

/* =====================================================
   CREATE TASK / HOMEWORK
===================================================== */

router.post("/create", protect, upload.single("file"), async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      removeUploadedFile(req.file);
      return res.status(403).json({
        message: "Only teacher or admin can create tasks",
      });
    }

    const title = cleanText(req.body.title);
    const description = cleanText(req.body.description);
    const className = cleanText(req.body.className || req.body.class);
    const section = cleanText(req.body.section);
    const classId =
      cleanText(req.body.classId) || `${className}-${section || "all"}`;
    const dueDate = cleanText(req.body.dueDate || req.body.deadline);
    const maxMarks = parseOptionalNumber(req.body.maxMarks);

    if (!title || !className || !section) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        message: "Title, class and section are required",
      });
    }

    if (dueDate && Number.isNaN(new Date(dueDate).getTime())) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        message: "Please provide a valid due date",
      });
    }

    if (
      req.body.maxMarks !== undefined &&
      req.body.maxMarks !== "" &&
      (maxMarks === null || maxMarks < 0)
    ) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        message: "Maximum marks must be a valid non-negative number",
      });
    }

    if (!req.user.schoolId) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        message: "Teacher school ID missing. Please login again.",
      });
    }

    if (
      req.user.role === "teacher" &&
      !isTeacherAssignedToClass(req.user, className, section)
    ) {
      removeUploadedFile(req.file);
      return res.status(403).json({
        message: "You are not assigned to this class and section",
      });
    }

    const { subject, snapshot } = await resolveSubjectForTask({
      body: req.body,
      user: req.user,
      className,
      section,
    });

    const requestedStatus = cleanText(req.body.status);
    const taskStatus = ["Draft", "Published", "Closed", "Archived"].includes(
      requestedStatus
    )
      ? requestedStatus
      : "Published";

    const fileData = getFileData(req.file);

    const task = await Task.create({
      title,
      description,
      ...snapshot,
      className,
      section,
      classId,
      dueDate: dueDate || null,
      maxMarks,
      status: taskStatus,
      schoolId: req.user.schoolId,
      teacherId: req.user._id,
      teacherName: req.user.name || "",
      ...fileData,
    });

    const populatedTask = await populateTaskQuery(Task.findById(task._id));

    if (task.status === "Published") {
      await notifyClassStudents({
        schoolId: req.user.schoolId,
        className,
        section,
        senderId: req.user._id,
        senderName: req.user.name,
        senderRole: req.user.role,
        type: "homework_created",
        title: "New Homework",
        message: `${snapshot.subjectName} homework "${title}" has been assigned.`,
        relatedId: task._id,
        relatedModel: "Task",
        relatedRoute: "/student/homework",
        metadata: {
          subjectId: String(subject._id),
          subject: snapshot.subjectName,
          subjectName: snapshot.subjectName,
          subjectCode: snapshot.subjectCode,
          subjectType: snapshot.subjectType,
          stream: snapshot.stream,
          academicYear: snapshot.academicYear,
          dueDate: task.dueDate,
          maxMarks: task.maxMarks,
        },
      });
    }

    return res.status(201).json({
      message:
        task.status === "Draft"
          ? "Homework draft created successfully"
          : "Homework published successfully",
      task: populatedTask,
      data: populatedTask,
    });
  } catch (error) {
    removeUploadedFile(req.file);
    console.error("Create task error:", error);

    return res.status(error.statusCode || 500).json({
      message: error.message || "Failed to create task",
    });
  }
});

/* =====================================================
   GET TASKS
===================================================== */

router.get("/class/:className", protect, async (req, res) => {
  try {
    const classValue = cleanText(req.params.className);

    if (!classValue) {
      return res.status(400).json({
        message: "Class name is required",
      });
    }

    const baseQuery = buildTaskQuery(req);

    if (req.user.role === "student") {
      return sendTaskList(req, res, baseQuery);
    }

    delete baseQuery.className;
    delete baseQuery.classId;

    baseQuery.$and = [
      ...(baseQuery.$and || []),
      {
        $or: [
          { className: classValue },
          { classId: classValue },
        ],
      },
    ];

    return sendTaskList(req, res, baseQuery);
  } catch (error) {
    console.error("Get tasks by class error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load tasks",
    });
  }
});

router.get("/subject/:subjectId", protect, async (req, res) => {
  try {
    const subjectId = cleanText(req.params.subjectId);

    if (!isValidObjectId(subjectId)) {
      return res.status(400).json({
        message: "Invalid subject ID",
      });
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      schoolId: req.user.schoolId,
    });

    if (!subject) {
      return res.status(404).json({
        message: "Subject not found",
      });
    }

    const query = buildTaskQuery(req, {
      $or: [
        { subjectId },
        { subjectName: exactText(getSubjectName(subject)) },
        { subject: exactText(getSubjectName(subject)) },
      ],
    });

    return sendTaskList(req, res, query);
  } catch (error) {
    console.error("Get tasks by subject error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load subject homework",
    });
  }
});

router.get("/", protect, async (req, res) => {
  try {
    const query = buildTaskQuery(req);
    return sendTaskList(req, res, query);
  } catch (error) {
    console.error("Get tasks error:", error);

    return res.status(500).json({
      message: error.message || "Failed to load tasks",
    });
  }
});

/* =====================================================
   SUBMIT HOMEWORK
===================================================== */

router.post("/:taskId/submit", protect, upload.single("file"), async (req, res) => {
  try {
    if (req.user.role !== "student") {
      removeUploadedFile(req.file);
      return res.status(403).json({
        message: "Only students can submit homework",
      });
    }

    const taskId = cleanText(req.params.taskId);
    const answer = cleanText(req.body.answer || req.body.submissionText);
    const suppliedFileUrl = cleanText(req.body.fileUrl);

    if (!isValidObjectId(taskId)) {
      removeUploadedFile(req.file);
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await Task.findById(taskId);

    if (!task) {
      removeUploadedFile(req.file);
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (String(task.schoolId) !== String(req.user.schoolId)) {
      removeUploadedFile(req.file);
      return res.status(403).json({
        message: "You cannot submit homework from another school",
      });
    }

    if (task.status !== "Published") {
      removeUploadedFile(req.file);
      return res.status(400).json({
        message: "This homework is not currently open for submissions",
      });
    }

    if (
      cleanText(task.className) !== cleanText(req.user.className) ||
      cleanText(task.section).toLowerCase() !==
        cleanText(req.user.section).toLowerCase()
    ) {
      removeUploadedFile(req.file);
      return res.status(403).json({
        message: "This homework is not for your class and section",
      });
    }

    const fileData = getFileData(req.file);

    if (!answer && !fileData.fileUrl && !suppliedFileUrl) {
      removeUploadedFile(req.file);
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
    const existingSubmission = isResubmission
      ? task.submissions[existingSubmissionIndex]
      : null;

    const late = isLateSubmission(task.dueDate);

    const submissionData = {
      studentId: req.user._id,
      studentName: req.user.name || "",
      studentEmail: req.user.email || "",
      answer,
      submissionText: answer,
      fileUrl:
        fileData.fileUrl ||
        suppliedFileUrl ||
        existingSubmission?.fileUrl ||
        "",
      fileName: fileData.fileName || existingSubmission?.fileName || "",
      fileOriginalName:
        fileData.fileOriginalName ||
        existingSubmission?.fileOriginalName ||
        "",
      fileMimeType:
        fileData.fileMimeType || existingSubmission?.fileMimeType || "",
      fileSize: fileData.fileSize || existingSubmission?.fileSize || 0,
      status: late ? "Late" : "Submitted",
      marks: null,
      feedback: "",
      checkedAt: null,
      checkedBy: null,
      teacherName: "",
      submittedAt: new Date(),
      updatedAt: new Date(),
    };

    if (isResubmission) {
      task.submissions[existingSubmissionIndex].set(submissionData);
    } else {
      task.submissions.push(submissionData);
    }

    await task.save();

    const savedSubmission = isResubmission
      ? task.submissions[existingSubmissionIndex]
      : task.submissions[task.submissions.length - 1];

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
      title: isResubmission ? "Homework Resubmitted" : "Homework Submitted",
      message: `${req.user.name || "A student"} ${
        isResubmission ? "resubmitted" : "submitted"
      } "${task.title}" for ${task.subjectName || task.subject || "the subject"}.`,
      relatedId: task._id,
      relatedModel: "Task",
      relatedRoute: "/teacher/submissions",
      className: task.className,
      section: task.section,
      metadata: {
        studentId: String(req.user._id),
        submissionId: String(savedSubmission._id),
        subjectId: getEntityId(task.subjectId),
        subject: task.subjectName || task.subject,
        subjectName: task.subjectName || task.subject,
        subjectCode: task.subjectCode,
        late,
      },
    });

    return res.json({
      message: isResubmission
        ? "Homework resubmitted successfully"
        : "Homework submitted successfully",
      submission: savedSubmission,
      task,
    });
  } catch (error) {
    removeUploadedFile(req.file);
    console.error("Submit homework error:", error);

    return res.status(500).json({
      message: error.message || "Failed to submit homework",
    });
  }
});

/* =====================================================
   REVIEW HOMEWORK SUBMISSION
===================================================== */

const reviewSubmission = async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only teacher or admin can review submissions",
      });
    }

    const taskId = cleanText(req.params.taskId);
    const submissionId = cleanText(req.params.submissionId);

    if (!isValidObjectId(taskId) || !isValidObjectId(submissionId)) {
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
      cleanText(marksValue) !== "";

    if (hasMarks) {
      const numericMarks = Number(marksValue);

      if (!Number.isFinite(numericMarks) || numericMarks < 0) {
        return res.status(400).json({
          message: "Marks must be a valid non-negative number",
        });
      }

      if (
        task.maxMarks !== null &&
        task.maxMarks !== undefined &&
        numericMarks > Number(task.maxMarks)
      ) {
        return res.status(400).json({
          message: `Marks cannot be greater than the homework maximum of ${task.maxMarks}`,
        });
      }

      submission.marks = numericMarks;
    }

    if (req.body.feedback !== undefined) {
      submission.feedback = cleanText(req.body.feedback);
    }

    const allowedStatuses = [
      "Submitted",
      "Checked",
      "Reviewed",
      "Needs Improvement",
      "Late",
    ];

    const requestedStatus = cleanText(req.body.status);

    submission.status = allowedStatuses.includes(requestedStatus)
      ? requestedStatus
      : "Checked";
    submission.checkedAt = new Date();
    submission.checkedBy = req.user._id;
    submission.teacherName = req.user.name || "";
    submission.updatedAt = new Date();

    await task.save();

    const subjectId = getEntityId(task.subjectId);
    const subjectName = task.subjectName || task.subject || "";

    /*
      Homework review data is also mirrored into the results collection.
      This allows the Student Results page and the future subject gradebook
      to use the same reviewed homework record without creating duplicates.
    */
    const homeworkResult = {
      resultType: "homework",
      sourceType: "homework",
      taskId: String(task._id),
      homeworkId: String(task._id),
      title: `Homework: ${task.title}`,
      homeworkTitle: task.title,
      subjectId,
      subject: subjectName,
      subjectName,
      subjectCode: task.subjectCode || "",
      subjectType: task.subjectType || "",
      stream: task.stream || "General",
      academicYear: task.academicYear || "",
      curriculumBoard: task.curriculumBoard || "Nepal Curriculum / NEB",
      curriculumVersion: task.curriculumVersion || "",
      studentId: String(submission.studentId),
      studentName: submission.studentName || "",
      studentEmail: submission.studentEmail || "",
      classId: task.classId || "",
      className: task.className || "",
      section: task.section || "",
      schoolId: String(task.schoolId),
      teacherId: String(req.user._id),
      teacherName: req.user.name || "",
      maxMarks:
        task.maxMarks !== undefined && task.maxMarks !== null
          ? Number(task.maxMarks)
          : null,
      totalMarks:
        task.maxMarks !== undefined && task.maxMarks !== null
          ? Number(task.maxMarks)
          : null,
      obtainedMarks:
        submission.marks !== undefined && submission.marks !== null
          ? Number(submission.marks)
          : null,
      marksObtained:
        submission.marks !== undefined && submission.marks !== null
          ? Number(submission.marks)
          : null,
      marks:
        submission.marks !== undefined && submission.marks !== null
          ? Number(submission.marks)
          : null,
      feedback: submission.feedback || "",
      remarks: submission.feedback || "",
      status: submission.status || "Checked",
      checkedAt: submission.checkedAt || new Date(),
      publishedAt: new Date(),
      updatedAt: new Date(),
    };

    await mongoose.connection.db.collection("results").findOneAndUpdate(
      {
        resultType: "homework",
        taskId: String(task._id),
        studentId: String(submission.studentId),
        schoolId: String(task.schoolId),
      },
      {
        $set: homeworkResult,
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      }
    );

    await createNotification({
      recipientId: submission.studentId,
      recipientRole: "student",
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      schoolId: req.user.schoolId,
      type: "homework_reviewed",
      title: "Homework Reviewed",
      message: `Your ${subjectName || "homework"} assignment "${task.title}" has been reviewed${
        hasMarks ? ` and marked ${submission.marks}` : ""
      }.`,
      relatedId: task._id,
      relatedModel: "Task",
      relatedRoute: "/student/homework",
      className: task.className,
      section: task.section,
      metadata: {
        submissionId: String(submission._id),
        subjectId,
        subject: subjectName,
        subjectName,
        subjectCode: task.subjectCode || "",
        marks: submission.marks,
        maxMarks: task.maxMarks,
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

/* =====================================================
   GET SUBMISSIONS BY STUDENT
===================================================== */

router.get("/submissions/student/:studentId", protect, async (req, res) => {
  try {
    const studentId = cleanText(req.params.studentId);

    if (!isValidObjectId(studentId)) {
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

    const tasks = await populateTaskQuery(
      Task.find({
        schoolId: req.user.schoolId,
        "submissions.studentId": studentId,
      })
    ).sort({ createdAt: -1 });

    const submissions = [];

    tasks.forEach((task) => {
      const studentSubmissions = task.submissions.filter(
        (item) =>
          String(item.studentId?._id || item.studentId) === String(studentId)
      );

      studentSubmissions.forEach((submission) => {
        submissions.push({
          taskId: task._id,
          taskTitle: task.title,
          homeworkTitle: task.title,
          subjectId: task.subjectId,
          subject: task.subjectName || task.subject,
          subjectName: task.subjectName || task.subject,
          subjectCode: task.subjectCode || "",
          subjectType: task.subjectType || "",
          stream: task.stream || "General",
          academicYear: task.academicYear || "",
          maxMarks: task.maxMarks,
          className: task.className,
          section: task.section,
          dueDate: task.dueDate,
          teacherId: task.teacherId,
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

/* =====================================================
   GET SUBMISSIONS BY TASK
===================================================== */

router.get("/:taskId/submissions", protect, async (req, res) => {
  try {
    if (!["teacher", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Only teacher or admin can view submissions",
      });
    }

    const taskId = cleanText(req.params.taskId);

    if (!isValidObjectId(taskId)) {
      return res.status(400).json({
        message: "Invalid task ID",
      });
    }

    const task = await populateTaskQuery(Task.findById(taskId));

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (String(task.schoolId) !== String(req.user.schoolId)) {
      return res.status(403).json({
        message: "You cannot view homework from another school",
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
