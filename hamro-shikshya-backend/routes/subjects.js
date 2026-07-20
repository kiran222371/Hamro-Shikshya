import express from "express";
import mongoose from "mongoose";
import Subject from "../models/Subject.js";
import User from "../models/User.js";

const router = express.Router();

/* =====================================================
   HELPERS
===================================================== */

const cleanText = (value) =>
  String(value ?? "").trim();

const escapeRegExp = (value) =>
  String(value ?? "").replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

const exactText = (value) => ({
  $regex: `^${escapeRegExp(value)}$`,
  $options: "i",
});

const isValidObjectId = (value) =>
  Boolean(value) &&
  mongoose.Types.ObjectId.isValid(
    String(value)
  );

const toNumberOrNull = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
};

const parseBoolean = (
  value,
  fallback = true
) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = cleanText(
    value
  ).toLowerCase();

  if (
    ["true", "1", "yes", "active"].includes(
      normalized
    )
  ) {
    return true;
  }

  if (
    [
      "false",
      "0",
      "no",
      "inactive",
      "deactivated",
    ].includes(normalized)
  ) {
    return false;
  }

  return fallback;
};

const parseArrayValue = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    try {
      const parsed = JSON.parse(trimmed);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to comma-separated parsing.
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [value];
};

const cleanStringArray = (values) => {
  return [
    ...new Set(
      parseArrayValue(values)
        .map((value) => cleanText(value))
        .filter(Boolean)
    ),
  ];
};

const cleanObjectIdArray = (values) => {
  const usedIds = new Set();

  return parseArrayValue(values)
    .map((value) => {
      if (value && typeof value === "object") {
        return (
          value._id ||
          value.id ||
          value.value ||
          ""
        );
      }

      return value;
    })
    .map((value) => cleanText(value))
    .filter((value) => {
      if (
        !isValidObjectId(value) ||
        usedIds.has(value)
      ) {
        return false;
      }

      usedIds.add(value);
      return true;
    });
};

const getEducationLevel = (className) => {
  const classNumber = Number(className);

  if (classNumber >= 1 && classNumber <= 8) {
    return "Basic";
  }

  if (classNumber >= 9 && classNumber <= 10) {
    return "Secondary";
  }

  if (classNumber >= 11 && classNumber <= 12) {
    return "Higher Secondary";
  }

  return "General";
};

const normalizeSubjectType = (value) => {
  const normalized = cleanText(
    value
  ).toLowerCase();

  const typeMap = {
    compulsory: "Compulsory",
    core: "Compulsory",
    optional: "Optional",
    elective: "Optional",
    practical: "Practical",
    local: "Local Curriculum",
    "local curriculum": "Local Curriculum",
    technical: "Technical/Vocational",
    vocational: "Technical/Vocational",
    "technical/vocational":
      "Technical/Vocational",
  };

  return typeMap[normalized] || "Compulsory";
};

const getSchoolIdValue = (value) => {
  if (value && typeof value === "object") {
    return cleanText(
      value._id ||
        value.id ||
        value.schoolId
    );
  }

  return cleanText(value);
};

const normalizeStream = (value) => {
  const cleanValue = cleanText(value);

  if (!cleanValue) {
    return "";
  }

  const normalized = cleanValue
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
    cleanValue
      .split(/\s+/)
      .map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1).toLowerCase()
      )
      .join(" ")
  );
};

const isGeneralStream = (value) =>
  ["", "general", "common", "all"].includes(
    cleanText(value).toLowerCase()
  );

const addAndCondition = (filter, condition) => {
  filter.$and = [
    ...(filter.$and || []),
    condition,
  ];
};

const getSubjectId = (subject) =>
  cleanText(subject?._id || subject?.id);

const getSubjectName = (subject) =>
  cleanText(
    subject?.name || subject?.subjectName
  ).toLowerCase();

const getSubjectStream = (subject) =>
  normalizeStream(subject?.stream);

