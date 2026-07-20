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
import notificationRoutes from "./routes/notifications.js";
import timetableRoutes from "./routes/timetable.js";

import School from "./models/School.js";
import {
  createNotification,
  notifyClassStudents,
} from "./services/notificationService.js";

dotenv.config();

const app = express();

app.disable("x-powered-by");

/* =====================================================
   ES MODULE __dirname FIX
===================================================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =====================================================
   UPLOAD FOLDERS
===================================================== */

const serverUploadsDir = path.join(__dirname, "uploads");
const rootUploadsDir = path.join(process.cwd(), "uploads");

const ensureFolderExists = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, {
      recursive: true,
    });
  }
};

ensureFolderExists(serverUploadsDir);
ensureFolderExists(rootUploadsDir);

/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  cors({
    origin: true,
    credentials: true,
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(express.json({ limit: "50mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);

/* =====================================================
   GENERAL HELPERS
===================================================== */

const cleanText = (value) =>
  String(value ?? "").trim();

const escapeRegExp = (value) =>
  String(value ?? "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

const getToday = () =>
  new Date().toISOString().slice(0, 10);

const getCollection = (collectionName) => {
  if (
    !mongoose.connection ||
    mongoose.connection.readyState !== 1
  ) {
    throw new Error(
      "MongoDB is not connected yet."
    );
  }

  return mongoose.connection.db.collection(
    collectionName
  );
};

const makeTextMatch = (field, value) => ({
  [field]: {
    $regex: `^${escapeRegExp(value)}$`,
    $options: "i",
  },
});

const getObjectIdValue = (value) => {
  const cleanedValue = cleanText(value);

  if (
    cleanedValue &&
    mongoose.Types.ObjectId.isValid(cleanedValue)
  ) {
    return new mongoose.Types.ObjectId(
      cleanedValue
    );
  }

  return null;
};

/*
  This allows older dashboard records that saved schoolId
  as a string and newer records that use MongoDB ObjectId.
*/
const buildSchoolIdConditions = (schoolId) => {
  const cleanedSchoolId = cleanText(schoolId);

  if (!cleanedSchoolId) {
    return [];
  }

  const conditions = [
    { schoolId: cleanedSchoolId },
    { "school._id": cleanedSchoolId },
    { "school.id": cleanedSchoolId },
  ];

  const objectId = getObjectIdValue(cleanedSchoolId);

  if (objectId) {
    conditions.push(
      { schoolId: objectId },
      { "school._id": objectId }
    );
  }

  return conditions;
};

const buildClassFilter = (
  className,
  section = "",
  schoolId = ""
) => {
  const cleanClassName = cleanText(className);
  const cleanSection = cleanText(section);
  const cleanSchoolId = cleanText(schoolId);

  const andConditions = [];

  if (cleanClassName) {
    const classConditions = [
      makeTextMatch(
        "className",
        cleanClassName
      ),
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

    andConditions.push({
      $or: classConditions,
    });
  }

  if (
    cleanSection &&
    cleanSection.toLowerCase() !== "all"
  ) {
    andConditions.push({
      $or: [
        makeTextMatch(
          "section",
          cleanSection
        ),
        makeTextMatch(
          "classSection",
          cleanSection
        ),

        { section: cleanSection },
        { classSection: cleanSection },
      ],
    });
  }

  if (cleanSchoolId) {
    andConditions.push({
      $or: buildSchoolIdConditions(
        cleanSchoolId
      ),
    });
  }

  if (andConditions.length === 0) {
    return {};
  }

  return {
    $and: andConditions,
  };
};

const sendServerError = (
  res,
  error,
  fallbackMessage
) => {
  console.error(fallbackMessage, error);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
    error: error.message,
  });
};

/* =====================================================
   REPAIR OLD SCHOOL DATABASE INDEXES
===================================================== */

/*
  Older versions of the application may have created
  unique indexes such as:

  name_1
  schoolName_1
  email_1

  A unique school-name index would stop another school or
  branch with a similar name from registering.

  The User email remains unique, but School name and School
  contact email must not be globally unique.
*/
const repairLegacySchoolIndexes = async () => {
  const schoolCollection =
    mongoose.connection.db.collection(
      "schools"
    );

  let indexes = [];

  try {
    indexes =
      await schoolCollection.indexes();
  } catch (error) {
    /*
      Code 26 means the schools collection does not exist
      yet. This is normal for a completely new database.
    */
    if (
      error.code !== 26 &&
      error.codeName !== "NamespaceNotFound"
    ) {
      throw error;
    }
  }

  const fieldsThatMustNotBeUnique = new Set([
    "name",
    "schoolName",
    "email",
  ]);

  for (const index of indexes) {
    if (
      index.name === "_id_" ||
      index.unique !== true
    ) {
      continue;
    }

    const indexedFields = Object.keys(
      index.key || {}
    );

    const shouldRemoveIndex =
      indexedFields.some((field) =>
        fieldsThatMustNotBeUnique.has(field)
      );

    if (!shouldRemoveIndex) {
      continue;
    }

    try {
      await schoolCollection.dropIndex(
        index.name
      );

      console.log(
        `✅ Removed old unique school index: ${index.name}`
      );
    } catch (error) {
      if (
        error.code !== 27 &&
        error.codeName !== "IndexNotFound"
      ) {
        throw error;
      }
    }
  }

  /*
    Create all indexes currently defined in School.js.

    These indexes improve searching but are not unique.
  */
  await School.createIndexes();

  console.log(
    "✅ School indexes checked and repaired"
  );
};

/* =====================================================
   SAFE FILE PATH HELPER
===================================================== */

const getSafeUploadPath = (
  baseDir,
  requestedFile
) => {
  const cleanFile = String(
    requestedFile || ""
  )
    .trim()
    .replace(/^\/?uploads\/?/, "")
    .replace(/\\/g, "/");

  if (!cleanFile) {
    return null;
  }

  const resolvedBase = path.resolve(baseDir);

  const resolvedFile = path.resolve(
    resolvedBase,
    cleanFile
  );

  if (
    resolvedFile !== resolvedBase &&
    !resolvedFile.startsWith(
      resolvedBase + path.sep
    )
  ) {
    return null;
  }

  return {
    cleanFile,
    filePath: resolvedFile,
  };
};

/* =====================================================
   FILE DOWNLOAD ROUTE
===================================================== */

app.get("/uploads/download", (req, res) => {
  try {
    const requestedFile = String(
      req.query.file || ""
    ).trim();

    if (!requestedFile) {
      return res.status(400).json({
        success: false,
        message: "File name is required.",
      });
    }

    const possibleFolders = [
      serverUploadsDir,
      rootUploadsDir,
    ];

    let foundFile = null;

    for (const folder of possibleFolders) {
      const safePath = getSafeUploadPath(
        folder,
        requestedFile
      );

      if (
        safePath &&
        fs.existsSync(safePath.filePath)
      ) {
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

    return res.download(
      foundFile.filePath,
      path.basename(foundFile.filePath)
    );
  } catch (error) {
    console.error(
      "Download file error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to download file.",
    });
  }
});

/* =====================================================
   SERVE UPLOADED FILES
===================================================== */

app.use(
  "/uploads",
  express.static(serverUploadsDir, {
    setHeaders: (res) => {
      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Cross-Origin-Resource-Policy",
        "cross-origin"
      );
    },
  })
);

app.use(
  "/uploads",
  express.static(rootUploadsDir, {
    setHeaders: (res) => {
      res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
      );

      res.setHeader(
        "Cross-Origin-Resource-Policy",
        "cross-origin"
      );
    },
  })
);

/* =====================================================
   TEST ROUTES
===================================================== */

app.get("/", (req, res) => {
  res.send(
    "Hamro Shikshya backend is running"
  );
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "API is running",
    app: "Hamro Shikshya",
    database:
      mongoose.connection.readyState === 1
        ? "connected"
        : "disconnected",
    time: new Date().toISOString(),
  });
});

/* =====================================================
   DIRECT TEACHER DASHBOARD ROUTES
===================================================== */

/*
  These routes keep TeacherDashboard functional even when
  older individual route files are incomplete.
*/

const registerTeacherDashboardRoutes = () => {
  /* ---------------------------------------------------
     ATTENDANCE
  --------------------------------------------------- */

  app.post(
    [
      "/api/attendance/bulk",
      "/api/attendance/mark-bulk",
      "/api/attendances/bulk",
    ],
    async (req, res) => {
      try {
        const body = req.body || {};
        const records = Array.isArray(body.records)
          ? body.records
          : [];

        if (records.length === 0) {
          return res.status(400).json({
            success: false,
            message: "Attendance records are required.",
          });
        }

        const savedRecords = [];
        const collection = getCollection("attendances");

        for (const rawRecord of records) {
          const record = rawRecord || {};

          const studentId = cleanText(
            record.studentId || record.student
          );

          const className = cleanText(
            record.className || record.class || body.className
          );

          const section = cleanText(
            record.section || body.section
          );

          const schoolId = cleanText(
            record.schoolId || body.schoolId
          );

          if (!studentId || !className || !schoolId) {
            continue;
          }

          const status =
            cleanText(record.status) || "Present";

          const date =
            cleanText(record.date || body.date) || getToday();

          const teacherId = cleanText(
            record.teacherId ||
              record.markedBy ||
              body.teacherId
          );

          const attendance = {
            ...record,
            studentId,
            studentName: cleanText(
              record.studentName || record.name
            ),
            classId: cleanText(
              record.classId || body.classId
            ),
            className,
            section,
            status,
            date,
            schoolId,
            teacherId,
            markedBy: teacherId,
            updatedAt: new Date(),
          };

          const result =
            await collection.findOneAndUpdate(
              {
                studentId,
                className,
                section,
                date,
                schoolId,
              },
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

          const savedAttendance =
            result?.value || result || attendance;

          savedRecords.push(savedAttendance);

          await createNotification({
            recipientId: studentId,
            recipientRole: "student",
            senderId: teacherId || null,
            senderName: cleanText(
              record.markedByName ||
                record.teacherName ||
                body.teacherName
            ),
            senderRole: "teacher",
            schoolId,
            type: "attendance_marked",
            title: "Attendance Updated",
            message: `Your attendance for ${date} was marked ${status}.`,
            relatedId:
              savedAttendance?._id || "",
            relatedModel: "Attendance",
            relatedRoute: "/student/attendance",
            className,
            section,
            metadata: {
              status,
              date,
            },
          });
        }

        return res.status(201).json({
          success: true,
          message: "Attendance saved successfully.",
          data: savedRecords,
          attendance: savedRecords,
          records: savedRecords,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to save attendance."
        );
      }
    }
  );

  app.post(
    [
      "/api/attendance/mark",
      "/api/attendance/create",
    ],
    async (req, res) => {
      try {
        const body = req.body || {};

        const studentId = cleanText(
          body.studentId || body.student
        );

        const studentName = cleanText(
          body.studentName || body.name
        );

        const className = cleanText(
          body.className || body.class
        );

        const section = cleanText(
          body.section
        );

        const status =
          cleanText(body.status) ||
          "Present";

        const date =
          cleanText(body.date) ||
          getToday();

        const schoolId = cleanText(
          body.schoolId
        );

        const teacherId = cleanText(
          body.teacherId || body.markedBy
        );

        const classId = cleanText(
          body.classId
        );

        if (!studentId) {
          return res.status(400).json({
            success: false,
            message:
              "studentId is required.",
          });
        }

        if (!className) {
          return res.status(400).json({
            success: false,
            message:
              "className is required.",
          });
        }

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
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
          schoolId,
        };

        const collection = getCollection(
          "attendances"
        );

        const result =
          await collection.findOneAndUpdate(
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

        const savedAttendance =
          result?.value ||
          result || {
            ...attendance,
          };

        await createNotification({
          recipientId: studentId,
          recipientRole: "student",
          senderId: teacherId || null,
          senderName: cleanText(
            body.markedByName ||
              body.teacherName
          ),
          senderRole: "teacher",
          schoolId,
          type: "attendance_marked",
          title: "Attendance Updated",
          message: `Your attendance for ${date} was marked ${status}.`,
          relatedId:
            savedAttendance?._id || "",
          relatedModel: "Attendance",
          relatedRoute: "/student/attendance",
          className,
          section,
          metadata: {
            status,
            date,
          },
        });

        return res.status(201).json({
          success: true,
          message:
            "Attendance saved successfully.",
          data: savedAttendance,
          attendance: savedAttendance,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to save attendance."
        );
      }
    }
  );

  app.get(
    "/api/attendance/class/:className",
    async (req, res) => {
      try {
        const className =
          req.params.className;

        const section =
          req.query.section || "";

        const schoolId =
          req.query.schoolId || "";

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
          });
        }

        const filter = buildClassFilter(
          className,
          section,
          schoolId
        );

        const records = await getCollection(
          "attendances"
        )
          .find(filter)
          .sort({
            date: -1,
            createdAt: -1,
          })
          .toArray();

        return res.json({
          success: true,
          data: records,
          attendance: records,
          records,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to load attendance records."
        );
      }
    }
  );

  /* ---------------------------------------------------
     EXAMS
  --------------------------------------------------- */

  app.post(
    [
      "/api/exams/create",
      "/api/exam/create",
      "/api/exams",
      "/api/exam",
    ],
    async (req, res) => {
      try {
        const body = req.body || {};

        const title = cleanText(
          body.title || body.examTitle
        );

        const subject = cleanText(
          body.subject
        );

        const className = cleanText(
          body.className || body.class
        );

        const section = cleanText(
          body.section
        );

        const date = cleanText(
          body.date || body.examDate
        );

        const maxMarks = Number(
          body.maxMarks ||
            body.totalMarks ||
            0
        );

        const schoolId = cleanText(
          body.schoolId
        );

        const teacherId = cleanText(
          body.teacherId
        );

        const classId = cleanText(
          body.classId
        );

        if (!title) {
          return res.status(400).json({
            success: false,
            message:
              "Exam title is required.",
          });
        }

        if (!subject) {
          return res.status(400).json({
            success: false,
            message:
              "Subject is required.",
          });
        }

        if (!className) {
          return res.status(400).json({
            success: false,
            message:
              "className is required.",
          });
        }

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
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

        const result = await getCollection(
          "exams"
        ).insertOne(exam);

        const savedExam = {
          _id: result.insertedId,
          ...exam,
        };

        await notifyClassStudents({
          schoolId,
          className,
          section,
          senderId: teacherId || null,
          senderName: cleanText(
            body.teacherName
          ),
          senderRole: "teacher",
          type: "exam_created",
          title: "New Exam Scheduled",
          message: `${subject} exam "${title}" has been scheduled for ${date || "an upcoming date"}.`,
          relatedId: savedExam._id,
          relatedModel: "Exam",
          relatedRoute: "/student/exams",
          metadata: {
            subject,
            date,
            maxMarks,
          },
        });

        return res.status(201).json({
          success: true,
          message:
            "Exam created successfully.",
          data: savedExam,
          exam: savedExam,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to create exam."
        );
      }
    }
  );

  app.get(
    [
      "/api/exams/class/:className",
      "/api/exam/class/:className",
    ],
    async (req, res) => {
      try {
        const className =
          req.params.className;

        const section =
          req.query.section || "";

        const schoolId =
          req.query.schoolId || "";

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
          });
        }

        const filter = buildClassFilter(
          className,
          section,
          schoolId
        );

        const exams = await getCollection(
          "exams"
        )
          .find(filter)
          .sort({
            date: -1,
            createdAt: -1,
          })
          .toArray();

        return res.json({
          success: true,
          data: exams,
          exams,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to load exams."
        );
      }
    }
  );

  /* ---------------------------------------------------
     NOTICES
  --------------------------------------------------- */

  app.post(
    [
      "/api/notices/create",
      "/api/notice/create",
      "/api/notices",
      "/api/notice",
    ],
    async (req, res) => {
      try {
        const body = req.body || {};

        const title = cleanText(
          body.title || body.noticeTitle
        );

        const content = cleanText(
          body.content ||
            body.description
        );

        const className = cleanText(
          body.className || body.class
        );

        const section = cleanText(
          body.section
        );

        const schoolId = cleanText(
          body.schoolId
        );

        const teacherId = cleanText(
          body.teacherId
        );

        const teacherName = cleanText(
          body.teacherName
        );

        const classId = cleanText(
          body.classId
        );

        if (!title) {
          return res.status(400).json({
            success: false,
            message:
              "Notice title is required.",
          });
        }

        if (!content) {
          return res.status(400).json({
            success: false,
            message:
              "Notice content is required.",
          });
        }

        if (!className) {
          return res.status(400).json({
            success: false,
            message:
              "className is required.",
          });
        }

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
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

        const result = await getCollection(
          "notices"
        ).insertOne(notice);

        const savedNotice = {
          _id: result.insertedId,
          ...notice,
        };

        await notifyClassStudents({
          schoolId,
          className,
          section,
          senderId: teacherId || null,
          senderName: teacherName,
          senderRole: "teacher",
          type: "notice_created",
          title: title,
          message: content,
          relatedId: savedNotice._id,
          relatedModel: "Notice",
          relatedRoute: "/student/notices",
        });

        return res.status(201).json({
          success: true,
          message:
            "Notice created successfully.",
          data: savedNotice,
          notice: savedNotice,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to create notice."
        );
      }
    }
  );

  app.get(
    [
      "/api/notices/class/:className",
      "/api/notice/class/:className",
    ],
    async (req, res) => {
      try {
        const className =
          req.params.className;

        const section =
          req.query.section || "";

        const schoolId =
          req.query.schoolId || "";

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
          });
        }

        const filter = buildClassFilter(
          className,
          section,
          schoolId
        );

        const notices =
          await getCollection("notices")
            .find(filter)
            .sort({
              createdAt: -1,
            })
            .toArray();

        return res.json({
          success: true,
          data: notices,
          notices,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to load notices."
        );
      }
    }
  );

  app.get(
    [
      "/api/notices/school/:schoolId",
      "/api/notice/school/:schoolId",
    ],
    async (req, res) => {
      try {
        const schoolId = cleanText(
          req.params.schoolId
        );

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
          });
        }

        const notices =
          await getCollection("notices")
            .find({
              $or: buildSchoolIdConditions(
                schoolId
              ),
            })
            .sort({
              createdAt: -1,
            })
            .toArray();

        return res.json({
          success: true,
          data: notices,
          notices,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to load school notices."
        );
      }
    }
  );

  /* ---------------------------------------------------
     EXAM RESULTS / MARKS
  --------------------------------------------------- */

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

        const examId = cleanText(
          req.params.examId ||
            body.examId
        );

        const studentId = cleanText(
          body.studentId ||
            body.student
        );

        const studentName = cleanText(
          body.studentName
        );

        const examTitle = cleanText(
          body.examTitle ||
            body.title
        );

        const subject = cleanText(
          body.subject
        );

        const className = cleanText(
          body.className ||
            body.class
        );

        const section = cleanText(
          body.section
        );

        const schoolId = cleanText(
          body.schoolId
        );

        const teacherId = cleanText(
          body.teacherId
        );

        const classId = cleanText(
          body.classId
        );

        const maxMarks = Number(
          body.maxMarks ||
            body.totalMarks ||
            0
        );

        const obtainedMarks = Number(
          body.obtainedMarks ??
            body.marksObtained ??
            body.marks ??
            0
        );

        const remarks = cleanText(
          body.remarks ||
            body.feedback
        );

        if (!examId) {
          return res.status(400).json({
            success: false,
            message:
              "examId is required.",
          });
        }

        if (!studentId) {
          return res.status(400).json({
            success: false,
            message:
              "studentId is required.",
          });
        }

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
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
          schoolId,

          ...(className
            ? { className }
            : {}),

          ...(section
            ? { section }
            : {}),
        };

        const result =
          await getCollection(
            "results"
          ).findOneAndUpdate(
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

        const savedResult =
          result?.value ||
          result || {
            ...resultData,
          };

        await createNotification({
          recipientId: studentId,
          recipientRole: "student",
          senderId: teacherId || null,
          senderName: cleanText(
            body.teacherName
          ),
          senderRole: "teacher",
          schoolId,
          type: "result_published",
          title: "Exam Result Published",
          message: `Your ${subject || examTitle || "exam"} result is now available.`,
          relatedId:
            savedResult?._id || examId,
          relatedModel: "Result",
          relatedRoute: "/student/results",
          className,
          section,
          metadata: {
            examId,
            obtainedMarks,
            maxMarks,
          },
        });

        return res.status(201).json({
          success: true,
          message:
            "Result saved successfully.",
          data: savedResult,
          result: savedResult,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to save result."
        );
      }
    }
  );

  app.put(
    "/api/results/:examId/:studentId",
    async (req, res) => {
      try {
        const examId = cleanText(
          req.params.examId
        );

        const studentId = cleanText(
          req.params.studentId
        );

        const body = req.body || {};

        const schoolId = cleanText(
          body.schoolId
        );

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
          });
        }

        const obtainedMarks = Number(
          body.obtainedMarks ??
            body.marksObtained ??
            body.marks ??
            0
        );

        const updateData = {
          ...body,
          examId,
          studentId,
          schoolId,
          obtainedMarks,
          marksObtained:
            obtainedMarks,
          marks: obtainedMarks,
          updatedAt: new Date(),
          savedAt: new Date(),
        };

        const result =
          await getCollection(
            "results"
          ).findOneAndUpdate(
            {
              examId,
              studentId,
              schoolId,
            },
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

        const savedResult =
          result?.value ||
          result || {
            ...updateData,
          };

        await createNotification({
          recipientId: studentId,
          recipientRole: "student",
          senderId:
            cleanText(body.teacherId) || null,
          senderName: cleanText(
            body.teacherName
          ),
          senderRole: "teacher",
          schoolId,
          type: "result_updated",
          title: "Exam Result Updated",
          message: `Your ${cleanText(
            body.subject ||
              body.examTitle ||
              "exam"
          )} result has been updated.`,
          relatedId:
            savedResult?._id || examId,
          relatedModel: "Result",
          relatedRoute: "/student/results",
          className: cleanText(
            body.className ||
              body.class
          ),
          section: cleanText(
            body.section
          ),
          metadata: {
            examId,
            obtainedMarks,
          },
        });

        return res.json({
          success: true,
          message:
            "Result updated successfully.",
          data: savedResult,
          result: savedResult,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to update result."
        );
      }
    }
  );

  app.get(
    "/api/results/exam/:examId",
    async (req, res) => {
      try {
        const examId = cleanText(
          req.params.examId
        );

        const schoolId = cleanText(
          req.query.schoolId
        );

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
          });
        }

        const results =
          await getCollection("results")
            .find({
              examId,

              $or:
                buildSchoolIdConditions(
                  schoolId
                ),
            })
            .sort({
              studentName: 1,
            })
            .toArray();

        return res.json({
          success: true,
          data: results,
          results,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to load exam results."
        );
      }
    }
  );

  app.get(
    "/api/results/student/:studentId",
    async (req, res) => {
      try {
        const studentId = cleanText(
          req.params.studentId
        );

        const schoolId = cleanText(
          req.query.schoolId
        );

        if (!schoolId) {
          return res.status(400).json({
            success: false,
            message:
              "schoolId is required.",
          });
        }

        const results =
          await getCollection("results")
            .find({
              studentId,

              $or:
                buildSchoolIdConditions(
                  schoolId
                ),
            })
            .sort({
              createdAt: -1,
            })
            .toArray();

        return res.json({
          success: true,
          data: results,
          results,
        });
      } catch (error) {
        return sendServerError(
          res,
          error,
          "Failed to load student results."
        );
      }
    }
  );

  console.log(
    "✅ Direct Teacher Dashboard routes enabled"
  );
};

