import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Subject from "../models/Subject.js";

const router = express.Router();

const MANAGED_ROLES = ["teacher", "student"];
const ALL_ROLES = ["admin", "teacher", "student"];
const ACCOUNT_STATUSES = ["active", "deactivated"];
const STUDENT_STATUSES = [
  "active",
  "graduated",
  "transferred",
  "dropout",
  "suspended",
];

/* =====================================================
   BASIC HELPERS
===================================================== */

const cleanString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const cleanEmail = (value) =>
  cleanString(value).toLowerCase();

const getSchoolId = (user) => {
  return user?.schoolId?._id || user?.schoolId || "";
};

const isValidObjectId = (id) => {
  return Boolean(id) &&
    mongoose.Types.ObjectId.isValid(String(id));
};

const escapeRegex = (value) => {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
};

const exactText = (value) => ({
  $regex: `^${escapeRegex(cleanString(value))}$`,
  $options: "i",
});

const publicUser = (user) => {
  const data = user?.toObject ? user.toObject() : user;

  if (!data) return data;

  delete data.password;
  delete data.__v;

  return data;
};

const parseMaybeJson = (value, fallback) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  return value;
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
      // Continue with comma-separated parsing.
    }

    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [value];
};

const cleanStringArray = (value) => {
  return [
    ...new Set(
      parseArrayValue(value)
        .map((item) => cleanString(item))
        .filter(Boolean)
    ),
  ];
};

const cleanObjectIdArray = (value) => {
  const usedIds = new Set();

  return parseArrayValue(value)
    .map((item) => {
      if (item && typeof item === "object") {
        return (
          item._id ||
          item.id ||
          item.subjectId ||
          item.value ||
          ""
        );
      }

      return item;
    })
    .map((item) => cleanString(item))
    .filter((item) => {
      if (
        !isValidObjectId(item) ||
        usedIds.has(item)
      ) {
        return false;
      }

      usedIds.add(item);
      return true;
    });
};