const deduplicateSubjects = (
  subjects,
  exactSubjectIds = [],
  studentStream = ""
) => {
  const exactIds = new Set(
    cleanObjectIdArray(exactSubjectIds)
  );

  const normalizedStudentStream =
    normalizeStream(studentStream);

  const priority = (subject) => {
    const subjectId = getSubjectId(subject);
    const subjectStream =
      getSubjectStream(subject);

    if (exactIds.has(subjectId)) {
      return 4;
    }

    if (
      normalizedStudentStream &&
      subjectStream.toLowerCase() ===
        normalizedStudentStream.toLowerCase()
    ) {
      return 3;
    }

    if (isGeneralStream(subjectStream)) {
      return 2;
    }

    return 1;
  };

  const subjectMap = new Map();

  subjects.forEach((subject) => {
    const key =
      getSubjectName(subject) ||
      getSubjectId(subject);

    if (!key) {
      return;
    }

    const existing =
      subjectMap.get(key);

    if (
      !existing ||
      priority(subject) >
        priority(existing)
    ) {
      subjectMap.set(key, subject);
    }
  });

  return [...subjectMap.values()].sort(
    (a, b) => {
      const orderDifference =
        Number(a?.sortOrder || 0) -
        Number(b?.sortOrder || 0);

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return cleanText(
        a?.name || a?.subjectName
      ).localeCompare(
        cleanText(
          b?.name || b?.subjectName
        )
      );
    }
  );
};

const buildSubjectPayload = (
  body = {},
  existingSubject = null
) => {
  const existing =
    existingSubject?.toObject?.() ||
    existingSubject ||
    {};

  const name = cleanText(
    body.name ??
      body.subjectName ??
      existing.name ??
      existing.subjectName
  ).replace(/\s+/g, " ");

  const subjectCode = cleanText(
    body.subjectCode ??
      body.code ??
      existing.subjectCode ??
      existing.code
  ).toUpperCase();

  const className = cleanText(
    body.className ??
      body.class ??
      existing.className
  );

  const rawSections =
    body.sections !== undefined
      ? body.sections
      : body.section !== undefined
      ? [body.section]
      : existing.sections?.length
      ? existing.sections
      : [existing.section || "All"];

  let sections = cleanStringArray(rawSections);

  if (sections.length === 0) {
    sections = ["All"];
  }

  if (
    sections.some(
      (section) =>
        section.toLowerCase() === "all"
    )
  ) {
    sections = ["All"];
  }

  const stream =
    cleanText(
      body.stream ?? existing.stream
    ) || "General";

  const teacherIds =
    body.teacherIds !== undefined ||
    body.teacherId !== undefined
      ? cleanObjectIdArray([
          ...parseArrayValue(body.teacherIds),
          ...(body.teacherId
            ? [body.teacherId]
            : []),
        ])
      : cleanObjectIdArray([
          ...(existing.teacherIds || []),
          ...(existing.teacherId
            ? [existing.teacherId]
            : []),
        ]);

  const schoolId = getSchoolIdValue(
    body.schoolId ?? existing.schoolId
  );

  return {
    name,
    subjectName: name,
    subjectCode,
    code: subjectCode,
    className,
    section: sections[0] || "All",
    sections,
    stream,
    type: normalizeSubjectType(
      body.type ?? existing.type
    ),
    educationLevel:
      cleanText(
        body.educationLevel ??
          existing.educationLevel
      ) || getEducationLevel(className),
    curriculumBoard:
      cleanText(
        body.curriculumBoard ??
          existing.curriculumBoard
      ) || "Nepal Curriculum / NEB",
    curriculumVersion: cleanText(
      body.curriculumVersion ??
        existing.curriculumVersion
    ),
    academicYear: cleanText(
      body.academicYear ??
        existing.academicYear
    ),
    fullMarks: toNumberOrNull(
      body.fullMarks !== undefined
        ? body.fullMarks
        : existing.fullMarks
    ),
    passMarks: toNumberOrNull(
      body.passMarks !== undefined
        ? body.passMarks
        : existing.passMarks
    ),
    creditHours: toNumberOrNull(
      body.creditHours !== undefined
        ? body.creditHours
        : existing.creditHours
    ),
    teacherId: teacherIds[0] || null,
    teacherIds,
    schoolId,
    description: cleanText(
      body.description ?? existing.description
    ),
    sortOrder:
      Number(
        body.sortOrder ??
          existing.sortOrder ??
          0
      ) || 0,
    isActive: parseBoolean(
      body.isActive,
      existing.isActive === undefined
        ? true
        : Boolean(existing.isActive)
    ),
  };
};

