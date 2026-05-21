import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import taskRoutes from "./routes/tasks.js";
import attendanceRoutes from "./routes/attendance.js";
import examRoutes from "./routes/exam.js";
import noticeRoutes from "./routes/notice.js";
import subjectRoutes from "./routes/subjects.js";
import schoolRoutes from "./routes/school.js";

dotenv.config();

const app = express();

// ================= ES MODULE __dirname FIX =================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================= UPLOAD FOLDERS =================
const serverUploadsDir = path.join(__dirname, "uploads");
const rootUploadsDir = path.join(process.cwd(), "uploads");

const ensureFolderExists = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

ensureFolderExists(serverUploadsDir);
ensureFolderExists(rootUploadsDir);

// ================= MIDDLEWARE =================
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ================= HELPERS =================
const cleanText = (value) => String(value || "").trim();

const escapeRegExp = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getToday = () => new Date().toISOString().slice(0, 10);

const getCollection = (collectionName) => {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected yet.");
  }

  return mongoose.connection.db.collection(collectionName);
};

const makeTextMatch = (field, value) => ({
  [field]: {
    $regex: `^${escapeRegExp(value)}$`,
    $options: "i",
  },
});

const buildClassFilter = (className, section = "", schoolId = "") => {
  const cleanClassName = cleanText(className);
  const cleanSection = cleanText(section);
  const cleanSchoolId = cleanText(schoolId);

  const andConditions = [];

  if (cleanClassName) {
    const classConditions = [
      makeTextMatch("className", cleanClassName),
      makeTextMatch("class", cleanClassName),
      makeTextMatch("grade", cleanClassName),
      { className: cleanClassName },
      { class: cleanClassName },
      { grade: cleanClassName },
    ];

    const numberClass = Number(cleanClassName);

    if (!Number.isNaN(numberClass)) {
      classConditions.push(
        { className: numberClass },
        { class: numberClass },
        { grade: numberClass }
      );
    }

    andConditions.push({ $or: classConditions });
  }

  if (cleanSection && cleanSection.toLowerCase() !== "all") {
    andConditions.push({
      $or: [
        makeTextMatch("section", cleanSection),
        makeTextMatch("classSection", cleanSection),
        { section: cleanSection },
        { classSection: cleanSection },
      ],
    });
  }

  if (cleanSchoolId) {
    andConditions.push({
      $or: [
        { schoolId: cleanSchoolId },
        { "school._id": cleanSchoolId },
        { "school.id": cleanSchoolId },
      ],
    });
  }

  if (andConditions.length === 0) {
    return {};
  }

  return { $and: andConditions };
};

const sendServerError = (res, error, fallbackMessage) => {
  console.error(fallbackMessage, error);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: error.message,
  });
};

// ================= SAFE FILE PATH HELPER =================
const getSafeUploadPath = (baseDir, requestedFile) => {
  const cleanFile = String(requestedFile || "")
    .trim()
    .replace(/^\/?uploads\/?/, "")
    .replace(/\\/g, "/");

  if (!cleanFile) return null;

  const resolvedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(resolvedBase, cleanFile);

  if (
    resolvedFile !== resolvedBase &&
    !resolvedFile.startsWith(resolvedBase + path.sep)
  ) {
    return null;
  }

  return {
    cleanFile,
    filePath: resolvedFile,
  };
};

// ================= FILE DOWNLOAD ROUTE =================
app.get("/uploads/download", (req, res) => {
  try {
    const requestedFile = String(req.query.file || "").trim();

    if (!requestedFile) {
      return res.status(400).json({
        success: false,
        message: "File name is required.",
      });
    }

    const possibleFolders = [serverUploadsDir, rootUploadsDir];

    let foundFile = null;

    for (const folder of possibleFolders) {
      const safePath = getSafeUploadPath(folder, requestedFile);

      if (safePath && fs.existsSync(safePath.filePath)) {
        foundFile = safePath;
        break;
      }
    }

    if (!foundFile) {
      return res.status(404).json({
        success: false,
        message: "File not found.",
        file: requestedFile,
      });
    }

    return res.download(foundFile.filePath, path.basename(foundFile.filePath));
  } catch (error) {
    console.error("Download file error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to download file.",
    });
  }
});