const normalizeStream = (value) => {
  const cleanValue = cleanString(value);

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

const normalizeGuardian = (body) => {
  const guardian = parseMaybeJson(
    body.guardian,
    {}
  );

  return {
    name: cleanString(
      guardian?.name || body.guardianName
    ),
    phone: cleanString(
      guardian?.phone || body.guardianPhone
    ),
    email: cleanEmail(
      guardian?.email || body.guardianEmail
    ),
    relation: cleanString(
      guardian?.relation ||
        body.guardianRelation
    ),
  };
};

const subjectAppliesToSection = (
  subject,
  section
) => {
  const targetSection = cleanString(
    section
  ).toLowerCase();

  const sections =
    Array.isArray(subject?.sections) &&
    subject.sections.length > 0
      ? subject.sections
      : [subject?.section || "All"];

  return sections.some((item) => {
    const normalized = cleanString(
      item
    ).toLowerCase();

    return (
      normalized === "all" ||
      normalized === targetSection
    );
  });
};

const subjectAppliesToStream = (
  subject,
  stream,
  className
) => {
  const classNumber = Number(className);

  if (classNumber >= 1 && classNumber <= 10) {
    return true;
  }

  const subjectStream =
    normalizeStream(subject?.stream) ||
    "General";

  const teacherStream =
    normalizeStream(stream) ||
    "General";

  return (
    subjectStream === "General" ||
    subjectStream === teacherStream
  );
};

const populateUserSubjects = (query) => {
  return query
    .populate(
      "subjectIds",
      "name subjectName subjectCode code className section sections stream type isActive"
    )
    .populate(
      "teacherSubjectIds",
      "name subjectName subjectCode code className section sections stream type isActive"
    )
    .populate(
      "assignedClasses.subjectIds",
      "name subjectName subjectCode code className section sections stream type isActive"
    );
};

/* =====================================================
   TEACHER ASSIGNMENT RESOLUTION
===================================================== */

const parseAssignedClasses = (
  assignedClasses,
  fallbackClassName = "",
  fallbackSection = "",
  fallbackStream = ""
) => {
  let parsed = parseMaybeJson(
    assignedClasses,
    []
  );

  if (
    !Array.isArray(parsed) &&
    parsed &&
    typeof parsed === "object"
  ) {
    parsed = [parsed];
  }

  if (!Array.isArray(parsed)) {
    parsed = [];
  }

  let cleaned = parsed
    .map((item) => {
      const className = cleanString(
        item?.className || item?.class
      );

      const section = cleanString(
        item?.section
      );

      const classNumber = Number(
        className
      );

      const stream =
        classNumber >= 11
          ? normalizeStream(
              item?.stream ||
                fallbackStream
            ) || "General"
          : "General";

      return {
        className,
        section,
        stream,
        subjects: cleanStringArray(
          item?.subjects ||
            item?.subjectNames
        ),
        subjectIds: cleanObjectIdArray(
          item?.subjectIds ||
            item?.subjectsIds ||
            item?.teachingSubjectIds
        ),
      };
    })
    .filter(
      (item) =>
        item.className &&
        item.section
    );

  if (
    cleaned.length === 0 &&
    fallbackClassName &&
    fallbackSection
  ) {
    const classNumber = Number(
      fallbackClassName
    );

    cleaned = [
      {
        className: cleanString(
          fallbackClassName
        ),
        section: cleanString(
          fallbackSection
        ),
        stream:
          classNumber >= 11
            ? normalizeStream(
                fallbackStream
              ) || "General"
            : "General",
        subjects: [],
        subjectIds: [],
      },
    ];
  }

  /*
    Merge duplicate rows for the same class, section and
    stream. This allows the admin UI to add subjects in more
    than one step without losing an earlier selection.
  */
  const merged = new Map();

  cleaned.forEach((item) => {
    const key = [
      item.className,
      item.section,
      item.stream,
    ]
      .join("::")
      .toLowerCase();

    if (!merged.has(key)) {
      merged.set(key, {
        ...item,
      });

      return;
    }

    const previous = merged.get(key);

    previous.subjects = [
      ...new Set([
        ...previous.subjects,
        ...item.subjects,
      ]),
    ];

    previous.subjectIds = [
      ...new Set([
        ...previous.subjectIds,
        ...item.subjectIds,
      ]),
    ];
  });

  return Array.from(merged.values());
};

const resolveTeacherAssignments = async ({
  assignedClasses,
  schoolId,
  fallbackClassName = "",
  fallbackSection = "",
  fallbackStream = "",
}) => {
  const parsedAssignments =
    parseAssignedClasses(
      assignedClasses,
      fallbackClassName,
      fallbackSection,
      fallbackStream
    );

  if (parsedAssignments.length === 0) {
    const error = new Error(
      "At least one class and section is required for teacher"
    );

    error.statusCode = 400;
    throw error;
  }

  const resolvedAssignments = [];

  for (const assignment of parsedAssignments) {
    const {
      className,
      section,
      stream,
      subjectIds,
      subjects,
    } = assignment;

    const requestedSubjectIds =
      cleanObjectIdArray(subjectIds);

    const requestedSubjectNames =
      cleanStringArray(subjects);

    if (
      requestedSubjectIds.length === 0 &&
      requestedSubjectNames.length === 0
    ) {
      const error = new Error(
        `Select at least one teaching subject for Class ${className}, Section ${section}.`
      );

      error.statusCode = 400;
      throw error;
    }

    const query = {
      schoolId,
      className: exactText(className),
      isActive: true,
      $and: [
        {
          $or: [
            {
              section: exactText(
                section
              ),
            },
            {
              sections: exactText(
                section
              ),
            },
            {
              section: exactText(
                "All"
              ),
            },
            {
              sections: exactText(
                "All"
              ),
            },
          ],
        },
      ],
    };

    const subjectConditions = [];

    if (requestedSubjectIds.length > 0) {
      subjectConditions.push({
        _id: {
          $in: requestedSubjectIds,
        },
      });
    }

    if (
      requestedSubjectNames.length > 0
    ) {
      const nameRegexes =
        requestedSubjectNames.map(
          (name) =>
            new RegExp(
              `^${escapeRegex(name)}$`,
              "i"
            )
        );

      subjectConditions.push({
        $or: [
          {
            name: {
              $in: nameRegexes,
            },
          },
          {
            subjectName: {
              $in: nameRegexes,
            },
          },
        ],
      });
    }

    query.$and.push({
      $or: subjectConditions,
    });

    const matchingSubjects =
      await Subject.find(query).sort({
        sortOrder: 1,
        name: 1,
      });

    const validSubjects =
      matchingSubjects.filter(
        (subject) =>
          subjectAppliesToSection(
            subject,
            section
          ) &&
          subjectAppliesToStream(
            subject,
            stream,
            className
          )
      );

    const foundIds = new Set(
      validSubjects.map((subject) =>
        String(subject._id)
      )
    );

    const missingIds =
      requestedSubjectIds.filter(
        (id) => !foundIds.has(String(id))
      );

    if (missingIds.length > 0) {
      const error = new Error(
        `One or more selected subjects are not active or do not belong to Class ${className}, Section ${section}, ${stream} stream.`
      );

      error.statusCode = 400;
      throw error;
    }

    if (validSubjects.length === 0) {
      const error = new Error(
        `No valid teaching subject was found for Class ${className}, Section ${section}.`
      );

      error.statusCode = 400;
      throw error;
    }

    resolvedAssignments.push({
      className,
      section,
      stream,
      subjectIds: validSubjects.map(
        (subject) => subject._id
      ),
      subjects: validSubjects.map(
        (subject) =>
          subject.name ||
          subject.subjectName
      ),
    });
  }

  return resolvedAssignments;
};

const getTeacherAssignmentSummary = (
  assignedClasses
) => {
  const subjectIds = [];
  const subjectNames = [];

  assignedClasses.forEach(
    (assignment) => {
      assignment.subjectIds.forEach(
        (subjectId) => {
          const id = String(subjectId);

          if (
            !subjectIds.some(
              (item) =>
                String(item) === id
            )
          ) {
            subjectIds.push(subjectId);
          }
        }
      );

      assignment.subjects.forEach(
        (subjectName) => {
          const normalized =
            cleanString(
              subjectName
            ).toLowerCase();

          if (
            normalized &&
            !subjectNames.some(
              (item) =>
                cleanString(
                  item
                ).toLowerCase() ===
                normalized
            )
          ) {
            subjectNames.push(
              subjectName
            );
          }
        }
      );
    }
  );

  return {
    teacherSubjectIds: subjectIds,
    subjects: subjectNames,
  };
};

const syncTeacherSubjectLinks = async ({
  teacherId,
  previousSubjectIds = [],
  nextSubjectIds = [],
}) => {
  const previousIds =
    cleanObjectIdArray(
      previousSubjectIds
    );

  const nextIds =
    cleanObjectIdArray(
      nextSubjectIds
    );

  const previousSet = new Set(
    previousIds.map(String)
  );

  const nextSet = new Set(
    nextIds.map(String)
  );

  const removedIds =
    previousIds.filter(
      (id) => !nextSet.has(String(id))
    );

  const addedIds =
    nextIds.filter(
      (id) =>
        !previousSet.has(String(id))
    );

  for (const subjectId of removedIds) {
    const subject =
      await Subject.findById(
        subjectId
      );

    if (!subject) {
      continue;
    }

    subject.teacherIds =
      (
        subject.teacherIds || []
      ).filter(
        (id) =>
          String(id) !==
          String(teacherId)
      );

    if (
      String(
        subject.teacherId || ""
      ) === String(teacherId)
    ) {
      subject.teacherId =
        subject.teacherIds[0] ||
        null;
    }

    await subject.save();
  }

  for (const subjectId of addedIds) {
    const subject =
      await Subject.findById(
        subjectId
      );

    if (!subject) {
      continue;
    }

    const existingTeacherIds =
      (
        subject.teacherIds || []
      ).map(String);

    if (
      !existingTeacherIds.includes(
        String(teacherId)
      )
    ) {
      subject.teacherIds.push(
        teacherId
      );
    }

    if (!subject.teacherId) {
      subject.teacherId =
        teacherId;
    }

    await subject.save();
  }
};

/* =====================================================
   STUDENT SUBJECT RESOLUTION
===================================================== */

const validateStudentSubjectIds = async ({
  subjectIds,
  schoolId,
  className,
  section,
  stream,
}) => {
  const ids =
    cleanObjectIdArray(subjectIds);

  if (ids.length === 0) {
    return [];
  }

  const subjects =
    await Subject.find({
      _id: {
        $in: ids,
      },
      schoolId,
      isActive: true,
      className: exactText(
        className
      ),
    });

  const validSubjects =
    subjects.filter(
      (subject) =>
        subjectAppliesToSection(
          subject,
          section
        ) &&
        subjectAppliesToStream(
          subject,
          stream,
          className
        )
    );

  if (
    validSubjects.length !== ids.length
  ) {
    const error = new Error(
      "One or more selected student subjects do not belong to the student's school, class, section or stream."
    );

    error.statusCode = 400;
    throw error;
  }

  return validSubjects.map(
    (subject) => subject._id
  );
};

/* =====================================================
   AUTHORIZATION
===================================================== */

const protect = async (
  req,
  res,
  next
) => {
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        message:
          "No token provided",
      });
    }

    const token =
      authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const userId =
      decoded.id ||
      decoded._id ||
      decoded.userId;

    if (
      !userId ||
      !isValidObjectId(userId)
    ) {
      return res.status(401).json({
        message:
          "Invalid token payload",
      });
    }

    const user =
      await User.findById(
        userId
      ).select("-password");

    if (!user) {
      return res.status(401).json({
        message:
          "Logged-in user not found",
      });
    }

    if (
      user.accountStatus ===
        "deactivated" ||
      user.isActive === false
    ) {
      return res.status(403).json({
        message:
          "Your account has been deactivated. Contact school admin.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error(
      "Auth error:",
      error.message
    );

    return res.status(401).json({
      message:
        "Invalid or expired token",
    });
  }
};