/* =====================================================
   OPTIONAL ROUTE LOADER
===================================================== */

const registerOptionalRoute = async (
  importPath,
  mountPaths,
  label
) => {
  try {
    const routeModule = await import(
      importPath
    );

    const router = routeModule.default;

    if (!router) {
      console.warn(
        `⚠️ ${label} route file exists but has no default export.`
      );

      return;
    }

    mountPaths.forEach((mountPath) => {
      app.use(mountPath, router);
    });

    console.log(
      `✅ ${label} routes enabled: ${mountPaths.join(
        ", "
      )}`
    );
  } catch (error) {
    const expectedPath =
      importPath.replace("./", "");

    if (
      error.code ===
        "ERR_MODULE_NOT_FOUND" &&
      error.message.includes(
        expectedPath
      )
    ) {
      console.warn(
        `⚠️ ${label} routes skipped because ${expectedPath} is not created yet.`
      );

      return;
    }

    throw error;
  }
};

/* =====================================================
   API ROUTES
===================================================== */

const registerRoutes = async () => {
  /*
    Public authentication routes:

    POST /api/auth/signup
    POST /api/auth/login
  */
  app.use("/api/auth", authRoutes);

  /*
    Existing admin creates teachers and students through
    the users route.
  */
  app.use("/api/users", userRoutes);

  /*
    Persistent notifications for Admin, Teacher and Student portals.
  */
  app.use(
    "/api/notifications",
    notificationRoutes
  );

  app.use("/api/tasks", taskRoutes);

  /*
    Register direct dashboard routes before the older
    route files so the dashboard endpoints are found first.
  */
  registerTeacherDashboardRoutes();

  app.use(
    "/api/attendance",
    attendanceRoutes
  );

  app.use("/api/exam", examRoutes);
  app.use("/api/exams", examRoutes);

  app.use("/api/notice", noticeRoutes);
  app.use("/api/notices", noticeRoutes);

  app.use(
    "/api/subjects",
    subjectRoutes
  );

  app.use(
    "/api/subject",
    subjectRoutes
  );

  app.use("/api/school", schoolRoutes);
  app.use("/api/schools", schoolRoutes);

  /*
    Weekly timetable routes for Admin, Teacher and Student portals.
  */
  app.use("/api/timetable", timetableRoutes);
  app.use("/api/timetables", timetableRoutes);

  await registerOptionalRoute(
    "./routes/reports.js",
    ["/api/reports", "/api/report"],
    "Reports"
  );

  /*
    API 404 handler
  */
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "API route not found",
      method: req.method,
      path: req.originalUrl,
    });
  });
};