// ================= SERVE UPLOADED FILES =================
app.use(
  "/uploads",
  express.static(serverUploadsDir, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

app.use(
  "/uploads",
  express.static(rootUploadsDir, {
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// ================= TEST ROUTES =================
app.get("/", (req, res) => {
  res.send("Hamro Shikshya backend is running");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    app: "Hamro Shikshya",
    time: new Date().toISOString(),
  });
});

// ================= DIRECT TEACHER DASHBOARD ROUTES =================
// These routes make TeacherDashboard real-functional even if old route files are incomplete.

const registerTeacherDashboardRoutes = () => {
  // ---------- ATTENDANCE ----------
  app.post(["/api/attendance/mark", "/api/attendance/create"], async (req, res) => {
    try {
      const body = req.body || {};

      const studentId = cleanText(body.studentId || body.student);
      const studentName = cleanText(body.studentName || body.name);
      const className = cleanText(body.className || body.class);
      const section = cleanText(body.section);
      const status = cleanText(body.status) || "Present";
      const date = cleanText(body.date) || getToday();
      const schoolId = cleanText(body.schoolId);
      const teacherId = cleanText(body.teacherId || body.markedBy);
      const classId = cleanText(body.classId);

      if (!studentId) {
        return res.status(400).json({
          success: false,
          message: "studentId is required.",
        });
      }

      if (!className) {
        return res.status(400).json({
          success: false,
          message: "className is required.",
        });
      }

      const attendance = {
        studentId,
        studentName,
        classId,
        className,
        section,
        status,
        date,
        schoolId,
        teacherId,
        markedBy: teacherId,
        updatedAt: new Date(),
      };

      const filter = {
        studentId,
        className,
        section,
        date,
        ...(schoolId ? { schoolId } : {}),
      };

      const collection = getCollection("attendances");

      const result = await collection.findOneAndUpdate(
        filter,
        {
          $set: attendance,
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: "after",
        }
      );

      const savedAttendance = result.value || {
        _id: result.upsertedId,
        ...attendance,
      };

      return res.status(201).json({
        success: true,
        message: "Attendance saved successfully.",
        data: savedAttendance,
        attendance: savedAttendance,
      });
    } catch (error) {
      return sendServerError(res, error, "Failed to save attendance.");
    }
  });

  app.get("/api/attendance/class/:className", async (req, res) => {
    try {
      const className = req.params.className;
      const section = req.query.section || "";
      const schoolId = req.query.schoolId || "";

      const filter = buildClassFilter(className, section, schoolId);

      const records = await getCollection("attendances")
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: records,
        attendance: records,
        records,
      });
    } catch (error) {
      return sendServerError(res, error, "Failed to load attendance records.");
    }
  });

  // ---------- EXAMS ----------
  app.post(
    ["/api/exams/create", "/api/exam/create", "/api/exams", "/api/exam"],
    async (req, res) => {
      try {
        const body = req.body || {};

        const title = cleanText(body.title || body.examTitle);
        const subject = cleanText(body.subject);
        const className = cleanText(body.className || body.class);
        const section = cleanText(body.section);
        const date = cleanText(body.date || body.examDate);
        const maxMarks = Number(body.maxMarks || body.totalMarks || 0);
        const schoolId = cleanText(body.schoolId);
        const teacherId = cleanText(body.teacherId);
        const classId = cleanText(body.classId);

        if (!title) {
          return res.status(400).json({
            success: false,
            message: "Exam title is required.",
          });
        }

        if (!subject) {
          return res.status(400).json({
            success: false,
            message: "Subject is required.",
          });
        }

        if (!className) {
          return res.status(400).json({
            success: false,
            message: "className is required.",
          });
        }

        const exam = {
          title,
          examTitle: title,
          subject,
          classId,
          className,
          section,
          date,
          examDate: date,
          maxMarks,
          totalMarks: maxMarks,
          schoolId,
          teacherId,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await getCollection("exams").insertOne(exam);

        const savedExam = {
          _id: result.insertedId,
          ...exam,
        };

        return res.status(201).json({
          success: true,
          message: "Exam created successfully.",
          data: savedExam,
          exam: savedExam,
        });
      } catch (error) {
        return sendServerError(res, error, "Failed to create exam.");
      }
    }
  );

  app.get(["/api/exams/class/:className", "/api/exam/class/:className"], async (req, res) => {
    try {
      const className = req.params.className;
      const section = req.query.section || "";
      const schoolId = req.query.schoolId || "";

      const filter = buildClassFilter(className, section, schoolId);

      const exams = await getCollection("exams")
        .find(filter)
        .sort({ date: -1, createdAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: exams,
        exams,
      });
    } catch (error) {
      return sendServerError(res, error, "Failed to load exams.");
    }
  });

  // ---------- NOTICES ----------
  app.post(
    ["/api/notices/create", "/api/notice/create", "/api/notices", "/api/notice"],
    async (req, res) => {
      try {
        const body = req.body || {};

        const title = cleanText(body.title || body.noticeTitle);
        const content = cleanText(body.content || body.description);
        const className = cleanText(body.className || body.class);
        const section = cleanText(body.section);
        const schoolId = cleanText(body.schoolId);
        const teacherId = cleanText(body.teacherId);
        const teacherName = cleanText(body.teacherName);
        const classId = cleanText(body.classId);

        if (!title) {
          return res.status(400).json({
            success: false,
            message: "Notice title is required.",
          });
        }

        if (!content) {
          return res.status(400).json({
            success: false,
            message: "Notice content is required.",
          });
        }

        if (!className) {
          return res.status(400).json({
            success: false,
            message: "className is required.",
          });
        }

        const notice = {
          title,
          content,
          description: content,
          classId,
          className,
          section,
          schoolId,
          teacherId,
          teacherName,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const result = await getCollection("notices").insertOne(notice);

        const savedNotice = {
          _id: result.insertedId,
          ...notice,
        };

        return res.status(201).json({
          success: true,
          message: "Notice created successfully.",
          data: savedNotice,
          notice: savedNotice,
        });
      } catch (error) {
        return sendServerError(res, error, "Failed to create notice.");
      }
    }
  );

  app.get(
    ["/api/notices/class/:className", "/api/notice/class/:className"],
    async (req, res) => {
      try {
        const className = req.params.className;
        const section = req.query.section || "";
        const schoolId = req.query.schoolId || "";

        const filter = buildClassFilter(className, section, schoolId);

        const notices = await getCollection("notices")
          .find(filter)
          .sort({ createdAt: -1 })
          .toArray();

        return res.json({
          success: true,
          data: notices,
          notices,
        });
      } catch (error) {
        return sendServerError(res, error, "Failed to load notices.");
      }
    }
  );

  app.get(
    ["/api/notices/school/:schoolId", "/api/notice/school/:schoolId"],
    async (req, res) => {
      try {
        const schoolId = cleanText(req.params.schoolId);

        const notices = await getCollection("notices")
          .find({ schoolId })
          .sort({ createdAt: -1 })
          .toArray();

        return res.json({
          success: true,
          data: notices,
          notices,
        });
      } catch (error) {
        return sendServerError(res, error, "Failed to load school notices.");
      }
    }
  );

  // ---------- EXAM RESULTS / MARKS ----------
  app.post(
    [
      "/api/results/create",
      "/api/results",
      "/api/exam-results/create",
      "/api/exam-results",
      "/api/exams/:examId/marks",
    ],
    async (req, res) => {
      try {
        const body = req.body || {};

        const examId = cleanText(req.params.examId || body.examId);
        const studentId = cleanText(body.studentId || body.student);
        const studentName = cleanText(body.studentName);
        const examTitle = cleanText(body.examTitle || body.title);
        const subject = cleanText(body.subject);
        const className = cleanText(body.className || body.class);
        const section = cleanText(body.section);
        const schoolId = cleanText(body.schoolId);
        const teacherId = cleanText(body.teacherId);
        const classId = cleanText(body.classId);

        const maxMarks = Number(body.maxMarks || body.totalMarks || 0);
        const obtainedMarks = Number(
          body.obtainedMarks || body.marksObtained || body.marks || 0
        );

        const remarks = cleanText(body.remarks || body.feedback);

        if (!examId) {
          return res.status(400).json({
            success: false,
            message: "examId is required.",
          });
        }

        if (!studentId) {
          return res.status(400).json({
            success: false,
            message: "studentId is required.",
          });
        }

        const resultData = {
          examId,
          examTitle,
          subject,
          studentId,
          studentName,
          classId,
          className,
          section,
          schoolId,
          teacherId,
          maxMarks,
          totalMarks: maxMarks,
          obtainedMarks,
          marksObtained: obtainedMarks,
          marks: obtainedMarks,
          remarks,
          updatedAt: new Date(),
          savedAt: new Date(),
        };

        const filter = {
          examId,
          studentId,
          ...(className ? { className } : {}),
          ...(section ? { section } : {}),
          ...(schoolId ? { schoolId } : {}),
        };

        const result = await getCollection("results").findOneAndUpdate(
          filter,
          {
            $set: resultData,
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          {
            upsert: true,
            returnDocument: "after",
          }
        );

        const savedResult = result.value || {
          _id: result.upsertedId,
          ...resultData,
        };

        return res.status(201).json({
          success: true,
          message: "Result saved successfully.",
          data: savedResult,
          result: savedResult,
        });
      } catch (error) {
        return sendServerError(res, error, "Failed to save result.");
      }
    }
  );

  app.put("/api/results/:examId/:studentId", async (req, res) => {
    try {
      const examId = cleanText(req.params.examId);
      const studentId = cleanText(req.params.studentId);
      const body = req.body || {};

      const obtainedMarks = Number(
        body.obtainedMarks || body.marksObtained || body.marks || 0
      );

      const updateData = {
        ...body,
        examId,
        studentId,
        obtainedMarks,
        marksObtained: obtainedMarks,
        marks: obtainedMarks,
        updatedAt: new Date(),
        savedAt: new Date(),
      };

      const result = await getCollection("results").findOneAndUpdate(
        { examId, studentId },
        {
          $set: updateData,
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        {
          upsert: true,
          returnDocument: "after",
        }
      );

      const savedResult = result.value || {
        _id: result.upsertedId,
        ...updateData,
      };

      return res.json({
        success: true,
        message: "Result updated successfully.",
        data: savedResult,
        result: savedResult,
      });
    } catch (error) {
      return sendServerError(res, error, "Failed to update result.");
    }
  });

  app.get("/api/results/exam/:examId", async (req, res) => {
    try {
      const examId = cleanText(req.params.examId);

      const results = await getCollection("results")
        .find({ examId })
        .sort({ studentName: 1 })
        .toArray();

      return res.json({
        success: true,
        data: results,
        results,
      });
    } catch (error) {
      return sendServerError(res, error, "Failed to load exam results.");
    }
  });

  app.get("/api/results/student/:studentId", async (req, res) => {
    try {
      const studentId = cleanText(req.params.studentId);

      const results = await getCollection("results")
        .find({ studentId })
        .sort({ createdAt: -1 })
        .toArray();

      return res.json({
        success: true,
        data: results,
        results,
      });
    } catch (error) {
      return sendServerError(res, error, "Failed to load student results.");
    }
  });

  console.log("✅ Direct Teacher Dashboard routes enabled");
};

// ================= OPTIONAL ROUTE LOADER =================
const registerOptionalRoute = async (importPath, mountPaths, label) => {
  try {
    const routeModule = await import(importPath);
    const router = routeModule.default;

    if (!router) {
      console.warn(`⚠️ ${label} route file exists but has no default export.`);
      return;
    }

    mountPaths.forEach((mountPath) => {
      app.use(mountPath, router);
    });

    console.log(`✅ ${label} routes enabled: ${mountPaths.join(", ")}`);
  } catch (error) {
    const expectedPath = importPath.replace("./", "");

    if (
      error.code === "ERR_MODULE_NOT_FOUND" &&
      error.message.includes(expectedPath)
    ) {
      console.warn(
        `⚠️ ${label} routes skipped because ${expectedPath} is not created yet.`
      );
      return;
    }

    throw error;
  }
};

// ================= API ROUTES =================
const registerRoutes = async () => {
  // Main routes
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/tasks", taskRoutes);

  // Direct teacher dashboard routes first, so save buttons work reliably
  registerTeacherDashboardRoutes();

  // Existing route files still remain active
  app.use("/api/attendance", attendanceRoutes);

  app.use("/api/exam", examRoutes);
  app.use("/api/exams", examRoutes);

  app.use("/api/notice", noticeRoutes);
  app.use("/api/notices", noticeRoutes);

  app.use("/api/subjects", subjectRoutes);
  app.use("/api/subject", subjectRoutes);

  app.use("/api/school", schoolRoutes);
  app.use("/api/schools", schoolRoutes);

  await registerOptionalRoute(
    "./routes/reports.js",
    ["/api/reports", "/api/report"],
    "Reports"
  );

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "API route not found",
      path: req.originalUrl,
    });
  });
};

// ================= SERVER START =================
const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ MONGO_URI is missing in .env file.");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB connected");

    await registerRoutes();

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📁 Server uploads folder: ${serverUploadsDir}`);
      console.log(`📁 Root uploads folder: ${rootUploadsDir}`);
      console.log(`🌐 Files available at http://localhost:${PORT}/uploads`);
      console.log(
        `⬇️ Download route: http://localhost:${PORT}/uploads/download?file=filename.pdf`
      );
    });
  } catch (err) {
    console.error("❌ Server startup error:", err);
    process.exit(1);
  }
};

startServer();