const validateSubjectPayload = (payload) => {
  if (!payload.name) {
    return "Subject name is required.";
  }

  if (!payload.className) {
    return "Class is required.";
  }

  if (
    !payload.schoolId ||
    !isValidObjectId(payload.schoolId)
  ) {
    return "A valid schoolId is required.";
  }

  if (
    payload.fullMarks !== null &&
    payload.fullMarks < 0
  ) {
    return "Full marks cannot be negative.";
  }

  if (
    payload.passMarks !== null &&
    payload.passMarks < 0
  ) {
    return "Pass marks cannot be negative.";
  }

  if (
    payload.fullMarks !== null &&
    payload.passMarks !== null &&
    payload.passMarks > payload.fullMarks
  ) {
    return "Pass marks cannot be greater than full marks.";
  }

  return "";
};

const buildDuplicateFilter = (
  payload,
  excludedId = ""
) => {
  const sections =
    payload.sections?.length
      ? payload.sections
      : [payload.section || "All"];

  const filter = {
    schoolId: payload.schoolId,
    className: exactText(payload.className),
    stream: exactText(
      payload.stream || "General"
    ),
    academicYear: exactText(
      payload.academicYear || ""
    ),
    $and: [
      {
        $or: [
          { name: exactText(payload.name) },
          {
            subjectName: exactText(
              payload.name
            ),
          },
          ...(payload.subjectCode
            ? [
                {
                  subjectCode: exactText(
                    payload.subjectCode
                  ),
                },
                {
                  code: exactText(
                    payload.subjectCode
                  ),
                },
              ]
            : []),
        ],
      },
      {
        $or: [
          { section: { $in: sections } },
          { sections: { $in: sections } },
          { section: exactText("All") },
          { sections: exactText("All") },
        ],
      },
    ],
  };

  if (excludedId) {
    filter._id = { $ne: excludedId };
  }

  return filter;
};

const populateSubject = (query) => {
  return query
    .populate(
      "teacherId",
      "name email assignedClasses subjects"
    )
    .populate(
      "teacherIds",
      "name email assignedClasses subjects"
    )
    .populate(
      "schoolId",
      "schoolName name"
    );
};

const makeInternalTemplateCode = (
  subjectName,
  className,
  stream
) => {
  const abbreviation = subjectName
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 3))
    .join("-")
    .slice(0, 24);

  const streamCode =
    cleanText(stream)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) || "GEN";

  return [
    abbreviation || "SUB",
    className || "GEN",
    streamCode,
  ].join("-");
};

/* =====================================================
   NEPAL-FOCUSED STARTER TEMPLATES
===================================================== */