const adminOnly = (
  req,
  res,
  next
) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message:
        "Only admin can perform this action",
    });
  }

  next();
};

const checkAdminSchool = (
  req,
  res
) => {
  const schoolId =
    getSchoolId(req.user);

  if (
    !schoolId ||
    !isValidObjectId(schoolId)
  ) {
    res.status(400).json({
      message:
        "Admin schoolId is missing or invalid",
    });

    return null;
  }

  return schoolId;
};

const findUserFromSameSchool =
  async (req, res, userId) => {
    if (!isValidObjectId(userId)) {
      res.status(400).json({
        message:
          "Invalid user ID",
      });

      return null;
    }

    const schoolId =
      getSchoolId(req.user);

    const user =
      await User.findById(userId);

    if (!user) {
      res.status(404).json({
        message: "User not found",
      });

      return null;
    }

    if (
      String(getSchoolId(user)) !==
      String(schoolId)
    ) {
      res.status(403).json({
        message:
          "You cannot manage a user from another school",
      });

      return null;
    }

    return user;
  };

/* =====================================================
   CREATE TEACHER / STUDENT
===================================================== */

router.post(
  "/create",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const schoolId =
        checkAdminSchool(req, res);

      if (!schoolId) return;

      const {
        name,
        email,
        password,
        role,
        className,
        section,
        rollNumber,
        admissionNumber,
        studentCode,
        academicYear,
        stream,
        employeeId,
        qualification,
        accountStatus,
        studentStatus,
      } = req.body;

      const finalRole =
        cleanString(role).toLowerCase();

      if (
        !name ||
        !email ||
        !password ||
        !finalRole
      ) {
        return res.status(400).json({
          message:
            "Name, email, password and role are required",
        });
      }

      if (
        !MANAGED_ROLES.includes(
          finalRole
        )
      ) {
        return res.status(400).json({
          message:
            "Role must be teacher or student",
        });
      }

      if (
        cleanString(password).length <
        4
      ) {
        return res.status(400).json({
          message:
            "Password must be at least 4 characters",
        });
      }

      const finalEmail =
        cleanEmail(email);

      const existingUser =
        await User.findOne({
          email: finalEmail,
        });

      if (existingUser) {
        return res.status(409).json({
          message:
            "This email is already used by another account",
        });
      }

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const userData = {
        name: cleanString(name),
        email: finalEmail,
        password:
          hashedPassword,
        role: finalRole,
        schoolId,

        phone: cleanString(
          req.body.phone
        ),
        address: cleanString(
          req.body.address
        ),
        gender: [
          "male",
          "female",
          "other",
        ].includes(
          cleanString(
            req.body.gender
          )
        )
          ? cleanString(
              req.body.gender
            )
          : "",
        dateOfBirth:
          req.body.dateOfBirth
            ? new Date(
                req.body.dateOfBirth
              )
            : null,
        profileImage: cleanString(
          req.body.profileImage
        ),
        accountStatus:
          ACCOUNT_STATUSES.includes(
            cleanString(
              accountStatus
            )
          )
            ? cleanString(
                accountStatus
              )
            : "active",
        isActive: true,

        className: "",
        section: "",
        rollNumber: "",
        admissionNumber: "",
        studentCode: "",
        academicYear: "",
        stream: "",
        subjectIds: [],
        subjectEnrollmentMode:
          "stream",
        studentStatus: "active",
        guardian: {},

        employeeId: "",
        qualification: "",
        subjects: [],
        teacherSubjectIds: [],
        assignedClasses: [],
      };

      /* ================= STUDENT DATA ================= */

      if (finalRole === "student") {
        const finalClassName =
          cleanString(className);

        const finalSection =
          cleanString(section);

        const classNumber =
          Number(finalClassName);

        const finalStream =
          classNumber >= 11
            ? normalizeStream(stream)
            : "General";

        if (
          !finalClassName ||
          !finalSection
        ) {
          return res.status(400).json({
            message:
              "Class and section are required for student",
          });
        }

        if (
          classNumber >= 11 &&
          !finalStream
        ) {
          return res.status(400).json({
            message:
              "Stream is required for Class 11 and Class 12 students",
          });
        }

        const studentSubjectIds =
          await validateStudentSubjectIds({
            subjectIds:
              req.body.subjectIds,
            schoolId,
            className:
              finalClassName,
            section:
              finalSection,
            stream:
              finalStream,
          });

        userData.className =
          finalClassName;
        userData.section =
          finalSection;
        userData.rollNumber =
          cleanString(rollNumber);
        userData.admissionNumber =
          cleanString(
            admissionNumber
          );
        userData.studentCode =
          cleanString(
            studentCode
          );
        userData.academicYear =
          cleanString(
            academicYear
          );
        userData.stream =
          finalStream;
        userData.subjectIds =
          studentSubjectIds;
        userData.subjectEnrollmentMode =
          studentSubjectIds.length > 0
            ? "individual"
            : "stream";
        userData.studentStatus =
          STUDENT_STATUSES.includes(
            cleanString(
              studentStatus
            )
          )
            ? cleanString(
                studentStatus
              )
            : "active";
        userData.guardian =
          normalizeGuardian(
            req.body
          );
      }

      /* ================= TEACHER DATA ================= */

      if (finalRole === "teacher") {
        const cleanAssignedClasses =
          await resolveTeacherAssignments({
            assignedClasses:
              req.body
                .assignedClasses,
            schoolId,
            fallbackClassName:
              className,
            fallbackSection:
              section,
            fallbackStream:
              stream,
          });

        const {
          teacherSubjectIds,
          subjects,
        } =
          getTeacherAssignmentSummary(
            cleanAssignedClasses
          );

        userData.employeeId =
          cleanString(employeeId);

        userData.qualification =
          cleanString(
            qualification
          );

        userData.subjects =
          subjects;

        userData.teacherSubjectIds =
          teacherSubjectIds;

        userData.assignedClasses =
          cleanAssignedClasses;
      }

      const newUser =
        await User.create(
          userData
        );

      if (
        finalRole === "teacher"
      ) {
        await syncTeacherSubjectLinks({
          teacherId:
            newUser._id,
          previousSubjectIds: [],
          nextSubjectIds:
            newUser.teacherSubjectIds,
        });
      }

      const populatedUser =
        await populateUserSubjects(
          User.findById(
            newUser._id
          ).select("-password")
        );

      return res.status(201).json({
        message: `${finalRole} created successfully`,
        user: publicUser(
          populatedUser
        ),
      });
    } catch (error) {
      console.error(
        "Create user error:",
        error
      );

      return res
        .status(
          error.statusCode || 500
        )
        .json({
          message:
            error.message ||
            "Failed to create user",
        });
    }
  }
);

