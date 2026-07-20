import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Timetable from "../models/Timetable.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";

const router = express.Router();

const TEACHING_CLASS_TYPES = new Set([
  "Regular Class",
  "Practical",
  "Lab",
  "Tutorial",
]);

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/* =====================================================
   HELPERS
===================================================== */

const cleanText = (value) => String(value ?? "").trim();

const escapeRegex = (value) =>
  String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exactText = (value) => ({
  $regex: `^${escapeRegex(cleanText(value))}$`,
  $options: "i",
});

const isValidObjectId = (value) =>
  Boolean(value) && mongoose.Types.ObjectId.isValid(String(value));

const normalizeStream = (value) => {
  const cleaned = cleanText(value);

  if (!cleaned) return "";

  const normalized = cleaned
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const streamMap = {
    science: "Science",
    management: "Management",
    commerce: "Management",
    humanities: "Humanities",
    arts: "Humanities",
    education: "Education",
    law: "Law",
    technical: "Technical",
    vocational: "Technical",
    "technical vocational": "Technical",
    general: "General",
  };

  return (
    streamMap[normalized] ||
    cleaned
      .split(/\s+/)
      .map(
        (word) =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ")
  );
};

const normalizeDay = (value) => {
  const cleaned = cleanText(value).toLowerCase();

  return (
    DAYS_OF_WEEK.find((day) => day.toLowerCase() === cleaned) || ""
  );
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") return value;

  const normalized = cleanText(value).toLowerCase();

  if (["true", "1", "yes", "active"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "inactive"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const toNumberOrNull = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numeric = Number(value);

  return Number.isFinite(numeric) ? numeric : null;
};

const parseDateOrNull = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const getSchoolId = (user) =>
  user?.schoolId?._id || user?.schoolId || "";

const addAndCondition = (filter, condition) => {
  filter.$and = [...(filter.$and || []), condition];
};

const getSubjectSections = (subject) => {
  if (Array.isArray(subject?.sections) && subject.sections.length > 0) {
    return subject.sections.map((value) => cleanText(value));
  }

  return [cleanText(subject?.section || "All") || "All"];
};

const subjectAppliesToSection = (subject, section) => {
  const targetSection = cleanText(section).toLowerCase();

  return getSubjectSections(subject).some((value) => {
    const normalized = cleanText(value).toLowerCase();

    return normalized === "all" || normalized === targetSection;
  });
};

const subjectAppliesToStream = (subject, stream, className) => {
  const classNumber = Number(className);

  if (classNumber >= 1 && classNumber <= 10) {
    return true;
  }

  const subjectStream = normalizeStream(subject?.stream) || "General";
  const selectedStream = normalizeStream(stream) || "General";

  return (
    subjectStream === "General" ||
    subjectStream === selectedStream
  );
};

const parseClassParameter = (rawValue, querySection = "") => {
  const value = cleanText(rawValue);
  const requestedSection = cleanText(querySection);

  if (requestedSection) {
    return {
      className: value,
      section: requestedSection,
    };
  }

  /*
    The current frontend first requests values such as:
    /timetable/class/11-A

    It later falls back to:
    /timetable/class/11?section=A
  */
  const match = value.match(/^(.+?)[-_ ]([A-Za-z0-9]+)$/);

  if (match) {
    return {
      className: cleanText(match[1]),
      section: cleanText(match[2]),
    };
  }

  return {
    className: value,
    section: "",
  };
};

const isValidTime = (value) =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(cleanText(value));

const timeRangesOverlap = (
  startTime,
  endTime,
  existingStart,
  existingEnd
) => {
  return startTime < existingEnd && endTime > existingStart;
};

const periodNeedsSubjectAndTeacher = (classType) =>
  TEACHING_CLASS_TYPES.has(classType);

const timetableResponse = (entries, extra = {}) => ({
  success: true,
  count: entries.length,
  timetable: entries,
  timetables: entries,
  routine: entries,
  routines: entries,
  data: entries,
  ...extra,
});

const populateTimetable = (query) =>
  query
    .populate(
      "subjectId",
      "name subjectName subjectCode code className section sections stream type isActive"
    )
    .populate(
      "teacherId",
      "name email employeeId assignedClasses subjects teacherSubjectIds"
    )
    .populate("createdBy", "name email role")
    .populate("updatedBy", "name email role");

const applyCurrentDateFilter = (filter, referenceDate = new Date()) => {
  const endOfDay = new Date(referenceDate);
  endOfDay.setHours(23, 59, 59, 999);

  const startOfDay = new Date(referenceDate);
  startOfDay.setHours(0, 0, 0, 0);

  addAndCondition(filter, {
    $or: [
      { validFrom: null },
      { validFrom: { $exists: false } },
      { validFrom: { $lte: endOfDay } },
    ],
  });

  addAndCondition(filter, {
    $or: [
      { validUntil: null },
      { validUntil: { $exists: false } },
      { validUntil: { $gte: startOfDay } },
    ],
  });
};

const buildBaseListFilter = ({
  schoolId,
  className = "",
  section = "",
  stream = "",
  academicYear = "",
  dayOfWeek = "",
  teacherId = "",
  subjectId = "",
  activeOnly = true,
  currentOnly = true,
  referenceDate = new Date(),
}) => {
  const filter = {
    schoolId,
  };

  if (className) {
    filter.className = exactText(className);
  }

  if (section) {
    filter.section = exactText(section);
  }

  if (stream) {
    const normalizedStream = normalizeStream(stream);

    if (Number(className) >= 11 && normalizedStream !== "General") {
      addAndCondition(filter, {
        $or: [
          { stream: exactText(normalizedStream) },
          { stream: exactText("General") },
          { stream: exactText("") },
        ],
      });
    } else {
      addAndCondition(filter, {
        $or: [
          { stream: exactText(normalizedStream || "General") },
          { stream: exactText("") },
        ],
      });
    }
  }

  if (academicYear) {
    addAndCondition(filter, {
      $or: [
        { academicYear: exactText(academicYear) },
        { academicYear: exactText("") },
      ],
    });
  }

  if (dayOfWeek) {
    filter.dayOfWeek = normalizeDay(dayOfWeek);
  }

  if (teacherId && isValidObjectId(teacherId)) {
    filter.teacherId = teacherId;
  }

  if (subjectId && isValidObjectId(subjectId)) {
    filter.subjectId = subjectId;
  }

  if (activeOnly) {
    filter.isActive = true;
  }

  if (currentOnly) {
    applyCurrentDateFilter(filter, referenceDate);
  }

  return filter;
};

/* =====================================================
   AUTHENTICATION
===================================================== */

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded._id || decoded.userId;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(401).json({
        message: "Invalid token payload",
      });
    }

    const user = await User.findById(userId).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "Logged-in user not found",
      });
    }

    if (
      user.accountStatus === "deactivated" ||
      user.isActive === false
    ) {
      return res.status(403).json({
        message: "This account is deactivated",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Timetable auth error:", error.message);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Only the school administrator can manage the timetable",
    });
  }

  next();
};