/*
  These are editable school-setup templates. Generated
  codes are internal application codes, not guaranteed
  official NEB/CDC subject codes.
*/
const NEPAL_SUBJECT_TEMPLATES = {
  /*
    These common subjects are safe to show when a school has
    not yet assigned a Class 11/12 stream. The API deliberately
    does not merge every stream together because that would show
    Law, Management and Humanities subjects to a Science student.
  */
  higherSecondaryCommon: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Social Studies and Life Skills", "Compulsory"],
  ],

  basic: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Mathematics", "Compulsory"],
    ["Science and Technology", "Compulsory"],
    ["Social Studies and Human Values", "Compulsory"],
    ["Health and Physical Education", "Compulsory"],
    ["Computer / Local Subject", "Local Curriculum"],
  ],

  secondary: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Mathematics", "Compulsory"],
    ["Science and Technology", "Compulsory"],
    ["Social Studies", "Compulsory"],
    ["Health, Population and Environment", "Compulsory"],
    ["Computer Science", "Optional"],
    ["Optional Mathematics", "Optional"],
    ["Accountancy", "Optional"],
    ["Economics", "Optional"],
  ],

  science: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Social Studies and Life Skills", "Compulsory"],
    ["Mathematics", "Optional"],
    ["Physics", "Optional"],
    ["Chemistry", "Optional"],
    ["Biology", "Optional"],
    ["Computer Science", "Optional"],
  ],

  management: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Social Studies and Life Skills", "Compulsory"],
    ["Accountancy", "Optional"],
    ["Economics", "Optional"],
    ["Business Studies", "Optional"],
    ["Marketing", "Optional"],
    ["Finance", "Optional"],
    ["Hotel Management", "Optional"],
    ["Computer Science", "Optional"],
  ],

  humanities: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Social Studies and Life Skills", "Compulsory"],
    ["Sociology", "Optional"],
    ["Mass Communication", "Optional"],
    ["Rural Development", "Optional"],
    ["Psychology", "Optional"],
    ["Population Studies", "Optional"],
    ["Economics", "Optional"],
  ],

  education: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Social Studies and Life Skills", "Compulsory"],
    ["Education and Development", "Optional"],
    ["Instructional Pedagogy", "Optional"],
    ["Child Development and Learning", "Optional"],
    ["Nepali Education", "Optional"],
    ["English Education", "Optional"],
  ],

  law: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Social Studies and Life Skills", "Compulsory"],
    ["Legal Studies", "Optional"],
    ["Constitutional Law", "Optional"],
    ["Civil and Criminal Law", "Optional"],
    ["Human Rights", "Optional"],
  ],

  technical: [
    ["English", "Compulsory"],
    ["Nepali", "Compulsory"],
    ["Mathematics", "Compulsory"],
    ["Science", "Compulsory"],
    ["Technical Foundation", "Technical/Vocational"],
    ["Practical / Workshop", "Technical/Vocational"],
  ],
};

const getTemplateSubjects = (
  className,
  stream = "General"
) => {
  const classNumber = Number(className);
  const normalizedStream = cleanText(
    stream
  ).toLowerCase();

  if (classNumber >= 1 && classNumber <= 8) {
    return NEPAL_SUBJECT_TEMPLATES.basic;
  }

  if (classNumber >= 9 && classNumber <= 10) {
    return NEPAL_SUBJECT_TEMPLATES.secondary;
  }

  if (classNumber >= 11 && classNumber <= 12) {
    if (normalizedStream.includes("science")) {
      return NEPAL_SUBJECT_TEMPLATES.science;
    }

    if (normalizedStream.includes("management")) {
      return NEPAL_SUBJECT_TEMPLATES.management;
    }

    if (normalizedStream.includes("humanities")) {
      return NEPAL_SUBJECT_TEMPLATES.humanities;
    }

    if (normalizedStream.includes("education")) {
      return NEPAL_SUBJECT_TEMPLATES.education;
    }

    if (normalizedStream.includes("law")) {
      return NEPAL_SUBJECT_TEMPLATES.law;
    }

    if (normalizedStream.includes("technical")) {
      return NEPAL_SUBJECT_TEMPLATES.technical;
    }

    /*
      A missing or General Class 11/12 stream must never return
      a union of every stream. Returning only common subjects is
      safer until the admin sets Science, Management, Humanities,
      Education, Law or Technical on the student/class.
    */
    return NEPAL_SUBJECT_TEMPLATES.higherSecondaryCommon;
  }

  return [];
};

/* =====================================================
   QUERY BUILDERS
===================================================== */