/* =====================================================
   GET USERS
===================================================== */

router.get(
  "/me",
  protect,
  async (req, res) => {
    const populatedUser =
      await populateUserSubjects(
        User.findById(
          req.user._id
        ).select("-password")
      );

    return res
      .status(200)
      .json(
        publicUser(populatedUser)
      );
  }
);

router.get(
  "/",
  protect,
  async (req, res) => {
    try {
      const schoolId =
        getSchoolId(req.user);

      if (
        !schoolId ||
        !isValidObjectId(
          schoolId
        )
      ) {
        return res.status(400).json({
          message:
            "SchoolId not found for logged-in user",
        });
      }

      const query = {
        schoolId,
      };

      const role =
        cleanString(
          req.query.role
        ).toLowerCase();

      const className =
        cleanString(
          req.query.className
        );

      const section =
        cleanString(
          req.query.section
        );

      const stream =
        normalizeStream(
          req.query.stream
        );

      const accountStatus =
        cleanString(
          req.query.accountStatus
        );

      const search =
        cleanString(
          req.query.search
        );

      if (
        role &&
        ALL_ROLES.includes(role)
      ) {
        query.role = role;
      }

      if (className) {
        if (role === "teacher") {
          query[
            "assignedClasses.className"
          ] = className;
        } else if (
          role === "student"
        ) {
          query.className =
            className;
        } else {
          query.$or = [
            {
              className,
            },
            {
              "assignedClasses.className":
                className,
            },
          ];
        }
      }

      if (section) {
        if (role === "teacher") {
          query[
            "assignedClasses.section"
          ] = section;
        } else if (
          role === "student"
        ) {
          query.section =
            section;
        }
      }

      if (stream) {
        if (role === "teacher") {
          query[
            "assignedClasses.stream"
          ] = stream;
        } else {
          query.stream = stream;
        }
      }

      if (
        accountStatus &&
        ACCOUNT_STATUSES.includes(
          accountStatus
        )
      ) {
        query.accountStatus =
          accountStatus;
      }

      if (search) {
        const regex =
          new RegExp(
            escapeRegex(search),
            "i"
          );

        const searchQuery = {
          $or: [
            { name: regex },
            { email: regex },
            { phone: regex },
            {
              rollNumber:
                regex,
            },
            {
              admissionNumber:
                regex,
            },
            {
              employeeId:
                regex,
            },
            {
              subjects:
                regex,
            },
          ],
        };

        if (query.$or) {
          query.$and = [
            {
              $or: query.$or,
            },
            searchQuery,
          ];

          delete query.$or;
        } else {
          query.$and = [
            ...(query.$and || []),
            searchQuery,
          ];
        }
      }

      const users =
        await populateUserSubjects(
          User.find(query)
            .select("-password")
            .sort({
              role: 1,
              name: 1,
              createdAt: -1,
            })
        );

      return res
        .status(200)
        .json(users);
    } catch (error) {
      console.error(
        "Get users error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to load users",
        });
    }
  }
);

