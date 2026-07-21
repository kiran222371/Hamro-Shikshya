import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, {
  createUser,
  getUsers,
  getSubjects,
  createSubject,
  bulkCreateSubjects,
  updateSubject,
  deleteSubject,
  getSchoolProfile,
  saveSchoolProfile,
  createTimetable,
  getTimetable,
  updateTimetable,
  deleteTimetable,
  getArrayFromApiResponse,
  GOOGLE_MAPS_API_KEY,
} from "../api";
import PortalLayout from "../components/PortalLayout";
import "../styles/App.css";

const SUBJECTS_STORAGE_KEY = "hamro_shikshya_subjects";
const SCHOOL_PROFILE_STORAGE_KEY = "hamro_shikshya_school_profile";
const GOOGLE_SCRIPT_ID = "hamro-shikshya-google-places-script";

const ADMIN_NAVIGATION = [
  { to: "/admin/overview", label: "Overview", icon: "▦" },
  { to: "/admin/school", label: "School Profile", icon: "🏫" },
  { to: "/admin/subjects", label: "Subjects", icon: "📚" },
  { to: "/admin/timetable", label: "Timetable", icon: "🗓️" },
  { to: "/admin/reports", label: "Reports", icon: "📊" },
  { to: "/admin/create-user", label: "Add User", icon: "➕" },
  { to: "/admin/users", label: "User Management", icon: "⚙️" },
  { to: "/admin/teachers", label: "Teachers", icon: "👩‍🏫" },
  { to: "/admin/students", label: "Students", icon: "🎓" },
];

const ADMIN_VIEWS = new Set(
  ADMIN_NAVIGATION.map((item) => item.to.split("/").filter(Boolean).pop())
);

const NEPAL_CLASSES = Array.from({ length: 12 }, (_, index) =>
  String(index + 1)
);

const SECTION_OPTIONS = ["A", "B", "C", "D", "E", "F", "G"];

const STREAM_OPTIONS = [
  "General",
  "Science",
  "Management",
  "Humanities",
  "Education",
  "Law",
  "Technical",
];

const SUBJECT_TYPES = [
  "Compulsory",
  "Optional",
  "Practical",
  "Local Curriculum",
];

const TIMETABLE_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TIMETABLE_CLASS_TYPES = [
  "Regular Class",
  "Practical",
  "Lab",
  "Tutorial",
  "Assembly",
  "Break",
  "Other",
];

const TEACHING_TIMETABLE_TYPES = new Set([
  "Regular Class",
  "Practical",
  "Lab",
  "Tutorial",
]);

const emptyAssignedClass = {
  className: "",
  section: "",
  stream: "General",
  subjectIds: [],
  subjects: [],
};

const emptyCreateForm = {
  name: "",
  email: "",
  password: "",
  role: "teacher",
  className: "",
  section: "",
  stream: "",
  academicYear: "",
  subjectEnrollmentMode: "stream",
  subjectIds: [],
  assignedClasses: [{ ...emptyAssignedClass }],
};

const emptySubjectForm = {
  name: "",
  subjectCode: "",
  className: "",
  section: "",
  stream: "General",
  type: "Compulsory",
};

const emptyTimetableForm = {
  className: "",
  section: "",
  stream: "General",
  academicYear: "",
  dayOfWeek: "Sunday",
  startTime: "",
  endTime: "",
  periodNumber: "",
  subjectId: "",
  subjectName: "",
  subjectCode: "",
  teacherId: "",
  teacherName: "",
  room: "",
  classType: "Regular Class",
  notes: "",
  validFrom: "",
  validUntil: "",
  isActive: true,
};

const getId = (item) => item?._id || item?.id || item?.userId || "";

const getSubjectId = (subject) =>
  subject?._id || subject?.id || subject?.subjectId || "";

const getTimetableId = (entry) =>
  entry?._id || entry?.id || entry?.timetableId || "";

const toDateInputValue = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
};

const normaliseTimetableEntry = (entry = {}) => {
  const subject =
    entry.subjectId && typeof entry.subjectId === "object"
      ? entry.subjectId
      : {};

  const teacher =
    entry.teacherId && typeof entry.teacherId === "object"
      ? entry.teacherId
      : {};

  return {
    ...entry,
    id: getTimetableId(entry),
    className: String(entry.className || entry.class || "").trim(),
    section: String(entry.section || "").trim(),
    stream: String(entry.stream || "General").trim() || "General",
    academicYear: String(entry.academicYear || "").trim(),
    dayOfWeek: String(entry.dayOfWeek || entry.day || "").trim(),
    startTime: String(entry.startTime || entry.start || "").trim(),
    endTime: String(entry.endTime || entry.end || "").trim(),
    periodNumber:
      entry.periodNumber === undefined || entry.periodNumber === null
        ? ""
        : entry.periodNumber,
    subjectId:
      subject?._id ||
      subject?.id ||
      (typeof entry.subjectId === "string" ? entry.subjectId : ""),
    subjectName:
      entry.subjectName ||
      subject?.name ||
      subject?.subjectName ||
      (typeof entry.subject === "string" ? entry.subject : ""),
    subjectCode:
      entry.subjectCode ||
      subject?.subjectCode ||
      subject?.code ||
      "",
    teacherId:
      teacher?._id ||
      teacher?.id ||
      (typeof entry.teacherId === "string" ? entry.teacherId : ""),
    teacherName:
      entry.teacherName ||
      teacher?.name ||
      "",
    room: String(entry.room || "").trim(),
    classType: String(entry.classType || entry.type || "Regular Class").trim(),
    notes: String(entry.notes || entry.description || "").trim(),
    validFrom: entry.validFrom || "",
    validUntil: entry.validUntil || "",
    isActive: entry.isActive !== false,
  };
};

const sortTimetableEntries = (entries = []) => {
  const dayOrder = new Map(
    TIMETABLE_DAYS.map((day, index) => [day, index])
  );

  return [...entries].sort((a, b) => {
    const dayDifference =
      (dayOrder.get(a.dayOfWeek) ?? 99) -
      (dayOrder.get(b.dayOfWeek) ?? 99);

    if (dayDifference !== 0) return dayDifference;

    const timeDifference = String(a.startTime || "").localeCompare(
      String(b.startTime || "")
    );

    if (timeDifference !== 0) return timeDifference;

    return Number(a.periodNumber || 0) - Number(b.periodNumber || 0);
  });
};