const buildSubjectFilter = (req) => {
  const filter = {};

  const schoolId =
    req.params.schoolId ||
    req.query.schoolId ||
    "";

  const className = cleanText(
    req.query.className || req.query.class
  );

  const section = cleanText(
    req.query.section
  );

  const stream = cleanText(req.query.stream);
  const type = cleanText(req.query.type);
  const academicYear = cleanText(
    req.query.academicYear
  );
  const teacherId = cleanText(
    req.query.teacherId
  );
  const search = cleanText(
    req.query.search || req.query.q
  );

  if (isValidObjectId(schoolId)) {
    filter.schoolId = schoolId;
  }

  if (className) {
    filter.className = exactText(className);
  }

  if (section) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { section: exactText(section) },
          { sections: exactText(section) },
          { section: exactText("All") },
          { sections: exactText("All") },
        ],
      },
    ];
  }

  if (stream) {
    filter.stream = exactText(stream);
  }

  if (type) {
    filter.type = exactText(type);
  }

  if (academicYear) {
    filter.academicYear = exactText(
      academicYear
    );
  }

  if (teacherId) {
    if (!isValidObjectId(teacherId)) {
      filter._id = null;
    } else {
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { teacherId },
            { teacherIds: teacherId },
          ],
        },
      ];
    }
  }

  if (
    req.query.activeOnly === "true" ||
    req.query.isActive === "true"
  ) {
    filter.isActive = true;
  } else if (req.query.isActive === "false") {
    filter.isActive = false;
  }

  if (search) {
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          {
            name: {
              $regex: escapeRegExp(search),
              $options: "i",
            },
          },
          {
            subjectName: {
              $regex: escapeRegExp(search),
              $options: "i",
            },
          },
          {
            subjectCode: {
              $regex: escapeRegExp(search),
              $options: "i",
            },
          },
        ],
      },
    ];
  }

  return filter;
};

/* =====================================================
   CREATE HELPERS
===================================================== */

const createOneSubject = async (
  body,
  options = {}
) => {
  const payload = buildSubjectPayload(body);
  const validationMessage =
    validateSubjectPayload(payload);

  if (validationMessage) {
    const error = new Error(validationMessage);
    error.statusCode = 400;
    throw error;
  }

  const duplicate = await Subject.findOne(
    buildDuplicateFilter(payload)
  );

  if (duplicate) {
    if (options.skipDuplicate) {
      return {
        status: "skipped",
        reason: "Matching subject already exists.",
        subject: duplicate,
      };
    }

    const error = new Error(
      "A matching subject already exists for this school, class, stream, academic year and section."
    );
    error.statusCode = 409;
    throw error;
  }

  const subject = await Subject.create(payload);
  const populated = await populateSubject(
    Subject.findById(subject._id)
  );

  return {
    status: "created",
    subject: populated,
  };
};

/* =====================================================
   ROUTE HANDLERS
===================================================== */

const createSubjectHandler = async (req, res) => {
  try {
    const result = await createOneSubject(req.body);

    return res.status(201).json({
      success: true,
      message: "Subject created successfully.",
      subject: result.subject,
      data: result.subject,
    });
  } catch (error) {
    console.error("Create subject error:", error);

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Failed to create subject.",
      });
  }
};