router.get(
  "/students",
  protect,
  async (req, res) => {
    try {
      const schoolId =
        getSchoolId(req.user);

      const students =
        await populateUserSubjects(
          User.find({
            schoolId,
            role: "student",
          })
            .select("-password")
            .sort({
              className: 1,
              section: 1,
              rollNumber: 1,
              name: 1,
            })
        );

      return res
        .status(200)
        .json(students);
    } catch (error) {
      console.error(
        "Get students error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to load students",
        });
    }
  }
);

router.get(
  "/teachers",
  protect,
  async (req, res) => {
    try {
      const schoolId =
        getSchoolId(req.user);

      const teachers =
        await populateUserSubjects(
          User.find({
            schoolId,
            role: "teacher",
          })
            .select("-password")
            .sort({
              name: 1,
            })
        );

      return res
        .status(200)
        .json(teachers);
    } catch (error) {
      console.error(
        "Get teachers error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to load teachers",
        });
    }
  }
);

router.get(
  "/class/:className",
  protect,
  async (req, res) => {
    try {
      const schoolId =
        getSchoolId(req.user);

      const className =
        cleanString(
          req.params.className
        );

      const section =
        cleanString(
          req.query.section
        );

      const stream =
        normalizeStream(
          req.query.stream
        );

      if (!className) {
        return res.status(400).json({
          message:
            "Class name is required",
        });
      }

      const query = {
        schoolId,
        role: "student",
        className,
      };

      if (section) {
        query.section = section;
      }

      if (stream) {
        query.stream = stream;
      }

      const students =
        await populateUserSubjects(
          User.find(query)
            .select("-password")
            .sort({
              section: 1,
              rollNumber: 1,
              name: 1,
            })
        );

      return res
        .status(200)
        .json(students);
    } catch (error) {
      console.error(
        "Get students by class error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to load class students",
        });
    }
  }
);