/* =====================================================
   SERVER START
===================================================== */

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error(
        "❌ MONGO_URI is missing in the backend .env file."
      );

      process.exit(1);
    }

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "✅ MongoDB connected successfully"
    );

    /*
      Remove old unique school indexes before accepting
      new school/admin registrations.
    */
    await repairLegacySchoolIndexes();

    await registerRoutes();

    const PORT =
      Number(process.env.PORT) || 5000;

    app.listen(PORT, () => {
      console.log(
        `🚀 Server running on http://localhost:${PORT}`
      );

      console.log(
        `❤️ Health check: http://localhost:${PORT}/api/health`
      );

      console.log(
        `📝 Admin signup: http://localhost:${PORT}/api/auth/signup`
      );

      console.log(
        `🔐 Login: http://localhost:${PORT}/api/auth/login`
      );

      console.log(
        `📁 Server uploads folder: ${serverUploadsDir}`
      );

      console.log(
        `📁 Root uploads folder: ${rootUploadsDir}`
      );

      console.log(
        `🌐 Files available at http://localhost:${PORT}/uploads`
      );

      console.log(
        `⬇️ Download route: http://localhost:${PORT}/uploads/download?file=filename.pdf`
      );
    });
  } catch (error) {
    console.error(
      "❌ Server startup error:",
      error
    );

    process.exit(1);
  }
};

/* =====================================================
   UNEXPECTED ERROR HANDLERS
===================================================== */

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "❌ Unhandled promise rejection:",
      error
    );
  }
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "❌ Uncaught exception:",
      error
    );
  }
);

startServer();