/* =====================================================
   SUBJECT AND TEACHER VALIDATION
===================================================== */

const resolveSubject = async ({
  subjectId,
  subjectName,
  schoolId,
  className,
  section,
  stream,
  classType,
}) => {
  if (!periodNeedsSubjectAndTeacher(classType)) {
    if (!subjectId) {
      return {
        subjectId: null,
        subjectName: cleanText(subjectName),
        subjectCode: "",
      };
    }
  }

  if (!subjectId || !isValidObjectId(subjectId)) {
    if (periodNeedsSubjectAndTeacher(classType)) {
      const error = new Error(
        "Select a valid subject for this teaching period"
      );
      error.statusCode = 400;
      throw error;
    }

    return {
      subjectId: null,
      subjectName: cleanText(subjectName),
      subjectCode: "",
    };
  }

  const subject = await Subject.findOne({
    _id: subjectId,
    schoolId,
    isActive: true,
  });

  if (!subject) {
    const error = new Error(
      "Selected subject was not found in this school or is inactive"
    );
    error.statusCode = 400;
    throw error;
  }

  if (cleanText(subject.className) !== cleanText(className)) {
    const error = new Error(
      `The selected subject does not belong to Class ${className}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (!subjectAppliesToSection(subject, section)) {
    const error = new Error(
      `The selected subject is not configured for Section ${section}`
    );
    error.statusCode = 400;
    throw error;
  }

  if (!subjectAppliesToStream(subject, stream, className)) {
    const error = new Error(
      `The selected subject does not belong to the ${stream || "General"} programme`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    subjectId: subject._id,
    subjectName: subject.name || subject.subjectName || "",
    subjectCode: subject.subjectCode || subject.code || "",
    subject,
  };
};

const resolveTeacher = async ({
  teacherId,
  schoolId,
  className,
  section,
  stream,
  subjectId,
  subjectName,
  classType,
}) => {
  if (!periodNeedsSubjectAndTeacher(classType) && !teacherId) {
    return {
      teacherId: null,
      teacherName: "",
    };
  }

  if (!teacherId || !isValidObjectId(teacherId)) {
    const error = new Error(
      "Select a valid teacher for this teaching period"
    );
    error.statusCode = 400;
    throw error;
  }

  const teacher = await User.findOne({
    _id: teacherId,
    schoolId,
    role: "teacher",
    isActive: { $ne: false },
    accountStatus: { $ne: "deactivated" },
  });

  if (!teacher) {
    const error = new Error(
      "Selected teacher was not found in this school or is inactive"
    );
    error.statusCode = 400;
    throw error;
  }

  const matchingAssignment = (teacher.assignedClasses || []).find(
    (assignment) => {
      const classMatches =
        cleanText(assignment.className) === cleanText(className);

      const sectionMatches =
        cleanText(assignment.section).toLowerCase() ===
        cleanText(section).toLowerCase();

      const classNumber = Number(className);
      const requestedStream = normalizeStream(stream) || "General";
      const assignedStream =
        normalizeStream(assignment.stream) || "General";

      const streamMatches =
        classNumber <= 10 ||
        assignedStream === requestedStream ||
        assignedStream === "General";

      const assignedSubjectIds = (assignment.subjectIds || []).map(
        (value) => String(value?._id || value)
      );

      const assignedSubjectNames = (assignment.subjects || []).map(
        (value) => cleanText(value).toLowerCase()
      );

      const subjectMatches =
        (subjectId &&
          assignedSubjectIds.includes(String(subjectId))) ||
        (subjectName &&
          assignedSubjectNames.includes(
            cleanText(subjectName).toLowerCase()
          ));

      return (
        classMatches &&
        sectionMatches &&
        streamMatches &&
        subjectMatches
      );
    }
  );

  if (periodNeedsSubjectAndTeacher(classType) && !matchingAssignment) {
    const error = new Error(
      `${teacher.name} is not appointed to teach ${subjectName || "this subject"} in Class ${className}, Section ${section}`
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    teacherId: teacher._id,
    teacherName: teacher.name || "",
    teacher,
  };
};

/* =====================================================
   PAYLOAD AND CONFLICT VALIDATION
===================================================== */

const buildTimetablePayload = async (
  body,
  reqUser,
  existingEntry = null
) => {
  const existing =
    existingEntry?.toObject?.() || existingEntry || {};

  const className = cleanText(
    body.className ?? body.class ?? existing.className
  );

  const section = cleanText(
    body.section ?? existing.section
  );

  const classNumber = Number(className);

  const stream =
    classNumber >= 11
      ? normalizeStream(body.stream ?? existing.stream) || "General"
      : "General";

  const classType =
    cleanText(body.classType ?? body.type ?? existing.classType) ||
    "Regular Class";

  const dayOfWeek = normalizeDay(
    body.dayOfWeek ?? body.day ?? existing.dayOfWeek
  );

  const startTime = cleanText(
    body.startTime ?? body.start ?? existing.startTime
  );

  const endTime = cleanText(
    body.endTime ?? body.end ?? existing.endTime
  );

  const schoolId = getSchoolId(reqUser);

  if (!className || !section) {
    const error = new Error(
      "Class and section are required"
    );
    error.statusCode = 400;
    throw error;
  }

  if (!dayOfWeek) {
    const error = new Error(
      "Select a valid day of the week"
    );
    error.statusCode = 400;
    throw error;
  }

  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    const error = new Error(
      "Start and end time must use HH:mm format"
    );
    error.statusCode = 400;
    throw error;
  }

  if (endTime <= startTime) {
    const error = new Error(
      "End time must be later than start time"
    );
    error.statusCode = 400;
    throw error;
  }

  const subjectResult = await resolveSubject({
    subjectId:
      body.subjectId ??
      body.subject?._id ??
      existing.subjectId,
    subjectName:
      body.subjectName ??
      body.subject ??
      existing.subjectName,
    schoolId,
    className,
    section,
    stream,
    classType,
  });

  const teacherResult = await resolveTeacher({
    teacherId:
      body.teacherId ??
      body.teacher?._id ??
      existing.teacherId,
    schoolId,
    className,
    section,
    stream,
    subjectId: subjectResult.subjectId,
    subjectName: subjectResult.subjectName,
    classType,
  });

  const validFrom =
    body.validFrom !== undefined
      ? parseDateOrNull(body.validFrom)
      : existing.validFrom || null;

  const validUntil =
    body.validUntil !== undefined
      ? parseDateOrNull(body.validUntil)
      : existing.validUntil || null;

  if (
    body.validFrom &&
    !validFrom
  ) {
    const error = new Error("Invalid valid-from date");
    error.statusCode = 400;
    throw error;
  }

  if (
    body.validUntil &&
    !validUntil
  ) {
    const error = new Error("Invalid valid-until date");
    error.statusCode = 400;
    throw error;
  }

  if (
    validFrom &&
    validUntil &&
    validUntil < validFrom
  ) {
    const error = new Error(
      "Valid-until date cannot be before valid-from date"
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    schoolId,
    className,
    section,
    stream,
    academicYear: cleanText(
      body.academicYear ?? existing.academicYear
    ),

    dayOfWeek,
    dayOrder: DAYS_OF_WEEK.indexOf(dayOfWeek),
    startTime,
    endTime,
    periodNumber: toNumberOrNull(
      body.periodNumber ?? existing.periodNumber
    ),

    subjectId: subjectResult.subjectId,
    subjectName: subjectResult.subjectName,
    subjectCode: subjectResult.subjectCode,

    teacherId: teacherResult.teacherId,
    teacherName: teacherResult.teacherName,

    room: cleanText(body.room ?? existing.room),
    classType,
    notes: cleanText(
      body.notes ?? body.description ?? existing.notes
    ),

    validFrom,
    validUntil,

    isActive: parseBoolean(
      body.isActive,
      existing.isActive === undefined
        ? true
        : Boolean(existing.isActive)
    ),

    updatedBy: reqUser._id,
  };
};

const findConflicts = async (
  payload,
  excludedId = ""
) => {
  if (!payload.isActive) {
    return [];
  }

  const baseQuery = {
    schoolId: payload.schoolId,
    dayOfWeek: payload.dayOfWeek,
    isActive: true,
  };

  if (excludedId) {
    baseQuery._id = {
      $ne: excludedId,
    };
  }

  const possibleEntries = await Timetable.find({
    ...baseQuery,
    $or: [
      /*
        Same student group.
        A General entry conflicts with every stream because
        it applies to the full class/section.
      */
      {
        className: exactText(payload.className),
        section: exactText(payload.section),
        ...(payload.stream === "General"
          ? {}
          : {
              $or: [
                { stream: exactText(payload.stream) },
                { stream: exactText("General") },
                { stream: exactText("") },
              ],
            }),
      },

      /*
        The same teacher cannot teach two places at once.
      */
      ...(payload.teacherId
        ? [{ teacherId: payload.teacherId }]
        : []),

      /*
        The same room cannot be double-booked.
      */
      ...(payload.room
        ? [{ room: exactText(payload.room) }]
        : []),
    ],
  });

  return possibleEntries.filter((entry) => {
    if (
      !timeRangesOverlap(
        payload.startTime,
        payload.endTime,
        entry.startTime,
        entry.endTime
      )
    ) {
      return false;
    }

    const sameClass =
      cleanText(entry.className) === cleanText(payload.className) &&
      cleanText(entry.section).toLowerCase() ===
        cleanText(payload.section).toLowerCase();

    const entryStream = normalizeStream(entry.stream) || "General";

    const streamConflict =
      sameClass &&
      (
        payload.stream === "General" ||
        entryStream === "General" ||
        entryStream === payload.stream
      );

    const teacherConflict =
      payload.teacherId &&
      entry.teacherId &&
      String(entry.teacherId) === String(payload.teacherId);

    const roomConflict =
      payload.room &&
      entry.room &&
      cleanText(entry.room).toLowerCase() ===
        cleanText(payload.room).toLowerCase();

    return streamConflict || teacherConflict || roomConflict;
  });
};

const conflictMessage = (conflicts, payload) => {
  if (conflicts.length === 0) return "";

  const conflict = conflicts[0];

  if (
    payload.teacherId &&
    conflict.teacherId &&
    String(conflict.teacherId) === String(payload.teacherId)
  ) {
    return `${payload.teacherName || "The selected teacher"} already has another class on ${payload.dayOfWeek} from ${conflict.startTime} to ${conflict.endTime}.`;
  }

  if (
    payload.room &&
    cleanText(conflict.room).toLowerCase() ===
      cleanText(payload.room).toLowerCase()
  ) {
    return `${payload.room} is already booked on ${payload.dayOfWeek} from ${conflict.startTime} to ${conflict.endTime}.`;
  }

  return `Class ${payload.className}, Section ${payload.section} already has a timetable entry on ${payload.dayOfWeek} from ${conflict.startTime} to ${conflict.endTime}.`;
};

/* =====================================================
   STUDENT TIMETABLE RESOLUTION
===================================================== */

const getStudentTimetable = async (student, req) => {
  const referenceDate =
    parseDateOrNull(req.query.date) || new Date();

  const stream =
    Number(student.className) >= 11
      ? normalizeStream(student.stream) || "General"
      : "General";

  const filter = buildBaseListFilter({
    schoolId: getSchoolId(student),
    className: student.className,
    section: student.section,
    stream,
    academicYear:
      cleanText(req.query.academicYear) ||
      cleanText(student.academicYear),
    dayOfWeek: cleanText(req.query.dayOfWeek || req.query.day),
    activeOnly: true,
    currentOnly: req.query.currentOnly !== "false",
    referenceDate,
  });

  let entries = await populateTimetable(
    Timetable.find(filter).sort({
      dayOrder: 1,
      startTime: 1,
      periodNumber: 1,
    })
  );

  const exactSubjectIds = (student.subjectIds || [])
    .map((value) => String(value?._id || value))
    .filter(Boolean);

  if (exactSubjectIds.length > 0) {
    entries = entries.filter((entry) => {
      if (!periodNeedsSubjectAndTeacher(entry.classType)) {
        return true;
      }

      const entrySubjectId = String(
        entry.subjectId?._id || entry.subjectId || ""
      );

      return exactSubjectIds.includes(entrySubjectId);
    });
  }

  return entries;
};

/* =====================================================
   CREATE ROUTES
===================================================== */

const createTimetableHandler = async (req, res) => {
  try {
    const payload = await buildTimetablePayload(
      req.body,
      req.user
    );

    const conflicts = await findConflicts(payload);
    const message = conflictMessage(conflicts, payload);

    if (message) {
      return res.status(409).json({
        success: false,
        message,
        conflicts,
      });
    }

    const entry = await Timetable.create({
      ...payload,
      createdBy: req.user._id,
    });

    const populated = await populateTimetable(
      Timetable.findById(entry._id)
    );

    return res.status(201).json({
      success: true,
      message: "Timetable entry created successfully",
      timetable: populated,
      entry: populated,
      data: populated,
    });
  } catch (error) {
    console.error("Create timetable error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to create timetable entry",
    });
  }
};

router.post(
  "/create",
  protect,
  adminOnly,
  createTimetableHandler
);

router.post(
  "/",
  protect,
  adminOnly,
  createTimetableHandler
);

router.post(
  "/bulk",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const items = Array.isArray(req.body)
        ? req.body
        : Array.isArray(req.body?.entries)
        ? req.body.entries
        : Array.isArray(req.body?.timetable)
        ? req.body.timetable
        : [];

      if (items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one timetable entry is required",
        });
      }

      const created = [];
      const failed = [];

      for (let index = 0; index < items.length; index += 1) {
        try {
          const payload = await buildTimetablePayload(
            items[index],
            req.user
          );

          const conflicts = await findConflicts(payload);
          const message = conflictMessage(conflicts, payload);

          if (message) {
            failed.push({
              index,
              message,
            });
            continue;
          }

          const entry = await Timetable.create({
            ...payload,
            createdBy: req.user._id,
          });

          created.push(entry);
        } catch (error) {
          failed.push({
            index,
            message: error.message,
          });
        }
      }

      const populatedCreated = await populateTimetable(
        Timetable.find({
          _id: {
            $in: created.map((entry) => entry._id),
          },
        }).sort({
          dayOrder: 1,
          startTime: 1,
        })
      );

      return res.status(201).json({
        success: true,
        message: `${populatedCreated.length} timetable entr${
          populatedCreated.length === 1 ? "y" : "ies"
        } created; ${failed.length} failed.`,
        created: populatedCreated,
        failed,
        timetable: populatedCreated,
        data: populatedCreated,
      });
    } catch (error) {
      console.error("Bulk timetable error:", error);

      return res.status(500).json({
        success: false,
        message:
          error.message || "Failed to create timetable entries",
      });
    }
  }
);

/* =====================================================
   READ ROUTES
===================================================== */

router.get(
  "/student/:studentId",
  protect,
  async (req, res) => {
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
          message: "Students can only view their own timetable",
        });
      }

      const student = await User.findById(studentId).select(
        "name role schoolId className section stream academicYear subjectIds"
      );

      if (!student || student.role !== "student") {
        return res.status(404).json({
          message: "Student not found",
        });
      }

      if (
        String(getSchoolId(student)) !==
        String(getSchoolId(req.user))
      ) {
        return res.status(403).json({
          message: "You cannot view a timetable from another school",
        });
      }

      const entries = await getStudentTimetable(student, req);

      return res.json(
        timetableResponse(entries, {
          student: {
            id: student._id,
            name: student.name,
            className: student.className,
            section: student.section,
            stream: student.stream,
            academicYear: student.academicYear,
          },
        })
      );
    } catch (error) {
      console.error("Get student timetable error:", error);

      return res.status(500).json({
        message:
          error.message || "Failed to load student timetable",
      });
    }
  }
);

router.get(
  "/teacher/:teacherId",
  protect,
  async (req, res) => {
    try {
      const teacherId = cleanText(req.params.teacherId);

      if (!isValidObjectId(teacherId)) {
        return res.status(400).json({
          message: "Invalid teacher ID",
        });
      }

      if (
        req.user.role === "teacher" &&
        String(req.user._id) !== String(teacherId)
      ) {
        return res.status(403).json({
          message: "Teachers can only view their own timetable",
        });
      }

      const teacher = await User.findById(teacherId).select(
        "name role schoolId"
      );

      if (!teacher || teacher.role !== "teacher") {
        return res.status(404).json({
          message: "Teacher not found",
        });
      }

      if (
        String(getSchoolId(teacher)) !==
        String(getSchoolId(req.user))
      ) {
        return res.status(403).json({
          message: "You cannot view a timetable from another school",
        });
      }

      const referenceDate =
        parseDateOrNull(req.query.date) || new Date();

      const filter = buildBaseListFilter({
        schoolId: getSchoolId(req.user),
        teacherId,
        academicYear: cleanText(req.query.academicYear),
        dayOfWeek: cleanText(req.query.dayOfWeek || req.query.day),
        activeOnly: req.query.includeInactive !== "true",
        currentOnly: req.query.currentOnly !== "false",
        referenceDate,
      });

      const entries = await populateTimetable(
        Timetable.find(filter).sort({
          dayOrder: 1,
          startTime: 1,
          periodNumber: 1,
        })
      );

      return res.json(
        timetableResponse(entries, {
          teacher: {
            id: teacher._id,
            name: teacher.name,
          },
        })
      );
    } catch (error) {
      console.error("Get teacher timetable error:", error);

      return res.status(500).json({
        message:
          error.message || "Failed to load teacher timetable",
      });
    }
  }
);

router.get(
  "/class/:className",
  protect,
  async (req, res) => {
    try {
      const parsed = parseClassParameter(
        req.params.className,
        req.query.section
      );

      let { className, section } = parsed;

      if (!className) {
        return res.status(400).json({
          message: "Class name is required",
        });
      }

      let stream = normalizeStream(req.query.stream);

      if (req.user.role === "student") {
        if (
          cleanText(req.user.className) !== cleanText(className) ||
          (
            section &&
            cleanText(req.user.section).toLowerCase() !==
              cleanText(section).toLowerCase()
          )
        ) {
          return res.status(403).json({
            message: "Students can only view their own class timetable",
          });
        }

        section = req.user.section;
        stream =
          Number(req.user.className) >= 11
            ? normalizeStream(req.user.stream) || "General"
            : "General";
      }

      if (req.user.role === "teacher") {
        const assigned = (req.user.assignedClasses || []).some(
          (assignment) =>
            cleanText(assignment.className) === cleanText(className) &&
            (
              !section ||
              cleanText(assignment.section).toLowerCase() ===
                cleanText(section).toLowerCase()
            )
        );

        if (!assigned) {
          return res.status(403).json({
            message: "You are not assigned to this class",
          });
        }
      }

      const referenceDate =
        parseDateOrNull(req.query.date) || new Date();

      const filter = buildBaseListFilter({
        schoolId: getSchoolId(req.user),
        className,
        section,
        stream,
        academicYear: cleanText(req.query.academicYear),
        dayOfWeek: cleanText(req.query.dayOfWeek || req.query.day),
        activeOnly: req.query.includeInactive !== "true",
        currentOnly: req.query.currentOnly !== "false",
        referenceDate,
      });

      let entries = await populateTimetable(
        Timetable.find(filter).sort({
          dayOrder: 1,
          startTime: 1,
          periodNumber: 1,
        })
      );

      if (
        req.user.role === "student" &&
        Array.isArray(req.user.subjectIds) &&
        req.user.subjectIds.length > 0
      ) {
        const allowedIds = req.user.subjectIds.map((value) =>
          String(value?._id || value)
        );

        entries = entries.filter((entry) => {
          if (!periodNeedsSubjectAndTeacher(entry.classType)) {
            return true;
          }

          return allowedIds.includes(
            String(entry.subjectId?._id || entry.subjectId || "")
          );
        });
      }

      return res.json(
        timetableResponse(entries, {
          className,
          section,
          stream,
        })
      );
    } catch (error) {
      console.error("Get class timetable error:", error);

      return res.status(500).json({
        message:
          error.message || "Failed to load class timetable",
      });
    }
  }
);

router.get(
  "/",
  protect,
  async (req, res) => {
    try {
      /*
        This fallback is important because the current frontend
        eventually requests /timetable?className=...&section=...
        when earlier timetable URLs return no records.
      */
      if (req.user.role === "student") {
        const student = await User.findById(req.user._id).select(
          "name role schoolId className section stream academicYear subjectIds"
        );

        const entries = await getStudentTimetable(student, req);

        return res.json(
          timetableResponse(entries, {
            student: {
              id: student._id,
              name: student.name,
              className: student.className,
              section: student.section,
              stream: student.stream,
            },
          })
        );
      }

      const referenceDate =
        parseDateOrNull(req.query.date) || new Date();

      const className = cleanText(
        req.query.className || req.query.class
      );

      const section = cleanText(req.query.section);
      const stream = normalizeStream(req.query.stream);
      const teacherId =
        req.user.role === "teacher"
          ? req.user._id
          : cleanText(req.query.teacherId);

      const filter = buildBaseListFilter({
        schoolId: getSchoolId(req.user),
        className,
        section,
        stream,
        academicYear: cleanText(req.query.academicYear),
        dayOfWeek: cleanText(req.query.dayOfWeek || req.query.day),
        teacherId,
        subjectId: cleanText(req.query.subjectId),
        activeOnly: req.query.includeInactive !== "true",
        currentOnly: req.query.currentOnly !== "false",
        referenceDate,
      });

      const entries = await populateTimetable(
        Timetable.find(filter).sort({
          className: 1,
          section: 1,
          dayOrder: 1,
          startTime: 1,
          periodNumber: 1,
        })
      );

      return res.json(timetableResponse(entries));
    } catch (error) {
      console.error("Get timetable error:", error);

      return res.status(500).json({
        message:
          error.message || "Failed to load timetable",
      });
    }
  }
);

router.get(
  "/entry/:id",
  protect,
  async (req, res) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid timetable ID",
        });
      }

      const entry = await populateTimetable(
        Timetable.findById(req.params.id)
      );

      if (!entry) {
        return res.status(404).json({
          message: "Timetable entry not found",
        });
      }

      if (
        String(entry.schoolId) !== String(getSchoolId(req.user))
      ) {
        return res.status(403).json({
          message: "You cannot view a timetable entry from another school",
        });
      }

      return res.json({
        success: true,
        timetable: entry,
        entry,
        data: entry,
      });
    } catch (error) {
      console.error("Get timetable entry error:", error);

      return res.status(500).json({
        message:
          error.message || "Failed to load timetable entry",
      });
    }
  }
);

/* =====================================================
   UPDATE AND DELETE ROUTES
===================================================== */

const updateTimetableHandler = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid timetable ID",
      });
    }

    const entry = await Timetable.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        message: "Timetable entry not found",
      });
    }

    if (
      String(entry.schoolId) !== String(getSchoolId(req.user))
    ) {
      return res.status(403).json({
        message: "You cannot update a timetable entry from another school",
      });
    }

    const payload = await buildTimetablePayload(
      req.body,
      req.user,
      entry
    );

    const conflicts = await findConflicts(
      payload,
      entry._id
    );

    const message = conflictMessage(conflicts, payload);

    if (message) {
      return res.status(409).json({
        success: false,
        message,
        conflicts,
      });
    }

    Object.assign(entry, payload);
    await entry.save();

    const populated = await populateTimetable(
      Timetable.findById(entry._id)
    );

    return res.json({
      success: true,
      message: "Timetable entry updated successfully",
      timetable: populated,
      entry: populated,
      data: populated,
    });
  } catch (error) {
    console.error("Update timetable error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.message || "Failed to update timetable entry",
    });
  }
};

router.put(
  "/:id",
  protect,
  adminOnly,
  updateTimetableHandler
);

router.patch(
  "/:id",
  protect,
  adminOnly,
  updateTimetableHandler
);

router.delete(
  "/:id",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid timetable ID",
        });
      }

      const entry = await Timetable.findById(req.params.id);

      if (!entry) {
        return res.status(404).json({
          message: "Timetable entry not found",
        });
      }

      if (
        String(entry.schoolId) !== String(getSchoolId(req.user))
      ) {
        return res.status(403).json({
          message: "You cannot delete a timetable entry from another school",
        });
      }

      if (req.query.permanent === "true") {
        await Timetable.findByIdAndDelete(entry._id);

        return res.json({
          success: true,
          message: "Timetable entry permanently deleted",
        });
      }

      entry.isActive = false;
      entry.updatedBy = req.user._id;
      await entry.save();

      return res.json({
        success: true,
        message: "Timetable entry deactivated successfully",
        timetable: entry,
        data: entry,
      });
    } catch (error) {
      console.error("Delete timetable error:", error);

      return res.status(500).json({
        message:
          error.message || "Failed to delete timetable entry",
      });
    }
  }
);

export default router;