router.get(
  "/:userId",
  protect,
  async (req, res) => {
    try {
      const user =
        await findUserFromSameSchool(
          req,
          res,
          req.params.userId
        );

      if (!user) return;

      const populatedUser =
        await populateUserSubjects(
          User.findById(
            user._id
          ).select("-password")
        );

      return res
        .status(200)
        .json(
          publicUser(
            populatedUser
          )
        );
    } catch (error) {
      console.error(
        "Get user error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to load user",
        });
    }
  }
);

/* =====================================================
   UPDATE USER
===================================================== */

const updateUserHandler = async (
  req,
  res
) => {
  try {
    const user =
      await findUserFromSameSchool(
        req,
        res,
        req.params.userId
      );

    if (!user) return;

    if (user.role === "admin") {
      return res.status(403).json({
        message:
          "Admin account cannot be edited from this route",
      });
    }

    const previousTeacherSubjectIds =
      user.role === "teacher"
        ? cleanObjectIdArray(
            user.teacherSubjectIds
          )
        : [];

    const updates = {};

    if (
      req.body.name !== undefined
    ) {
      updates.name = cleanString(
        req.body.name
      );
    }

    if (
      req.body.email !== undefined
    ) {
      const finalEmail =
        cleanEmail(req.body.email);

      if (!finalEmail) {
        return res.status(400).json({
          message:
            "Email cannot be empty",
        });
      }

      const emailOwner =
        await User.findOne({
          email: finalEmail,
          _id: {
            $ne: user._id,
          },
        });

      if (emailOwner) {
        return res.status(409).json({
          message:
            "This email is already used by another account",
        });
      }

      updates.email =
        finalEmail;
    }

    if (
      req.body.phone !== undefined
    ) {
      updates.phone =
        cleanString(
          req.body.phone
        );
    }

    if (
      req.body.address !== undefined
    ) {
      updates.address =
        cleanString(
          req.body.address
        );
    }

    if (
      req.body.gender !== undefined
    ) {
      const gender =
        cleanString(
          req.body.gender
        );

      updates.gender = [
        "",
        "male",
        "female",
        "other",
      ].includes(gender)
        ? gender
        : "";
    }

    if (
      req.body.dateOfBirth !==
      undefined
    ) {
      updates.dateOfBirth =
        req.body.dateOfBirth
          ? new Date(
              req.body.dateOfBirth
            )
          : null;
    }

    if (
      req.body.profileImage !==
      undefined
    ) {
      updates.profileImage =
        cleanString(
          req.body.profileImage
        );
    }

    if (
      req.body.accountStatus !==
      undefined
    ) {
      const status =
        cleanString(
          req.body.accountStatus
        );

      if (
        !ACCOUNT_STATUSES.includes(
          status
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid account status",
        });
      }

      updates.accountStatus =
        status;

      updates.isActive =
        status === "active";
    }

    if (
      req.body.isActive !==
      undefined
    ) {
      updates.isActive =
        req.body.isActive === true ||
        req.body.isActive === "true";

      updates.accountStatus =
        updates.isActive
          ? "active"
          : "deactivated";
    }

    let finalRole = user.role;

    if (
      req.body.role !== undefined
    ) {
      const requestedRole =
        cleanString(
          req.body.role
        ).toLowerCase();

      if (
        !MANAGED_ROLES.includes(
          requestedRole
        )
      ) {
        return res.status(400).json({
          message:
            "Role must be teacher or student",
        });
      }

      finalRole =
        requestedRole;

      updates.role =
        requestedRole;
    }

    /* ================= UPDATE STUDENT ================= */

    if (finalRole === "student") {
      const finalClassName =
        req.body.className !==
        undefined
          ? cleanString(
              req.body.className
            )
          : user.className;

      const finalSection =
        req.body.section !==
        undefined
          ? cleanString(
              req.body.section
            )
          : user.section;

      const classNumber =
        Number(finalClassName);

      const finalStream =
        classNumber >= 11
          ? normalizeStream(
              req.body.stream !==
                undefined
                ? req.body.stream
                : user.stream
            )
          : "General";

      if (
        !finalClassName ||
        !finalSection
      ) {
        return res.status(400).json({
          message:
            "Class and section are required for student",
        });
      }

      if (
        classNumber >= 11 &&
        !finalStream
      ) {
        return res.status(400).json({
          message:
            "Stream is required for Class 11 and Class 12 students",
        });
      }

      updates.className =
        finalClassName;

      updates.section =
        finalSection;

      updates.stream =
        finalStream;

      if (
        req.body.rollNumber !==
        undefined
      ) {
        updates.rollNumber =
          cleanString(
            req.body.rollNumber
          );
      }

      if (
        req.body.admissionNumber !==
        undefined
      ) {
        updates.admissionNumber =
          cleanString(
            req.body.admissionNumber
          );
      }

      if (
        req.body.studentCode !==
        undefined
      ) {
        updates.studentCode =
          cleanString(
            req.body.studentCode
          );
      }

      if (
        req.body.academicYear !==
        undefined
      ) {
        updates.academicYear =
          cleanString(
            req.body.academicYear
          );
      }

      if (
        req.body.subjectIds !==
          undefined ||
        req.body.subjectEnrollmentMode !==
          undefined ||
        req.body.className !==
          undefined ||
        req.body.section !==
          undefined ||
        req.body.stream !==
          undefined
      ) {
        const requestedSubjectIds =
          req.body.subjectIds !==
          undefined
            ? req.body.subjectIds
            : user.subjectIds;

        const validatedSubjectIds =
          await validateStudentSubjectIds({
            subjectIds:
              requestedSubjectIds,
            schoolId:
              getSchoolId(user),
            className:
              finalClassName,
            section:
              finalSection,
            stream:
              finalStream,
          });

        updates.subjectIds =
          validatedSubjectIds;

        updates.subjectEnrollmentMode =
          validatedSubjectIds.length > 0
            ? "individual"
            : "stream";
      }

      if (
        req.body.studentStatus !==
        undefined
      ) {
        const status =
          cleanString(
            req.body.studentStatus
          );

        if (
          !STUDENT_STATUSES.includes(
            status
          )
        ) {
          return res.status(400).json({
            message:
              "Invalid student status",
          });
        }

        updates.studentStatus =
          status;
      }

      if (
        req.body.guardian !==
          undefined ||
        req.body.guardianName !==
          undefined ||
        req.body.guardianPhone !==
          undefined ||
        req.body.guardianEmail !==
          undefined ||
        req.body.guardianRelation !==
          undefined
      ) {
        updates.guardian =
          normalizeGuardian(
            req.body
          );
      }

      updates.employeeId = "";
      updates.qualification = "";
      updates.subjects = [];
      updates.teacherSubjectIds = [];
      updates.assignedClasses = [];
    }

    /* ================= UPDATE TEACHER ================= */

    if (finalRole === "teacher") {
      let cleanAssignedClasses =
        user.assignedClasses || [];

      if (
        req.body.assignedClasses !==
          undefined ||
        req.body.className !==
          undefined ||
        req.body.section !==
          undefined ||
        req.body.stream !==
          undefined
      ) {
        cleanAssignedClasses =
          await resolveTeacherAssignments({
            assignedClasses:
              req.body
                .assignedClasses,
            schoolId:
              getSchoolId(user),
            fallbackClassName:
              req.body.className,
            fallbackSection:
              req.body.section,
            fallbackStream:
              req.body.stream,
          });
      }

      if (
        !cleanAssignedClasses ||
        cleanAssignedClasses.length ===
          0
      ) {
        return res.status(400).json({
          message:
            "At least one class, section and teaching subject is required for teacher",
        });
      }

      /*
        Re-resolve older teacher assignments when the user is
        edited, so the route never stores class-only records.
      */
      if (
        req.body.assignedClasses ===
          undefined &&
        cleanAssignedClasses.some(
          (assignment) =>
            !assignment
              ?.subjectIds?.length
        )
      ) {
        cleanAssignedClasses =
          await resolveTeacherAssignments({
            assignedClasses:
              cleanAssignedClasses,
            schoolId:
              getSchoolId(user),
          });
      }

      const {
        teacherSubjectIds,
        subjects,
      } =
        getTeacherAssignmentSummary(
          cleanAssignedClasses
        );

      if (
        req.body.employeeId !==
        undefined
      ) {
        updates.employeeId =
          cleanString(
            req.body.employeeId
          );
      }

      if (
        req.body.qualification !==
        undefined
      ) {
        updates.qualification =
          cleanString(
            req.body.qualification
          );
      }

      updates.subjects =
        subjects;

      updates.teacherSubjectIds =
        teacherSubjectIds;

      updates.assignedClasses =
        cleanAssignedClasses;

      updates.className = "";
      updates.section = "";
      updates.rollNumber = "";
      updates.admissionNumber = "";
      updates.studentCode = "";
      updates.academicYear = "";
      updates.stream = "";
      updates.subjectIds = [];
      updates.subjectEnrollmentMode =
        "stream";
      updates.studentStatus =
        "active";
      updates.guardian = {};
    }

    Object.assign(user, updates);

    const savedUser =
      await user.save();

    const nextTeacherSubjectIds =
      savedUser.role === "teacher"
        ? cleanObjectIdArray(
            savedUser.teacherSubjectIds
          )
        : [];

    if (
      previousTeacherSubjectIds.length >
        0 ||
      nextTeacherSubjectIds.length >
        0
    ) {
      await syncTeacherSubjectLinks({
        teacherId:
          savedUser._id,
        previousSubjectIds:
          previousTeacherSubjectIds,
        nextSubjectIds:
          nextTeacherSubjectIds,
      });
    }

    const populatedUser =
      await populateUserSubjects(
        User.findById(
          savedUser._id
        ).select("-password")
      );

    return res.status(200).json({
      message:
        "User updated successfully",
      user: publicUser(
        populatedUser
      ),
    });
  } catch (error) {
    console.error(
      "Update user error:",
      error
    );

    return res
      .status(
        error.statusCode || 500
      )
      .json({
        message:
          error.message ||
          "Failed to update user",
      });
  }
};