const bulkCreateSubjectsHandler = async (
  req,
  res
) => {
  try {
    const subjects = Array.isArray(req.body)
      ? req.body
      : parseArrayValue(req.body?.subjects);

    if (subjects.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one subject is required.",
      });
    }

    const sharedSchoolId = getSchoolIdValue(
      req.body?.schoolId
    );
    const sharedClassName = cleanText(
      req.body?.className || req.body?.class
    );
    const sharedSection = cleanText(
      req.body?.section
    );
    const sharedSections = req.body?.sections;
    const sharedStream = cleanText(
      req.body?.stream
    );
    const sharedAcademicYear = cleanText(
      req.body?.academicYear
    );

    const created = [];
    const skipped = [];
    const failed = [];

    for (
      let index = 0;
      index < subjects.length;
      index += 1
    ) {
      const subject = subjects[index];
      const subjectBody = {
        ...subject,
        schoolId:
          subject.schoolId || sharedSchoolId,
        className:
          subject.className ||
          subject.class ||
          sharedClassName,
        section:
          subject.section ||
          sharedSection ||
          "All",
        sections:
          subject.sections || sharedSections,
        stream:
          subject.stream ||
          sharedStream ||
          "General",
        academicYear:
          subject.academicYear ||
          sharedAcademicYear,
      };

      try {
        const result = await createOneSubject(
          subjectBody,
          { skipDuplicate: true }
        );

        if (result.status === "created") {
          created.push(result.subject);
        } else {
          skipped.push({
            index,
            name:
              subjectBody.name ||
              subjectBody.subjectName ||
              "Subject",
            reason: result.reason,
            existingSubject: result.subject,
          });
        }
      } catch (error) {
        failed.push({
          index,
          name:
            subjectBody.name ||
            subjectBody.subjectName ||
            "Subject",
          message: error.message,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${created.length} subject(s) created, ${skipped.length} skipped, ${failed.length} failed.`,
      created,
      skipped,
      failed,
      subjects: created,
      data: created,
    });
  } catch (error) {
    console.error(
      "Bulk create subjects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create subjects.",
    });
  }
};

const getSubjectsHandler = async (req, res) => {
  try {
    const filter = buildSubjectFilter(req);

    const subjects = await populateSubject(
      Subject.find(filter)
    ).sort({
      className: 1,
      stream: 1,
      sortOrder: 1,
      name: 1,
    });

    return res.json({
      success: true,
      count: subjects.length,
      subjects,
      data: subjects,
    });
  } catch (error) {
    console.error("Get subjects error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load subjects.",
    });
  }
};

const getTeacherSubjectsHandler = async (
  req,
  res
) => {
  try {
    const teacherId = cleanText(
      req.params.teacherId
    );

    if (!isValidObjectId(teacherId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher ID.",
      });
    }

    const teacher = await User.findById(
      teacherId
    ).select(
      "schoolId assignedClasses subjects teacherSubjectIds role"
    );

    if (!teacher || teacher.role !== "teacher") {
      return res.status(404).json({
        success: false,
        message: "Teacher not found.",
      });
    }

    const className = cleanText(
      req.query.className
    );
    const section = cleanText(req.query.section);

    const filter = {
      schoolId: teacher.schoolId,
      isActive: true,
      $or: [
        { teacherId },
        { teacherIds: teacherId },
      ],
    };

    if (className) {
      filter.className = exactText(className);
    }

    if (section) {
      filter.$and = [
        {
          $or: [
            { section: exactText(section) },
            { sections: exactText(section) },
            { section: exactText("All") },
            { sections: exactText("All") },
          ],
        },
      ];
    }

    let subjects = await populateSubject(
      Subject.find(filter)
    ).sort({ sortOrder: 1, name: 1 });

    /*
      Compatibility fallback for older teacher records that
      contain subject names but no Subject.teacherIds link.
    */
    if (
      subjects.length === 0 &&
      Array.isArray(teacher.subjects) &&
      teacher.subjects.length > 0
    ) {
      const fallbackFilter = {
        schoolId: teacher.schoolId,
        isActive: true,
        $or: [
          {
            name: {
              $in: teacher.subjects.map(
                (name) =>
                  new RegExp(
                    `^${escapeRegExp(name)}$`,
                    "i"
                  )
              ),
            },
          },
          {
            subjectName: {
              $in: teacher.subjects.map(
                (name) =>
                  new RegExp(
                    `^${escapeRegExp(name)}$`,
                    "i"
                  )
              ),
            },
          },
        ],
      };

      if (className) {
        fallbackFilter.className =
          exactText(className);
      }

      subjects = await populateSubject(
        Subject.find(fallbackFilter)
      ).sort({ sortOrder: 1, name: 1 });
    }

    return res.json({
      success: true,
      count: subjects.length,
      subjects,
      data: subjects,
    });
  } catch (error) {
    console.error(
      "Get teacher subjects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to load teacher subjects.",
    });
  }
};

const getStudentSubjectsHandler = async (
  req,
  res
) => {
  try {
    const studentId = cleanText(
      req.params.studentId
    );

    if (!isValidObjectId(studentId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student ID.",
      });
    }

    const student = await User.findById(
      studentId
    ).select(
      "schoolId className section stream academicYear role subjectIds subjectEnrollmentMode"
    );

    if (!student || student.role !== "student") {
      return res.status(404).json({
        success: false,
        message: "Student not found.",
      });
    }

    if (!student.schoolId) {
      return res.status(400).json({
        success: false,
        message:
          "Student school is missing. Ask the administrator to update this account.",
      });
    }

    const className = cleanText(
      student.className
    );

    if (!className) {
      return res.status(400).json({
        success: false,
        message:
          "Student class is missing. Ask the administrator to update this account.",
      });
    }

    const filter = {
      schoolId: student.schoolId,
      className: exactText(className),
      isActive: true,
    };

    const section = cleanText(
      student.section
    );

    if (section) {
      addAndCondition(filter, {
        $or: [
          { section: exactText(section) },
          { sections: exactText(section) },
          { section: exactText("All") },
          { sections: exactText("All") },
        ],
      });
    }

    const academicYear = cleanText(
      student.academicYear
    );

    if (academicYear) {
      addAndCondition(filter, {
        $or: [
          {
            academicYear: exactText(
              academicYear
            ),
          },
          { academicYear: exactText("") },
        ],
      });
    }

    const exactSubjectIds =
      cleanObjectIdArray(
        student.subjectIds
      );

    const studentStream =
      normalizeStream(student.stream);

    const classNumber =
      Number(className);

    let resolutionMode = "general";
    let warning = "";

    /*
      Priority 1: exact student subject enrollment.

      When subjectIds is configured, only those exact Subject
      records are returned. General compulsory subjects are also
      allowed so schools do not need to repeat common subjects in
      every optional-subject selection.
    */
    if (exactSubjectIds.length > 0) {
      addAndCondition(filter, {
        $or: [
          {
            _id: {
              $in: exactSubjectIds.map(
                (id) =>
                  new mongoose.Types.ObjectId(
                    id
                  )
              ),
            },
          },
          {
            $and: [
              {
                stream:
                  exactText("General"),
              },
              {
                type:
                  exactText(
                    "Compulsory"
                  ),
              },
            ],
          },
        ],
      });

      resolutionMode = "individual";
    } else if (
      studentStream &&
      !isGeneralStream(studentStream)
    ) {
      /*
        Priority 2: stream-based enrollment.

        A Science student receives Science + General subjects.
        They cannot receive Law, Management, Humanities,
        Education or Technical subjects.
      */
      addAndCondition(filter, {
        $or: [
          {
            stream:
              exactText(studentStream),
          },
          {
            stream:
              exactText("General"),
          },
        ],
      });

      resolutionMode = "stream";
    } else if (
      classNumber >= 11 &&
      classNumber <= 12
    ) {
      /*
        Safety fallback for Class 11/12.

        Missing stream information must not expose every subject.
        Only General/common subjects are returned until the admin
        sets the student's stream or exact subjectIds.
      */
      addAndCondition(filter, {
        stream: exactText("General"),
      });

      resolutionMode = "missing_stream";
      warning =
        "This Class 11/12 student does not have a stream or exact subject enrollment. Only General subjects are shown until the administrator assigns Science, Management, Humanities, Education, Law, Technical, or individual subjects.";
    } else {
      /*
        Classes 1-10 normally use the General curriculum. Empty
        legacy stream values are accepted for compatibility.
      */
      addAndCondition(filter, {
        $or: [
          {
            stream:
              exactText("General"),
          },
          {
            stream: exactText(""),
          },
        ],
      });

      resolutionMode = "general";
    }

    const foundSubjects =
      await populateSubject(
        Subject.find(filter)
      ).sort({
        sortOrder: 1,
        name: 1,
      });

    const subjects =
      deduplicateSubjects(
        foundSubjects,
        exactSubjectIds,
        studentStream
      );

    return res.json({
      success: true,
      count: subjects.length,
      resolutionMode,
      warning,
      student: {
        id: student._id,
        className: student.className,
        section: student.section,
        stream:
          studentStream ||
          "Not assigned",
        academicYear:
          student.academicYear,
        subjectEnrollmentMode:
          exactSubjectIds.length > 0
            ? "individual"
            : student.subjectEnrollmentMode ||
              "stream",
        assignedSubjectCount:
          exactSubjectIds.length,
      },
      subjects,
      data: subjects,
    });
  } catch (error) {
    console.error(
      "Get student subjects error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to load student subjects.",
    });
  }
};

const updateSubjectHandler = async (req, res) => {
  try {
    const id = cleanText(req.params.id);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject ID.",
      });
    }

    const existingSubject =
      await Subject.findById(id);

    if (!existingSubject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    const payload = buildSubjectPayload(
      req.body,
      existingSubject
    );
    const validationMessage =
      validateSubjectPayload(payload);

    if (validationMessage) {
      return res.status(400).json({
        success: false,
        message: validationMessage,
      });
    }

    const duplicate = await Subject.findOne(
      buildDuplicateFilter(payload, id)
    );

    if (duplicate) {
      return res.status(409).json({
        success: false,
        message:
          "Another matching subject already exists for this school, class, stream, academic year and section.",
      });
    }

    Object.assign(existingSubject, payload);
    await existingSubject.save();

    const populated = await populateSubject(
      Subject.findById(id)
    );

    return res.json({
      success: true,
      message: "Subject updated successfully.",
      subject: populated,
      data: populated,
    });
  } catch (error) {
    console.error("Update subject error:", error);

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to update subject.",
    });
  }
};

const deleteSubjectHandler = async (req, res) => {
  try {
    const id = cleanText(req.params.id);

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subject ID.",
      });
    }

    const permanent =
      req.query.permanent === "true";

    if (permanent) {
      const deletedSubject =
        await Subject.findByIdAndDelete(id);

      if (!deletedSubject) {
        return res.status(404).json({
          success: false,
          message: "Subject not found.",
        });
      }

      return res.json({
        success: true,
        message: "Subject permanently deleted.",
      });
    }

    const subject =
      await Subject.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true, runValidators: true }
      );

    if (!subject) {
      return res.status(404).json({
        success: false,
        message: "Subject not found.",
      });
    }

    return res.json({
      success: true,
      message: "Subject deactivated successfully.",
      subject,
      data: subject,
    });
  } catch (error) {
    console.error("Delete subject error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete subject.",
    });
  }
};

/* =====================================================
   TEMPLATE ROUTE
===================================================== */

router.get("/templates/nepal", (req, res) => {
  const className = cleanText(
    req.query.className
  );
  const section =
    cleanText(req.query.section) || "All";
  const sections = cleanStringArray(
    req.query.sections
  );
  const stream =
    normalizeStream(req.query.stream) ||
    "General";
  const academicYear = cleanText(
    req.query.academicYear
  );
  const curriculumVersion = cleanText(
    req.query.curriculumVersion
  );

  const templateSubjects = getTemplateSubjects(
    className,
    stream
  );

  const subjects = templateSubjects.map(
    ([name, type], index) => {
      const internalCode =
        makeInternalTemplateCode(
          name,
          className,
          stream
        );

      return {
        name,
        subjectName: name,
        subjectCode: internalCode,
        code: internalCode,
        className,
        section: sections[0] || section,
        sections:
          sections.length > 0
            ? sections
            : [section],
        stream,
        type,
        educationLevel:
          getEducationLevel(className),
        curriculumBoard:
          "Nepal Curriculum / NEB",
        curriculumVersion,
        academicYear,
        sortOrder: index + 1,
        isActive: true,
      };
    }
  );

  return res.json({
    success: true,
    note:
      Number(className) >= 11 &&
      Number(className) <= 12 &&
      isGeneralStream(stream)
        ? "A Class 11/12 stream was not selected, so only common subjects are returned. Select Science, Management, Humanities, Education, Law or Technical before importing stream subjects."
        : "These are editable starter templates. Generated subject codes are internal application codes and should be replaced when the school has verified official codes.",
    className,
    section,
    sections:
      sections.length > 0
        ? sections
        : [section],
    stream,
    academicYear,
    subjects,
    data: subjects,
  });
});

/* =====================================================
   ROUTES
===================================================== */

router.post("/bulk", bulkCreateSubjectsHandler);
router.post(
  "/create-many",
  bulkCreateSubjectsHandler
);

router.post("/create", createSubjectHandler);
router.post("/", createSubjectHandler);

router.get(
  "/teacher/:teacherId",
  getTeacherSubjectsHandler
);
router.get(
  "/student/:studentId",
  getStudentSubjectsHandler
);

router.get(
  "/school/:schoolId",
  getSubjectsHandler
);
router.get("/", getSubjectsHandler);

router.put("/:id", updateSubjectHandler);
router.patch("/:id", updateSubjectHandler);
router.delete("/:id", deleteSubjectHandler);

export default router;