const safeReadStorage = (key, fallback) => {
  try {
    if (typeof localStorage === "undefined") return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeWriteStorage = (key, value) => {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore local storage errors
  }
};

const isUserActive = (user) => {
  if (user?.isActive === false) return false;
  if (String(user?.status || "").toLowerCase() === "inactive") return false;
  if (String(user?.accountStatus || "").toLowerCase() === "inactive") {
    return false;
  }

  return true;
};

const getNepalLevel = (className) => {
  const classNumber = Number(className);

  if (classNumber >= 1 && classNumber <= 8) return "Basic Education";
  if (classNumber >= 9 && classNumber <= 12) return "Secondary Education";

  return "N/A";
};

const makeSubjectCode = (name, className) => {
  const words = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const prefix =
    words.length === 1
      ? words[0].slice(0, 4).toUpperCase()
      : words.map((word) => word[0]).join("").slice(0, 5).toUpperCase();

  return `${prefix || "SUB"}-${className || "CLS"}`;
};

const getNepalSubjectTemplates = (className, stream = "General") => {
  const classNumber = Number(className);

  if (!classNumber) return [];

  if (classNumber >= 1 && classNumber <= 8) {
    return [
      { name: "Nepali", type: "Compulsory", stream: "General" },
      { name: "English", type: "Compulsory", stream: "General" },
      { name: "Mathematics", type: "Compulsory", stream: "General" },
      { name: "Science", type: "Compulsory", stream: "General" },
      { name: "Social Studies", type: "Compulsory", stream: "General" },
      {
        name: "Health, Physical and Creative Arts",
        type: "Compulsory",
        stream: "General",
      },
      { name: "Computer Science", type: "Optional", stream: "General" },
      {
        name: "Local Curriculum",
        type: "Local Curriculum",
        stream: "General",
      },
    ];
  }

  if (classNumber >= 9 && classNumber <= 10) {
    return [
      { name: "Nepali", type: "Compulsory", stream: "General" },
      { name: "English", type: "Compulsory", stream: "General" },
      { name: "Mathematics", type: "Compulsory", stream: "General" },
      { name: "Science", type: "Compulsory", stream: "General" },
      { name: "Social Studies", type: "Compulsory", stream: "General" },
      { name: "Optional Mathematics", type: "Optional", stream: "General" },
      { name: "Computer Science", type: "Optional", stream: "General" },
      { name: "Accountancy", type: "Optional", stream: "General" },
      { name: "Economics", type: "Optional", stream: "General" },
    ];
  }

  const commonSubjects = [
    { name: "Compulsory Nepali", type: "Compulsory", stream },
    { name: "Compulsory English", type: "Compulsory", stream },
    {
      name: "Social Studies and Life Skills",
      type: "Compulsory",
      stream,
    },
  ];

  const streamSubjects = {
    Science: [
      { name: "Physics", type: "Optional", stream: "Science" },
      { name: "Chemistry", type: "Optional", stream: "Science" },
      { name: "Biology", type: "Optional", stream: "Science" },
      { name: "Mathematics", type: "Optional", stream: "Science" },
      { name: "Computer Science", type: "Optional", stream: "Science" },
    ],
    Management: [
      { name: "Accountancy", type: "Optional", stream: "Management" },
      { name: "Economics", type: "Optional", stream: "Management" },
      { name: "Business Studies", type: "Optional", stream: "Management" },
      { name: "Business Mathematics", type: "Optional", stream: "Management" },
      { name: "Hotel Management", type: "Optional", stream: "Management" },
    ],
    Humanities: [
      { name: "Sociology", type: "Optional", stream: "Humanities" },
      { name: "Psychology", type: "Optional", stream: "Humanities" },
      {
        name: "Mass Communication",
        type: "Optional",
        stream: "Humanities",
      },
      {
        name: "Rural Development",
        type: "Optional",
        stream: "Humanities",
      },
      { name: "Political Science", type: "Optional", stream: "Humanities" },
    ],
    Education: [
      {
        name: "Education and Development",
        type: "Optional",
        stream: "Education",
      },
      { name: "Nepali Education", type: "Optional", stream: "Education" },
      { name: "English Education", type: "Optional", stream: "Education" },
      { name: "Health Education", type: "Optional", stream: "Education" },
      { name: "Population Education", type: "Optional", stream: "Education" },
    ],
    Law: [
      { name: "Legal Studies", type: "Optional", stream: "Law" },
      { name: "Constitutional Law", type: "Optional", stream: "Law" },
      { name: "Procedural Law", type: "Optional", stream: "Law" },
      { name: "Human Rights", type: "Optional", stream: "Law" },
      { name: "General Law", type: "Optional", stream: "Law" },
    ],
    Technical: [
      { name: "Technical Subject 1", type: "Optional", stream: "Technical" },
      { name: "Technical Subject 2", type: "Optional", stream: "Technical" },
      { name: "Technical Practical", type: "Practical", stream: "Technical" },
    ],
    General: [
      { name: "Accountancy", type: "Optional", stream: "General" },
      { name: "Economics", type: "Optional", stream: "General" },
      { name: "Computer Science", type: "Optional", stream: "General" },
      { name: "Mathematics", type: "Optional", stream: "General" },
    ],
  };

  return [...commonSubjects, ...(streamSubjects[stream] || streamSubjects.General)];
};

const normaliseSubject = (subject) => {
  const id =
    getSubjectId(subject) ||
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const className = subject?.className || subject?.class || "";
  const name = subject?.name || subject?.subjectName || "";

  return {
    ...subject,
    id,
    name,
    subjectName: subject?.subjectName || name,
    subjectCode:
      subject?.subjectCode || subject?.code || makeSubjectCode(name, className),
    code: subject?.code || subject?.subjectCode || makeSubjectCode(name, className),
    className,
    section: subject?.section || "All",
    stream: subject?.stream || "General",
    type: subject?.type || "Compulsory",
    level: subject?.level || getNepalLevel(className),
  };
};

const getSubjectSections = (subject) => {
  if (Array.isArray(subject?.sections) && subject.sections.length > 0) {
    return subject.sections.map((value) => String(value || "").trim());
  }

  return [String(subject?.section || "All").trim() || "All"];
};

const isSubjectAvailableForStudent = (subject, studentForm) => {
  if (!subject || subject.isActive === false) return false;

  const selectedClass = String(studentForm?.className || "").trim();
  const selectedSection = String(studentForm?.section || "").trim();
  const selectedStream = String(studentForm?.stream || "").trim();
  const subjectClass = String(subject.className || subject.class || "").trim();
  const subjectStream = String(subject.stream || "General").trim();
  const subjectSections = getSubjectSections(subject);

  if (!selectedClass || subjectClass !== selectedClass) return false;

  const sectionMatches =
    !selectedSection ||
    subjectSections.some(
      (value) =>
        value.toLowerCase() === "all" ||
        value.toLowerCase() === selectedSection.toLowerCase()
    );

  if (!sectionMatches) return false;

  const classNumber = Number(selectedClass);

  if (classNumber >= 11) {
    if (!selectedStream) return false;

    return (
      subjectStream.toLowerCase() === selectedStream.toLowerCase() ||
      subjectStream.toLowerCase() === "general"
    );
  }

  return (
    !subjectStream ||
    subjectStream.toLowerCase() === "general"
  );
};

const getStudentSubjectOptions = (allSubjects, studentForm) => {
  return allSubjects
    .filter((subject) => isSubjectAvailableForStudent(subject, studentForm))
    .sort((a, b) =>
      String(a.name || a.subjectName || "").localeCompare(
        String(b.name || b.subjectName || "")
      )
    );
};

const hasPersistentSubjectId = (subject) => {
  const subjectId = String(getSubjectId(subject) || "");

  return Boolean(subjectId) && !subjectId.startsWith("local-");
};

const getSubjectIdentityKey = (subject = {}) => {
  return [
    String(subject.name || subject.subjectName || "").trim().toLowerCase(),
    String(subject.className || subject.class || "").trim().toLowerCase(),
    String(subject.section || "All").trim().toLowerCase(),
    String(subject.stream || "General").trim().toLowerCase(),
  ].join("|");
};

const getComparableSubjectSections = (subject = {}) => {
  const values =
    Array.isArray(subject.sections) &&
    subject.sections.length > 0
      ? subject.sections
      : [subject.section || "All"];

  const cleaned = values
    .map((value) =>
      String(value || "All")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  return cleaned.length > 0
    ? [...new Set(cleaned)]
    : ["all"];
};

const subjectRecordsMatch = (
  first = {},
  second = {}
) => {
  const firstName = String(
    first.name ||
      first.subjectName ||
      ""
  )
    .trim()
    .toLowerCase();

  const secondName = String(
    second.name ||
      second.subjectName ||
      ""
  )
    .trim()
    .toLowerCase();

  const firstCode = String(
    first.subjectCode ||
      first.code ||
      ""
  )
    .trim()
    .toLowerCase();

  const secondCode = String(
    second.subjectCode ||
      second.code ||
      ""
  )
    .trim()
    .toLowerCase();

  const sameNameOrCode =
    Boolean(
      firstName &&
        secondName &&
        firstName === secondName
    ) ||
    Boolean(
      firstCode &&
        secondCode &&
        firstCode === secondCode
    );

  if (!sameNameOrCode) {
    return false;
  }

  const sameClass =
    String(
      first.className ||
        first.class ||
        ""
    )
      .trim()
      .toLowerCase() ===
    String(
      second.className ||
        second.class ||
        ""
    )
      .trim()
      .toLowerCase();

  if (!sameClass) {
    return false;
  }

  const sameStream =
    String(first.stream || "General")
      .trim()
      .toLowerCase() ===
    String(second.stream || "General")
      .trim()
      .toLowerCase();

  if (!sameStream) {
    return false;
  }

  const firstAcademicYear = String(
    first.academicYear || ""
  )
    .trim()
    .toLowerCase();

  const secondAcademicYear = String(
    second.academicYear || ""
  )
    .trim()
    .toLowerCase();

  if (
    firstAcademicYear &&
    secondAcademicYear &&
    firstAcademicYear !==
      secondAcademicYear
  ) {
    return false;
  }

  const firstSections =
    getComparableSubjectSections(first);

  const secondSections =
    getComparableSubjectSections(second);

  return (
    firstSections.includes("all") ||
    secondSections.includes("all") ||
    firstSections.some((section) =>
      secondSections.includes(section)
    )
  );
};

const buildPersistableSubjectPayload = (subject = {}, schoolId = "") => {
  const name = String(subject.name || subject.subjectName || "").trim();
  const className = String(subject.className || subject.class || "").trim();
  const subjectCode =
    String(subject.subjectCode || subject.code || "").trim() ||
    makeSubjectCode(name, className);

  return {
    name,
    subjectName: name,
    code: subjectCode,
    subjectCode,
    className,
    section: String(subject.section || "All").trim() || "All",
    sections:
      Array.isArray(subject.sections) && subject.sections.length > 0
        ? subject.sections
        : [String(subject.section || "All").trim() || "All"],
    stream: String(subject.stream || "General").trim() || "General",
    type: subject.type || "Compulsory",
    level: subject.level || getNepalLevel(className),
    educationLevel:
      subject.educationLevel || subject.level || getNepalLevel(className),
    academicYear: String(subject.academicYear || "").trim(),
    curriculumBoard:
      subject.curriculumBoard || "Nepal Curriculum / NEB",
    curriculumVersion: String(subject.curriculumVersion || "").trim(),
    fullMarks:
      subject.fullMarks === undefined || subject.fullMarks === null
        ? null
        : subject.fullMarks,
    passMarks:
      subject.passMarks === undefined || subject.passMarks === null
        ? null
        : subject.passMarks,
    creditHours:
      subject.creditHours === undefined || subject.creditHours === null
        ? null
        : subject.creditHours,
    description: String(subject.description || "").trim(),
    sortOrder: Number(subject.sortOrder || 0),
    isActive: subject.isActive !== false,
    schoolId: schoolId || subject.schoolId || "",
  };
};

const mergeSubjectRecords = (...subjectGroups) => {
  const merged = [];

  subjectGroups
    .flat()
    .filter(Boolean)
    .map(normaliseSubject)
    .forEach((subject) => {
      const existingIndex =
        merged.findIndex((existing) =>
          subjectRecordsMatch(
            existing,
            subject
          )
        );

      if (existingIndex === -1) {
        merged.push(subject);
        return;
      }

      const existing =
        merged[existingIndex];

      if (
        !hasPersistentSubjectId(existing) &&
        hasPersistentSubjectId(subject)
      ) {
        merged[existingIndex] = subject;
        return;
      }

      if (
        hasPersistentSubjectId(existing) &&
        !hasPersistentSubjectId(subject)
      ) {
        return;
      }

      if (
        existing.isActive === false &&
        subject.isActive !== false
      ) {
        merged[existingIndex] = subject;
      }
    });

  return merged;
};

const getTeacherSubjectOptions = (allSubjects, assignment) => {
  return allSubjects
    .filter(hasPersistentSubjectId)
    .filter((subject) => isSubjectAvailableForStudent(subject, assignment))
    .sort((a, b) =>
      String(a.name || a.subjectName || "").localeCompare(
        String(b.name || b.subjectName || "")
      )
    );
};

const normaliseAssignedClassForForm = (item = {}, allSubjects = []) => {
  const className = String(item.className || item.class || "").trim();
  const classNumber = Number(className);

  let subjectIds = Array.isArray(item.subjectIds)
    ? item.subjectIds
        .map((subject) =>
          String(
            typeof subject === "object"
              ? getSubjectId(subject)
              : subject || ""
          )
        )
        .filter(Boolean)
    : [];

  const subjectNamesFromObjects = Array.isArray(item.subjectIds)
    ? item.subjectIds
        .filter((subject) => subject && typeof subject === "object")
        .map((subject) =>
          String(subject.name || subject.subjectName || "").trim()
        )
        .filter(Boolean)
    : [];

  const subjects = [
    ...new Set([
      ...(Array.isArray(item.subjects)
        ? item.subjects.map((subject) => String(subject || "").trim())
        : []),
      ...subjectNamesFromObjects,
    ].filter(Boolean)),
  ];

  const assignment = {
    className,
    section: String(item.section || "").trim(),
    stream:
      classNumber >= 11
        ? String(item.stream || "").trim()
        : className
        ? "General"
        : "General",
    subjectIds,
    subjects,
  };

  /*
    Compatibility for older teacher records that stored only
    subject names. Resolve those names to current Subject IDs
    so the admin can save the teacher without rebuilding every
    assignment manually.
  */
  if (subjectIds.length === 0 && subjects.length > 0) {
    const subjectNameSet = new Set(
      subjects.map((name) => String(name || "").trim().toLowerCase())
    );

    subjectIds = getTeacherSubjectOptions(allSubjects, assignment)
      .filter((subject) =>
        subjectNameSet.has(
          String(subject.name || subject.subjectName || "")
            .trim()
            .toLowerCase()
        )
      )
      .map((subject) => String(getSubjectId(subject)))
      .filter(Boolean);

    assignment.subjectIds = subjectIds;
  }

  return assignment;
};

const getAssignmentSubjectNames = (assignment = {}) => {
  const directNames = Array.isArray(assignment.subjects)
    ? assignment.subjects.map((name) => String(name || "").trim()).filter(Boolean)
    : [];

  const populatedNames = Array.isArray(assignment.subjectIds)
    ? assignment.subjectIds
        .filter((subject) => subject && typeof subject === "object")
        .map((subject) =>
          String(subject.name || subject.subjectName || "").trim()
        )
        .filter(Boolean)
    : [];

  return [...new Set([...directNames, ...populatedNames])];
};

const teacherMatchesTimetableSelection = (teacher, selection) => {
  if (!teacher || !isUserActive(teacher)) return false;

  const selectedClass = String(selection?.className || "").trim();
  const selectedSection = String(selection?.section || "").trim();
  const selectedStream = String(selection?.stream || "General").trim();
  const selectedSubjectId = String(selection?.subjectId || "").trim();
  const selectedSubjectName = String(selection?.subjectName || "")
    .trim()
    .toLowerCase();

  if (!selectedClass || !selectedSection || !selectedSubjectId) {
    return false;
  }

  return (teacher.assignedClasses || []).some((assignment) => {
    const assignmentClass = String(assignment?.className || "").trim();
    const assignmentSection = String(assignment?.section || "").trim();
    const assignmentStream = String(assignment?.stream || "General").trim();

    const classMatches = assignmentClass === selectedClass;
    const sectionMatches =
      assignmentSection.toLowerCase() === selectedSection.toLowerCase();

    const classNumber = Number(selectedClass);
    const streamMatches =
      classNumber <= 10 ||
      assignmentStream.toLowerCase() === selectedStream.toLowerCase() ||
      assignmentStream.toLowerCase() === "general";

    const assignmentSubjectIds = Array.isArray(assignment?.subjectIds)
      ? assignment.subjectIds
          .map((subject) =>
            String(
              typeof subject === "object"
                ? getSubjectId(subject)
                : subject || ""
            )
          )
          .filter(Boolean)
      : [];

    const assignmentSubjectNames = getAssignmentSubjectNames(assignment).map(
      (name) => String(name || "").trim().toLowerCase()
    );

    const subjectMatches =
      assignmentSubjectIds.includes(selectedSubjectId) ||
      (selectedSubjectName &&
        assignmentSubjectNames.includes(selectedSubjectName));

    return classMatches && sectionMatches && streamMatches && subjectMatches;
  });
};

const extractAddressComponent = (components, type) => {
  const component = components?.find((item) => item.types?.includes(type));
  return component?.long_name || "";
};

const buildGoogleMapsLink = (profile) => {
  const latitude = profile?.latitude;
  const longitude = profile?.longitude;
  const placeId = profile?.placeId;
  const address = profile?.formattedAddress || profile?.address;

  if (latitude && longitude) {
    const query = encodeURIComponent(`${latitude},${longitude}`);
    const placeQuery = placeId
      ? `&query_place_id=${encodeURIComponent(placeId)}`
      : "";

    return `https://www.google.com/maps/search/?api=1&query=${query}${placeQuery}`;
  }

  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`;
  }

  return "";
};

const loadGooglePlacesScript = () => {
  return new Promise((resolve, reject) => {
    const apiKey = String(GOOGLE_MAPS_API_KEY || "").trim();

    if (!apiKey) {
      reject(new Error("Missing Google Maps API key"));
      return;
    }

    if (window.google?.maps?.places) {
      resolve(window.google);
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", reject);
      return;
    }

    const script = document.createElement("script");

    script.id = GOOGLE_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => resolve(window.google);
    script.onerror = reject;

    document.body.appendChild(script);
  });
};

export default function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeView = useMemo(() => {
    const segment = location.pathname.split("/").filter(Boolean)[1] || "overview";
    return ADMIN_VIEWS.has(segment) ? segment : "overview";
  }, [location.pathname]);

  useEffect(() => {
    const segment = location.pathname.split("/").filter(Boolean)[1];

    if (!segment || !ADMIN_VIEWS.has(segment)) {
      navigate("/admin/overview", { replace: true });
    }
  }, [location.pathname, navigate]);

  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const loggedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const googleMapsKey = useMemo(
    () => String(GOOGLE_MAPS_API_KEY || "").trim(),
    []
  );

  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  const [form, setForm] = useState(emptyCreateForm);

  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState(emptyCreateForm);

  const [subjects, setSubjects] = useState(() =>
    safeReadStorage(SUBJECTS_STORAGE_KEY, [])
  );
  const [subjectForm, setSubjectForm] = useState(emptySubjectForm);
  const [editingSubject, setEditingSubject] = useState(null);
  const [subjectSaving, setSubjectSaving] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectClassFilter, setSubjectClassFilter] = useState("all");
  const [subjectStreamFilter, setSubjectStreamFilter] = useState("all");

  const [timetableEntries, setTimetableEntries] = useState([]);
  const [timetableForm, setTimetableForm] = useState(emptyTimetableForm);
  const [editingTimetable, setEditingTimetable] = useState(null);
  const [selectedTimetableDetails, setSelectedTimetableDetails] = useState(null);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableSaving, setTimetableSaving] = useState(false);
  const [timetableClassFilter, setTimetableClassFilter] = useState("all");
  const [timetableSectionFilter, setTimetableSectionFilter] = useState("all");
  const [timetableStreamFilter, setTimetableStreamFilter] = useState("all");
  const [timetableDayFilter, setTimetableDayFilter] = useState("all");
  const [timetableShowInactive, setTimetableShowInactive] = useState(false);

  const [schoolProfile, setSchoolProfile] = useState(() => {
    return (
      safeReadStorage(SCHOOL_PROFILE_STORAGE_KEY, null) || {
        schoolId: loggedUser.schoolId || "",
        schoolName: loggedUser.schoolName || "",
        address: "",
        formattedAddress: "",
        placeId: "",
        latitude: "",
        longitude: "",
        city: "",
        district: "",
        province: "",
        country: "Nepal",
        phone: "",
        email: "",
        principalName: "",
        adminName: loggedUser.name || "",
        website: "",
        logoUrl: "",
      }
    );
  });

  const [schoolSaving, setSchoolSaving] = useState(false);
  const [addressStatus, setAddressStatus] = useState(
    googleMapsKey ? "Google address autocomplete loading..." : ""
  );

  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const googleMapsLink = useMemo(
    () => buildGoogleMapsLink(schoolProfile),
    [schoolProfile]
  );

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const toArray = (res) => {
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.users)) return res.data.users;
    if (Array.isArray(res?.data?.subjects)) return res.data.subjects;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    return [];
  };

  const showSuccess = (text) => {
    setSuccess(text);
    setError("");
    setTimeout(() => setSuccess(""), 2500);
  };

  const showError = (text) => {
    setError(text);
    setSuccess("");
  };

  const requestWithFallback = async (requests) => {
    let lastError = null;

    for (const request of requests.filter(Boolean)) {
      try {
        const method = request.method.toLowerCase();

        if (method === "delete") {
          return await api.delete(
            request.url,
            request.data ? { data: request.data } : undefined
          );
        }

        return await api[method](request.url, request.data);
      } catch (err) {
        lastError = err;

        const status = err.response?.status;

        if (status === 404 || status === 405) {
          continue;
        }

        throw err;
      }
    }

    throw lastError;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await getUsers();
      const users = toArray(res);

      setAllUsers(users);

      setTeachers(
        users.filter(
          (user) => String(user.role || "").toLowerCase() === "teacher"
        )
      );

      setStudents(
        users.filter(
          (user) => String(user.role || "").toLowerCase() === "student"
        )
      );
    } catch (err) {
      console.error("LOAD USERS ERROR:", err);
      showError(err.response?.data?.message || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    const schoolId =
      loggedUser.schoolId || schoolProfile.schoolId || "";

    const savedSubjects = safeReadStorage(
      SUBJECTS_STORAGE_KEY,
      []
    ).map(normaliseSubject);

    try {
      const res = await getSubjects(schoolId);
      let apiSubjects = toArray(res).map(normaliseSubject);

      const localOnlySubjects =
        savedSubjects.filter(
          (subject) =>
            !hasPersistentSubjectId(
              subject
            ) &&
            !apiSubjects.some(
              (apiSubject) =>
                subjectRecordsMatch(
                  apiSubject,
                  subject
                )
            )
        );

      const syncedSubjects = [];
      const failedLocalSubjects = [];

      for (const localSubject of localOnlySubjects) {
        try {
          const payload =
            buildPersistableSubjectPayload(
              localSubject,
              schoolId
            );

          const createResponse =
            await createSubject(payload);

          const savedSubject =
            normaliseSubject(
              createResponse?.data?.subject ||
                createResponse?.data?.data ||
                createResponse?.data
            );

          if (!hasPersistentSubjectId(savedSubject)) {
            throw new Error(
              "The backend did not return a persistent subject ID."
            );
          }

          syncedSubjects.push(savedSubject);
        } catch (syncError) {
          if (
            syncError?.response?.status ===
            409
          ) {
            try {
              const duplicateResponse =
                await getSubjects(schoolId);

              const duplicateSubjects =
                toArray(
                  duplicateResponse
                ).map(normaliseSubject);

              const existingSubject =
                duplicateSubjects.find(
                  (apiSubject) =>
                    subjectRecordsMatch(
                      apiSubject,
                      localSubject
                    )
                );

              if (
                existingSubject &&
                hasPersistentSubjectId(
                  existingSubject
                )
              ) {
                syncedSubjects.push(
                  existingSubject
                );
                apiSubjects =
                  mergeSubjectRecords(
                    apiSubjects,
                    duplicateSubjects
                  );
                continue;
              }
            } catch (
              duplicateLookupError
            ) {
              console.warn(
                "FAILED TO LOAD EXISTING DUPLICATE SUBJECT:",
                duplicateLookupError
              );
            }
          }

          console.warn(
            "LOCAL SUBJECT SYNC FAILED:",
            localSubject,
            syncError
          );

          failedLocalSubjects.push(localSubject);
        }
      }

      if (syncedSubjects.length > 0) {
        const refreshedResponse =
          await getSubjects(schoolId);

        apiSubjects = toArray(
          refreshedResponse
        ).map(normaliseSubject);
      }

      const finalSubjects =
        mergeSubjectRecords(
          apiSubjects,
          syncedSubjects,
          failedLocalSubjects
        );

      setSubjects(finalSubjects);
      safeWriteStorage(
        SUBJECTS_STORAGE_KEY,
        finalSubjects
      );

      if (failedLocalSubjects.length > 0) {
        showError(
          `${failedLocalSubjects.length} subject${
            failedLocalSubjects.length === 1
              ? " is"
              : "s are"
          } still stored only in this browser and cannot be assigned to a teacher. The app could not match them with a database record. Refresh once more, or delete and recreate only the subjects that remain marked Local only.`
        );
      }
    } catch (err) {
      console.warn(
        "SUBJECTS BACKEND NOT AVAILABLE:",
        err
      );

      setSubjects(savedSubjects);

      if (
        savedSubjects.some(
          (subject) =>
            !hasPersistentSubjectId(subject)
        )
      ) {
        showError(
          "The subjects shown on this page are stored only in this browser because the backend could not be reached. Start the backend and refresh before assigning subjects to teachers."
        );
      }
    }
  };

  const fetchTimetableEntries = async () => {
    try {
      setTimetableLoading(true);

      const res = await getTimetable({
        includeInactive: true,
        currentOnly: false,
      });

      const entries = getArrayFromApiResponse(res)
        .map(normaliseTimetableEntry);

      setTimetableEntries(sortTimetableEntries(entries));
    } catch (err) {
      console.error("LOAD TIMETABLE ERROR:", err);
      showError(
        err.response?.data?.message ||
          "Failed to load timetable entries."
      );
    } finally {
      setTimetableLoading(false);
    }
  };

  const fetchSchoolProfile = async () => {
    try {
      const savedProfile = safeReadStorage(SCHOOL_PROFILE_STORAGE_KEY, null);
      const res = await getSchoolProfile(loggedUser.schoolId || "");

      const profile =
        res?.data?.school ||
        res?.data?.profile ||
        res?.data?.data ||
        res?.data ||
        null;

      if (profile && Object.keys(profile).length > 0) {
        const cleanProfile = {
          schoolId:
            profile.schoolId ||
            profile._id ||
            profile.id ||
            loggedUser.schoolId ||
            "",
          schoolName:
            profile.schoolName ||
            profile.name ||
            loggedUser.schoolName ||
            "",
          address: profile.address || profile.formattedAddress || "",
          formattedAddress: profile.formattedAddress || profile.address || "",
          placeId: profile.placeId || "",
          latitude: profile.latitude || "",
          longitude: profile.longitude || "",
          city: profile.city || "",
          district: profile.district || "",
          province: profile.province || "",
          country: profile.country || "Nepal",
          phone: profile.phone || profile.contact || "",
          email: profile.email || "",
          principalName: profile.principalName || profile.principal || "",
          adminName: profile.adminName || loggedUser.name || "",
          website: profile.website || "",
          logoUrl: profile.logoUrl || "",
        };

        setSchoolProfile(cleanProfile);
        safeWriteStorage(SCHOOL_PROFILE_STORAGE_KEY, cleanProfile);
      } else if (savedProfile) {
        setSchoolProfile(savedProfile);
      }
    } catch (err) {
      console.warn("SCHOOL PROFILE BACKEND NOT AVAILABLE:", err);
      const savedProfile = safeReadStorage(SCHOOL_PROFILE_STORAGE_KEY, null);

      if (savedProfile) {
        setSchoolProfile(savedProfile);
      }
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchSubjects();
    fetchSchoolProfile();
    fetchTimetableEntries();
  }, []);

  useEffect(() => {
    if (!addressInputRef.current) return;

    if (!googleMapsKey) {
      setAddressStatus("");
      return;
    }

    let isMounted = true;

    loadGooglePlacesScript()
      .then(() => {
        if (!isMounted) return;
        if (!window.google?.maps?.places || !addressInputRef.current) return;

        autocompleteRef.current = new window.google.maps.places.Autocomplete(
          addressInputRef.current,
          {
            componentRestrictions: { country: "np" },
            fields: [
              "place_id",
              "formatted_address",
              "geometry",
              "address_components",
              "name",
            ],
          }
        );

        autocompleteRef.current.addListener("place_changed", () => {
          const place = autocompleteRef.current.getPlace();

          if (!place) return;

          const components = place.address_components || [];
          const formattedAddress =
            place.formatted_address || place.name || schoolProfile.address;

          const latitude =
            typeof place.geometry?.location?.lat === "function"
              ? place.geometry.location.lat()
              : "";

          const longitude =
            typeof place.geometry?.location?.lng === "function"
              ? place.geometry.location.lng()
              : "";

          setSchoolProfile((prev) => ({
            ...prev,
            address: formattedAddress,
            formattedAddress,
            placeId: place.place_id || "",
            latitude,
            longitude,
            city:
              extractAddressComponent(components, "locality") ||
              extractAddressComponent(components, "postal_town") ||
              extractAddressComponent(components, "sublocality"),
            district:
              extractAddressComponent(components, "administrative_area_level_2") ||
              extractAddressComponent(components, "administrative_area_level_3"),
            province: extractAddressComponent(
              components,
              "administrative_area_level_1"
            ),
            country: extractAddressComponent(components, "country") || "Nepal",
          }));

          setAddressStatus("Google address selected successfully.");
        });

        setAddressStatus("Google address autocomplete is ready.");
      })
      .catch((err) => {
        console.warn("GOOGLE PLACES ERROR:", err);
        setAddressStatus(
          "Google address autocomplete is not available. You can still type address manually."
        );
      });

    return () => {
      isMounted = false;
    };
  }, [googleMapsKey]);

  const classOptions = useMemo(() => {
    const classes = new Set();

    allUsers.forEach((user) => {
      if (user.className) {
        classes.add(`Class ${user.className} Section ${user.section || ""}`);
      }

      if (Array.isArray(user.assignedClasses)) {
        user.assignedClasses.forEach((item) => {
          if (item.className) {
            classes.add(`Class ${item.className} Section ${item.section || ""}`);
          }
        });
      }
    });

    return Array.from(classes).sort();
  }, [allUsers]);

  const filteredTeachers = teachers.filter((teacher) => {
    const search = searchText.toLowerCase();

    const matchesSearch =
      teacher.name?.toLowerCase().includes(search) ||
      teacher.email?.toLowerCase().includes(search);

    const matchesRole = roleFilter === "all" || roleFilter === "teacher";

    const matchesClass =
      classFilter === "all" ||
      teacher.assignedClasses?.some(
        (item) =>
          `Class ${item.className} Section ${item.section || ""}` ===
          classFilter
      );

    return matchesSearch && matchesRole && matchesClass;
  });

  const filteredStudents = students.filter((student) => {
    const search = searchText.toLowerCase();

    const matchesSearch =
      student.name?.toLowerCase().includes(search) ||
      student.email?.toLowerCase().includes(search);

    const matchesRole = roleFilter === "all" || roleFilter === "student";

    const matchesClass =
      classFilter === "all" ||
      `Class ${student.className} Section ${student.section || ""}` ===
        classFilter;

    return matchesSearch && matchesRole && matchesClass;
  });

  const filteredSubjects = useMemo(() => {
    const search = subjectSearch.toLowerCase();

    return subjects.filter((subject) => {
      const matchesSearch =
        !search ||
        subject.name?.toLowerCase().includes(search) ||
        subject.subjectCode?.toLowerCase().includes(search);

      const matchesClass =
        subjectClassFilter === "all" ||
        String(subject.className) === String(subjectClassFilter);

      const matchesStream =
        subjectStreamFilter === "all" || subject.stream === subjectStreamFilter;

      return matchesSearch && matchesClass && matchesStream;
    });
  }, [subjects, subjectSearch, subjectClassFilter, subjectStreamFilter]);

  const createStudentSubjectOptions = useMemo(
    () => getStudentSubjectOptions(subjects, form),
    [subjects, form.className, form.section, form.stream]
  );

  const editStudentSubjectOptions = useMemo(
    () => getStudentSubjectOptions(subjects, editForm),
    [subjects, editForm.className, editForm.section, editForm.stream]
  );

  const timetableSubjectOptions = useMemo(
    () => getTeacherSubjectOptions(subjects, timetableForm),
    [
      subjects,
      timetableForm.className,
      timetableForm.section,
      timetableForm.stream,
    ]
  );

  const selectedTimetableSubject = useMemo(
    () =>
      timetableSubjectOptions.find(
        (subject) =>
          String(getSubjectId(subject)) ===
          String(timetableForm.subjectId || "")
      ) || null,
    [timetableSubjectOptions, timetableForm.subjectId]
  );

  const timetableTeacherOptions = useMemo(() => {
    const isTeachingPeriod = TEACHING_TIMETABLE_TYPES.has(
      timetableForm.classType
    );

    if (!isTeachingPeriod) {
      return teachers
        .filter(isUserActive)
        .sort((a, b) =>
          String(a.name || "").localeCompare(String(b.name || ""))
        );
    }

    if (
      !timetableForm.className ||
      !timetableForm.section ||
      !timetableForm.subjectId
    ) {
      return [];
    }

    return teachers
      .filter((teacher) =>
        teacherMatchesTimetableSelection(teacher, {
          ...timetableForm,
          subjectName:
            selectedTimetableSubject?.name ||
            selectedTimetableSubject?.subjectName ||
            timetableForm.subjectName,
        })
      )
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [
    teachers,
    timetableForm.className,
    timetableForm.section,
    timetableForm.stream,
    timetableForm.subjectId,
    timetableForm.subjectName,
    timetableForm.classType,
    selectedTimetableSubject,
  ]);

  const filteredTimetableEntries = useMemo(() => {
    return sortTimetableEntries(
      timetableEntries.filter((entry) => {
        const matchesClass =
          timetableClassFilter === "all" ||
          String(entry.className) === String(timetableClassFilter);

        const matchesSection =
          timetableSectionFilter === "all" ||
          String(entry.section).toLowerCase() ===
            String(timetableSectionFilter).toLowerCase();

        const matchesStream =
          timetableStreamFilter === "all" ||
          String(entry.stream || "General").toLowerCase() ===
            String(timetableStreamFilter).toLowerCase();

        const matchesDay =
          timetableDayFilter === "all" ||
          entry.dayOfWeek === timetableDayFilter;

        const matchesStatus =
          timetableShowInactive || entry.isActive !== false;

        return (
          matchesClass &&
          matchesSection &&
          matchesStream &&
          matchesDay &&
          matchesStatus
        );
      })
    );
  }, [
    timetableEntries,
    timetableClassFilter,
    timetableSectionFilter,
    timetableStreamFilter,
    timetableDayFilter,
    timetableShowInactive,
  ]);

  const timetableTimeSlots = useMemo(() => {
    const values = new Set();

    filteredTimetableEntries
      .filter((entry) => entry.isActive !== false)
      .forEach((entry) => {
        if (entry.startTime && entry.endTime) {
          values.add(`${entry.startTime}__${entry.endTime}`);
        }
      });

    return Array.from(values)
      .map((value) => {
        const [startTime, endTime] = value.split("__");

        return {
          key: value,
          startTime,
          endTime,
        };
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [filteredTimetableEntries]);

  const timetableGridMap = useMemo(() => {
    const map = new Map();

    filteredTimetableEntries
      .filter((entry) => entry.isActive !== false)
      .forEach((entry) => {
        const key = `${entry.dayOfWeek}__${entry.startTime}__${entry.endTime}`;
        const current = map.get(key) || [];

        current.push(entry);
        map.set(key, current);
      });

    return map;
  }, [filteredTimetableEntries]);

  const reportData = useMemo(() => {
    const classMap = new Map();

    const ensureClass = (className, section) => {
      const cleanClass = className || "N/A";
      const cleanSection = section || "N/A";
      const key = `Class ${cleanClass} Section ${cleanSection}`;

      if (!classMap.has(key)) {
        classMap.set(key, {
          key,
          className: cleanClass,
          section: cleanSection,
          students: 0,
          activeStudents: 0,
          inactiveStudents: 0,
          teachers: 0,
          subjects: 0,
        });
      }

      return classMap.get(key);
    };

    students.forEach((student) => {
      const row = ensureClass(student.className, student.section);
      row.students += 1;

      if (isUserActive(student)) {
        row.activeStudents += 1;
      } else {
        row.inactiveStudents += 1;
      }
    });

    teachers.forEach((teacher) => {
      if (Array.isArray(teacher.assignedClasses)) {
        teacher.assignedClasses.forEach((item) => {
          const row = ensureClass(item.className, item.section);
          row.teachers += 1;
        });
      }
    });

    subjects.forEach((subject) => {
      const row = ensureClass(subject.className, subject.section || "All");
      row.subjects += 1;
    });

    return {
      totalUsers: allUsers.length,
      totalTeachers: teachers.length,
      totalStudents: students.length,
      activeUsers: allUsers.filter(isUserActive).length,
      inactiveUsers: allUsers.filter((user) => !isUserActive(user)).length,
      totalSubjects: subjects.length,
      totalClasses: classMap.size,
      classRows: Array.from(classMap.values()).sort((a, b) =>
        a.key.localeCompare(b.key)
      ),
    };
  }, [allUsers, teachers, students, subjects]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => {
      if (name === "className") {
        const classNumber = Number(value);

        return {
          ...previous,
          className: value,
          stream:
            classNumber >= 11
              ? previous.stream === "General"
                ? ""
                : previous.stream
              : value
              ? "General"
              : "",
          subjectEnrollmentMode: "stream",
          subjectIds: [],
        };
      }

      if (name === "section" || name === "stream") {
        return {
          ...previous,
          [name]: value,
          subjectEnrollmentMode: "stream",
          subjectIds: [],
        };
      }

      if (name === "subjectEnrollmentMode") {
        return {
          ...previous,
          subjectEnrollmentMode: value,
          subjectIds: value === "individual" ? previous.subjectIds : [],
        };
      }

      return {
        ...previous,
        [name]: value,
      };
    });
  };

  const handleStudentSubjectToggle = (subjectId) => {
    const cleanId = String(subjectId || "");

    if (!cleanId) return;

    setForm((previous) => ({
      ...previous,
      subjectIds: previous.subjectIds.includes(cleanId)
        ? previous.subjectIds.filter((id) => id !== cleanId)
        : [...previous.subjectIds, cleanId],
    }));
  };

  const handleRoleChange = (e) => {
    setForm({
      ...emptyCreateForm,
      role: e.target.value,
    });
  };

  const handleAssignedClassChange = (index, field, value) => {
    setForm((previous) => {
      const updatedClasses = [...previous.assignedClasses];
      const current = {
        ...emptyAssignedClass,
        ...updatedClasses[index],
      };

      if (field === "className") {
        const classNumber = Number(value);

        updatedClasses[index] = {
          ...current,
          className: value,
          stream:
            classNumber >= 11
              ? current.stream === "General"
                ? ""
                : current.stream
              : value
              ? "General"
              : "General",
          subjectIds: [],
          subjects: [],
        };
      } else if (field === "section" || field === "stream") {
        updatedClasses[index] = {
          ...current,
          [field]: value,
          subjectIds: [],
          subjects: [],
        };
      } else {
        updatedClasses[index] = {
          ...current,
          [field]: value,
        };
      }

      return {
        ...previous,
        assignedClasses: updatedClasses,
      };
    });
  };

  const handleTeacherSubjectToggle = (index, subject) => {
    const subjectId = String(getSubjectId(subject) || "");
    const subjectName = String(
      subject?.name || subject?.subjectName || ""
    ).trim();

    if (!subjectId || subjectId.startsWith("local-")) {
      showError(
        "This subject is only stored locally. Save it to the backend before assigning it to a teacher."
      );
      return;
    }

    setForm((previous) => {
      const updatedClasses = [...previous.assignedClasses];
      const current = {
        ...emptyAssignedClass,
        ...updatedClasses[index],
      };

      const selectedIds = Array.isArray(current.subjectIds)
        ? current.subjectIds.map(String)
        : [];

      const isSelected = selectedIds.includes(subjectId);

      updatedClasses[index] = {
        ...current,
        subjectIds: isSelected
          ? selectedIds.filter((id) => id !== subjectId)
          : [...selectedIds, subjectId],
        subjects: isSelected
          ? (current.subjects || []).filter(
              (name) =>
                String(name || "").trim().toLowerCase() !==
                subjectName.toLowerCase()
            )
          : [...new Set([...(current.subjects || []), subjectName].filter(Boolean))],
      };

      return {
        ...previous,
        assignedClasses: updatedClasses,
      };
    });
  };

  const addTeacherClass = () => {
    setForm({
      ...form,
      assignedClasses: [...form.assignedClasses, { ...emptyAssignedClass }],
    });
  };

  const removeTeacherClass = (index) => {
    const updatedClasses = form.assignedClasses.filter((_, i) => i !== index);

    setForm({
      ...form,
      assignedClasses:
        updatedClasses.length > 0
          ? updatedClasses
          : [{ ...emptyAssignedClass }],
    });
  };

  const resetCreateForm = () => {
    setForm(emptyCreateForm);
  };

  const buildCreatePayload = () => {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      role: form.role,
      schoolId: loggedUser.schoolId || schoolProfile.schoolId || "",
    };

    if (form.role === "student") {
      const classNumber = Number(form.className);

      payload.className = form.className.trim();
      payload.section = form.section.trim();
      payload.stream =
        classNumber >= 11 ? form.stream.trim() : "General";
      payload.academicYear = form.academicYear.trim();
      payload.subjectEnrollmentMode =
        form.subjectEnrollmentMode === "individual"
          ? "individual"
          : "stream";
      payload.subjectIds =
        payload.subjectEnrollmentMode === "individual"
          ? form.subjectIds
          : [];
    }

    if (form.role === "teacher") {
      payload.assignedClasses = form.assignedClasses
        .map((item) => {
          const className = String(item.className || "").trim();
          const classNumber = Number(className);

          return {
            className,
            section: String(item.section || "").trim(),
            stream:
              classNumber >= 11
                ? String(item.stream || "").trim()
                : "General",
            subjectIds: Array.isArray(item.subjectIds)
              ? item.subjectIds.map(String).filter(Boolean)
              : [],
            subjects: Array.isArray(item.subjects)
              ? item.subjects.map((name) => String(name || "").trim()).filter(Boolean)
              : [],
          };
        })
        .filter((item) => item.className && item.section);
    }

    return payload;
  };

  const validateCreateForm = () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      return "Please fill name, email, and password.";
    }

    if (form.password.length < 6) {
      return "Password should be at least 6 characters.";
    }

    if (form.role === "student") {
      if (!form.className.trim() || !form.section.trim()) {
        return "Please add class and section for student.";
      }

      if (Number(form.className) >= 11 && !form.stream.trim()) {
        return "Please select the student's stream for Class 11 or 12.";
      }

      if (
        form.subjectEnrollmentMode === "individual" &&
        form.subjectIds.length === 0
      ) {
        return "Select at least one subject for individual subject enrolment.";
      }
    }

    if (form.role === "teacher") {
      const cleanAssignedClasses = form.assignedClasses
        .map((item) => ({
          className: String(item.className || "").trim(),
          section: String(item.section || "").trim(),
          stream: String(item.stream || "").trim(),
          subjectIds: Array.isArray(item.subjectIds)
            ? item.subjectIds.filter(Boolean)
            : [],
        }))
        .filter((item) => item.className && item.section);

      if (cleanAssignedClasses.length === 0) {
        return "Please assign at least one class to the teacher.";
      }

      const incompleteAssignment = cleanAssignedClasses.find(
        (item) => Number(item.className) >= 11 && !item.stream
      );

      if (incompleteAssignment) {
        return `Select a stream for Class ${incompleteAssignment.className}, Section ${incompleteAssignment.section}.`;
      }

      const assignmentWithoutSubject = cleanAssignedClasses.find(
        (item) => item.subjectIds.length === 0
      );

      if (assignmentWithoutSubject) {
        return `Select at least one teaching subject for Class ${assignmentWithoutSubject.className}, Section ${assignmentWithoutSubject.section}.`;
      }
    }

    return "";
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();

    try {
      setCreating(true);
      setError("");
      setSuccess("");

      const validationError = validateCreateForm();

      if (validationError) {
        showError(validationError);
        return;
      }

      const payload = buildCreatePayload();

      await createUser(payload);

      showSuccess(`${form.role} created successfully.`);
      resetCreateForm();
      fetchUsers();
    } catch (err) {
      console.error("CREATE USER ERROR:", err);
      showError(err.response?.data?.message || "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (user) => {
    navigate("/admin/users");
    setEditingUser(user);
    setError("");
    setSuccess("");

    setEditForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role || "student",
      className: user.className || "",
      section: user.section || "",
      stream:
        user.stream ||
        (Number(user.className) > 0 && Number(user.className) <= 10
          ? "General"
          : ""),
      academicYear: user.academicYear || "",
      subjectEnrollmentMode:
        user.subjectEnrollmentMode ||
        (Array.isArray(user.subjectIds) && user.subjectIds.length > 0
          ? "individual"
          : "stream"),
      subjectIds: Array.isArray(user.subjectIds)
        ? user.subjectIds
            .map((subject) =>
              String(
                typeof subject === "object"
                  ? getSubjectId(subject)
                  : subject || ""
              )
            )
            .filter(Boolean)
        : [],
      assignedClasses:
        Array.isArray(user.assignedClasses) && user.assignedClasses.length > 0
          ? user.assignedClasses.map((item) =>
              normaliseAssignedClassForForm(item, subjects)
            )
          : [{ ...emptyAssignedClass }],
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditForm(emptyCreateForm);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;

    setEditForm((previous) => {
      if (name === "className") {
        const classNumber = Number(value);

        return {
          ...previous,
          className: value,
          stream:
            classNumber >= 11
              ? previous.stream === "General"
                ? ""
                : previous.stream
              : value
              ? "General"
              : "",
          subjectEnrollmentMode: "stream",
          subjectIds: [],
        };
      }

      if (name === "section" || name === "stream") {
        return {
          ...previous,
          [name]: value,
          subjectEnrollmentMode: "stream",
          subjectIds: [],
        };
      }

      if (name === "subjectEnrollmentMode") {
        return {
          ...previous,
          subjectEnrollmentMode: value,
          subjectIds: value === "individual" ? previous.subjectIds : [],
        };
      }

      return {
        ...previous,
        [name]: value,
      };
    });
  };

  const handleEditStudentSubjectToggle = (subjectId) => {
    const cleanId = String(subjectId || "");

    if (!cleanId) return;

    setEditForm((previous) => ({
      ...previous,
      subjectIds: previous.subjectIds.includes(cleanId)
        ? previous.subjectIds.filter((id) => id !== cleanId)
        : [...previous.subjectIds, cleanId],
    }));
  };

  const handleEditRoleChange = (e) => {
    setEditForm({
      ...editForm,
      role: e.target.value,
      className: "",
      section: "",
      stream: "",
      academicYear: "",
      subjectEnrollmentMode: "stream",
      subjectIds: [],
      assignedClasses: [{ ...emptyAssignedClass }],
    });
  };

  const handleEditAssignedClassChange = (index, field, value) => {
    setEditForm((previous) => {
      const updatedClasses = [...previous.assignedClasses];
      const current = {
        ...emptyAssignedClass,
        ...updatedClasses[index],
      };

      if (field === "className") {
        const classNumber = Number(value);

        updatedClasses[index] = {
          ...current,
          className: value,
          stream:
            classNumber >= 11
              ? current.stream === "General"
                ? ""
                : current.stream
              : value
              ? "General"
              : "General",
          subjectIds: [],
          subjects: [],
        };
      } else if (field === "section" || field === "stream") {
        updatedClasses[index] = {
          ...current,
          [field]: value,
          subjectIds: [],
          subjects: [],
        };
      } else {
        updatedClasses[index] = {
          ...current,
          [field]: value,
        };
      }

      return {
        ...previous,
        assignedClasses: updatedClasses,
      };
    });
  };

  const handleEditTeacherSubjectToggle = (index, subject) => {
    const subjectId = String(getSubjectId(subject) || "");
    const subjectName = String(
      subject?.name || subject?.subjectName || ""
    ).trim();

    if (!subjectId || subjectId.startsWith("local-")) {
      showError(
        "This subject is only stored locally. Save it to the backend before assigning it to a teacher."
      );
      return;
    }

    setEditForm((previous) => {
      const updatedClasses = [...previous.assignedClasses];
      const current = {
        ...emptyAssignedClass,
        ...updatedClasses[index],
      };

      const selectedIds = Array.isArray(current.subjectIds)
        ? current.subjectIds.map(String)
        : [];

      const isSelected = selectedIds.includes(subjectId);

      updatedClasses[index] = {
        ...current,
        subjectIds: isSelected
          ? selectedIds.filter((id) => id !== subjectId)
          : [...selectedIds, subjectId],
        subjects: isSelected
          ? (current.subjects || []).filter(
              (name) =>
                String(name || "").trim().toLowerCase() !==
                subjectName.toLowerCase()
            )
          : [...new Set([...(current.subjects || []), subjectName].filter(Boolean))],
      };

      return {
        ...previous,
        assignedClasses: updatedClasses,
      };
    });
  };

  const addEditTeacherClass = () => {
    setEditForm({
      ...editForm,
      assignedClasses: [
        ...editForm.assignedClasses,
        { ...emptyAssignedClass },
      ],
    });
  };

  const removeEditTeacherClass = (index) => {
    const updatedClasses = editForm.assignedClasses.filter(
      (_, i) => i !== index
    );

    setEditForm({
      ...editForm,
      assignedClasses:
        updatedClasses.length > 0
          ? updatedClasses
          : [{ ...emptyAssignedClass }],
    });
  };

  const validateEditForm = () => {
    if (!editForm.name.trim() || !editForm.email.trim()) {
      return "Please fill name and email.";
    }

    if (editForm.role === "student") {
      if (!editForm.className.trim() || !editForm.section.trim()) {
        return "Please add class and section for student.";
      }

      if (Number(editForm.className) >= 11 && !editForm.stream.trim()) {
        return "Please select the student's stream for Class 11 or 12.";
      }

      if (
        editForm.subjectEnrollmentMode === "individual" &&
        editForm.subjectIds.length === 0
      ) {
        return "Select at least one subject for individual subject enrolment.";
      }
    }

    if (editForm.role === "teacher") {
      const cleanAssignedClasses = editForm.assignedClasses
        .map((item) => ({
          className: String(item.className || "").trim(),
          section: String(item.section || "").trim(),
          stream: String(item.stream || "").trim(),
          subjectIds: Array.isArray(item.subjectIds)
            ? item.subjectIds.filter(Boolean)
            : [],
        }))
        .filter((item) => item.className && item.section);

      if (cleanAssignedClasses.length === 0) {
        return "Please assign at least one class to the teacher.";
      }

      const incompleteAssignment = cleanAssignedClasses.find(
        (item) => Number(item.className) >= 11 && !item.stream
      );

      if (incompleteAssignment) {
        return `Select a stream for Class ${incompleteAssignment.className}, Section ${incompleteAssignment.section}.`;
      }

      const assignmentWithoutSubject = cleanAssignedClasses.find(
        (item) => item.subjectIds.length === 0
      );

      if (assignmentWithoutSubject) {
        return `Select at least one teaching subject for Class ${assignmentWithoutSubject.className}, Section ${assignmentWithoutSubject.section}.`;
      }
    }

    return "";
  };

  const buildEditPayload = () => {
    const payload = {
      name: editForm.name.trim(),
      email: editForm.email.trim().toLowerCase(),
      role: editForm.role,
      schoolId: loggedUser.schoolId || schoolProfile.schoolId || "",
    };

    if (editForm.role === "student") {
      const classNumber = Number(editForm.className);

      payload.className = editForm.className.trim();
      payload.section = editForm.section.trim();
      payload.stream =
        classNumber >= 11 ? editForm.stream.trim() : "General";
      payload.academicYear = editForm.academicYear.trim();
      payload.subjectEnrollmentMode =
        editForm.subjectEnrollmentMode === "individual"
          ? "individual"
          : "stream";
      payload.subjectIds =
        payload.subjectEnrollmentMode === "individual"
          ? editForm.subjectIds
          : [];
      payload.assignedClasses = [];
    }

    if (editForm.role === "teacher") {
      payload.className = "";
      payload.section = "";
      payload.assignedClasses = editForm.assignedClasses
        .map((item) => {
          const className = String(item.className || "").trim();
          const classNumber = Number(className);

          return {
            className,
            section: String(item.section || "").trim(),
            stream:
              classNumber >= 11
                ? String(item.stream || "").trim()
                : "General",
            subjectIds: Array.isArray(item.subjectIds)
              ? item.subjectIds.map(String).filter(Boolean)
              : [],
            subjects: Array.isArray(item.subjects)
              ? item.subjects.map((name) => String(name || "").trim()).filter(Boolean)
              : [],
          };
        })
        .filter((item) => item.className && item.section);
    }

    return payload;
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();

    if (!editingUser) return;

    try {
      setUpdating(true);
      setError("");
      setSuccess("");

      const validationError = validateEditForm();

      if (validationError) {
        showError(validationError);
        return;
      }

      const userId = getId(editingUser);
      const payload = buildEditPayload();

      await requestWithFallback([
        {
          method: "put",
          url: `/users/${userId}`,
          data: payload,
        },
        {
          method: "patch",
          url: `/users/${userId}`,
          data: payload,
        },
        {
          method: "put",
          url: `/users/update/${userId}`,
          data: payload,
        },
      ]);

      showSuccess("User updated successfully.");
      cancelEdit();
      fetchUsers();
    } catch (err) {
      console.error("UPDATE USER ERROR:", err);
      showError(err.response?.data?.message || "Failed to update user.");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleStatus = async (user) => {
    const userId = getId(user);
    const activeNow = isUserActive(user);
    const nextActive = !activeNow;

    const confirmText = nextActive
      ? `Activate ${user.name}?`
      : `Deactivate ${user.name}?`;

    if (!window.confirm(confirmText)) return;

    try {
      setError("");
      setSuccess("");

      await requestWithFallback([
        {
          method: "patch",
          url: `/users/${userId}/status`,
          data: {
            isActive: nextActive,
            status: nextActive ? "active" : "inactive",
          },
        },
        {
          method: "put",
          url: `/users/${userId}/status`,
          data: {
            isActive: nextActive,
            status: nextActive ? "active" : "inactive",
          },
        },
        {
          method: "put",
          url: `/users/${userId}`,
          data: {
            isActive: nextActive,
            status: nextActive ? "active" : "inactive",
          },
        },
      ]);

      showSuccess(nextActive ? "User activated." : "User deactivated.");
      fetchUsers();
    } catch (err) {
      console.error("STATUS UPDATE ERROR:", err);
      showError(err.response?.data?.message || "Failed to update user status.");
    }
  };

  const handleResetPassword = async (user) => {
    const newPassword = window.prompt(
      `Enter new password for ${user.name}. Minimum 6 characters.`
    );

    if (!newPassword) return;

    if (newPassword.length < 6) {
      showError("Password should be at least 6 characters.");
      return;
    }

    try {
      setError("");
      setSuccess("");

      const userId = getId(user);

      await requestWithFallback([
        {
          method: "patch",
          url: `/users/${userId}/reset-password`,
          data: { password: newPassword, newPassword },
        },
        {
          method: "put",
          url: `/users/${userId}/reset-password`,
          data: { password: newPassword, newPassword },
        },
        {
          method: "patch",
          url: `/users/reset-password/${userId}`,
          data: { password: newPassword, newPassword },
        },
        {
          method: "put",
          url: `/users/${userId}/password`,
          data: { password: newPassword, newPassword },
        },
      ]);

      showSuccess("Password reset successfully.");
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);
      showError(err.response?.data?.message || "Failed to reset password.");
    }
  };

  const handleDeleteUser = async (user) => {
    const userId = getId(user);

    if (String(userId) === String(getId(loggedUser))) {
      showError("You cannot delete your own admin account.");
      return;
    }

    if (
      !window.confirm(
        `Delete ${user.name}? This action will remove this user account.`
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await requestWithFallback([
        {
          method: "delete",
          url: `/users/${userId}`,
        },
        {
          method: "delete",
          url: `/users/delete/${userId}`,
        },
      ]);

      showSuccess("User deleted successfully.");
      fetchUsers();
    } catch (err) {
      console.error("DELETE USER ERROR:", err);
      showError(err.response?.data?.message || "Failed to delete user.");
    }
  };

  const handleSchoolProfileChange = (e) => {
    setSchoolProfile({
      ...schoolProfile,
      [e.target.name]: e.target.value,
    });
  };

  const clearGoogleLocation = () => {
    setSchoolProfile((prev) => ({
      ...prev,
      formattedAddress: "",
      placeId: "",
      latitude: "",
      longitude: "",
      city: "",
      district: "",
      province: "",
      country: "Nepal",
    }));

    setAddressStatus("Google location data cleared. Address can be typed manually.");
  };

  const handleSaveSchoolProfile = async (e) => {
    e.preventDefault();

    if (!schoolProfile.schoolName.trim()) {
      showError("Please enter school name.");
      return;
    }

    try {
      setSchoolSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        ...schoolProfile,
        schoolId: schoolProfile.schoolId || loggedUser.schoolId || "",
        schoolName: schoolProfile.schoolName.trim(),
        address: schoolProfile.address.trim(),
        formattedAddress:
          schoolProfile.formattedAddress || schoolProfile.address.trim(),
      };

      setSchoolProfile(payload);
      safeWriteStorage(SCHOOL_PROFILE_STORAGE_KEY, payload);

      try {
        await saveSchoolProfile(payload);
      } catch (backendErr) {
        console.warn("SCHOOL PROFILE SAVED LOCALLY:", backendErr);
      }

      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

      localStorage.setItem(
        "user",
        JSON.stringify({
          ...currentUser,
          schoolName: payload.schoolName,
          schoolId: payload.schoolId,
        })
      );

      showSuccess("School profile saved successfully.");
    } catch (err) {
      console.error("SAVE SCHOOL PROFILE ERROR:", err);
      showError("Failed to save school profile.");
    } finally {
      setSchoolSaving(false);
    }
  };

  const handleSubjectFormChange = (e) => {
    const { name, value } = e.target;

    if (name === "className") {
      const classNumber = Number(value);

      setSubjectForm((prev) => ({
        ...prev,
        className: value,
        stream: classNumber >= 11 ? prev.stream : "General",
        subjectCode: prev.name ? makeSubjectCode(prev.name, value) : "",
      }));

      return;
    }

    if (name === "name") {
      setSubjectForm((prev) => ({
        ...prev,
        name: value,
        subjectCode: makeSubjectCode(value, prev.className),
      }));

      return;
    }

    setSubjectForm({
      ...subjectForm,
      [name]: value,
    });
  };

  const resetSubjectForm = () => {
    setSubjectForm(emptySubjectForm);
    setEditingSubject(null);
  };

  const buildSubjectPayload = () => {
    const subjectCode =
      subjectForm.subjectCode.trim() ||
      makeSubjectCode(subjectForm.name, subjectForm.className);

    return {
      name: subjectForm.name.trim(),
      subjectName: subjectForm.name.trim(),
      code: subjectCode,
      subjectCode,
      className: subjectForm.className.trim(),
      section: subjectForm.section.trim() || "All",
      stream: subjectForm.stream.trim() || "General",
      type: subjectForm.type,
      level: getNepalLevel(subjectForm.className),
      schoolId: loggedUser.schoolId || schoolProfile.schoolId || "",
    };
  };

  const handleSubjectSubmit = async (e) => {
    e.preventDefault();

    if (
      !subjectForm.name.trim() ||
      !subjectForm.className.trim()
    ) {
      showError(
        "Please add subject name and class."
      );
      return;
    }

    try {
      setSubjectSaving(true);
      setError("");
      setSuccess("");

      const payload = buildSubjectPayload();

      if (editingSubject) {
        const subjectId =
          getSubjectId(editingSubject);

        let response;

        if (
          !subjectId ||
          String(subjectId).startsWith("local-")
        ) {
          response =
            await createSubject(payload);
        } else {
          response =
            await updateSubject(
              subjectId,
              payload
            );
        }

        const updatedSubject =
          normaliseSubject(
            response?.data?.subject ||
              response?.data?.data ||
              response?.data
          );

        if (
          !hasPersistentSubjectId(
            updatedSubject
          )
        ) {
          throw new Error(
            "The subject was not saved to the database."
          );
        }

        const nextSubjects =
          mergeSubjectRecords(
            subjects.filter(
              (subject) =>
                String(
                  getSubjectId(subject)
                ) !== String(subjectId)
            ),
            [updatedSubject]
          );

        setSubjects(nextSubjects);
        safeWriteStorage(
          SUBJECTS_STORAGE_KEY,
          nextSubjects
        );

        showSuccess(
          "Subject updated successfully."
        );
      } else {
        const response =
          await createSubject(payload);

        const newSubject =
          normaliseSubject(
            response?.data?.subject ||
              response?.data?.data ||
              response?.data
          );

        if (
          !hasPersistentSubjectId(
            newSubject
          )
        ) {
          throw new Error(
            "The subject was not saved to the database."
          );
        }

        const nextSubjects =
          mergeSubjectRecords(
            subjects,
            [newSubject]
          );

        setSubjects(nextSubjects);
        safeWriteStorage(
          SUBJECTS_STORAGE_KEY,
          nextSubjects
        );

        showSuccess(
          "Subject added successfully."
        );
      }

      resetSubjectForm();
      await fetchSubjects();
    } catch (err) {
      console.error(
        "SUBJECT SAVE ERROR:",
        err
      );

      showError(
        err.response?.data?.message ||
          err.message ||
          "Failed to save subject to the database."
      );
    } finally {
      setSubjectSaving(false);
    }
  };

  const handleAutoAddNepalSubjects = async () => {
    if (!subjectForm.className) {
      showError(
        "Select class first before auto-adding subjects."
      );
      return;
    }

    try {
      setSubjectSaving(true);
      setError("");
      setSuccess("");

      const templateSubjects =
        getNepalSubjectTemplates(
          subjectForm.className,
          subjectForm.stream ||
            "General"
        );

      const section =
        subjectForm.section.trim() ||
        "All";

      const schoolId =
        loggedUser.schoolId ||
        schoolProfile.schoolId ||
        "";

      const subjectsToCreate =
        templateSubjects
          .map((item) =>
            buildPersistableSubjectPayload(
              {
                ...item,
                className:
                  subjectForm.className,
                section,
                sections: [section],
                subjectCode:
                  makeSubjectCode(
                    item.name,
                    subjectForm.className
                  ),
                code:
                  makeSubjectCode(
                    item.name,
                    subjectForm.className
                  ),
                level:
                  getNepalLevel(
                    subjectForm.className
                  ),
              },
              schoolId
            )
          )
          .filter((newSubject) => {
            const newKey =
              getSubjectIdentityKey(
                newSubject
              );

            return !subjects.some(
              (existing) =>
                getSubjectIdentityKey(
                  existing
                ) === newKey &&
                hasPersistentSubjectId(
                  existing
                )
            );
          });

      if (
        subjectsToCreate.length === 0
      ) {
        showError(
          "These subjects already exist in the database for the selected class and stream."
        );
        return;
      }

      const savedSubjects = [];
      const failedSubjects = [];

      for (
        const subjectPayload of
        subjectsToCreate
      ) {
        try {
          const response =
            await createSubject(
              subjectPayload
            );

          const savedSubject =
            normaliseSubject(
              response?.data?.subject ||
                response?.data?.data ||
                response?.data
            );

          if (
            !hasPersistentSubjectId(
              savedSubject
            )
          ) {
            throw new Error(
              "The backend did not return a persistent subject ID."
            );
          }

          savedSubjects.push(
            savedSubject
          );
        } catch (subjectError) {
          console.error(
            "AUTO ADD SUBJECT ERROR:",
            subjectPayload,
            subjectError
          );

          failedSubjects.push({
            name:
              subjectPayload.name,
            error:
              subjectError.response?.data
                ?.message ||
              subjectError.message ||
              "Unknown error",
          });
        }
      }

      if (
        savedSubjects.length === 0
      ) {
        throw new Error(
          failedSubjects[0]?.error ||
            "No subjects could be saved to the database."
        );
      }

      const nextSubjects =
        mergeSubjectRecords(
          subjects,
          savedSubjects
        );

      setSubjects(nextSubjects);
      safeWriteStorage(
        SUBJECTS_STORAGE_KEY,
        nextSubjects
      );

      await fetchSubjects();

      if (
        failedSubjects.length > 0
      ) {
        showError(
          `${savedSubjects.length} subject${
            savedSubjects.length === 1
              ? ""
              : "s"
          } saved, but ${failedSubjects.length} failed. ${failedSubjects
            .map(
              (item) =>
                `${item.name}: ${item.error}`
            )
            .join(" | ")}`
        );
      } else {
        showSuccess(
          `${savedSubjects.length} Nepal curriculum subject${
            savedSubjects.length === 1
              ? ""
              : "s"
          } added to the database.`
        );
      }
    } catch (err) {
      console.error(
        "AUTO ADD SUBJECTS ERROR:",
        err
      );

      showError(
        err.response?.data?.message ||
          err.message ||
          "Failed to auto-add subjects to the database."
      );
    } finally {
      setSubjectSaving(false);
    }
  };

  const startSubjectEdit = (subject) => {
    navigate("/admin/subjects");
    setEditingSubject(subject);
    setSubjectForm({
      name: subject.name || subject.subjectName || "",
      subjectCode: subject.subjectCode || subject.code || "",
      className: subject.className || "",
      section: subject.section === "All" ? "" : subject.section || "",
      stream: subject.stream || "General",
      type: subject.type || "Compulsory",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteSubject = async (subject) => {
    const subjectId = getSubjectId(subject);

    if (!window.confirm(`Delete subject "${subject.name}"?`)) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      if (subjectId && !String(subjectId).startsWith("local-")) {
        try {
          await deleteSubject(subjectId);
        } catch (backendErr) {
          console.warn("SUBJECT DELETED LOCALLY:", backendErr);
        }
      }

      const nextSubjects = subjects.filter(
        (item) => String(getSubjectId(item)) !== String(subjectId)
      );

      setSubjects(nextSubjects);
      safeWriteStorage(SUBJECTS_STORAGE_KEY, nextSubjects);
      showSuccess("Subject deleted successfully.");
    } catch (err) {
      console.error("DELETE SUBJECT ERROR:", err);
      showError("Failed to delete subject.");
    }
  };

  const handleTimetableFormChange = (event) => {
    const { name, value } = event.target;

    setTimetableForm((previous) => {
      if (name === "className") {
        const classNumber = Number(value);

        return {
          ...previous,
          className: value,
          stream:
            classNumber >= 11
              ? previous.stream === "General"
                ? ""
                : previous.stream
              : "General",
          subjectId: "",
          subjectName: "",
          subjectCode: "",
          teacherId: "",
          teacherName: "",
        };
      }

      if (name === "section" || name === "stream") {
        return {
          ...previous,
          [name]: value,
          subjectId: "",
          subjectName: "",
          subjectCode: "",
          teacherId: "",
          teacherName: "",
        };
      }

      if (name === "subjectId") {
        const selectedSubject = subjects.find(
          (subject) =>
            String(getSubjectId(subject)) === String(value)
        );

        return {
          ...previous,
          subjectId: value,
          subjectName:
            selectedSubject?.name ||
            selectedSubject?.subjectName ||
            "",
          subjectCode:
            selectedSubject?.subjectCode ||
            selectedSubject?.code ||
            "",
          teacherId: "",
          teacherName: "",
        };
      }

      if (name === "teacherId") {
        const selectedTeacher = teachers.find(
          (teacher) => String(getId(teacher)) === String(value)
        );

        return {
          ...previous,
          teacherId: value,
          teacherName: selectedTeacher?.name || "",
        };
      }

      if (name === "classType") {
        const teachingPeriod = TEACHING_TIMETABLE_TYPES.has(value);

        return {
          ...previous,
          classType: value,
          subjectId: teachingPeriod ? previous.subjectId : "",
          subjectName: teachingPeriod ? previous.subjectName : "",
          subjectCode: teachingPeriod ? previous.subjectCode : "",
          teacherId: teachingPeriod ? previous.teacherId : "",
          teacherName: teachingPeriod ? previous.teacherName : "",
        };
      }

      return {
        ...previous,
        [name]: value,
      };
    });
  };

  const resetTimetableForm = () => {
    setTimetableForm(emptyTimetableForm);
    setEditingTimetable(null);
  };

  const validateTimetableForm = () => {
    if (!timetableForm.className || !timetableForm.section) {
      return "Select the class and section.";
    }

    if (Number(timetableForm.className) >= 11 && !timetableForm.stream) {
      return "Select the stream or programme for Class 11 or 12.";
    }

    if (
      !timetableForm.dayOfWeek ||
      !timetableForm.startTime ||
      !timetableForm.endTime
    ) {
      return "Select the day, start time and end time.";
    }

    if (timetableForm.endTime <= timetableForm.startTime) {
      return "End time must be later than start time.";
    }

    if (
      timetableForm.validFrom &&
      timetableForm.validUntil &&
      timetableForm.validUntil < timetableForm.validFrom
    ) {
      return "Valid-until date cannot be before valid-from date.";
    }

    if (TEACHING_TIMETABLE_TYPES.has(timetableForm.classType)) {
      if (!timetableForm.subjectId) {
        return "Select the subject for this teaching period.";
      }

      if (!timetableForm.teacherId) {
        return "Select the appointed teacher for this subject.";
      }
    }

    return "";
  };

  const buildTimetablePayload = () => {
    const classNumber = Number(timetableForm.className);
    const teachingPeriod = TEACHING_TIMETABLE_TYPES.has(
      timetableForm.classType
    );

    return {
      className: String(timetableForm.className || "").trim(),
      section: String(timetableForm.section || "").trim(),
      stream:
        classNumber >= 11
          ? String(timetableForm.stream || "").trim()
          : "General",
      academicYear: String(timetableForm.academicYear || "").trim(),
      dayOfWeek: timetableForm.dayOfWeek,
      startTime: timetableForm.startTime,
      endTime: timetableForm.endTime,
      periodNumber:
        timetableForm.periodNumber === ""
          ? null
          : Number(timetableForm.periodNumber),
      subjectId: teachingPeriod ? timetableForm.subjectId : "",
      subjectName: teachingPeriod ? timetableForm.subjectName : "",
      subjectCode: teachingPeriod ? timetableForm.subjectCode : "",
      teacherId: teachingPeriod ? timetableForm.teacherId : "",
      teacherName: teachingPeriod ? timetableForm.teacherName : "",
      room: String(timetableForm.room || "").trim(),
      classType: timetableForm.classType,
      notes: String(timetableForm.notes || "").trim(),
      validFrom: timetableForm.validFrom || null,
      validUntil: timetableForm.validUntil || null,
      isActive: timetableForm.isActive !== false,
      schoolId: loggedUser.schoolId || schoolProfile.schoolId || "",
    };
  };

  const handleTimetableSubmit = async (event) => {
    event.preventDefault();

    const validationError = validateTimetableForm();

    if (validationError) {
      showError(validationError);
      return;
    }

    try {
      setTimetableSaving(true);
      setError("");
      setSuccess("");

      const payload = buildTimetablePayload();

      if (editingTimetable) {
        await updateTimetable(
          getTimetableId(editingTimetable),
          payload
        );

        showSuccess("Timetable period updated successfully.");
      } else {
        await createTimetable(payload);
        showSuccess("Timetable period added successfully.");
      }

      resetTimetableForm();
      await fetchTimetableEntries();
    } catch (err) {
      console.error("SAVE TIMETABLE ERROR:", err);
      showError(
        err.response?.data?.message ||
          "Failed to save timetable period."
      );
    } finally {
      setTimetableSaving(false);
    }
  };

  const startTimetableEdit = (entry) => {
    const normalised = normaliseTimetableEntry(entry);

    setEditingTimetable(normalised);
    setSelectedTimetableDetails(null);

    setTimetableForm({
      className: normalised.className,
      section: normalised.section,
      stream:
        Number(normalised.className) >= 11
          ? normalised.stream || "General"
          : "General",
      academicYear: normalised.academicYear,
      dayOfWeek: normalised.dayOfWeek || "Sunday",
      startTime: normalised.startTime,
      endTime: normalised.endTime,
      periodNumber: normalised.periodNumber,
      subjectId: String(normalised.subjectId || ""),
      subjectName: normalised.subjectName,
      subjectCode: normalised.subjectCode,
      teacherId: String(normalised.teacherId || ""),
      teacherName: normalised.teacherName,
      room: normalised.room,
      classType: normalised.classType || "Regular Class",
      notes: normalised.notes,
      validFrom: toDateInputValue(normalised.validFrom),
      validUntil: toDateInputValue(normalised.validUntil),
      isActive: normalised.isActive !== false,
    });

    navigate("/admin/timetable");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleTimetableDeactivate = async (entry) => {
    const timetableId = getTimetableId(entry);

    if (!timetableId) return;

    if (
      !window.confirm(
        `Deactivate ${entry.subjectName || entry.classType} on ${
          entry.dayOfWeek
        } from ${entry.startTime} to ${entry.endTime}?`
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await deleteTimetable(timetableId);
      showSuccess("Timetable period deactivated.");
      await fetchTimetableEntries();
    } catch (err) {
      console.error("DEACTIVATE TIMETABLE ERROR:", err);
      showError(
        err.response?.data?.message ||
          "Failed to deactivate timetable period."
      );
    }
  };

  const handleTimetableActivate = async (entry) => {
    try {
      setError("");
      setSuccess("");

      await updateTimetable(getTimetableId(entry), {
        ...normaliseTimetableEntry(entry),
        validFrom: toDateInputValue(entry.validFrom) || null,
        validUntil: toDateInputValue(entry.validUntil) || null,
        isActive: true,
      });

      showSuccess("Timetable period activated.");
      await fetchTimetableEntries();
    } catch (err) {
      console.error("ACTIVATE TIMETABLE ERROR:", err);
      showError(
        err.response?.data?.message ||
          "Failed to activate timetable period."
      );
    }
  };

  const handleTimetablePermanentDelete = async (entry) => {
    const timetableId = getTimetableId(entry);

    if (!timetableId) return;

    if (
      !window.confirm(
        "Permanently delete this timetable record? This cannot be undone."
      )
    ) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await deleteTimetable(timetableId, {
        permanent: true,
      });

      showSuccess("Timetable period permanently deleted.");
      setSelectedTimetableDetails(null);
      await fetchTimetableEntries();
    } catch (err) {
      console.error("DELETE TIMETABLE ERROR:", err);
      showError(
        err.response?.data?.message ||
          "Failed to delete timetable period."
      );
    }
  };

  const downloadReportsCsv = () => {
    const escapeCsv = (value) => {
      const text = String(value ?? "");

      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }

      return text;
    };

    const rows = [
      ["Hamro Shikshya Admin Report"],
      ["School", schoolProfile.schoolName || loggedUser.schoolName || "N/A"],
      ["Address", schoolProfile.formattedAddress || schoolProfile.address || "N/A"],
      ["Generated At", new Date().toLocaleString()],
      [],
      ["Summary"],
      ["Total Users", reportData.totalUsers],
      ["Teachers", reportData.totalTeachers],
      ["Students", reportData.totalStudents],
      ["Active Users", reportData.activeUsers],
      ["Inactive Users", reportData.inactiveUsers],
      ["Subjects", reportData.totalSubjects],
      ["Classes/Sections", reportData.totalClasses],
      [],
      ["Class Report"],
      [
        "Class",
        "Section",
        "Students",
        "Active Students",
        "Inactive Students",
        "Assigned Teachers",
        "Subjects",
      ],
      ...reportData.classRows.map((row) => [
        row.className,
        row.section,
        row.students,
        row.activeStudents,
        row.inactiveStudents,
        row.teachers,
        row.subjects,
      ]),
      [],
      ["Subject Report"],
      [
        "Subject",
        "Code",
        "Class",
        "Section",
        "Level",
        "Stream",
        "Type",
      ],
      ...subjects.map((subject) => [
        subject.name,
        subject.subjectCode,
        subject.className,
        subject.section || "All",
        subject.level || getNepalLevel(subject.className),
        subject.stream || "General",
        subject.type || "Compulsory",
      ]),
    ];

    const csvContent = rows.map((row) => row.map(escapeCsv).join(",")).join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "hamro-shikshya-admin-report.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const renderUserActions = (user) => {
    const userId = getId(user);
    const self = String(userId) === String(getId(loggedUser));
    const active = isUserActive(user);

    return (
      <div className="admin-row-actions">
        <button
          className="small-btn add-btn"
          type="button"
          onClick={() => startEdit(user)}
        >
          Edit
        </button>

        <button
          className="small-btn add-btn"
          type="button"
          onClick={() => handleResetPassword(user)}
        >
          Reset Password
        </button>

        {!self && (
          <button
            className="small-btn remove-btn"
            type="button"
            onClick={() => handleToggleStatus(user)}
          >
            {active ? "Deactivate" : "Activate"}
          </button>
        )}

        {!self && (
          <button
            className="small-btn remove-btn"
            type="button"
            onClick={() => handleDeleteUser(user)}
          >
            Delete
          </button>
        )}
      </div>
    );
  };

  const renderTeacherAssignmentEditor = (item, index, isEdit = false) => {
    const assignment = {
      ...emptyAssignedClass,
      ...item,
      subjectIds: Array.isArray(item?.subjectIds)
        ? item.subjectIds.map(String)
        : [],
      subjects: Array.isArray(item?.subjects) ? item.subjects : [],
    };

    const classNumber = Number(assignment.className);
    const matchingSubjectsIncludingLocal = subjects.filter(
      (subject) =>
        isSubjectAvailableForStudent(
          subject,
          assignment
        )
    );
    const localMatchingSubjects =
      matchingSubjectsIncludingLocal.filter(
        (subject) =>
          !hasPersistentSubjectId(subject)
      );
    const availableSubjects =
      matchingSubjectsIncludingLocal
        .filter(hasPersistentSubjectId)
        .sort((a, b) =>
          String(
            a.name ||
              a.subjectName ||
              ""
          ).localeCompare(
            String(
              b.name ||
                b.subjectName ||
                ""
            )
          )
        );
    const selectedIds = assignment.subjectIds;

    const handleFieldChange = isEdit
      ? handleEditAssignedClassChange
      : handleAssignedClassChange;

    const handleSubjectToggle = isEdit
      ? handleEditTeacherSubjectToggle
      : handleTeacherSubjectToggle;

    const handleRemove = isEdit
      ? removeEditTeacherClass
      : removeTeacherClass;

    return (
      <div
        key={`${isEdit ? "edit" : "create"}-teacher-assignment-${index}`}
        style={{
          marginBottom: 18,
          padding: 18,
          border: "1px solid #dbe7f5",
          borderRadius: 18,
          background: "#f8fbff",
        }}
      >
        <div
          className="admin-section-title-row"
          style={{ marginBottom: 14, alignItems: "center" }}
        >
          <div>
            <h4 style={{ margin: 0 }}>
              Teaching Assignment {index + 1}
            </h4>
            <p className="dashboard-muted" style={{ margin: "5px 0 0" }}>
              Choose the class, section and only the subject or subjects this
              teacher is officially appointed to teach.
            </p>
          </div>

          <button
            className="small-btn remove-btn"
            type="button"
            onClick={() => handleRemove(index)}
          >
            Remove Assignment
          </button>
        </div>

        <div className="form-grid">
          <div className="auth-form-group">
            <label>Class</label>
            <select
              className="auth-select"
              value={assignment.className}
              onChange={(event) =>
                handleFieldChange(index, "className", event.target.value)
              }
              required
            >
              <option value="">Select class</option>
              {NEPAL_CLASSES.map((className) => (
                <option key={className} value={className}>
                  Class {className}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-form-group">
            <label>Section</label>
            <select
              className="auth-select"
              value={assignment.section}
              onChange={(event) =>
                handleFieldChange(index, "section", event.target.value)
              }
              required
            >
              <option value="">Select section</option>
              {SECTION_OPTIONS.map((section) => (
                <option key={section} value={section}>
                  Section {section}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-form-group">
            <label>Stream / Programme</label>
            <select
              className="auth-select"
              value={
                classNumber > 0 && classNumber <= 10
                  ? "General"
                  : assignment.stream
              }
              onChange={(event) =>
                handleFieldChange(index, "stream", event.target.value)
              }
              disabled={!assignment.className || (classNumber > 0 && classNumber <= 10)}
              required={classNumber >= 11}
            >
              {classNumber >= 11 ? (
                <>
                  <option value="">Select stream</option>
                  {STREAM_OPTIONS.map((stream) => (
                    <option key={stream} value={stream}>
                      {stream}
                    </option>
                  ))}
                </>
              ) : (
                <option value="General">General</option>
              )}
            </select>
          </div>
        </div>

        {!assignment.className || !assignment.section ? (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "#ffffff",
              border: "1px dashed #cbd5e1",
            }}
          >
            <p className="dashboard-muted" style={{ margin: 0 }}>
              Select the class and section first. The matching school subjects
              will then appear here.
            </p>
          </div>
        ) : classNumber >= 11 && !assignment.stream ? (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
            }}
          >
            <p className="dashboard-muted" style={{ margin: 0 }}>
              Select the Class {assignment.className} stream before choosing a
              teaching subject.
            </p>
          </div>
        ) : availableSubjects.length === 0 ? (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: "#fff7ed",
              border: "1px solid #fed7aa",
            }}
          >
            <strong>
              {localMatchingSubjects.length > 0
                ? "Matching subjects are not saved to the database"
                : "No matching subjects configured"}
            </strong>
            <p className="dashboard-muted" style={{ margin: "6px 0 0" }}>
              {localMatchingSubjects.length > 0
                ? `${localMatchingSubjects.length} matching subject${
                    localMatchingSubjects.length === 1 ? " is" : "s are"
                  } visible in Subject Management, but ${
                    localMatchingSubjects.length === 1 ? "it has" : "they have"
                  } only been saved in this browser. Make sure the backend is running, then refresh the page so the subject records can be synchronised to MongoDB.`
                : `Add active subjects for Class ${assignment.className}, Section ${
                    assignment.section
                  }${
                    classNumber >= 11
                      ? `, ${assignment.stream} stream`
                      : ""
                  } from Subject Management first.`}
            </p>
          </div>
        ) : (
          <div
            style={{
              marginTop: 14,
              padding: 16,
              borderRadius: 16,
              background: "#ffffff",
              border: "1px solid #dbe7f5",
            }}
          >
            <div
              className="admin-section-title-row"
              style={{ marginBottom: 12, alignItems: "center" }}
            >
              <div>
                <h4 style={{ margin: 0 }}>Teaching Subjects</h4>
                <p className="dashboard-muted" style={{ margin: "5px 0 0" }}>
                  Selected: {selectedIds.length}. The teacher will only see
                  these subjects for this class and section.
                </p>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {availableSubjects.map((subject) => {
                const subjectId = String(getSubjectId(subject));
                const selected = selectedIds.includes(subjectId);

                return (
                  <label
                    key={`${index}-${subjectId}`}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: 12,
                      border: selected
                        ? "1px solid #2563eb"
                        : "1px solid #dbe7f5",
                      borderRadius: 13,
                      background: selected ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => handleSubjectToggle(index, subject)}
                    />

                    <span>
                      <strong style={{ display: "block" }}>
                        {subject.name || subject.subjectName}
                      </strong>
                      <small className="dashboard-muted">
                        {subject.subjectCode || subject.code || "No code"} ·{" "}
                        {subject.type || "Subject"} ·{" "}
                        {subject.stream || "General"}
                      </small>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PortalLayout
      role="admin"
      portalName="Admin Portal"
      user={loggedUser}
      navigation={ADMIN_NAVIGATION}
      onLogout={logout}
      headerMeta={
        <>
          <span className="portal-header-pill">
            🏫 {schoolProfile.schoolName || loggedUser.schoolName || "School not set"}
          </span>
          {loading && <span className="portal-header-pill">Loading…</span>}
        </>
      }
    >
      <div
        className="dashboard-page admin-dashboard-page portal-page-stack"
        style={{ minHeight: "auto", padding: 0, background: "transparent" }}
      >
      <section
        className="dashboard-card dashboard-header admin-hero"
        hidden={activeView !== "overview"}
      >
        <div>
          <span className="admin-top-badge">School Admin Panel</span>
          <h1 className="dashboard-main-title">Admin Dashboard</h1>

          <p className="dashboard-muted">
            Logged in as <b>{loggedUser.name || "Admin"}</b>
          </p>

          <p className="dashboard-muted">
            School:{" "}
            <b>
              {schoolProfile.schoolName ||
                loggedUser.schoolName ||
                "Not available"}
            </b>
          </p>
        </div>

        <div className="admin-hero-actions">
          <button className="primary-btn" type="button" onClick={downloadReportsCsv}>
            Download Report
          </button>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      {(error || success || loading) && (
        <section className="dashboard-card admin-message-card">
          {error && <div className="error-box">{error}</div>}
          {success && <div className="success-box">{success}</div>}
          {loading && <p>Loading users...</p>}
        </section>
      )}

      <section className="admin-stats-grid" hidden={activeView !== "overview"}>
        <div className="admin-stat-card blue">
          <span>Total Users</span>
          <strong>{reportData.totalUsers}</strong>
          <p>Teachers, students and admin users</p>
        </div>

        <div className="admin-stat-card green">
          <span>Teachers</span>
          <strong>{reportData.totalTeachers}</strong>
          <p>Assigned to classes and sections</p>
        </div>

        <div className="admin-stat-card purple">
          <span>Students</span>
          <strong>{reportData.totalStudents}</strong>
          <p>Registered under your school</p>
        </div>

        <div className="admin-stat-card orange">
          <span>Subjects</span>
          <strong>{reportData.totalSubjects}</strong>
          <p>Nepal curriculum subject records</p>
        </div>
      </section>

      <section className="admin-quick-grid" hidden={activeView !== "overview"}>
        <div className="admin-quick-card">
          <h3>School Setup</h3>
          <p>Manage profile, address, contact and Google location.</p>
        </div>

        <div className="admin-quick-card">
          <h3>User Control</h3>
          <p>Create, edit, deactivate and reset teacher/student accounts.</p>
        </div>

        <div className="admin-quick-card">
          <h3>Curriculum</h3>
          <p>Add subjects for classes 1 to 12 based on Nepal education structure.</p>
        </div>

        <div className="admin-quick-card">
          <h3>Reports</h3>
          <p>Download school, user, class and subject reports as CSV.</p>
        </div>
      </section>

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "school"}
      >
        <div className="admin-section-title-row">
          <div>
            <h2 className="card-title">School Profile</h2>
            <p className="dashboard-muted">
              Keep your school details updated for teachers and students.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSchoolProfile}>
          <div className="form-grid">
            <div className="auth-form-group">
              <label>School Name</label>
              <input
                className="auth-input"
                name="schoolName"
                placeholder="Example: Hamro Shikshya School"
                value={schoolProfile.schoolName}
                onChange={handleSchoolProfileChange}
                required
              />
            </div>

            <div className="auth-form-group">
              <label>School Address</label>
              <input
                ref={addressInputRef}
                className="auth-input"
                name="address"
                placeholder="Search school address in Nepal"
                value={schoolProfile.address}
                onChange={handleSchoolProfileChange}
              />
              <small className="dashboard-muted">{addressStatus}</small>
            </div>

            <div className="auth-form-group">
              <label>City / Local Area</label>
              <input
                className="auth-input"
                name="city"
                placeholder="Example: Kathmandu"
                value={schoolProfile.city}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>District</label>
              <input
                className="auth-input"
                name="district"
                placeholder="Example: Kathmandu"
                value={schoolProfile.district}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Province</label>
              <input
                className="auth-input"
                name="province"
                placeholder="Example: Bagmati Province"
                value={schoolProfile.province}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Country</label>
              <input
                className="auth-input"
                name="country"
                placeholder="Nepal"
                value={schoolProfile.country}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Phone</label>
              <input
                className="auth-input"
                name="phone"
                placeholder="Example: 01-XXXXXXX"
                value={schoolProfile.phone}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Email</label>
              <input
                className="auth-input"
                name="email"
                type="email"
                placeholder="school@example.com"
                value={schoolProfile.email}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Principal Name</label>
              <input
                className="auth-input"
                name="principalName"
                placeholder="Principal name"
                value={schoolProfile.principalName}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Admin Name</label>
              <input
                className="auth-input"
                name="adminName"
                placeholder="Admin name"
                value={schoolProfile.adminName}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Website</label>
              <input
                className="auth-input"
                name="website"
                placeholder="https://school.edu.np"
                value={schoolProfile.website}
                onChange={handleSchoolProfileChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Logo URL</label>
              <input
                className="auth-input"
                name="logoUrl"
                placeholder="https://example.com/logo.png"
                value={schoolProfile.logoUrl || ""}
                onChange={handleSchoolProfileChange}
              />
            </div>
          </div>

          {(schoolProfile.latitude ||
            schoolProfile.longitude ||
            schoolProfile.placeId) && (
            <div className="admin-location-box">
              <h3>Google Location Details</h3>

              <p className="dashboard-muted">
                Place ID: <b>{schoolProfile.placeId || "N/A"}</b>
              </p>

              <p className="dashboard-muted">
                Latitude: <b>{schoolProfile.latitude || "N/A"}</b>
              </p>

              <p className="dashboard-muted">
                Longitude: <b>{schoolProfile.longitude || "N/A"}</b>
              </p>

              <div className="admin-row-actions">
                {googleMapsLink && (
                  <a
                    className="small-btn add-btn"
                    href={googleMapsLink}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Google Maps
                  </a>
                )}

                <button
                  className="small-btn remove-btn"
                  type="button"
                  onClick={clearGoogleLocation}
                >
                  Clear Google Location
                </button>
              </div>
            </div>
          )}

          <button className="primary-btn" type="submit" disabled={schoolSaving}>
            {schoolSaving ? "Saving..." : "Save School Profile"}
          </button>
        </form>
      </section>

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "subjects"}
      >
        <div className="admin-section-title-row">
          <div>
            <h2 className="card-title">Subject Management</h2>
            <p className="dashboard-muted">
              Add school subjects according to Nepal classes, streams and sections.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubjectSubmit}>
          <div className="form-grid">
            <div className="auth-form-group">
              <label>Class</label>
              <select
                className="auth-select"
                name="className"
                value={subjectForm.className}
                onChange={handleSubjectFormChange}
                required
              >
                <option value="">Select class</option>
                {NEPAL_CLASSES.map((className) => (
                  <option key={className} value={className}>
                    Class {className} - {getNepalLevel(className)}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form-group">
              <label>Section</label>
              <select
                className="auth-select"
                name="section"
                value={subjectForm.section}
                onChange={handleSubjectFormChange}
              >
                <option value="">All Sections</option>
                {SECTION_OPTIONS.map((section) => (
                  <option key={section} value={section}>
                    Section {section}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form-group">
              <label>Stream</label>
              <select
                className="auth-select"
                name="stream"
                value={subjectForm.stream}
                onChange={handleSubjectFormChange}
                disabled={
                  Number(subjectForm.className) > 0 &&
                  Number(subjectForm.className) <= 10
                }
              >
                {STREAM_OPTIONS.map((stream) => (
                  <option key={stream} value={stream}>
                    {stream}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form-group">
              <label>Subject Name</label>
              <input
                className="auth-input"
                name="name"
                placeholder="Example: Mathematics"
                value={subjectForm.name}
                onChange={handleSubjectFormChange}
                required
              />
            </div>

            <div className="auth-form-group">
              <label>Subject Code</label>
              <input
                className="auth-input"
                name="subjectCode"
                placeholder="Auto generated, example: MATH-11"
                value={subjectForm.subjectCode}
                onChange={handleSubjectFormChange}
              />
            </div>

            <div className="auth-form-group">
              <label>Subject Type</label>
              <select
                className="auth-select"
                name="type"
                value={subjectForm.type}
                onChange={handleSubjectFormChange}
              >
                {SUBJECT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="dashboard-muted">
            Level: <b>{getNepalLevel(subjectForm.className)}</b>
          </p>

          <div className="admin-row-actions">
            <button className="primary-btn" type="submit" disabled={subjectSaving}>
              {subjectSaving
                ? "Saving..."
                : editingSubject
                ? "Update Subject"
                : "Add Subject"}
            </button>

            <button
              className="small-btn add-btn"
              type="button"
              onClick={handleAutoAddNepalSubjects}
              disabled={subjectSaving}
            >
              Auto Add Nepal Subjects
            </button>

            {editingSubject && (
              <button
                className="logout-btn"
                type="button"
                onClick={resetSubjectForm}
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <hr className="admin-divider" />

        <h3>Subjects</h3>

        <div className="form-grid">
          <input
            className="auth-input"
            placeholder="Search subject or code"
            value={subjectSearch}
            onChange={(e) => setSubjectSearch(e.target.value)}
          />

          <select
            className="auth-select"
            value={subjectClassFilter}
            onChange={(e) => setSubjectClassFilter(e.target.value)}
          >
            <option value="all">All classes</option>
            {NEPAL_CLASSES.map((className) => (
              <option key={className} value={className}>
                Class {className}
              </option>
            ))}
          </select>

          <select
            className="auth-select"
            value={subjectStreamFilter}
            onChange={(e) => setSubjectStreamFilter(e.target.value)}
          >
            <option value="all">All streams</option>
            {STREAM_OPTIONS.map((stream) => (
              <option key={stream} value={stream}>
                {stream}
              </option>
            ))}
          </select>
        </div>

        {filteredSubjects.length === 0 ? (
          <p>No subjects found.</p>
        ) : (
          <div className="admin-list-grid">
            {filteredSubjects.map((subject) => (
              <article className="admin-user-card" key={getSubjectId(subject)}>
                <h3>{subject.name}</h3>
                <p>Code: {subject.subjectCode || subject.code || "N/A"}</p>
                <p>
                  Class {subject.className || "N/A"} Section{" "}
                  {subject.section || "All"}
                </p>
                <p>Level: {subject.level || getNepalLevel(subject.className)}</p>
                <p>Stream: {subject.stream || "General"}</p>
                <span className="badge badge-info">
                  {subject.type || "Compulsory"}
                </span>

                {hasPersistentSubjectId(subject) ? (
                  <span className="badge badge-success">
                    Saved to database
                  </span>
                ) : (
                  <span className="badge badge-danger">
                    Local only — cannot assign
                  </span>
                )}

                <div className="admin-row-actions">
                  <button
                    className="small-btn add-btn"
                    type="button"
                    onClick={() => startSubjectEdit(subject)}
                  >
                    Edit
                  </button>

                  <button
                    className="small-btn remove-btn"
                    type="button"
                    onClick={() => handleDeleteSubject(subject)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "timetable"}
      >
        <div className="admin-section-title-row">
          <div>
            <h2 className="card-title">Weekly Timetable Management</h2>
            <p className="dashboard-muted">
              Build the weekly class schedule. Students and teachers will
              automatically receive the periods connected to their class,
              section, stream and subject appointments.
            </p>
          </div>

          <button
            className="small-btn add-btn"
            type="button"
            onClick={fetchTimetableEntries}
            disabled={timetableLoading}
          >
            {timetableLoading ? "Refreshing..." : "Refresh Timetable"}
          </button>
        </div>

        <form onSubmit={handleTimetableSubmit}>
          <div className="admin-inner-box">
            <div className="admin-section-title-row">
              <div>
                <h3 style={{ margin: 0 }}>
                  {editingTimetable
                    ? "Edit Timetable Period"
                    : "Add Timetable Period"}
                </h3>
                <p className="dashboard-muted" style={{ margin: "6px 0 0" }}>
                  Teaching periods use the existing Subject and Teacher
                  appointments, preventing an unassigned teacher from being
                  scheduled for the wrong subject.
                </p>
              </div>
            </div>

            <div className="form-grid">
              <div className="auth-form-group">
                <label>Class</label>
                <select
                  className="auth-select"
                  name="className"
                  value={timetableForm.className}
                  onChange={handleTimetableFormChange}
                  required
                >
                  <option value="">Select class</option>
                  {NEPAL_CLASSES.map((className) => (
                    <option key={className} value={className}>
                      Class {className}
                    </option>
                  ))}
                </select>
              </div>

              <div className="auth-form-group">
                <label>Section</label>
                <select
                  className="auth-select"
                  name="section"
                  value={timetableForm.section}
                  onChange={handleTimetableFormChange}
                  required
                >
                  <option value="">Select section</option>
                  {SECTION_OPTIONS.map((section) => (
                    <option key={section} value={section}>
                      Section {section}
                    </option>
                  ))}
                </select>
              </div>

              <div className="auth-form-group">
                <label>Stream / Programme</label>
                <select
                  className="auth-select"
                  name="stream"
                  value={
                    Number(timetableForm.className) > 0 &&
                    Number(timetableForm.className) <= 10
                      ? "General"
                      : timetableForm.stream
                  }
                  onChange={handleTimetableFormChange}
                  disabled={
                    !timetableForm.className ||
                    (Number(timetableForm.className) > 0 &&
                      Number(timetableForm.className) <= 10)
                  }
                  required={Number(timetableForm.className) >= 11}
                >
                  {Number(timetableForm.className) >= 11 ? (
                    <>
                      <option value="">Select stream</option>
                      {STREAM_OPTIONS.map((stream) => (
                        <option key={stream} value={stream}>
                          {stream}
                        </option>
                      ))}
                    </>
                  ) : (
                    <option value="General">General</option>
                  )}
                </select>
              </div>

              <div className="auth-form-group">
                <label>Academic Year</label>
                <input
                  className="auth-input"
                  name="academicYear"
                  placeholder="Example: 2082/83"
                  value={timetableForm.academicYear}
                  onChange={handleTimetableFormChange}
                />
              </div>

              <div className="auth-form-group">
                <label>Period Type</label>
                <select
                  className="auth-select"
                  name="classType"
                  value={timetableForm.classType}
                  onChange={handleTimetableFormChange}
                >
                  {TIMETABLE_CLASS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="auth-form-group">
                <label>Day</label>
                <select
                  className="auth-select"
                  name="dayOfWeek"
                  value={timetableForm.dayOfWeek}
                  onChange={handleTimetableFormChange}
                  required
                >
                  {TIMETABLE_DAYS.map((day) => (
                    <option key={day} value={day}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div className="auth-form-group">
                <label>Start Time</label>
                <input
                  className="auth-input"
                  type="time"
                  name="startTime"
                  value={timetableForm.startTime}
                  onChange={handleTimetableFormChange}
                  required
                />
              </div>

              <div className="auth-form-group">
                <label>End Time</label>
                <input
                  className="auth-input"
                  type="time"
                  name="endTime"
                  value={timetableForm.endTime}
                  onChange={handleTimetableFormChange}
                  required
                />
              </div>

              <div className="auth-form-group">
                <label>Period Number</label>
                <input
                  className="auth-input"
                  type="number"
                  min="1"
                  name="periodNumber"
                  placeholder="Example: 1"
                  value={timetableForm.periodNumber}
                  onChange={handleTimetableFormChange}
                />
              </div>

              <div className="auth-form-group">
                <label>Room / Location</label>
                <input
                  className="auth-input"
                  name="room"
                  placeholder="Example: Room 11 or Science Lab"
                  value={timetableForm.room}
                  onChange={handleTimetableFormChange}
                />
              </div>

              <div className="auth-form-group">
                <label>Valid From</label>
                <input
                  className="auth-input"
                  type="date"
                  name="validFrom"
                  value={timetableForm.validFrom}
                  onChange={handleTimetableFormChange}
                />
              </div>

              <div className="auth-form-group">
                <label>Valid Until</label>
                <input
                  className="auth-input"
                  type="date"
                  name="validUntil"
                  value={timetableForm.validUntil}
                  onChange={handleTimetableFormChange}
                />
              </div>
            </div>

            {TEACHING_TIMETABLE_TYPES.has(timetableForm.classType) ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  border: "1px solid #dbe7f5",
                  borderRadius: 16,
                  background: "#ffffff",
                }}
              >
                <div className="form-grid">
                  <div className="auth-form-group">
                    <label>Subject</label>
                    <select
                      className="auth-select"
                      name="subjectId"
                      value={timetableForm.subjectId}
                      onChange={handleTimetableFormChange}
                      disabled={
                        !timetableForm.className ||
                        !timetableForm.section ||
                        (Number(timetableForm.className) >= 11 &&
                          !timetableForm.stream)
                      }
                      required
                    >
                      <option value="">Select subject</option>
                      {timetableSubjectOptions.map((subject) => (
                        <option
                          key={getSubjectId(subject)}
                          value={getSubjectId(subject)}
                        >
                          {subject.name || subject.subjectName}
                          {subject.subjectCode || subject.code
                            ? ` (${subject.subjectCode || subject.code})`
                            : ""}
                        </option>
                      ))}
                    </select>

                    {timetableForm.className &&
                      timetableForm.section &&
                      (Number(timetableForm.className) < 11 ||
                        timetableForm.stream) &&
                      timetableSubjectOptions.length === 0 && (
                        <small
                          style={{
                            display: "block",
                            marginTop: 7,
                            color: "#b45309",
                          }}
                        >
                          No active subjects match this class, section and
                          stream. Configure them under Subject Management.
                        </small>
                      )}
                  </div>

                  <div className="auth-form-group">
                    <label>Appointed Teacher</label>
                    <select
                      className="auth-select"
                      name="teacherId"
                      value={timetableForm.teacherId}
                      onChange={handleTimetableFormChange}
                      disabled={!timetableForm.subjectId}
                      required
                    >
                      <option value="">Select teacher</option>
                      {timetableTeacherOptions.map((teacher) => (
                        <option key={getId(teacher)} value={getId(teacher)}>
                          {teacher.name}
                        </option>
                      ))}
                    </select>

                    {timetableForm.subjectId &&
                      timetableTeacherOptions.length === 0 && (
                        <small
                          style={{
                            display: "block",
                            marginTop: 7,
                            color: "#b45309",
                          }}
                        >
                          No active teacher is appointed to this subject for
                          the selected class and section. Edit the teacher
                          appointment first.
                        </small>
                      )}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 14,
                  background: "#f8fbff",
                  border: "1px solid #dbe7f5",
                }}
              >
                <p className="dashboard-muted" style={{ margin: 0 }}>
                  {timetableForm.classType} does not require a subject or
                  teacher. It will appear in the weekly schedule as a
                  non-teaching period.
                </p>
              </div>
            )}

            <div className="auth-form-group" style={{ marginTop: 16 }}>
              <label>Notes</label>
              <textarea
                className="auth-input"
                name="notes"
                rows="3"
                placeholder="Optional details such as lab instructions, assembly point or temporary changes"
                value={timetableForm.notes}
                onChange={handleTimetableFormChange}
                style={{ resize: "vertical" }}
              />
            </div>

            <div className="admin-row-actions">
              <button
                className="primary-btn"
                type="submit"
                disabled={timetableSaving}
              >
                {timetableSaving
                  ? "Saving..."
                  : editingTimetable
                  ? "Update Period"
                  : "Add Period"}
              </button>

              {editingTimetable && (
                <button
                  className="logout-btn"
                  type="button"
                  onClick={resetTimetableForm}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </form>

        <hr className="admin-divider" />

        <div className="admin-section-title-row">
          <div>
            <h3 style={{ margin: 0 }}>Weekly Timetable</h3>
            <p className="dashboard-muted" style={{ margin: "6px 0 0" }}>
              Click any timetable block to open its full details.
            </p>
          </div>

          <span className="badge badge-info">
            {filteredTimetableEntries.length} record
            {filteredTimetableEntries.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="form-grid" style={{ marginTop: 16 }}>
          <select
            className="auth-select"
            value={timetableClassFilter}
            onChange={(event) => {
              setTimetableClassFilter(event.target.value);
              setTimetableSectionFilter("all");
              setTimetableStreamFilter("all");
            }}
          >
            <option value="all">All classes</option>
            {NEPAL_CLASSES.map((className) => (
              <option key={className} value={className}>
                Class {className}
              </option>
            ))}
          </select>

          <select
            className="auth-select"
            value={timetableSectionFilter}
            onChange={(event) => setTimetableSectionFilter(event.target.value)}
          >
            <option value="all">All sections</option>
            {SECTION_OPTIONS.map((section) => (
              <option key={section} value={section}>
                Section {section}
              </option>
            ))}
          </select>

          <select
            className="auth-select"
            value={timetableStreamFilter}
            onChange={(event) => setTimetableStreamFilter(event.target.value)}
          >
            <option value="all">All streams</option>
            {STREAM_OPTIONS.map((stream) => (
              <option key={stream} value={stream}>
                {stream}
              </option>
            ))}
          </select>

          <select
            className="auth-select"
            value={timetableDayFilter}
            onChange={(event) => setTimetableDayFilter(event.target.value)}
          >
            <option value="all">Full week</option>
            {TIMETABLE_DAYS.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              minHeight: 44,
              padding: "0 12px",
              border: "1px solid #dbe7f5",
              borderRadius: 12,
              background: "#ffffff",
            }}
          >
            <input
              type="checkbox"
              checked={timetableShowInactive}
              onChange={(event) =>
                setTimetableShowInactive(event.target.checked)
              }
            />
            Show inactive records
          </label>
        </div>

        {timetableLoading ? (
          <p style={{ marginTop: 18 }}>Loading timetable...</p>
        ) : timetableTimeSlots.length === 0 ? (
          <div
            style={{
              marginTop: 18,
              padding: 18,
              borderRadius: 16,
              border: "1px dashed #cbd5e1",
              background: "#f8fbff",
            }}
          >
            <strong>No active timetable periods found</strong>
            <p className="dashboard-muted" style={{ margin: "6px 0 0" }}>
              Add the first period above or change the timetable filters.
            </p>
          </div>
        ) : (
          <div
            className="table-wrap"
            style={{
              marginTop: 18,
              overflowX: "auto",
            }}
          >
            <table
              className="dashboard-table"
              style={{
                minWidth: 1100,
                tableLayout: "fixed",
              }}
            >
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Time</th>
                  {TIMETABLE_DAYS.filter(
                    (day) =>
                      timetableDayFilter === "all" ||
                      timetableDayFilter === day
                  ).map((day) => (
                    <th key={day}>{day}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {timetableTimeSlots.map((slot) => (
                  <tr key={slot.key}>
                    <td>
                      <strong>{slot.startTime}</strong>
                      <br />
                      <span className="dashboard-muted">to {slot.endTime}</span>
                    </td>

                    {TIMETABLE_DAYS.filter(
                      (day) =>
                        timetableDayFilter === "all" ||
                        timetableDayFilter === day
                    ).map((day) => {
                      const cellEntries =
                        timetableGridMap.get(
                          `${day}__${slot.startTime}__${slot.endTime}`
                        ) || [];

                      return (
                        <td key={`${slot.key}-${day}`} style={{ verticalAlign: "top" }}>
                          {cellEntries.length === 0 ? (
                            <span className="dashboard-muted">—</span>
                          ) : (
                            <div style={{ display: "grid", gap: 8 }}>
                              {cellEntries.map((entry) => (
                                <button
                                  key={getTimetableId(entry)}
                                  type="button"
                                  onClick={() =>
                                    setSelectedTimetableDetails(entry)
                                  }
                                  style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: 10,
                                    borderRadius: 12,
                                    border: "1px solid #bfdbfe",
                                    background: "#eff6ff",
                                    cursor: "pointer",
                                  }}
                                >
                                  <strong style={{ display: "block" }}>
                                    {entry.subjectName || entry.classType}
                                  </strong>
                                  <small style={{ display: "block", marginTop: 3 }}>
                                    Class {entry.className}-{entry.section}
                                    {Number(entry.className) >= 11
                                      ? ` · ${entry.stream}`
                                      : ""}
                                  </small>
                                  <small className="dashboard-muted">
                                    {entry.teacherName ||
                                      (TEACHING_TIMETABLE_TYPES.has(entry.classType)
                                        ? "Teacher not set"
                                        : entry.classType)}
                                    {entry.room ? ` · ${entry.room}` : ""}
                                  </small>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <hr className="admin-divider" />

        <h3>Timetable Records</h3>

        {filteredTimetableEntries.length === 0 ? (
          <p>No timetable records match the selected filters.</p>
        ) : (
          <div className="admin-list-grid">
            {filteredTimetableEntries.map((entry) => (
              <article
                className="admin-user-card"
                key={getTimetableId(entry)}
                style={{
                  opacity: entry.isActive === false ? 0.68 : 1,
                }}
              >
                <div className="admin-user-card-top">
                  <h3>{entry.subjectName || entry.classType}</h3>
                  <span
                    className={
                      entry.isActive === false
                        ? "badge badge-danger"
                        : "badge badge-success"
                    }
                  >
                    {entry.isActive === false ? "Inactive" : "Active"}
                  </span>
                </div>

                <p>
                  <b>{entry.dayOfWeek}</b> · {entry.startTime}–{entry.endTime}
                </p>

                <p>
                  Class {entry.className}, Section {entry.section}
                  {Number(entry.className) >= 11
                    ? ` · ${entry.stream}`
                    : ""}
                </p>

                <p>
                  <b>Teacher:</b> {entry.teacherName || "Not required"}
                </p>

                <p>
                  <b>Room:</b> {entry.room || "Not assigned"}
                </p>

                <div className="admin-row-actions">
                  <button
                    className="small-btn add-btn"
                    type="button"
                    onClick={() => setSelectedTimetableDetails(entry)}
                  >
                    View Details
                  </button>

                  <button
                    className="small-btn add-btn"
                    type="button"
                    onClick={() => startTimetableEdit(entry)}
                  >
                    Edit
                  </button>

                  {entry.isActive === false ? (
                    <>
                      <button
                        className="small-btn add-btn"
                        type="button"
                        onClick={() => handleTimetableActivate(entry)}
                      >
                        Activate
                      </button>

                      <button
                        className="small-btn remove-btn"
                        type="button"
                        onClick={() => handleTimetablePermanentDelete(entry)}
                      >
                        Delete Permanently
                      </button>
                    </>
                  ) : (
                    <button
                      className="small-btn remove-btn"
                      type="button"
                      onClick={() => handleTimetableDeactivate(entry)}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {selectedTimetableDetails && (
          <div
            role="presentation"
            onClick={() => setSelectedTimetableDetails(null)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
              background: "rgba(15, 23, 42, 0.58)",
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Timetable details"
              onClick={(event) => event.stopPropagation()}
              style={{
                width: "min(620px, 100%)",
                maxHeight: "88vh",
                overflowY: "auto",
                padding: 24,
                borderRadius: 20,
                background: "#ffffff",
                boxShadow: "0 24px 70px rgba(15, 23, 42, 0.25)",
              }}
            >
              <div className="admin-section-title-row">
                <div>
                  <span className="admin-top-badge">
                    {selectedTimetableDetails.classType}
                  </span>
                  <h2 style={{ margin: "10px 0 0" }}>
                    {selectedTimetableDetails.subjectName ||
                      selectedTimetableDetails.classType}
                  </h2>
                </div>

                <button
                  className="logout-btn"
                  type="button"
                  onClick={() => setSelectedTimetableDetails(null)}
                >
                  Close
                </button>
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div className="admin-inner-box">
                  <b>Class</b>
                  <p style={{ marginBottom: 0 }}>
                    Class {selectedTimetableDetails.className}, Section{" "}
                    {selectedTimetableDetails.section}
                  </p>
                </div>

                <div className="admin-inner-box">
                  <b>Stream</b>
                  <p style={{ marginBottom: 0 }}>
                    {selectedTimetableDetails.stream || "General"}
                  </p>
                </div>

                <div className="admin-inner-box">
                  <b>Day and Time</b>
                  <p style={{ marginBottom: 0 }}>
                    {selectedTimetableDetails.dayOfWeek},{" "}
                    {selectedTimetableDetails.startTime}–
                    {selectedTimetableDetails.endTime}
                  </p>
                </div>

                <div className="admin-inner-box">
                  <b>Teacher</b>
                  <p style={{ marginBottom: 0 }}>
                    {selectedTimetableDetails.teacherName || "Not required"}
                  </p>
                </div>

                <div className="admin-inner-box">
                  <b>Room</b>
                  <p style={{ marginBottom: 0 }}>
                    {selectedTimetableDetails.room || "Not assigned"}
                  </p>
                </div>

                <div className="admin-inner-box">
                  <b>Academic Year</b>
                  <p style={{ marginBottom: 0 }}>
                    {selectedTimetableDetails.academicYear || "Not specified"}
                  </p>
                </div>
              </div>

              {(selectedTimetableDetails.validFrom ||
                selectedTimetableDetails.validUntil) && (
                <div className="admin-inner-box" style={{ marginTop: 14 }}>
                  <b>Schedule Validity</b>
                  <p style={{ marginBottom: 0 }}>
                    {selectedTimetableDetails.validFrom
                      ? new Date(
                          selectedTimetableDetails.validFrom
                        ).toLocaleDateString()
                      : "No start limit"}{" "}
                    –{" "}
                    {selectedTimetableDetails.validUntil
                      ? new Date(
                          selectedTimetableDetails.validUntil
                        ).toLocaleDateString()
                      : "No end limit"}
                  </p>
                </div>
              )}

              {selectedTimetableDetails.notes && (
                <div className="admin-inner-box" style={{ marginTop: 14 }}>
                  <b>Notes</b>
                  <p style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
                    {selectedTimetableDetails.notes}
                  </p>
                </div>
              )}

              <div className="admin-row-actions" style={{ marginTop: 18 }}>
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => startTimetableEdit(selectedTimetableDetails)}
                >
                  Edit Period
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "reports"}
      >
        <div className="admin-section-title-row">
          <div>
            <h2 className="card-title">Reports</h2>
            <p className="dashboard-muted">
              View class-wise summary and export school data.
            </p>
          </div>

          <button className="primary-btn" type="button" onClick={downloadReportsCsv}>
            Download CSV Report
          </button>
        </div>

        <div className="admin-mini-stats">
          <div>
            <strong>{reportData.activeUsers}</strong>
            <span>Active Users</span>
          </div>

          <div>
            <strong>{reportData.inactiveUsers}</strong>
            <span>Inactive Users</span>
          </div>

          <div>
            <strong>{reportData.totalClasses}</strong>
            <span>Classes / Sections</span>
          </div>
        </div>

        <hr className="admin-divider" />

        <h3>Class Summary Report</h3>

        {reportData.classRows.length === 0 ? (
          <p>No class report available yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Students</th>
                  <th>Active</th>
                  <th>Inactive</th>
                  <th>Teachers</th>
                  <th>Subjects</th>
                </tr>
              </thead>

              <tbody>
                {reportData.classRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.className}</td>
                    <td>{row.section}</td>
                    <td>{row.students}</td>
                    <td>{row.activeStudents}</td>
                    <td>{row.inactiveStudents}</td>
                    <td>{row.teachers}</td>
                    <td>{row.subjects}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingUser && (
        <section
          className="dashboard-card admin-section-card"
          hidden={activeView !== "users"}
        >
          <h2 className="card-title">Edit User</h2>

          <form onSubmit={handleUpdateUser}>
            <div className="form-grid">
              <div className="auth-form-group">
                <label>Full Name</label>
                <input
                  className="auth-input"
                  name="name"
                  placeholder="Enter full name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  required
                />
              </div>

              <div className="auth-form-group">
                <label>Email</label>
                <input
                  className="auth-input"
                  name="email"
                  type="email"
                  placeholder="Enter email"
                  value={editForm.email}
                  onChange={handleEditChange}
                  required
                />
              </div>

              <div className="auth-form-group">
                <label>Role</label>
                <select
                  className="auth-select"
                  name="role"
                  value={editForm.role}
                  onChange={handleEditRoleChange}
                >
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                </select>
              </div>
            </div>

            {editForm.role === "student" && (
              <div className="admin-inner-box">
                <h3>Student Academic Placement</h3>
                <p className="dashboard-muted">
                  Correct the stream here so the student only receives subjects
                  belonging to that programme.
                </p>

                <div className="form-grid">
                  <div className="auth-form-group">
                    <label>Class</label>
                    <select
                      className="auth-select"
                      name="className"
                      value={editForm.className}
                      onChange={handleEditChange}
                      required
                    >
                      <option value="">Select class</option>
                      {NEPAL_CLASSES.map((className) => (
                        <option key={className} value={className}>
                          Class {className}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="auth-form-group">
                    <label>Section</label>
                    <select
                      className="auth-select"
                      name="section"
                      value={editForm.section}
                      onChange={handleEditChange}
                      required
                    >
                      <option value="">Select section</option>
                      {SECTION_OPTIONS.map((section) => (
                        <option key={section} value={section}>
                          Section {section}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="auth-form-group">
                    <label>Stream / Programme</label>
                    <select
                      className="auth-select"
                      name="stream"
                      value={
                        Number(editForm.className) > 0 && Number(editForm.className) <= 10
                          ? "General"
                          : editForm.stream
                      }
                      onChange={handleEditChange}
                      disabled={
                        !editForm.className ||
                        (Number(editForm.className) > 0 && Number(editForm.className) <= 10)
                      }
                      required={Number(editForm.className) >= 11}
                    >
                      {Number(editForm.className) >= 11 ? (
                        <>
                          <option value="">Select stream</option>
                          {STREAM_OPTIONS.map(
                            (stream) => (
                              <option key={stream} value={stream}>
                                {stream}
                              </option>
                            )
                          )}
                        </>
                      ) : (
                        <option value="General">General</option>
                      )}
                    </select>
                  </div>

                  <div className="auth-form-group">
                    <label>Academic Year</label>
                    <input
                      className="auth-input"
                      name="academicYear"
                      placeholder="Example: 2082/83"
                      value={editForm.academicYear}
                      onChange={handleEditChange}
                    />
                  </div>

                  <div className="auth-form-group">
                    <label>Subject Assignment</label>
                    <select
                      className="auth-select"
                      name="subjectEnrollmentMode"
                      value={editForm.subjectEnrollmentMode}
                      onChange={handleEditChange}
                    >
                      <option value="stream">Use all subjects in the selected stream</option>
                      <option value="individual">Choose exact subjects for this student</option>
                    </select>
                  </div>
                </div>

                {editForm.className && editForm.section && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 16,
                      border: "1px solid #dbe7f5",
                      borderRadius: 16,
                      background: "#f8fbff",
                    }}
                  >
                    {editForm.subjectEnrollmentMode === "stream" ? (
                      <p className="dashboard-muted" style={{ margin: 0 }}>
                        This student will see {editStudentSubjectOptions.length} active subject
                        {editStudentSubjectOptions.length === 1 ? "" : "s"} for {editForm.stream || "General"}.
                        Subjects from other streams will be excluded.
                      </p>
                    ) : editStudentSubjectOptions.length === 0 ? (
                      <p className="dashboard-muted" style={{ margin: 0 }}>
                        No matching subjects are configured for this class, section and stream.
                      </p>
                    ) : (
                      <>
                        <div className="admin-section-title-row" style={{ marginBottom: 12 }}>
                          <div>
                            <h4 style={{ margin: 0 }}>Choose Student Subjects</h4>
                            <p className="dashboard-muted" style={{ margin: "5px 0 0" }}>
                              Selected: {editForm.subjectIds.length} of {editStudentSubjectOptions.length}
                            </p>
                          </div>
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="small-btn add-btn"
                              onClick={() =>
                                setEditForm((previous) => ({
                                  ...previous,
                                  subjectIds: editStudentSubjectOptions
                                    .map((subject) => String(getSubjectId(subject)))
                                    .filter(Boolean),
                                }))
                              }
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              className="small-btn remove-btn"
                              onClick={() =>
                                setEditForm((previous) => ({ ...previous, subjectIds: [] }))
                              }
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 10,
                          }}
                        >
                          {editStudentSubjectOptions.map((subject) => {
                            const subjectId = String(getSubjectId(subject));
                            const selected = editForm.subjectIds.includes(subjectId);

                            return (
                              <label
                                key={subjectId}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: 10,
                                  padding: 12,
                                  border: selected
                                    ? "1px solid #2563eb"
                                    : "1px solid #dbe7f5",
                                  borderRadius: 13,
                                  background: selected ? "#eff6ff" : "#ffffff",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => handleEditStudentSubjectToggle(subjectId)}
                                />
                                <span>
                                  <strong style={{ display: "block" }}>
                                    {subject.name || subject.subjectName}
                                  </strong>
                                  <small className="dashboard-muted">
                                    {subject.subjectCode || subject.code || "No code"} · {subject.type || "Subject"}
                                  </small>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {editForm.role === "teacher" && (
              <div className="admin-inner-box">
                <h3>Teacher Class and Subject Appointments</h3>
                <p className="dashboard-muted">
                  Every class assignment must include the exact teaching
                  subject. A teacher may teach the same subject in several
                  classes and sections, or several subjects only when the
                  school appoints them to each subject.
                </p>

                {editForm.assignedClasses.map((item, index) =>
                  renderTeacherAssignmentEditor(item, index, true)
                )}

                <button
                  className="small-btn add-btn"
                  type="button"
                  onClick={addEditTeacherClass}
                >
                  Add Another Teaching Assignment
                </button>
              </div>
            )}

            <div className="admin-row-actions">
              <button className="primary-btn" type="submit" disabled={updating}>
                {updating ? "Updating..." : "Update User"}
              </button>

              <button className="logout-btn" type="button" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "create-user"}
      >
        <div className="admin-section-title-row">
          <div>
            <h2 className="card-title">Add Teacher / Student</h2>
            <p className="dashboard-muted">
              Create login accounts for teachers and students.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateUser}>
          <div className="form-grid">
            <div className="auth-form-group">
              <label>Full Name</label>
              <input
                className="auth-input"
                name="name"
                placeholder="Enter full name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-form-group">
              <label>Email</label>
              <input
                className="auth-input"
                name="email"
                placeholder="Enter email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-form-group">
              <label>Password</label>
              <input
                className="auth-input"
                name="password"
                type="password"
                placeholder="Enter password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="auth-form-group">
              <label>Role</label>
              <select
                className="auth-select"
                name="role"
                value={form.role}
                onChange={handleRoleChange}
              >
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>
          </div>

          {form.role === "student" && (
            <div className="admin-inner-box">
              <h3>Student Academic Placement</h3>
              <p className="dashboard-muted">
                Class 11 and 12 students must be connected to the correct stream.
                You can also assign their exact optional subjects.
              </p>

              <div className="form-grid">
                <div className="auth-form-group">
                  <label>Class</label>
                  <select
                    className="auth-select"
                    name="className"
                    value={form.className}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select class</option>
                    {NEPAL_CLASSES.map((className) => (
                      <option key={className} value={className}>
                        Class {className}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="auth-form-group">
                  <label>Section</label>
                  <select
                    className="auth-select"
                    name="section"
                    value={form.section}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select section</option>
                    {SECTION_OPTIONS.map((section) => (
                      <option key={section} value={section}>
                        Section {section}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="auth-form-group">
                  <label>Stream / Programme</label>
                  <select
                    className="auth-select"
                    name="stream"
                    value={
                      Number(form.className) > 0 && Number(form.className) <= 10
                        ? "General"
                        : form.stream
                    }
                    onChange={handleChange}
                    disabled={
                      !form.className ||
                      (Number(form.className) > 0 && Number(form.className) <= 10)
                    }
                    required={Number(form.className) >= 11}
                  >
                    {Number(form.className) >= 11 ? (
                      <>
                        <option value="">Select stream</option>
                        {STREAM_OPTIONS.map(
                          (stream) => (
                            <option key={stream} value={stream}>
                              {stream}
                            </option>
                          )
                        )}
                      </>
                    ) : (
                      <option value="General">General</option>
                    )}
                  </select>
                </div>

                <div className="auth-form-group">
                  <label>Academic Year</label>
                  <input
                    className="auth-input"
                    name="academicYear"
                    placeholder="Example: 2082/83"
                    value={form.academicYear}
                    onChange={handleChange}
                  />
                </div>

                <div className="auth-form-group">
                  <label>Subject Assignment</label>
                  <select
                    className="auth-select"
                    name="subjectEnrollmentMode"
                    value={form.subjectEnrollmentMode}
                    onChange={handleChange}
                  >
                    <option value="stream">Use all subjects in the selected stream</option>
                    <option value="individual">Choose exact subjects for this student</option>
                  </select>
                </div>
              </div>

              {form.className && form.section && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 16,
                    border: "1px solid #dbe7f5",
                    borderRadius: 16,
                    background: "#f8fbff",
                  }}
                >
                  {form.subjectEnrollmentMode === "stream" ? (
                    <p className="dashboard-muted" style={{ margin: 0 }}>
                      This student will see {createStudentSubjectOptions.length} active subject
                      {createStudentSubjectOptions.length === 1 ? "" : "s"} for {form.stream || "General"}.
                      Unrelated streams will not appear.
                    </p>
                  ) : createStudentSubjectOptions.length === 0 ? (
                    <p className="dashboard-muted" style={{ margin: 0 }}>
                      No matching subjects are configured yet. Add subjects for this class,
                      section and stream from Subject Management first.
                    </p>
                  ) : (
                    <>
                      <div className="admin-section-title-row" style={{ marginBottom: 12 }}>
                        <div>
                          <h4 style={{ margin: 0 }}>Choose Student Subjects</h4>
                          <p className="dashboard-muted" style={{ margin: "5px 0 0" }}>
                            Selected: {form.subjectIds.length} of {createStudentSubjectOptions.length}
                          </p>
                        </div>
                        <div className="admin-row-actions">
                          <button
                            type="button"
                            className="small-btn add-btn"
                            onClick={() =>
                              setForm((previous) => ({
                                ...previous,
                                subjectIds: createStudentSubjectOptions
                                  .map((subject) => String(getSubjectId(subject)))
                                  .filter(Boolean),
                              }))
                            }
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            className="small-btn remove-btn"
                            onClick={() =>
                              setForm((previous) => ({ ...previous, subjectIds: [] }))
                            }
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 10,
                        }}
                      >
                        {createStudentSubjectOptions.map((subject) => {
                          const subjectId = String(getSubjectId(subject));
                          const selected = form.subjectIds.includes(subjectId);

                          return (
                            <label
                              key={subjectId}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 10,
                                padding: 12,
                                border: selected
                                  ? "1px solid #2563eb"
                                  : "1px solid #dbe7f5",
                                borderRadius: 13,
                                background: selected ? "#eff6ff" : "#ffffff",
                                cursor: "pointer",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => handleStudentSubjectToggle(subjectId)}
                              />
                              <span>
                                <strong style={{ display: "block" }}>
                                  {subject.name || subject.subjectName}
                                </strong>
                                <small className="dashboard-muted">
                                  {subject.subjectCode || subject.code || "No code"} · {subject.type || "Subject"}
                                </small>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {form.role === "teacher" && (
            <div className="admin-inner-box">
              <h3>Teacher Class and Subject Appointments</h3>
              <p className="dashboard-muted">
                Assign the teacher to specific subjects for every class and
                section. The Teacher Portal will only show the selected
                subjects when creating homework, exams and marks.
              </p>

              {form.assignedClasses.map((item, index) =>
                renderTeacherAssignmentEditor(item, index, false)
              )}

              <button
                className="small-btn add-btn"
                type="button"
                onClick={addTeacherClass}
              >
                Add Another Teaching Assignment
              </button>
            </div>
          )}

          <button className="primary-btn" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </section>

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "users"}
      >
        <div className="admin-section-title-row">
          <div>
            <h2 className="card-title">User Management</h2>
            <p className="dashboard-muted">
              Search, filter and manage teacher/student accounts.
            </p>
          </div>
        </div>

        <div className="form-grid">
          <input
            className="auth-input"
            placeholder="Search by name or email"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />

          <select
            className="auth-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All roles</option>
            <option value="teacher">Teachers only</option>
            <option value="student">Students only</option>
          </select>

          <select
            className="auth-select"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
          >
            <option value="all">All classes</option>
            {classOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "teachers"}
      >
        <h2 className="card-title">Teachers</h2>

        {loading ? (
          <p>Loading teachers...</p>
        ) : filteredTeachers.length === 0 ? (
          <p>No teachers found.</p>
        ) : (
          <div className="admin-list-grid">
            {filteredTeachers.map((teacher) => (
              <article className="admin-user-card" key={getId(teacher)}>
                <div className="admin-user-card-top">
                  <h3>{teacher.name}</h3>
                  <span
                    className={
                      isUserActive(teacher)
                        ? "badge badge-success"
                        : "badge badge-danger"
                    }
                  >
                    {isUserActive(teacher) ? "Active" : "Inactive"}
                  </span>
                </div>

                <p>{teacher.email}</p>
                <p>
                  <b>Role:</b> Teacher
                </p>
                <div style={{ marginTop: 10 }}>
                  <b>Teaching Appointments:</b>

                  {teacher.assignedClasses?.length > 0 ? (
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        marginTop: 8,
                      }}
                    >
                      {teacher.assignedClasses.map((item, index) => {
                        const subjectNames = getAssignmentSubjectNames(item);

                        return (
                          <div
                            key={`${getId(teacher)}-assignment-${index}`}
                            style={{
                              padding: 10,
                              borderRadius: 12,
                              background: "#f8fbff",
                              border: "1px solid #dbe7f5",
                            }}
                          >
                            <strong>
                              Class {item.className} · Section {item.section}
                              {Number(item.className) >= 11
                                ? ` · ${item.stream || "Stream not assigned"}`
                                : ""}
                            </strong>
                            <div className="dashboard-muted" style={{ marginTop: 4 }}>
                              {subjectNames.length > 0
                                ? subjectNames.join(", ")
                                : "No teaching subject assigned"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="dashboard-muted">No class assigned</p>
                  )}
                </div>

                {renderUserActions(teacher)}
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        className="dashboard-card admin-section-card"
        hidden={activeView !== "students"}
      >
        <h2 className="card-title">Students</h2>

        {loading ? (
          <p>Loading students...</p>
        ) : filteredStudents.length === 0 ? (
          <p>No students found.</p>
        ) : (
          <div className="admin-list-grid">
            {filteredStudents.map((student) => (
              <article className="admin-user-card" key={getId(student)}>
                <div className="admin-user-card-top">
                  <h3>{student.name}</h3>
                  <span
                    className={
                      isUserActive(student)
                        ? "badge badge-success"
                        : "badge badge-danger"
                    }
                  >
                    {isUserActive(student) ? "Active" : "Inactive"}
                  </span>
                </div>

                <p>{student.email}</p>
                <p>
                  <b>Role:</b> Student
                </p>
                <p>
                  <b>Class:</b> Class {student.className || "N/A"} Section{" "}
                  {student.section || "N/A"}
                </p>
                <p>
                  <b>Stream:</b>{" "}
                  {Number(student.className) >= 11
                    ? student.stream || "Not assigned"
                    : "General"}
                </p>
                <p>
                  <b>Academic Year:</b> {student.academicYear || "N/A"}
                </p>
                <p>
                  <b>Subjects:</b>{" "}
                  {student.subjectEnrollmentMode === "individual" ||
                  (Array.isArray(student.subjectIds) && student.subjectIds.length > 0)
                    ? `${student.subjectIds?.length || 0} individually assigned`
                    : `All ${student.stream || "General"} subjects`}
                </p>

                {renderUserActions(student)}
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </PortalLayout>
  );
}