router.put(
  "/:userId",
  protect,
  adminOnly,
  updateUserHandler
);

router.patch(
  "/:userId",
  protect,
  adminOnly,
  updateUserHandler
);

/* =====================================================
   ACTIVATE / DEACTIVATE USER
===================================================== */

router.patch(
  "/:userId/status",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const user =
        await findUserFromSameSchool(
          req,
          res,
          req.params.userId
        );

      if (!user) return;

      if (user.role === "admin") {
        return res.status(403).json({
          message:
            "Admin account cannot be deactivated from this route",
        });
      }

      let accountStatus =
        cleanString(
          req.body.accountStatus
        );

      if (!accountStatus) {
        const status =
          cleanString(
            req.body.status
          ).toLowerCase();

        if (
          status === "inactive" ||
          status ===
            "deactivated"
        ) {
          accountStatus =
            "deactivated";
        } else if (
          status === "active"
        ) {
          accountStatus =
            "active";
        } else if (
          req.body.isActive !==
          undefined
        ) {
          const active =
            req.body.isActive ===
              true ||
            req.body.isActive ===
              "true";

          accountStatus = active
            ? "active"
            : "deactivated";
        }
      }

      if (
        !ACCOUNT_STATUSES.includes(
          accountStatus
        )
      ) {
        return res.status(400).json({
          message:
            "accountStatus must be active or deactivated",
        });
      }

      user.accountStatus =
        accountStatus;

      user.isActive =
        accountStatus === "active";

      await user.save();

      return res.status(200).json({
        message:
          accountStatus === "active"
            ? "User activated successfully"
            : "User deactivated successfully",
        user: publicUser(user),
      });
    } catch (error) {
      console.error(
        "Update user status error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to update user status",
        });
    }
  }
);

/* =====================================================
   RESET PASSWORD
===================================================== */

router.patch(
  "/:userId/reset-password",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const user =
        await findUserFromSameSchool(
          req,
          res,
          req.params.userId
        );

      if (!user) return;

      if (user.role === "admin") {
        return res.status(403).json({
          message:
            "Admin password cannot be reset from this route",
        });
      }

      const newPassword =
        cleanString(
          req.body.newPassword ||
            req.body.password
        );

      if (
        !newPassword ||
        newPassword.length < 4
      ) {
        return res.status(400).json({
          message:
            "New password must be at least 4 characters",
        });
      }

      user.password =
        await bcrypt.hash(
          newPassword,
          10
        );

      await user.save();

      return res.status(200).json({
        message:
          "Password reset successfully",
      });
    } catch (error) {
      console.error(
        "Reset password error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to reset password",
        });
    }
  }
);

/* =====================================================
   DELETE USER
===================================================== */

router.delete(
  "/:userId",
  protect,
  adminOnly,
  async (req, res) => {
    try {
      const user =
        await findUserFromSameSchool(
          req,
          res,
          req.params.userId
        );

      if (!user) return;

      if (
        String(user._id) ===
        String(req.user._id)
      ) {
        return res.status(400).json({
          message:
            "You cannot delete your own account",
        });
      }

      if (user.role === "admin") {
        return res.status(403).json({
          message:
            "Admin account cannot be deleted from this route",
        });
      }

      if (user.role === "teacher") {
        await syncTeacherSubjectLinks({
          teacherId: user._id,
          previousSubjectIds:
            user.teacherSubjectIds,
          nextSubjectIds: [],
        });
      }

      await User.findByIdAndDelete(
        user._id
      );

      return res.status(200).json({
        message:
          "User deleted successfully",
      });
    } catch (error) {
      console.error(
        "Delete user error:",
        error
      );

      return res
        .status(500)
        .json({
          message:
            error.message ||
            "Failed to delete user",
        });
    }
  }
);

export default router;
