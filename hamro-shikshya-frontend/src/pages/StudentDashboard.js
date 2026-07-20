import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PortalLayout from "../components/PortalLayout";
import "../styles/App.css";
import {
  buildFileUrl,
  getAttendanceByStudent,
  getExamsByClass,
  getNoticesByClass,
  getResultsByStudent,
  getStudentSubjects,
  getSubmissionsByStudent,
  getTasksByClass,
  getTimetableByStudent,
  submitHomework,
} from "../api";

const emptyArray = [];

const STUDENT_NAVIGATION = [
  { to: "/student/overview", label: "Overview", icon: "▦" },
  { to: "/student/profile", label: "My Profile", icon: "👤" },
  { to: "/student/homework", label: "Homework", icon: "📚" },
  { to: "/student/notices", label: "Notices", icon: "📢" },
  { to: "/student/exams", label: "Exams", icon: "📝" },
  { to: "/student/results", label: "Results", icon: "🏆" },
  { to: "/student/attendance", label: "Attendance", icon: "📅" },
  { to: "/student/timetable", label: "Timetable", icon: "🗓️" },
];

const STUDENT_VIEWS = new Set(
  STUDENT_NAVIGATION.map((item) => item.to.split("/").filter(Boolean).pop())
);


const WEEK_ORDER = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
  saturday: 7,
};

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const CALENDAR_EVENT_META = {
  class: {
    label: "Class",
    icon: "🏫",
  },
  exam: {
    label: "Exam",
    icon: "📝",
  },
  homework: {
    label: "Homework",
    icon: "📚",
  },
  notice: {
    label: "School Event",
    icon: "📢",
  },
};

const readLoggedUser = () => {
  try {
    const savedUser = localStorage.getItem("user");

    if (!savedUser || savedUser === "undefined" || savedUser === "null") {
      return {};
    }

    return JSON.parse(savedUser);
  } catch {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return {};
  }
};

const getRecordId = (item, fallback = "") => {
  return String(
    item?._id ||
      item?.id ||
      item?.taskId ||
      item?.homeworkId ||
      item?.examId ||
      item?.noticeId ||
      fallback
  );
};

const hasValue = (value) => {
  return value !== undefined && value !== null && String(value).trim() !== "";
};

const toArray = (res) => {
  const body = res?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.tasks)) return body.tasks;
  if (Array.isArray(body?.task)) return body.task;
  if (Array.isArray(body?.homework)) return body.homework;
  if (Array.isArray(body?.homeworks)) return body.homeworks;
  if (Array.isArray(body?.submissions)) return body.submissions;
  if (Array.isArray(body?.exams)) return body.exams;
  if (Array.isArray(body?.notices)) return body.notices;
  if (Array.isArray(body?.attendance)) return body.attendance;
  if (Array.isArray(body?.attendances)) return body.attendances;
  if (Array.isArray(body?.records)) return body.records;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.marks)) return body.marks;
  if (Array.isArray(body?.subjects)) return body.subjects;
  if (Array.isArray(body?.timetable)) return body.timetable;
  if (Array.isArray(body?.timetables)) return body.timetables;
  if (Array.isArray(body?.routine)) return body.routine;
  if (Array.isArray(body?.routines)) return body.routines;

  return [];
};

const formatDate = (value) => {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString();
};

const getFileName = (filePath) => {
  if (!filePath) return "download-file";

  const cleanPath = String(filePath).split("?")[0];
  const fileName = cleanPath.split("/").pop();

  return fileName || "download-file";
};

const getTaskFilePath = (task) => {
  return (
    task?.fileUrl ||
    task?.attachmentUrl ||
    task?.taskFileUrl ||
    task?.materialUrl ||
    task?.teacherFileUrl ||
    task?.filePath ||
    task?.file?.url ||
    task?.file ||
    ""
  );
};

const getSubmissionFilePath = (submission) => {
  return (
    submission?.fileUrl ||
    submission?.attachmentUrl ||
    submission?.submissionFileUrl ||
    submission?.studentFileUrl ||
    submission?.submittedFileUrl ||
    submission?.filePath ||
    submission?.file?.url ||
    submission?.file ||
    ""
  );
};

const getTaskIdFromSubmission = (submission) => {
  return String(
    submission?.taskId?._id ||
      submission?.taskId ||
      submission?.task?._id ||
      submission?.task ||
      submission?.homeworkId?._id ||
      submission?.homeworkId ||
      submission?.homework?._id ||
      submission?.homework ||
      ""
  );
};

const getStudentIdFromSubmission = (submission) => {
  return String(
    submission?.studentId?._id ||
      submission?.studentId ||
      submission?.student?._id ||
      submission?.student ||
      submission?.userId?._id ||
      submission?.userId ||
      ""
  );
};

const isPastDue = (value) => {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return date < today;
};

const getDaysUntilDue = (value) => {
  if (!value) return null;

  const dueDate = new Date(value);

  if (Number.isNaN(dueDate.getTime())) {
    return null;
  }

  dueDate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.ceil(
    (dueDate.getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
  );
};

const isDueSoon = (value) => {
  const daysUntilDue = getDaysUntilDue(value);

  return (
    daysUntilDue !== null &&
    daysUntilDue >= 0 &&
    daysUntilDue <= 7
  );
};

const isRecentlyCreated = (value, days = 3) => {
  if (!value) return false;

  const createdDate = new Date(value);

  if (Number.isNaN(createdDate.getTime())) {
    return false;
  }

  const difference =
    Date.now() - createdDate.getTime();

  return (
    difference >= 0 &&
    difference <=
      days * 24 * 60 * 60 * 1000
  );
};

const getRelativeDueText = (value) => {
  const daysUntilDue = getDaysUntilDue(value);

  if (daysUntilDue === null) {
    return "No due date";
  }

  if (daysUntilDue < 0) {
    const lateDays = Math.abs(daysUntilDue);

    return `${lateDays} day${
      lateDays === 1 ? "" : "s"
    } late`;
  }

  if (daysUntilDue === 0) {
    return "Due today";
  }

  if (daysUntilDue === 1) {
    return "Due tomorrow";
  }

  return `Due in ${daysUntilDue} days`;
};

const normalizeStatus = (value) => {
  return String(value || "").trim().toLowerCase();
};

const statusLabel = (status) => {
  const cleanStatus = normalizeStatus(status);

  if (!cleanStatus) return "Submitted";

  return cleanStatus.charAt(0).toUpperCase() + cleanStatus.slice(1);
};

const getResultMarks = (result) => {
  const obtained =
    result?.marksObtained ??
    result?.obtainedMarks ??
    result?.marks ??
    result?.score ??
    "";

  const total =
    result?.totalMarks ??
    result?.maxMarks ??
    result?.fullMarks ??
    result?.outOf ??
    "";

  if (obtained !== "" && total !== "") return `${obtained}/${total}`;
  if (obtained !== "") return obtained;

  return "N/A";
};

const sortByDateDesc = (items, dateKeys = ["createdAt", "date"]) => {
  return [...items].sort((a, b) => {
    const aDateValue = dateKeys.map((key) => a?.[key]).find(Boolean);
    const bDateValue = dateKeys.map((key) => b?.[key]).find(Boolean);

    const aTime = aDateValue ? new Date(aDateValue).getTime() : 0;
    const bTime = bDateValue ? new Date(bDateValue).getTime() : 0;

    return bTime - aTime;
  });
};

const getExamDateValue = (exam) => {
  return (
    exam?.date ||
    exam?.examDate ||
    exam?.startDate ||
    exam?.scheduledDate ||
    ""
  );
};

const getRoutineDayName = (item) => {
  return String(
    item?.dayOfWeek ||
      item?.day ||
      item?.weekDay ||
      ""
  ).trim();
};

const getRoutineDayNumber = (item) => {
  const day = getRoutineDayName(item).toLowerCase();
  return WEEK_ORDER[day] || 99;
};

const getTimetableSubjectName = (item) => {
  return String(
    item?.subjectId?.name ||
      item?.subjectId?.subjectName ||
      item?.subjectName ||
      item?.subject ||
      item?.classType ||
      "School period"
  ).trim();
};

const getTimetableTeacherName = (item) => {
  return String(
    item?.teacherId?.name ||
      item?.teacherName ||
      item?.teacher?.name ||
      (typeof item?.teacher === "string" ? item.teacher : "") ||
      ""
  ).trim();
};

const parseCalendarDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    const clonedDate = new Date(value.getTime());
    return Number.isNaN(clonedDate.getTime()) ? null : clonedDate;
  }

  const cleanValue = String(value).trim();

  if (!cleanValue) return null;

  const dateOnlyMatch = cleanValue.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const localDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    );

    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsedDate = new Date(cleanValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const toLocalDateKey = (value) => {
  const date = parseCalendarDate(value);

  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatCalendarDate = (value) => {
  const date = parseCalendarDate(value);

  if (!date) return "N/A";

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getTimeMinutes = (value) => {
  const cleanValue = String(value || "").trim();
  const match = cleanValue.match(/^(\d{1,2}):(\d{2})/);

  if (!match) return null;

  return Number(match[1]) * 60 + Number(match[2]);
};

const getTimeRangeText = (item) => {
  const startTime = String(
    item?.startTime || item?.start || ""
  ).trim();

  const endTime = String(
    item?.endTime || item?.end || ""
  ).trim();

  if (startTime && endTime) {
    return `${startTime} – ${endTime}`;
  }

  return startTime || endTime || String(item?.time || "").trim() || "All day";
};

const getNoticeCalendarDateValue = (notice) => {
  const explicitDate =
    notice?.eventDate ||
    notice?.scheduledDate ||
    notice?.startDate ||
    notice?.noticeDate ||
    notice?.calendarDate ||
    "";

  if (explicitDate) return explicitDate;

  const hasEventInformation =
    notice?.showInCalendar === true ||
    Boolean(notice?.startTime) ||
    Boolean(notice?.endTime) ||
    Boolean(notice?.location) ||
    ["event", "programme", "program", "meeting", "holiday"]
      .includes(
        String(notice?.noticeType || notice?.type || "")
          .trim()
          .toLowerCase()
      );

  return hasEventInformation ? notice?.date || "" : "";
};

const isNoticeCalendarEvent = (notice) => {
  if (notice?.showInCalendar === false) return false;

  return Boolean(
    parseCalendarDate(
      getNoticeCalendarDateValue(notice)
    )
  );
};

const isTimetableEntryActiveOnDate = (item, dateValue) => {
  if (item?.isActive === false) return false;

  const targetDate = parseCalendarDate(dateValue);

  if (!targetDate) return false;

  targetDate.setHours(12, 0, 0, 0);

  const validFrom = parseCalendarDate(item?.validFrom);
  const validUntil = parseCalendarDate(item?.validUntil);

  if (validFrom) {
    validFrom.setHours(0, 0, 0, 0);

    if (targetDate < validFrom) return false;
  }

  if (validUntil) {
    validUntil.setHours(23, 59, 59, 999);

    if (targetDate > validUntil) return false;
  }

  return true;
};

const SUBJECT_NAME_ALIASES = {
  math: "mathematics",
  maths: "mathematics",
  mathematics: "mathematics",
  nepali: "nepali",
  english: "english",
  science: "science and technology",
  "social studies and life skill": "social studies and life skills",
  "social studies and life skills": "social studies and life skills",
  computer: "computer science",
  ict: "computer science",
  account: "accountancy",
  accounts: "accountancy",
};

const normalizeSubjectName = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return SUBJECT_NAME_ALIASES[normalized] || normalized;
};

const getSubjectId = (subject) => {
  if (!subject) return "";

  if (typeof subject === "string") {
    return mongooseSafeId(subject);
  }

  return String(
    subject?._id ||
      subject?.id ||
      subject?.subjectId?._id ||
      subject?.subjectId ||
      ""
  ).trim();
};

const mongooseSafeId = (value) => {
  const cleanValue = String(value || "").trim();

  return /^[a-f\d]{24}$/i.test(cleanValue) ? cleanValue : "";
};

const getSubjectName = (subject) =>
  String(
    subject?.name ||
      subject?.subjectName ||
      subject?.subject ||
      ""
  ).trim();

const getSubjectCode = (subject) =>
  String(
    subject?.subjectCode ||
      subject?.code ||
      ""
  ).trim();

const getTaskSubjectId = (task) => {
  const value =
    task?.subjectId?._id ||
    task?.subjectId ||
    "";

  return mongooseSafeId(value);
};

const getTaskSubjectName = (task) =>
  String(
    task?.subjectName ||
      task?.subject ||
      ""
  ).trim();

const getTaskSubjectCode = (task) =>
  String(
    task?.subjectCode ||
      task?.code ||
      ""
  ).trim();

const getSubjectFolderKey = (subject) => {
  const id = getSubjectId(subject);
  const code = getSubjectCode(subject);
  const name = getSubjectName(subject);

  if (id) return `id:${id}`;
  if (code) return `code:${code.toLowerCase()}`;

  return `name:${normalizeSubjectName(name) || "general"}`;
};

const subjectMatchesTask = (subject, task) => {
  const subjectId = getSubjectId(subject);
  const taskSubjectId = getTaskSubjectId(task);

  if (subjectId && taskSubjectId && subjectId === taskSubjectId) {
    return true;
  }

  const subjectCode = getSubjectCode(subject).toLowerCase();
  const taskSubjectCode = getTaskSubjectCode(task).toLowerCase();

  if (
    subjectCode &&
    taskSubjectCode &&
    subjectCode === taskSubjectCode
  ) {
    return true;
  }

  const subjectName = normalizeSubjectName(
    getSubjectName(subject)
  );

  const taskSubjectName = normalizeSubjectName(
    getTaskSubjectName(task)
  );

  return Boolean(
    subjectName &&
      taskSubjectName &&
      subjectName === taskSubjectName
  );
};

const getSubjectFolderIcon = (subjectName) => {
  const name = normalizeSubjectName(subjectName);

  if (name.includes("mathemat")) return "📐";
  if (name.includes("physics")) return "⚛️";
  if (name.includes("chemistry")) return "🧪";
  if (name.includes("biology")) return "🧬";
  if (name.includes("computer")) return "💻";
  if (name.includes("english")) return "📖";
  if (name.includes("nepali")) return "🇳🇵";
  if (name.includes("account")) return "🧾";
  if (name.includes("econom")) return "📈";
  if (name.includes("business")) return "💼";
  if (name.includes("social")) return "🌏";
  if (name.includes("health")) return "🏃";
  if (name.includes("law")) return "⚖️";
  if (name.includes("hotel")) return "🏨";
  if (name.includes("education")) return "🎓";

  return "📚";
};

function EmptyState({ title, text }) {
  return (
    <div
      style={{
        background: "#f8fbff",
        border: "1px dashed #cfe0f3",
        borderRadius: 18,
        padding: 22,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 34, marginBottom: 8 }}>📭</div>
      <h3 style={{ margin: "0 0 8px", fontSize: 20 }}>{title}</h3>
      <p className="dashboard-muted" style={{ margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

function StatCard({ icon, label, value, subText, tone = "blue" }) {
  const toneMap = {
    blue: {
      bg: "linear-gradient(135deg, #eaf5ff, #ffffff)",
      color: "#0f8cff",
      border: "#cfe8ff",
    },
    green: {
      bg: "linear-gradient(135deg, #ecfdf5, #ffffff)",
      color: "#047857",
      border: "#bbf7d0",
    },
    yellow: {
      bg: "linear-gradient(135deg, #fffbeb, #ffffff)",
      color: "#92400e",
      border: "#fde68a",
    },
    red: {
      bg: "linear-gradient(135deg, #fff1f2, #ffffff)",
      color: "#be123c",
      border: "#fecdd3",
    },
    purple: {
      bg: "linear-gradient(135deg, #f5f3ff, #ffffff)",
      color: "#6d28d9",
      border: "#ddd6fe",
    },
  };

  const selectedTone = toneMap[tone] || toneMap.blue;

  return (
    <div
      className="student-stat-card"
      style={{
        background: selectedTone.bg,
        border: `1px solid ${selectedTone.border}`,
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.07)",
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 16,
          background: "#ffffff",
          color: selectedTone.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          marginBottom: 14,
          boxShadow: "0 8px 18px rgba(15, 23, 42, 0.06)",
        }}
      >
        {icon}
      </div>

      <span className="dashboard-muted" style={{ fontWeight: 800 }}>
        {label}
      </span>

      <strong
        style={{
          display: "block",
          marginTop: 8,
          fontSize: 34,
          lineHeight: 1,
          color: "#0f172a",
        }}
      >
        {value}
      </strong>

      {subText && (
        <p className="dashboard-muted" style={{ margin: "10px 0 0" }}>
          {subText}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ children, type = "info" }) {
  const styleMap = {
    info: {
      background: "#e0f2fe",
      color: "#075985",
    },
    success: {
      background: "#dcfce7",
      color: "#166534",
    },
    warning: {
      background: "#fef3c7",
      color: "#92400e",
    },
    danger: {
      background: "#fee2e2",
      color: "#991b1b",
    },
    purple: {
      background: "#ede9fe",
      color: "#5b21b6",
    },
  };

  const selected = styleMap[type] || styleMap.info;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "6px 11px",
        borderRadius: 999,
        background: selected.background,
        color: selected.color,
        fontSize: 12,
        fontWeight: 900,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      {children}
    </span>
  );
}

export default function StudentDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const requestedView = location.pathname.split("/").filter(Boolean).pop();
  const activeView = STUDENT_VIEWS.has(requestedView)
    ? requestedView
    : "overview";

  useEffect(() => {
    if (!STUDENT_VIEWS.has(requestedView)) {
      navigate("/student/overview", { replace: true });
    }
  }, [navigate, requestedView]);

  const [tasks, setTasks] = useState(emptyArray);
  const [academicSubjects, setAcademicSubjects] = useState(emptyArray);
  const [submissions, setSubmissions] = useState(emptyArray);
  const [exams, setExams] = useState(emptyArray);
  const [notices, setNotices] = useState(emptyArray);
  const [attendance, setAttendance] = useState(emptyArray);
  const [results, setResults] = useState(emptyArray);
  const [timetable, setTimetable] = useState(emptyArray);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState(null);
  const [calendarCursor, setCalendarCursor] = useState(() => {
    const today = new Date();

    return new Date(
      today.getFullYear(),
      today.getMonth(),
      1
    );
  });

  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState({});
  const [fileInputKeys, setFileInputKeys] = useState({});
  const [submitting, setSubmitting] = useState({});

  const [homeworkFilter, setHomeworkFilter] =
    useState("all");
  const [homeworkSearch, setHomeworkSearch] =
    useState("");
  const [selectedSubjectKey, setSelectedSubjectKey] =
    useState("");
  const [homeworkSort, setHomeworkSort] =
    useState("newest");
  const [homeworkView, setHomeworkView] =
    useState("grid");
  const [selectedTaskId, setSelectedTaskId] =
    useState("");
  const [editingSubmission, setEditingSubmission] =
    useState({});

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loggedUser = useMemo(() => readLoggedUser(), []);

  const studentId = String(
    loggedUser._id || loggedUser.id || loggedUser.userId || ""
  ).trim();

  const studentName = String(
    loggedUser.name ||
      loggedUser.fullName ||
      loggedUser.studentName ||
      loggedUser.username ||
      "Student"
  ).trim();

  const className = String(loggedUser.className || loggedUser.class || "").trim();
  const section = String(loggedUser.section || "").trim();
  const studentStream = String(
    loggedUser.stream ||
      (Number(className) >= 11 ? "General" : "General")
  ).trim();
  const academicYear = String(loggedUser.academicYear || "").trim();

  const schoolId = String(
    loggedUser.schoolId || loggedUser.school?._id || ""
  ).trim();

  const studentInitial = studentName ? studentName.charAt(0).toUpperCase() : "S";

  const getMySubmission = useCallback(
    (task) => {
      const taskId = String(
        task?._id || task?.id || ""
      );

      const fromTask = Array.isArray(
        task?.submissions
      )
        ? task.submissions.find(
            (submission) => {
              return (
                getStudentIdFromSubmission(
                  submission
                ) === String(studentId)
              );
            }
          )
        : null;

      if (fromTask) return fromTask;

      const fromSubmissionList =
        submissions.find((item) => {
          return (
            getTaskIdFromSubmission(item) ===
            taskId
          );
        });

      if (fromSubmissionList?.submission) {
        return fromSubmissionList.submission;
      }

      return fromSubmissionList || null;
    },
    [studentId, submissions]
  );

  const homeworkSummary = useMemo(() => {
    const total = tasks.length;

    const submitted = tasks.filter((task) => Boolean(getMySubmission(task))).length;
    const pending = Math.max(total - submitted, 0);

    const late = tasks.filter((task) => {
      return !getMySubmission(task) && isPastDue(task?.dueDate || task?.deadline);
    }).length;

    return {
      total,
      submitted,
      pending,
      late,
    };
  }, [tasks, getMySubmission]);

  const attendanceSummary = useMemo(() => {
    const total = attendance.length;

    let present = 0;
    let absent = 0;
    let late = 0;

    attendance.forEach((record) => {
      const status = normalizeStatus(record?.status || record?.attendanceStatus);

      if (status.includes("present")) present += 1;
      else if (status.includes("late")) late += 1;
      else if (status.includes("absent")) absent += 1;
    });

    const attended = present + late;
    const percentage = total > 0 ? Math.round((attended / total) * 100) : 0;

    return {
      total,
      present,
      absent,
      late,
      percentage,
    };
  }, [attendance]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aDate = new Date(
        a?.dueDate ||
          a?.deadline ||
          a?.createdAt ||
          0
      );

      const bDate = new Date(
        b?.dueDate ||
          b?.deadline ||
          b?.createdAt ||
          0
      );

      return aDate.getTime() - bDate.getTime();
    });
  }, [tasks]);

  const homeworkRecords = useMemo(() => {
    return tasks.map((task, index) => {
      const taskId = String(
        task?._id || task?.id || index
      );

      const submission =
        getMySubmission(task);

      const submitted = Boolean(submission);
      const dueDate =
        task?.dueDate || task?.deadline || "";
      const late =
        !submitted && isPastDue(dueDate);
      const dueSoon =
        !submitted &&
        !late &&
        isDueSoon(dueDate);
      const recentlyAdded =
        isRecentlyCreated(
          task?.createdAt ||
            task?.assignedAt ||
            task?.date
        );

      return {
        task,
        taskId,
        submission,
        submitted,
        late,
        dueSoon,
        recentlyAdded,
        pending: !submitted && !late,
      };
    });
  }, [tasks, getMySubmission]);

  /*
    Build the subject library from the school's configured Subject
    records first. Legacy homework subjects are added only when they
    are not already represented, so old project data remains visible.
  */
  const subjectFolders = useMemo(() => {
    const folders = [];
    const seenNames = new Set();
    const seenCodes = new Set();
    const seenIds = new Set();

    const addSubject = (subject, source = "configured") => {
      const name = getSubjectName(subject) || "General";
      const id = getSubjectId(subject);
      const code = getSubjectCode(subject);
      const normalizedName = normalizeSubjectName(name);
      const normalizedCode = code.toLowerCase();

      const alreadyExists =
        (id && seenIds.has(id)) ||
        (normalizedCode && seenCodes.has(normalizedCode)) ||
        (normalizedName && seenNames.has(normalizedName));

      if (alreadyExists) return;

      if (id) seenIds.add(id);
      if (normalizedCode) seenCodes.add(normalizedCode);
      if (normalizedName) seenNames.add(normalizedName);

      folders.push({
        ...subject,
        _folderName: name,
        _folderCode: code,
        _folderKey: getSubjectFolderKey(subject),
        _folderSource: source,
        _folderIcon: getSubjectFolderIcon(name),
      });
    };

    academicSubjects
      .filter((subject) => subject?.isActive !== false)
      .forEach((subject) => addSubject(subject, "configured"));

    tasks.forEach((task) => {
      const taskSubjectName =
        getTaskSubjectName(task) || "General";

      addSubject(
        {
          _id: getTaskSubjectId(task) || undefined,
          name: taskSubjectName,
          subjectName: taskSubjectName,
          subjectCode: getTaskSubjectCode(task),
          code: getTaskSubjectCode(task),
          type: task?.subjectType || "",
          stream: task?.stream || loggedUser?.stream || "General",
          academicYear:
            task?.academicYear ||
            loggedUser?.academicYear ||
            "",
          isActive: true,
        },
        "homework"
      );
    });

    return folders
      .map((folder) => {
        const records = homeworkRecords.filter((record) =>
          subjectMatchesTask(folder, record.task)
        );

        return {
          ...folder,
          count: records.length,
          submittedCount: records.filter(
            (record) => record.submitted
          ).length,
          pendingCount: records.filter(
            (record) => !record.submitted
          ).length,
        };
      })
      .sort((a, b) => {
        const orderDifference =
          Number(a?.sortOrder || 0) -
          Number(b?.sortOrder || 0);

        if (orderDifference !== 0) {
          return orderDifference;
        }

        return String(a._folderName).localeCompare(
          String(b._folderName)
        );
      });
  }, [
    academicSubjects,
    tasks,
    homeworkRecords,
    loggedUser,
  ]);

  const selectedSubject = useMemo(
    () =>
      subjectFolders.find(
        (subject) =>
          subject._folderKey ===
          selectedSubjectKey
      ) || null,
    [subjectFolders, selectedSubjectKey]
  );

  const selectedSubjectRecords = useMemo(() => {
    if (!selectedSubject) return [];

    return homeworkRecords.filter((record) =>
      subjectMatchesTask(
        selectedSubject,
        record.task
      )
    );
  }, [homeworkRecords, selectedSubject]);

  const homeworkCounts = useMemo(() => {
    return {
      all: selectedSubjectRecords.length,

      new: selectedSubjectRecords.filter(
        (record) => record.recentlyAdded
      ).length,

      due: selectedSubjectRecords.filter(
        (record) => record.dueSoon
      ).length,

      pending: selectedSubjectRecords.filter(
        (record) => record.pending
      ).length,

      late: selectedSubjectRecords.filter(
        (record) => record.late
      ).length,

      submitted: selectedSubjectRecords.filter(
        (record) => record.submitted
      ).length,
    };
  }, [selectedSubjectRecords]);

  const visibleHomeworkRecords =
    useMemo(() => {
      const cleanSearch =
        homeworkSearch
          .trim()
          .toLowerCase();

      const filtered =
        selectedSubjectRecords.filter(
          (record) => {
            const { task } = record;

            const matchesFolder =
              homeworkFilter === "all" ||
              (homeworkFilter === "new" &&
                record.recentlyAdded) ||
              (homeworkFilter === "due" &&
                record.dueSoon) ||
              (homeworkFilter ===
                "pending" &&
                record.pending) ||
              (homeworkFilter === "late" &&
                record.late) ||
              (homeworkFilter ===
                "submitted" &&
                record.submitted);

            const searchableText = [
              task?.title,
              task?.taskTitle,
              task?.homeworkTitle,
              task?.subject,
              task?.subjectName,
              task?.subjectCode,
              task?.description,
              task?.instructions,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            const matchesSearch =
              !cleanSearch ||
              searchableText.includes(
                cleanSearch
              );

            return (
              matchesFolder &&
              matchesSearch
            );
          }
        );

      return [...filtered].sort(
        (a, b) => {
          const aTask = a.task;
          const bTask = b.task;

          if (
            homeworkSort === "title"
          ) {
            return String(
              aTask?.title ||
                aTask?.taskTitle ||
                ""
            ).localeCompare(
              String(
                bTask?.title ||
                  bTask?.taskTitle ||
                  ""
              )
            );
          }

          if (
            homeworkSort === "oldest"
          ) {
            return (
              new Date(
                aTask?.createdAt || 0
              ).getTime() -
              new Date(
                bTask?.createdAt || 0
              ).getTime()
            );
          }

          if (
            homeworkSort === "due"
          ) {
            const aDue = new Date(
              aTask?.dueDate ||
                aTask?.deadline ||
                "9999-12-31"
            ).getTime();

            const bDue = new Date(
              bTask?.dueDate ||
                bTask?.deadline ||
                "9999-12-31"
            ).getTime();

            return aDue - bDue;
          }

          return (
            new Date(
              bTask?.createdAt || 0
            ).getTime() -
            new Date(
              aTask?.createdAt || 0
            ).getTime()
          );
        }
      );
    }, [
      selectedSubjectRecords,
      homeworkFilter,
      homeworkSearch,
      homeworkSort,
    ]);

  const selectedHomework =
    homeworkRecords.find(
      (record) =>
        record.taskId === selectedTaskId
    ) || null;

  const pendingTasks = useMemo(() => {
    return sortedTasks
      .filter(
        (task) => !getMySubmission(task)
      )
      .slice(0, 3);
  }, [sortedTasks, getMySubmission]);

  const upcomingExams = useMemo(() => {
    return [...exams].sort((a, b) => {
      const aTime = new Date(getExamDateValue(a) || 0).getTime();
      const bTime = new Date(getExamDateValue(b) || 0).getTime();

      return aTime - bTime;
    });
  }, [exams]);

  const recentAttendance = useMemo(() => {
    return sortByDateDesc(attendance, [
      "date",
      "attendanceDate",
      "createdAt",
    ]).slice(0, 8);
  }, [attendance]);

  const recentResults = useMemo(() => {
    return sortByDateDesc(results, ["date", "examDate", "createdAt"]).slice(0, 8);
  }, [results]);

  const recentNotices = useMemo(() => {
    return sortByDateDesc(notices, ["createdAt", "date"]).slice(0, 8);
  }, [notices]);

  const sortedTimetable = useMemo(() => {
    return [...timetable]
      .filter((item) => item?.isActive !== false)
      .sort((a, b) => {
        const dayDiff =
          getRoutineDayNumber(a) -
          getRoutineDayNumber(b);

        if (dayDiff !== 0) return dayDiff;

        return String(
          a?.startTime || a?.time || ""
        ).localeCompare(
          String(
            b?.startTime || b?.time || ""
          )
        );
      });
  }, [timetable]);

  const timetableByDay = useMemo(() => {
    const grouped = {};

    DAYS_OF_WEEK.forEach((day) => {
      grouped[day] = [];
    });

    sortedTimetable.forEach((item) => {
      const dayName = getRoutineDayName(item);
      const matchingDay = DAYS_OF_WEEK.find(
        (day) =>
          day.toLowerCase() ===
          dayName.toLowerCase()
      );

      if (matchingDay) {
        grouped[matchingDay].push(item);
      }
    });

    return grouped;
  }, [sortedTimetable]);

  const timetableTimeSlots = useMemo(() => {
    const slotMap = new Map();

    sortedTimetable.forEach((item) => {
      const startTime = String(
        item?.startTime || item?.start || ""
      ).trim();

      const endTime = String(
        item?.endTime || item?.end || ""
      ).trim();

      const slotKey = `${startTime}|${endTime}`;

      if (!slotMap.has(slotKey)) {
        slotMap.set(slotKey, {
          key: slotKey,
          startTime,
          endTime,
          startMinutes:
            getTimeMinutes(startTime) ?? 9999,
        });
      }
    });

    return Array.from(slotMap.values()).sort(
      (a, b) =>
        a.startMinutes - b.startMinutes
    );
  }, [sortedTimetable]);

  const today = new Date();
  const todayDateKey = toLocalDateKey(today);
  const todayDayName = DAYS_OF_WEEK[today.getDay()];
  const nowMinutes =
    today.getHours() * 60 + today.getMinutes();

  const todayTimetable = useMemo(() => {
    return (
      timetableByDay[todayDayName] || []
    ).filter((item) =>
      isTimetableEntryActiveOnDate(
        item,
        today
      )
    );
  }, [timetableByDay, todayDayName]);

  const currentTimetableItem = useMemo(() => {
    return (
      todayTimetable.find((item) => {
        const startMinutes = getTimeMinutes(
          item?.startTime
        );
        const endMinutes = getTimeMinutes(
          item?.endTime
        );

        return (
          startMinutes !== null &&
          endMinutes !== null &&
          nowMinutes >= startMinutes &&
          nowMinutes < endMinutes
        );
      }) || null
    );
  }, [todayTimetable, nowMinutes]);

  const nextTimetableItem = useMemo(() => {
    return (
      todayTimetable.find((item) => {
        const startMinutes = getTimeMinutes(
          item?.startTime
        );

        return (
          startMinutes !== null &&
          startMinutes > nowMinutes
        );
      }) || null
    );
  }, [todayTimetable, nowMinutes]);

  const calendarGridDates = useMemo(() => {
    const firstDayOfMonth = new Date(
      calendarCursor.getFullYear(),
      calendarCursor.getMonth(),
      1
    );

    const gridStart = new Date(
      firstDayOfMonth
    );

    gridStart.setDate(
      firstDayOfMonth.getDate() -
        firstDayOfMonth.getDay()
    );

    return Array.from(
      { length: 42 },
      (_, index) => {
        const date = new Date(gridStart);
        date.setDate(
          gridStart.getDate() + index
        );
        date.setHours(12, 0, 0, 0);
        return date;
      }
    );
  }, [calendarCursor]);

  const calendarEvents = useMemo(() => {
    const events = [];
    const firstGridDate =
      calendarGridDates[0];
    const lastGridDate =
      calendarGridDates[
        calendarGridDates.length - 1
      ];

    const isInsideGrid = (dateValue) => {
      const date = parseCalendarDate(
        dateValue
      );

      if (!date) return false;

      date.setHours(12, 0, 0, 0);

      return (
        date >= firstGridDate &&
        date <= lastGridDate
      );
    };

    tasks.forEach((task, index) => {
      const dueDate =
        task?.dueDate ||
        task?.deadline ||
        "";

      const date = parseCalendarDate(
        dueDate
      );

      if (!date || !isInsideGrid(date)) {
        return;
      }

      const dateKey = toLocalDateKey(date);

      events.push({
        id: `homework-${getRecordId(
          task,
          index
        )}-${dateKey}`,
        type: "homework",
        title:
          task?.title ||
          task?.taskTitle ||
          task?.homeworkTitle ||
          "Homework deadline",
        subtitle:
          task?.subjectName ||
          task?.subject ||
          "Homework",
        date,
        dateKey,
        startTime: String(
          task?.dueTime || ""
        ).trim(),
        endTime: "",
        allDay: !task?.dueTime,
        source: task,
      });
    });

    exams.forEach((exam, index) => {
      const examDate =
        getExamDateValue(exam);
      const date = parseCalendarDate(
        examDate
      );

      if (!date || !isInsideGrid(date)) {
        return;
      }

      const dateKey = toLocalDateKey(date);

      events.push({
        id: `exam-${getRecordId(
          exam,
          index
        )}-${dateKey}`,
        type: "exam",
        title:
          exam?.title ||
          exam?.examTitle ||
          exam?.name ||
          "Exam",
        subtitle:
          exam?.subjectName ||
          exam?.subject ||
          "Exam",
        date,
        dateKey,
        startTime: String(
          exam?.startTime ||
            exam?.time ||
            ""
        ).trim(),
        endTime: String(
          exam?.endTime || ""
        ).trim(),
        allDay: !(
          exam?.startTime ||
          exam?.time
        ),
        source: exam,
      });
    });

    notices.forEach((notice, index) => {
      if (!isNoticeCalendarEvent(notice)) {
        return;
      }

      const noticeDate =
        getNoticeCalendarDateValue(
          notice
        );

      const date = parseCalendarDate(
        noticeDate
      );

      if (!date || !isInsideGrid(date)) {
        return;
      }

      const dateKey = toLocalDateKey(date);

      events.push({
        id: `notice-${getRecordId(
          notice,
          index
        )}-${dateKey}`,
        type: "notice",
        title:
          notice?.title ||
          notice?.noticeTitle ||
          "School event",
        subtitle:
          notice?.location ||
          notice?.noticeType ||
          "Notice",
        date,
        dateKey,
        startTime: String(
          notice?.startTime ||
            notice?.eventTime ||
            ""
        ).trim(),
        endTime: String(
          notice?.endTime || ""
        ).trim(),
        allDay:
          notice?.isAllDay === true ||
          !(
            notice?.startTime ||
            notice?.eventTime
          ),
        source: notice,
      });
    });

    calendarGridDates.forEach((date) => {
      const dayName =
        DAYS_OF_WEEK[date.getDay()];
      const dateKey = toLocalDateKey(date);

      (
        timetableByDay[dayName] || []
      ).forEach((item, index) => {
        if (
          !isTimetableEntryActiveOnDate(
            item,
            date
          )
        ) {
          return;
        }

        const classType = String(
          item?.classType ||
            "Regular Class"
        ).trim();

        events.push({
          id: `class-${getRecordId(
            item,
            index
          )}-${dateKey}`,
          type: "class",
          title:
            getTimetableSubjectName(
              item
            ) || classType,
          subtitle:
            getTimetableTeacherName(
              item
            ) || classType,
          date,
          dateKey,
          startTime: String(
            item?.startTime || ""
          ).trim(),
          endTime: String(
            item?.endTime || ""
          ).trim(),
          allDay: false,
          source: item,
        });
      });
    });

    return events.sort((a, b) => {
      const dateDifference =
        a.date.getTime() -
        b.date.getTime();

      if (dateDifference !== 0) {
        return dateDifference;
      }

      const aTime =
        getTimeMinutes(a.startTime) ??
        9999;
      const bTime =
        getTimeMinutes(b.startTime) ??
        9999;

      if (aTime !== bTime) {
        return aTime - bTime;
      }

      return a.title.localeCompare(
        b.title
      );
    });
  }, [
    calendarGridDates,
    tasks,
    exams,
    notices,
    timetableByDay,
  ]);

  const calendarEventsByDate = useMemo(() => {
    const grouped = new Map();

    calendarEvents.forEach((event) => {
      if (!grouped.has(event.dateKey)) {
        grouped.set(event.dateKey, []);
      }

      grouped.get(event.dateKey).push(event);
    });

    return grouped;
  }, [calendarEvents]);

  const selectedMonthEvents = useMemo(() => {
    return calendarEvents.filter(
      (event) =>
        event.date.getMonth() ===
          calendarCursor.getMonth() &&
        event.date.getFullYear() ===
          calendarCursor.getFullYear()
    );
  }, [calendarEvents, calendarCursor]);

  const nextExam = upcomingExams[0] || null;

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      if (!studentId) {
        setError(
          "Student ID missing. Please logout and login again with the student account."
        );
        return;
      }

      if (!className) {
        setError(
          "Student class is missing. Admin must create student with class and section."
        );
        return;
      }

      const requests = await Promise.allSettled([
        getTasksByClass(className, section),
        getSubmissionsByStudent(studentId),
        getExamsByClass(className, section),
        getNoticesByClass(className, section),
        getAttendanceByStudent(studentId),
        getResultsByStudent(studentId),
        getTimetableByStudent(studentId, {
          academicYear,
        }),
        getStudentSubjects(studentId),
      ]);

      setTasks(requests[0].status === "fulfilled" ? toArray(requests[0].value) : []);

      setSubmissions(
        requests[1].status === "fulfilled" ? toArray(requests[1].value) : []
      );

      setExams(requests[2].status === "fulfilled" ? toArray(requests[2].value) : []);

      setNotices(
        requests[3].status === "fulfilled" ? toArray(requests[3].value) : []
      );

      setAttendance(
        requests[4].status === "fulfilled" ? toArray(requests[4].value) : []
      );

      setResults(
        requests[5].status === "fulfilled" ? toArray(requests[5].value) : []
      );

      setTimetable(
        requests[6].status === "fulfilled" ? toArray(requests[6].value) : []
      );

      setAcademicSubjects(
        requests[7].status === "fulfilled" ? toArray(requests[7].value) : []
      );

      const failedRequests = requests.filter((item) => item.status === "rejected");

      if (failedRequests.length > 0) {
        console.warn("Some student dashboard APIs failed:", failedRequests);
      }
    } catch (err) {
      console.error("Student dashboard error:", err);
      setError(
        err.response?.data?.message || "Failed to load student dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeView !== "homework") {
      setSelectedTaskId("");
    }
  }, [activeView]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== "Escape") {
        return;
      }

      if (selectedTaskId) {
        setSelectedTaskId("");
      }

      if (selectedScheduleItem) {
        setSelectedScheduleItem(null);
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [selectedTaskId, selectedScheduleItem]);

  const handleAnswerChange = (taskId, value) => {
    setAnswers((previous) => ({
      ...previous,
      [taskId]: value,
    }));
  };

  const handleFileChange = (taskId, file) => {
    setFiles((previous) => ({
      ...previous,
      [taskId]: file,
    }));
  };

  const openHomeworkDetails = (
    record
  ) => {
    setSelectedTaskId(record.taskId);

    if (!record.submitted) {
      setEditingSubmission(
        (previous) => ({
          ...previous,
          [record.taskId]: true,
        })
      );
    }
  };

  const closeHomeworkDetails = () => {
    setSelectedTaskId("");
  };

  const startUpdatingSubmission = (
    record
  ) => {
    const previousAnswer =
      record?.submission?.answer ||
      record?.submission
        ?.submissionText ||
      "";

    setAnswers((previous) => ({
      ...previous,
      [record.taskId]:
        previous[record.taskId] ??
        previousAnswer,
    }));

    setEditingSubmission(
      (previous) => ({
        ...previous,
        [record.taskId]: true,
      })
    );
  };

  const cancelUpdatingSubmission = (
    taskId
  ) => {
    setEditingSubmission(
      (previous) => ({
        ...previous,
        [taskId]: false,
      })
    );

    setAnswers((previous) => ({
      ...previous,
      [taskId]: "",
    }));

    setFiles((previous) => ({
      ...previous,
      [taskId]: null,
    }));

    setFileInputKeys(
      (previous) => ({
        ...previous,
        [taskId]: Date.now(),
      })
    );
  };

  const handleSubmitHomework = async (taskId) => {
    try {
      setError("");
      setMessage("");

      const answer = answers[taskId] || "";
      const file = files[taskId] || null;

      if (!answer.trim() && !file) {
        alert("Please write your answer or upload a file before submitting.");
        return;
      }

      setSubmitting((previous) => ({
        ...previous,
        [taskId]: true,
      }));

      await submitHomework(taskId, {
        studentId,
        studentName,
        className,
        section,
        schoolId,
        answer,
        file,
      });

      setMessage("Homework submitted successfully.");

      setAnswers((previous) => ({
        ...previous,
        [taskId]: "",
      }));

      setFiles((previous) => ({
        ...previous,
        [taskId]: null,
      }));

      setFileInputKeys((previous) => ({
        ...previous,
        [taskId]: Date.now(),
      }));

      setEditingSubmission(
        (previous) => ({
          ...previous,
          [taskId]: false,
        })
      );

      await fetchStudentData();
    } catch (err) {
      console.error("Submit homework error:", err);
      alert(err.response?.data?.message || "Failed to submit homework.");
    } finally {
      setSubmitting((previous) => ({
        ...previous,
        [taskId]: false,
      }));
    }
  };

  const openSubjectFolder = (subjectKey) => {
    setSelectedSubjectKey(subjectKey);
    setHomeworkFilter("all");
    setHomeworkSearch("");
    setSelectedTaskId("");
  };

  const returnToSubjectFolders = () => {
    setSelectedSubjectKey("");
    setHomeworkFilter("all");
    setHomeworkSearch("");
    setSelectedTaskId("");
  };

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);

    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const openTimetableDetails = (
    item,
    dateValue = null
  ) => {
    const detailDate =
      parseCalendarDate(dateValue);

    setSelectedScheduleItem({
      id: `class-${getRecordId(item)}`,
      type: "class",
      title:
        getTimetableSubjectName(item),
      subtitle:
        getTimetableTeacherName(item) ||
        item?.classType ||
        "School period",
      date: detailDate,
      dateKey: detailDate
        ? toLocalDateKey(detailDate)
        : "",
      startTime: String(
        item?.startTime || ""
      ).trim(),
      endTime: String(
        item?.endTime || ""
      ).trim(),
      allDay: false,
      source: item,
    });
  };

  const changeCalendarMonth = (
    offset
  ) => {
    setCalendarCursor((previous) =>
      new Date(
        previous.getFullYear(),
        previous.getMonth() + offset,
        1
      )
    );
  };

  const returnCalendarToToday = () => {
    const currentDate = new Date();

    setCalendarCursor(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1
      )
    );
  };

  const selectedScheduleSource =
    selectedScheduleItem?.source || {};

  const selectedScheduleMeta =
    CALENDAR_EVENT_META[
      selectedScheduleItem?.type
    ] || CALENDAR_EVENT_META.class;

  const styles = {
    hero: {
      background:
        "radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 30%), linear-gradient(135deg, #0f8cff 0%, #48b8f6 100%)",
      color: "#ffffff",
      borderRadius: 28,
      padding: 28,
      marginBottom: 24,
      boxShadow: "0 22px 55px rgba(15, 140, 255, 0.22)",
      alignItems: "center",
    },
    avatar: {
      width: 74,
      height: 74,
      borderRadius: 24,
      background: "rgba(255,255,255,0.2)",
      border: "1px solid rgba(255,255,255,0.32)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 34,
      fontWeight: 900,
      boxShadow: "0 12px 26px rgba(15, 23, 42, 0.12)",
    },
    heroTitle: {
      fontSize: "clamp(32px, 5vw, 54px)",
      lineHeight: 1.05,
      margin: "14px 0 12px",
      letterSpacing: "-1.2px",
      fontWeight: 950,
      color: "#ffffff",
    },
    heroText: {
      margin: 0,
      color: "rgba(255,255,255,0.94)",
      fontSize: 17,
      lineHeight: 1.55,
    },
    heroPanel: {
      background: "rgba(255,255,255,0.16)",
      border: "1px solid rgba(255,255,255,0.25)",
      borderRadius: 24,
      padding: 20,
      backdropFilter: "blur(12px)",
    },
    heroMetric: {
      background: "rgba(255,255,255,0.17)",
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
    },
    quickButton: {
      background: "#ffffff",
      color: "#0f8cff",
      borderRadius: 999,
      padding: "10px 14px",
      fontWeight: 900,
      fontSize: 14,
      textDecoration: "none",
      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
      border: "none",
      cursor: "pointer",
    },
    actionRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 18,
    },
    buttonRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 12,
    },
    profileRow: {
      display: "grid",
      gridTemplateColumns: "120px 1fr",
      gap: 10,
      padding: "12px 0",
      borderBottom: "1px solid #edf2f7",
    },
    progressTrack: {
      width: "100%",
      height: 12,
      borderRadius: 999,
      background: "#e5e7eb",
      overflow: "hidden",
      marginTop: 12,
    },
    progressBar: {
      height: "100%",
      borderRadius: 999,
      background: "linear-gradient(90deg, #0f8cff, #48b8f6)",
      width: `${attendanceSummary.percentage}%`,
    },
  };

  const homeworkFolders = [
    {
      id: "all",
      label: "All Homework",
      icon: "📁",
      count: homeworkCounts.all,
      description: "Every assignment",
    },
    {
      id: "new",
      label: "Just Added",
      icon: "✨",
      count: homeworkCounts.new,
      description: "Added in 3 days",
    },
    {
      id: "due",
      label: "Due Soon",
      icon: "⏰",
      count: homeworkCounts.due,
      description: "Due within 7 days",
    },
    {
      id: "pending",
      label: "Pending",
      icon: "🗂️",
      count: homeworkCounts.pending,
      description: "Waiting for submission",
    },
    {
      id: "late",
      label: "Late",
      icon: "⚠️",
      count: homeworkCounts.late,
      description: "Past the due date",
    },
    {
      id: "submitted",
      label: "Submitted",
      icon: "✅",
      count: homeworkCounts.submitted,
      description: "Completed work",
    },
  ];

  const selectedTask =
    selectedHomework?.task || null;

  const selectedSubmission =
    selectedHomework?.submission || null;

  const selectedTaskFilePath =
    getTaskFilePath(selectedTask);

  const selectedTaskFileUrl =
    buildFileUrl(selectedTaskFilePath);

  const selectedTaskFileName =
    getFileName(selectedTaskFilePath);

  const selectedSubmissionFilePath =
    getSubmissionFilePath(
      selectedSubmission
    );

  const selectedSubmissionFileUrl =
    buildFileUrl(
      selectedSubmissionFilePath
    );

  const selectedSubmissionFileName =
    getFileName(
      selectedSubmissionFilePath
    );

  const headerMeta = (
    <span>🎓 Class {className || "N/A"}{section ? ` • Section ${section}` : ""}</span>
  );

  return (
    <PortalLayout
      role="student"
      portalName="Student Portal"
      user={loggedUser}
      navigation={STUDENT_NAVIGATION}
      onLogout={logout}
      headerMeta={headerMeta}
    >
      <div className="dashboard-page">
      <style>
        {`
          .student-hero {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
            gap: 22px;
          }

          .student-hero-left {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            position: relative;
            z-index: 2;
          }

          .student-hero-left::before,
          .student-hero-left::after {
            display: none !important;
          }

          .student-hero-left h1,
          .student-hero-left p {
            color: #ffffff !important;
            opacity: 1 !important;
            visibility: visible !important;
            -webkit-text-fill-color: #ffffff !important;
            text-shadow: none !important;
            mix-blend-mode: normal !important;
          }

          .student-quick-links {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 18px;
          }

          .student-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(175px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }

          .student-stat-card::before,
          .student-stat-card::after {
            display: none !important;
          }

          .student-two-column {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 18px;
            align-items: start;
          }

          .homework-professional-shell {
            margin-top: 24px;
          }

          .homework-page-intro {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 18px;
            padding: 24px;
            border: 1px solid #dbe7f5;
            border-radius: 24px;
            background:
              radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 34%),
              linear-gradient(135deg, #ffffff, #f8fbff);
            box-shadow: 0 16px 38px rgba(15, 23, 42, 0.07);
          }

          .homework-page-intro h2 {
            margin: 0;
            color: #0f172a;
            font-size: clamp(24px, 3vw, 34px);
            font-weight: 950;
            letter-spacing: -0.6px;
          }

          .homework-page-intro p {
            max-width: 720px;
            margin: 8px 0 0;
            color: #64748b;
            line-height: 1.65;
          }

          .homework-refresh-button {
            min-height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px 15px;
            border: 1px solid #bfdbfe;
            border-radius: 13px;
            background: #ffffff;
            color: #1d4ed8;
            font: inherit;
            font-size: 13px;
            font-weight: 900;
            cursor: pointer;
            box-shadow: 0 8px 18px rgba(37, 99, 235, 0.08);
          }

          .homework-folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(165px, 1fr));
            gap: 14px;
            margin-bottom: 18px;
          }

          .homework-folder-card {
            position: relative;
            min-height: 138px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 17px;
            border: 1px solid #dbe7f5;
            border-radius: 20px;
            background: #ffffff;
            color: #0f172a;
            text-align: left;
            font: inherit;
            cursor: pointer;
            overflow: hidden;
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
            transition:
              transform 170ms ease,
              border-color 170ms ease,
              box-shadow 170ms ease,
              background 170ms ease;
          }

          .homework-folder-card::after {
            content: "";
            position: absolute;
            right: -24px;
            bottom: -28px;
            width: 86px;
            height: 86px;
            border-radius: 999px;
            background: rgba(59, 130, 246, 0.07);
          }

          .homework-folder-card:hover {
            transform: translateY(-3px);
            border-color: #93c5fd;
            box-shadow: 0 18px 36px rgba(37, 99, 235, 0.12);
          }

          .homework-folder-card.is-active {
            border-color: #2563eb;
            background:
              radial-gradient(circle at bottom right, rgba(37, 99, 235, 0.13), transparent 38%),
              linear-gradient(135deg, #eff6ff, #ffffff);
            box-shadow:
              0 0 0 3px rgba(37, 99, 235, 0.08),
              0 18px 36px rgba(37, 99, 235, 0.13);
          }

          .homework-folder-top {
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
          }

          .homework-folder-icon {
            width: 46px;
            height: 46px;
            display: grid;
            place-items: center;
            border-radius: 15px;
            background: #eff6ff;
            font-size: 24px;
          }

          .homework-folder-count {
            min-width: 34px;
            height: 34px;
            display: grid;
            place-items: center;
            padding: 0 9px;
            border-radius: 999px;
            background: #f1f5f9;
            color: #334155;
            font-size: 13px;
            font-weight: 950;
          }

          .homework-folder-card.is-active .homework-folder-count {
            background: #2563eb;
            color: #ffffff;
          }

          .homework-folder-copy {
            position: relative;
            z-index: 1;
          }

          .homework-folder-copy strong,
          .homework-folder-copy span {
            display: block;
          }

          .homework-folder-copy strong {
            font-size: 14px;
            font-weight: 950;
          }

          .homework-folder-copy span {
            margin-top: 4px;
            color: #64748b;
            font-size: 11px;
            font-weight: 700;
          }

          .homework-explorer {
            border: 1px solid #dbe7f5;
            border-radius: 24px;
            background: #ffffff;
            box-shadow: 0 16px 38px rgba(15, 23, 42, 0.07);
            overflow: hidden;
          }

          .homework-explorer-toolbar {
            display: grid;
            grid-template-columns: minmax(220px, 1fr) minmax(150px, 0.38fr) auto;
            gap: 12px;
            padding: 16px;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
          }

          .homework-search-wrap {
            position: relative;
          }

          .homework-search-icon {
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: #64748b;
            pointer-events: none;
          }

          .homework-control {
            width: 100%;
            min-height: 44px;
            border: 1px solid #cbd5e1;
            border-radius: 13px;
            background: #ffffff;
            color: #0f172a;
            padding: 10px 13px;
            font: inherit;
            font-size: 13px;
            outline: none;
            transition:
              border-color 150ms ease,
              box-shadow 150ms ease;
          }

          .homework-search-wrap .homework-control {
            padding-left: 40px;
          }

          .homework-control:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
          }

          .homework-view-switch {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px;
            border: 1px solid #cbd5e1;
            border-radius: 13px;
            background: #ffffff;
          }

          .homework-view-button {
            width: 36px;
            height: 36px;
            display: grid;
            place-items: center;
            border: 0;
            border-radius: 9px;
            background: transparent;
            color: #64748b;
            font-size: 16px;
            cursor: pointer;
          }

          .homework-view-button.is-active {
            background: #2563eb;
            color: #ffffff;
          }

          .homework-explorer-titlebar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            padding: 15px 18px;
            border-bottom: 1px solid #eef2f7;
          }

          .homework-explorer-titlebar strong {
            color: #0f172a;
            font-size: 14px;
          }

          .homework-explorer-titlebar span {
            color: #64748b;
            font-size: 12px;
            font-weight: 750;
          }

          .homework-items {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
            gap: 14px;
            padding: 16px;
          }

          .homework-items.is-list {
            display: flex;
            flex-direction: column;
          }

          .homework-item-card {
            position: relative;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 14px;
            padding: 17px;
            border: 1px solid #dbe7f5;
            border-radius: 18px;
            background: #ffffff;
            cursor: pointer;
            transition:
              transform 160ms ease,
              border-color 160ms ease,
              box-shadow 160ms ease;
          }

          .homework-item-card:hover {
            transform: translateY(-2px);
            border-color: #93c5fd;
            box-shadow: 0 14px 30px rgba(37, 99, 235, 0.1);
          }

          .homework-items.is-list .homework-item-card {
            display: grid;
            grid-template-columns: auto minmax(180px, 1fr) minmax(130px, 0.4fr) minmax(130px, 0.38fr) auto;
            align-items: center;
            gap: 16px;
          }

          .homework-item-icon {
            width: 48px;
            height: 48px;
            flex: 0 0 48px;
            display: grid;
            place-items: center;
            border-radius: 15px;
            background: linear-gradient(135deg, #eff6ff, #dbeafe);
            font-size: 24px;
          }

          .homework-item-heading {
            min-width: 0;
          }

          .homework-item-heading h3 {
            margin: 0;
            color: #0f172a;
            font-size: 16px;
            font-weight: 950;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .homework-item-heading p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 12px;
            font-weight: 750;
          }

          .homework-item-badges {
            display: flex;
            align-items: center;
            gap: 7px;
            flex-wrap: wrap;
          }

          .homework-mini-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 27px;
            padding: 5px 9px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 950;
          }

          .homework-mini-badge.is-submitted {
            background: #dcfce7;
            color: #166534;
          }

          .homework-mini-badge.is-late {
            background: #fee2e2;
            color: #991b1b;
          }

          .homework-mini-badge.is-due {
            background: #fef3c7;
            color: #92400e;
          }

          .homework-mini-badge.is-pending {
            background: #e0f2fe;
            color: #075985;
          }

          .homework-mini-badge.is-new {
            background: #ede9fe;
            color: #5b21b6;
          }

          .homework-item-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 9px;
          }

          .homework-meta-box {
            min-width: 0;
            padding: 10px;
            border-radius: 12px;
            background: #f8fafc;
          }

          .homework-meta-box span,
          .homework-meta-box strong {
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .homework-meta-box span {
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.45px;
          }

          .homework-meta-box strong {
            margin-top: 4px;
            color: #0f172a;
            font-size: 12px;
          }

          .homework-open-button {
            min-height: 38px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 9px 12px;
            border: 1px solid #bfdbfe;
            border-radius: 12px;
            background: #eff6ff;
            color: #1d4ed8;
            font: inherit;
            font-size: 12px;
            font-weight: 950;
            cursor: pointer;
          }

          .homework-items.is-list .homework-item-meta {
            display: contents;
          }

          .homework-items.is-list .homework-meta-box {
            background: transparent;
            padding: 0;
          }

          .homework-empty-wrap {
            padding: 24px;
          }

          .homework-modal-backdrop {
            position: fixed;
            inset: 0;
            z-index: 120;
            display: grid;
            place-items: center;
            padding: 18px;
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(7px);
          }

          .homework-modal {
            width: min(880px, 100%);
            max-height: min(88vh, 900px);
            display: flex;
            flex-direction: column;
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 24px;
            background: #ffffff;
            box-shadow: 0 30px 80px rgba(15, 23, 42, 0.28);
            overflow: hidden;
          }

          .homework-modal-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 20px 22px;
            border-bottom: 1px solid #e2e8f0;
            background:
              radial-gradient(circle at top right, rgba(59, 130, 246, 0.13), transparent 38%),
              #f8fafc;
          }

          .homework-modal-header h2 {
            margin: 5px 0 0;
            color: #0f172a;
            font-size: clamp(22px, 3vw, 30px);
            font-weight: 950;
            letter-spacing: -0.5px;
          }

          .homework-modal-close {
            width: 40px;
            height: 40px;
            flex: 0 0 40px;
            display: grid;
            place-items: center;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            color: #334155;
            font-size: 20px;
            cursor: pointer;
          }

          .homework-modal-body {
            padding: 22px;
            overflow-y: auto;
          }

          .homework-detail-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 18px;
          }

          .homework-detail-box {
            padding: 13px;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            background: #f8fafc;
          }

          .homework-detail-box span,
          .homework-detail-box strong {
            display: block;
          }

          .homework-detail-box span {
            color: #64748b;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }

          .homework-detail-box strong {
            margin-top: 5px;
            color: #0f172a;
            font-size: 13px;
          }

          .homework-description-panel,
          .homework-file-panel,
          .homework-submission-panel {
            margin-top: 16px;
            padding: 17px;
            border: 1px solid #dbe7f5;
            border-radius: 17px;
            background: #fbfdff;
          }

          .homework-description-panel h3,
          .homework-file-panel h3,
          .homework-submission-panel h3 {
            margin: 0 0 10px;
            color: #0f172a;
            font-size: 15px;
            font-weight: 950;
          }

          .homework-description-panel p,
          .homework-file-panel p,
          .homework-submission-panel p {
            color: #475569;
            line-height: 1.65;
          }

          .homework-file-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            flex-wrap: wrap;
          }

          .homework-file-identity {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .homework-file-identity span {
            width: 42px;
            height: 42px;
            flex: 0 0 42px;
            display: grid;
            place-items: center;
            border-radius: 12px;
            background: #e0f2fe;
            font-size: 21px;
          }

          .homework-file-identity strong {
            display: block;
            max-width: 420px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .homework-file-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .homework-submission-form {
            margin-top: 16px;
            padding: 18px;
            border: 1px solid #bfdbfe;
            border-radius: 18px;
            background: linear-gradient(135deg, #eff6ff, #ffffff);
          }

          .homework-submission-form h3 {
            margin: 0 0 14px;
            color: #0f172a;
            font-size: 17px;
            font-weight: 950;
          }

          .homework-textarea {
            width: 100%;
            min-height: 145px;
            resize: vertical;
            border: 1px solid #cbd5e1;
            border-radius: 14px;
            background: #ffffff;
            color: #0f172a;
            padding: 14px;
            font: inherit;
            line-height: 1.55;
            outline: none;
          }

          .homework-textarea:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
          }

          .homework-upload-label {
            min-height: 96px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-top: 13px;
            padding: 15px;
            border: 1px dashed #60a5fa;
            border-radius: 15px;
            background: rgba(255, 255, 255, 0.78);
            color: #1d4ed8;
            text-align: center;
            cursor: pointer;
          }

          .homework-upload-label strong {
            font-size: 13px;
          }

          .homework-upload-label span {
            color: #64748b;
            font-size: 11px;
          }

          .homework-upload-input {
            display: none;
          }

          .homework-selected-file {
            margin: 10px 0 0;
            padding: 9px 11px;
            border-radius: 11px;
            background: #dcfce7;
            color: #166534;
            font-size: 12px;
            font-weight: 800;
          }

          .homework-form-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            flex-wrap: wrap;
            margin-top: 14px;
          }

          .homework-action-primary,
          .homework-action-secondary {
            min-height: 42px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 10px 15px;
            border-radius: 12px;
            font: inherit;
            font-size: 13px;
            font-weight: 950;
            cursor: pointer;
          }

          .homework-action-primary {
            border: 1px solid #2563eb;
            background: linear-gradient(135deg, #2563eb, #4f46e5);
            color: #ffffff;
            box-shadow: 0 10px 22px rgba(37, 99, 235, 0.2);
          }

          .homework-action-primary:disabled {
            opacity: 0.65;
            cursor: not-allowed;
          }

          .homework-action-secondary {
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #334155;
          }

          .homework-submission-summary {
            margin-top: 16px;
            padding: 17px;
            border: 1px solid #bbf7d0;
            border-radius: 17px;
            background: #f0fdf4;
          }

          .homework-submission-summary h3 {
            margin: 0 0 10px;
            color: #166534;
            font-size: 16px;
            font-weight: 950;
          }

          .homework-submission-summary p {
            margin: 8px 0;
            color: #365314;
            line-height: 1.55;
          }


          .subject-library {
            margin-bottom: 18px;
            padding: 20px;
            border: 1px solid #dbe7f5;
            border-radius: 24px;
            background:
              radial-gradient(circle at top right, rgba(37, 99, 235, 0.1), transparent 34%),
              linear-gradient(135deg, #ffffff, #f8fbff);
            box-shadow: 0 16px 38px rgba(15, 23, 42, 0.07);
          }

          .subject-library-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 17px;
          }

          .subject-library-header h3 {
            margin: 0;
            color: #0f172a;
            font-size: 21px;
            font-weight: 950;
          }

          .subject-library-header p {
            max-width: 690px;
            margin: 7px 0 0;
            color: #64748b;
            line-height: 1.55;
          }

          .subject-library-count {
            min-width: 94px;
            padding: 10px 13px;
            border: 1px solid #bfdbfe;
            border-radius: 14px;
            background: #ffffff;
            color: #1d4ed8;
            font-size: 12px;
            font-weight: 900;
            text-align: center;
          }

          .subject-folder-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
            gap: 14px;
          }

          .subject-folder-card {
            position: relative;
            min-width: 0;
            min-height: 180px;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            padding: 18px;
            border: 1px solid #dbe7f5;
            border-top: 5px solid #3b82f6;
            border-radius: 20px;
            background: #ffffff;
            color: #0f172a;
            text-align: left;
            font: inherit;
            cursor: pointer;
            overflow: hidden;
            box-shadow: 0 11px 28px rgba(15, 23, 42, 0.06);
            transition:
              transform 170ms ease,
              border-color 170ms ease,
              box-shadow 170ms ease;
          }

          .subject-folder-card::after {
            content: "";
            position: absolute;
            right: -34px;
            bottom: -42px;
            width: 120px;
            height: 120px;
            border-radius: 999px;
            background: rgba(59, 130, 246, 0.07);
          }

          .subject-folder-card:hover {
            transform: translateY(-3px);
            border-color: #93c5fd;
            box-shadow: 0 18px 38px rgba(37, 99, 235, 0.13);
          }

          .subject-folder-card.is-empty {
            border-top-color: #94a3b8;
          }

          .subject-folder-card-top {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
          }

          .subject-folder-icon {
            width: 52px;
            height: 52px;
            flex: 0 0 52px;
            display: grid;
            place-items: center;
            border-radius: 16px;
            background: linear-gradient(135deg, #eff6ff, #dbeafe);
            font-size: 27px;
          }

          .subject-folder-total {
            min-width: 38px;
            height: 38px;
            display: grid;
            place-items: center;
            padding: 0 10px;
            border-radius: 999px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 13px;
            font-weight: 950;
          }

          .subject-folder-copy {
            position: relative;
            z-index: 1;
            min-width: 0;
            margin-top: 16px;
          }

          .subject-folder-copy h4 {
            margin: 0;
            color: #0f172a;
            font-size: 17px;
            font-weight: 950;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .subject-folder-copy p {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 11px;
            font-weight: 750;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .subject-folder-stats {
            position: relative;
            z-index: 1;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: auto;
            padding-top: 16px;
          }

          .subject-folder-stats span {
            padding: 9px;
            border-radius: 11px;
            background: #f8fafc;
            color: #475569;
            font-size: 11px;
            font-weight: 850;
          }

          .subject-folder-open {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 12px;
            color: #1d4ed8;
            font-size: 12px;
            font-weight: 950;
          }

          .subject-workspace-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            margin-bottom: 16px;
            padding: 16px 18px;
            border: 1px solid #bfdbfe;
            border-radius: 19px;
            background: linear-gradient(135deg, #eff6ff, #ffffff);
          }

          .subject-workspace-identity {
            min-width: 0;
            display: flex;
            align-items: center;
            gap: 13px;
          }

          .subject-workspace-identity > span {
            width: 49px;
            height: 49px;
            flex: 0 0 49px;
            display: grid;
            place-items: center;
            border-radius: 15px;
            background: #ffffff;
            font-size: 25px;
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
          }

          .subject-workspace-identity h3 {
            margin: 0;
            color: #0f172a;
            font-size: 20px;
            font-weight: 950;
          }

          .subject-workspace-identity p {
            margin: 5px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          .subject-back-button {
            min-height: 41px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            padding: 9px 13px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            color: #334155;
            font: inherit;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
          }

          .schedule-page-shell {
            display: grid;
            gap: 18px;
          }

          .schedule-page-intro {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            padding: 24px;
            border: 1px solid #dbe7f5;
            border-radius: 24px;
            background:
              radial-gradient(circle at top right, rgba(14, 165, 233, 0.14), transparent 34%),
              linear-gradient(135deg, #ffffff, #f8fbff);
            box-shadow: 0 16px 38px rgba(15, 23, 42, 0.07);
          }

          .schedule-page-intro h2 {
            margin: 0;
            color: #0f172a;
            font-size: clamp(25px, 3vw, 35px);
            font-weight: 950;
            letter-spacing: -0.65px;
          }

          .schedule-page-intro p {
            max-width: 760px;
            margin: 8px 0 0;
            color: #64748b;
            line-height: 1.65;
          }

          .schedule-summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
            gap: 14px;
          }

          .schedule-summary-card {
            min-height: 126px;
            padding: 18px;
            border: 1px solid #dbe7f5;
            border-radius: 20px;
            background: #ffffff;
            box-shadow: 0 12px 28px rgba(15, 23, 42, 0.06);
          }

          .schedule-summary-card span,
          .schedule-summary-card strong,
          .schedule-summary-card small {
            display: block;
          }

          .schedule-summary-card span {
            color: #64748b;
            font-size: 12px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.45px;
          }

          .schedule-summary-card strong {
            margin-top: 10px;
            color: #0f172a;
            font-size: 21px;
            font-weight: 950;
          }

          .schedule-summary-card small {
            margin-top: 7px;
            color: #64748b;
            line-height: 1.45;
          }

          .schedule-panel {
            border: 1px solid #dbe7f5;
            border-radius: 24px;
            background: #ffffff;
            box-shadow: 0 16px 38px rgba(15, 23, 42, 0.07);
            overflow: hidden;
          }

          .schedule-panel-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 19px 21px;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
          }

          .schedule-panel-header h3 {
            margin: 0;
            color: #0f172a;
            font-size: 19px;
            font-weight: 950;
          }

          .schedule-panel-header p {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 12px;
          }

          .today-timeline {
            display: grid;
            gap: 0;
            padding: 18px 20px 22px;
          }

          .today-timeline-item {
            position: relative;
            display: grid;
            grid-template-columns: 105px 24px minmax(0, 1fr);
            gap: 12px;
            align-items: stretch;
            border: 0;
            background: transparent;
            color: inherit;
            text-align: left;
            font: inherit;
            cursor: pointer;
          }

          .today-timeline-item + .today-timeline-item {
            margin-top: 3px;
          }

          .today-timeline-time {
            padding-top: 15px;
            color: #334155;
            font-size: 12px;
            font-weight: 900;
          }

          .today-timeline-rail {
            position: relative;
            display: flex;
            justify-content: center;
          }

          .today-timeline-rail::after {
            content: "";
            position: absolute;
            top: 27px;
            bottom: -14px;
            width: 2px;
            background: #dbeafe;
          }

          .today-timeline-item:last-child .today-timeline-rail::after {
            display: none;
          }

          .today-timeline-dot {
            position: relative;
            z-index: 1;
            width: 13px;
            height: 13px;
            margin-top: 19px;
            border: 3px solid #ffffff;
            border-radius: 999px;
            background: #60a5fa;
            box-shadow: 0 0 0 2px #bfdbfe;
          }

          .today-timeline-card {
            min-width: 0;
            margin-bottom: 10px;
            padding: 14px 15px;
            border: 1px solid #dbe7f5;
            border-radius: 16px;
            background: #ffffff;
            transition:
              transform 160ms ease,
              border-color 160ms ease,
              box-shadow 160ms ease;
          }

          .today-timeline-item:hover .today-timeline-card {
            transform: translateY(-2px);
            border-color: #93c5fd;
            box-shadow: 0 12px 26px rgba(37, 99, 235, 0.1);
          }

          .today-timeline-item.is-current .today-timeline-card {
            border-color: #22c55e;
            background: #f0fdf4;
          }

          .today-timeline-item.is-current .today-timeline-dot {
            background: #22c55e;
            box-shadow: 0 0 0 2px #bbf7d0;
          }

          .today-timeline-item.is-next .today-timeline-card {
            border-color: #f59e0b;
            background: #fffbeb;
          }

          .today-timeline-card h4 {
            margin: 0;
            color: #0f172a;
            font-size: 15px;
            font-weight: 950;
          }

          .today-timeline-card p {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 12px;
            line-height: 1.5;
          }

          .weekly-table-scroll {
            overflow-x: auto;
          }

          .weekly-schedule-table {
            width: 100%;
            min-width: 1120px;
            border-collapse: separate;
            border-spacing: 0;
          }

          .weekly-schedule-table th,
          .weekly-schedule-table td {
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: top;
          }

          .weekly-schedule-table th:last-child,
          .weekly-schedule-table td:last-child {
            border-right: 0;
          }

          .weekly-schedule-table tr:last-child td {
            border-bottom: 0;
          }

          .weekly-schedule-table th {
            padding: 13px 11px;
            background: #f8fafc;
            color: #334155;
            font-size: 12px;
            font-weight: 950;
            text-align: center;
          }

          .weekly-schedule-time {
            width: 106px;
            padding: 14px 10px !important;
            background: #f8fafc;
            color: #475569;
            font-size: 11px;
            font-weight: 900;
            text-align: center;
          }

          .weekly-schedule-cell {
            min-width: 142px;
            height: 104px;
            padding: 8px;
            background: #ffffff;
          }

          .week-period-button {
            width: 100%;
            min-height: 84px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            justify-content: space-between;
            gap: 7px;
            padding: 10px;
            border: 1px solid #bfdbfe;
            border-radius: 13px;
            background: linear-gradient(135deg, #eff6ff, #ffffff);
            color: #0f172a;
            text-align: left;
            font: inherit;
            cursor: pointer;
          }

          .week-period-button + .week-period-button {
            margin-top: 7px;
          }

          .week-period-button:hover {
            border-color: #3b82f6;
            box-shadow: 0 9px 20px rgba(37, 99, 235, 0.12);
          }

          .week-period-button strong {
            font-size: 12px;
            font-weight: 950;
          }

          .week-period-button span {
            color: #64748b;
            font-size: 10px;
            line-height: 1.35;
          }

          .calendar-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
          }

          .calendar-toolbar-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
          }

          .calendar-toolbar-button {
            min-height: 38px;
            padding: 8px 12px;
            border: 1px solid #cbd5e1;
            border-radius: 11px;
            background: #ffffff;
            color: #334155;
            font: inherit;
            font-size: 12px;
            font-weight: 900;
            cursor: pointer;
          }

          .calendar-toolbar-button:hover {
            border-color: #60a5fa;
            color: #1d4ed8;
          }

          .academic-calendar-grid {
            display: grid;
            grid-template-columns: repeat(7, minmax(118px, 1fr));
            min-width: 900px;
          }

          .calendar-weekday {
            padding: 11px 8px;
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            background: #f8fafc;
            color: #475569;
            font-size: 11px;
            font-weight: 950;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.45px;
          }

          .calendar-weekday:nth-child(7) {
            border-right: 0;
          }

          .calendar-day-cell {
            min-height: 142px;
            padding: 9px;
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            background: #ffffff;
          }

          .calendar-day-cell:nth-child(7n) {
            border-right: 0;
          }

          .calendar-day-cell.is-outside {
            background: #f8fafc;
          }

          .calendar-day-cell.is-today {
            background: #eff6ff;
            box-shadow: inset 0 0 0 2px #60a5fa;
          }

          .calendar-day-number {
            width: 29px;
            height: 29px;
            display: grid;
            place-items: center;
            margin-bottom: 6px;
            border-radius: 999px;
            color: #334155;
            font-size: 12px;
            font-weight: 950;
          }

          .calendar-day-cell.is-outside .calendar-day-number {
            color: #94a3b8;
          }

          .calendar-day-cell.is-today .calendar-day-number {
            background: #2563eb;
            color: #ffffff;
          }

          .calendar-event-button {
            width: 100%;
            display: flex;
            align-items: flex-start;
            gap: 5px;
            margin-top: 5px;
            padding: 6px 7px;
            border: 0;
            border-radius: 8px;
            text-align: left;
            font: inherit;
            font-size: 10px;
            font-weight: 850;
            line-height: 1.3;
            cursor: pointer;
          }

          .calendar-event-button span:last-child {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .calendar-event-button.is-class {
            background: #e0f2fe;
            color: #075985;
          }

          .calendar-event-button.is-exam {
            background: #ede9fe;
            color: #5b21b6;
          }

          .calendar-event-button.is-homework {
            background: #fef3c7;
            color: #92400e;
          }

          .calendar-event-button.is-notice {
            background: #dcfce7;
            color: #166534;
          }

          .calendar-more-label {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 10px;
            font-weight: 900;
          }

          .calendar-legend {
            display: flex;
            gap: 9px;
            flex-wrap: wrap;
            padding: 14px 18px 18px;
            border-top: 1px solid #e2e8f0;
          }

          .calendar-legend span {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 9px;
            border-radius: 999px;
            background: #f8fafc;
            color: #475569;
            font-size: 10px;
            font-weight: 900;
          }

          .calendar-legend-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
          }

          .calendar-legend-dot.is-class {
            background: #0ea5e9;
          }

          .calendar-legend-dot.is-exam {
            background: #8b5cf6;
          }

          .calendar-legend-dot.is-homework {
            background: #f59e0b;
          }

          .calendar-legend-dot.is-notice {
            background: #22c55e;
          }

          .schedule-detail-backdrop {
            position: fixed;
            inset: 0;
            z-index: 140;
            display: grid;
            place-items: center;
            padding: 18px;
            background: rgba(15, 23, 42, 0.62);
            backdrop-filter: blur(8px);
          }

          .schedule-detail-modal {
            width: min(720px, 100%);
            max-height: 90vh;
            border: 1px solid rgba(255, 255, 255, 0.4);
            border-radius: 24px;
            background: #ffffff;
            box-shadow: 0 30px 80px rgba(15, 23, 42, 0.3);
            overflow: hidden;
          }

          .schedule-detail-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            padding: 21px 22px;
            border-bottom: 1px solid #e2e8f0;
            background:
              radial-gradient(circle at top right, rgba(59, 130, 246, 0.14), transparent 38%),
              #f8fafc;
          }

          .schedule-detail-header h2 {
            margin: 7px 0 0;
            color: #0f172a;
            font-size: clamp(22px, 3vw, 30px);
            font-weight: 950;
          }

          .schedule-detail-close {
            width: 40px;
            height: 40px;
            flex: 0 0 40px;
            display: grid;
            place-items: center;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            color: #334155;
            font-size: 20px;
            cursor: pointer;
          }

          .schedule-detail-body {
            max-height: calc(90vh - 100px);
            padding: 22px;
            overflow-y: auto;
          }

          .schedule-detail-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 11px;
          }

          .schedule-detail-box {
            padding: 13px;
            border: 1px solid #e2e8f0;
            border-radius: 14px;
            background: #f8fafc;
          }

          .schedule-detail-box span,
          .schedule-detail-box strong {
            display: block;
          }

          .schedule-detail-box span {
            color: #64748b;
            font-size: 10px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.45px;
          }

          .schedule-detail-box strong {
            margin-top: 5px;
            color: #0f172a;
            font-size: 13px;
            line-height: 1.5;
          }

          .schedule-detail-description {
            margin-top: 15px;
            padding: 16px;
            border: 1px solid #dbe7f5;
            border-radius: 16px;
            background: #fbfdff;
          }

          .schedule-detail-description h3 {
            margin: 0 0 8px;
            color: #0f172a;
            font-size: 15px;
            font-weight: 950;
          }

          .schedule-detail-description p {
            margin: 0;
            color: #475569;
            line-height: 1.65;
            white-space: pre-wrap;
          }

          @media (max-width: 760px) {
            .schedule-page-intro,
            .schedule-panel-header,
            .calendar-toolbar {
              align-items: stretch;
              flex-direction: column;
            }

            .today-timeline-item {
              grid-template-columns: 78px 18px minmax(0, 1fr);
              gap: 8px;
            }

            .schedule-detail-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 1100px) {
            .homework-explorer-toolbar {
              grid-template-columns: minmax(220px, 1fr) repeat(2, minmax(150px, 0.45fr));
            }

            .homework-view-switch {
              grid-column: 1 / -1;
              justify-self: end;
            }

            .homework-items.is-list .homework-item-card {
              grid-template-columns: auto minmax(180px, 1fr) minmax(120px, 0.4fr) auto;
            }

            .homework-items.is-list .homework-item-meta .homework-meta-box:last-child {
              display: none;
            }
          }

          @media (max-width: 900px) {
            .student-hero {
              grid-template-columns: 1fr;
            }

            .homework-page-intro,
            .subject-library-header,
            .subject-workspace-heading {
              align-items: stretch;
              flex-direction: column;
            }

            .homework-explorer-toolbar {
              grid-template-columns: 1fr 1fr;
            }

            .homework-search-wrap {
              grid-column: 1 / -1;
            }

            .homework-view-switch {
              grid-column: auto;
              justify-self: stretch;
              justify-content: center;
            }

            .homework-items.is-list .homework-item-card {
              display: flex;
              flex-direction: column;
              align-items: stretch;
            }

            .homework-items.is-list .homework-item-meta {
              display: grid;
            }

            .homework-items.is-list .homework-meta-box {
              background: #f8fafc;
              padding: 10px;
            }

            .homework-detail-grid {
              grid-template-columns: 1fr 1fr;
            }
          }

          @media (max-width: 520px) {
            .student-hero {
              padding: 22px !important;
            }

            .student-hero-left h1 {
              font-size: 32px !important;
            }

            .student-two-column {
              grid-template-columns: 1fr;
            }

            .homework-page-intro {
              padding: 18px;
              border-radius: 19px;
            }

            .homework-folder-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 10px;
            }

            .homework-folder-card {
              min-height: 130px;
              padding: 14px;
            }

            .homework-explorer-toolbar {
              grid-template-columns: 1fr;
            }

            .homework-search-wrap,
            .homework-view-switch {
              grid-column: auto;
            }

            .homework-items {
              grid-template-columns: 1fr;
              padding: 12px;
            }

            .homework-detail-grid {
              grid-template-columns: 1fr;
            }

            .homework-modal-backdrop {
              padding: 8px;
            }

            .homework-modal {
              max-height: 94vh;
              border-radius: 18px;
            }

            .homework-modal-header,
            .homework-modal-body {
              padding: 16px;
            }

            .homework-file-actions,
            .homework-form-actions {
              width: 100%;
            }

            .homework-file-actions > *,
            .homework-form-actions > * {
              flex: 1;
            }
          }
        `}
      </style>

      <section className="student-hero" style={styles.hero} hidden={activeView !== "overview"}>
        <div className="student-hero-left">
          <div style={styles.avatar}>{studentInitial}</div>

          <h1 style={styles.heroTitle}>Welcome back, {studentName}</h1>

          <p style={styles.heroText}>
            This is your learning space. Check homework, notices, exams,
            attendance, results, and timetable from one simple dashboard.
          </p>

          <div className="student-quick-links">
            <button
              type="button"
              style={styles.quickButton}
              onClick={() => navigate("/student/homework")}
            >
              Homework
            </button>

            <button
              type="button"
              style={styles.quickButton}
              onClick={() => navigate("/student/notices")}
            >
              Notices
            </button>

            <button
              type="button"
              style={styles.quickButton}
              onClick={() => navigate("/student/exams")}
            >
              Exams
            </button>

            <button
              type="button"
              style={styles.quickButton}
              onClick={() => navigate("/student/results")}
            >
              Results
            </button>

            <button
              type="button"
              style={styles.quickButton}
              onClick={() => navigate("/student/attendance")}
            >
              Attendance
            </button>

            <button
              type="button"
              style={styles.quickButton}
              onClick={() => navigate("/student/timetable")}
            >
              Timetable
            </button>
          </div>

          <div style={styles.actionRow}>
            <button className="primary-btn" type="button" onClick={fetchStudentData}>
              Refresh Dashboard
            </button>

            <button className="logout-btn" type="button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <aside style={styles.heroPanel}>
          <div style={styles.heroMetric}>
            <p style={{ margin: "0 0 6px", opacity: 0.9, color: "#ffffff" }}>
              Class
            </p>
            <h2 style={{ margin: 0, fontSize: 28, color: "#ffffff" }}>
              {className || "Missing"} {section ? `- ${section}` : ""}
            </h2>
          </div>

          <div style={styles.heroMetric}>
            <p style={{ margin: "0 0 6px", opacity: 0.9, color: "#ffffff" }}>
              Attendance
            </p>
            <h2 style={{ margin: 0, fontSize: 28, color: "#ffffff" }}>
              {attendanceSummary.percentage}%
            </h2>
          </div>

          <div style={{ ...styles.heroMetric, marginBottom: 0 }}>
            <p style={{ margin: "0 0 6px", opacity: 0.9, color: "#ffffff" }}>
              Pending Homework
            </p>
            <h2 style={{ margin: 0, fontSize: 28, color: "#ffffff" }}>
              {homeworkSummary.pending}
            </h2>
          </div>
        </aside>
      </section>

      {(loading || message || error) && (
        <section className="dashboard-card">
          {loading && <p>Loading student dashboard data...</p>}
          {message && <div className="success-box">{message}</div>}
          {error && <div className="error-box">{error}</div>}
        </section>
      )}

      <section className="student-stats-grid" hidden={activeView !== "overview"}>
        <StatCard
          icon="📚"
          label="Total Homework"
          value={homeworkSummary.total}
          subText="Assigned to your class"
          tone="blue"
        />

        <StatCard
          icon="✅"
          label="Submitted"
          value={homeworkSummary.submitted}
          subText="Completed tasks"
          tone="green"
        />

        <StatCard
          icon="⏳"
          label="Pending"
          value={homeworkSummary.pending}
          subText={`${homeworkSummary.late} late task(s)`}
          tone={homeworkSummary.late > 0 ? "red" : "yellow"}
        />

        <StatCard
          icon="📅"
          label="Attendance"
          value={`${attendanceSummary.percentage}%`}
          subText={`${attendanceSummary.present} present records`}
          tone="purple"
        />

        <StatCard
          icon="📢"
          label="Notices"
          value={notices.length}
          subText="Class announcements"
          tone="blue"
        />

        <StatCard
          icon="🏆"
          label="Results"
          value={results.length}
          subText="Published result records"
          tone="green"
        />
      </section>

      <section className="student-two-column" hidden={!(["overview", "profile"].includes(activeView))}>
        <section className="dashboard-card" hidden={activeView !== "profile" && activeView !== "overview"}>
          <h2 className="card-title">My Profile</h2>

          <div style={styles.profileRow}>
            <b>Name</b>
            <span>{studentName}</span>
          </div>

          <div style={styles.profileRow}>
            <b>Email</b>
            <span>{loggedUser.email || "N/A"}</span>
          </div>

          <div style={styles.profileRow}>
            <b>Class</b>
            <span>{className || "N/A"}</span>
          </div>

          <div style={styles.profileRow}>
            <b>Section</b>
            <span>{section || "N/A"}</span>
          </div>

          <div style={{ ...styles.profileRow, borderBottom: "none" }}>
            <b>Role</b>
            <span>Student</span>
          </div>
        </section>

        <section className="dashboard-card" hidden={activeView !== "overview"}>
          <h2 className="card-title">Today / Priority</h2>

          {pendingTasks.length === 0 && !nextExam ? (
            <EmptyState
              title="No urgent item"
              text="You do not have any pending homework or upcoming exam right now."
            />
          ) : (
            <>
              {pendingTasks.length > 0 && (
                <div>
                  <h3 style={{ marginTop: 0 }}>Pending Homework</h3>

                  {pendingTasks.map((task, index) => (
                    <div className="list-card" key={getRecordId(task, index)}>
                      <h3>{task.title || task.taskTitle || "Homework"}</h3>

                      <p>
                        <b>Subject:</b>{" "}
                        {task.subject || task.subjectName || "N/A"}
                      </p>

                      <p>
                        <b>Due:</b> {formatDate(task.dueDate || task.deadline)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {nextExam && (
                <div className="file-box">
                  <h3 style={{ marginTop: 0 }}>Next Exam</h3>

                  <p>
                    <b>
                      {nextExam.title ||
                        nextExam.examTitle ||
                        nextExam.name ||
                        "Exam"}
                    </b>
                  </p>

                  <p>
                    <b>Subject:</b> {nextExam.subject || "N/A"}
                  </p>

                  <p>
                    <b>Date:</b> {formatDate(getExamDateValue(nextExam))}
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      </section>

      <section
        id="homework"
        className="homework-professional-shell"
        hidden={activeView !== "homework"}
      >
        <div className="homework-page-intro">
          <div>
            <h2>Homework Explorer</h2>
            <p>
              
            </p>
          </div>

          <button
            type="button"
            className="homework-refresh-button"
            onClick={fetchStudentData}
            disabled={loading}
          >
            <span aria-hidden="true">↻</span>
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {!selectedSubject ? (
          <div className="subject-library">
            <div className="subject-library-header">
              <div>
                <h3>Your subjects</h3>
                <p>
                  
                </p>
              </div>

              <span className="subject-library-count">
                {subjectFolders.length} subject
                {subjectFolders.length === 1 ? "" : "s"}
              </span>
            </div>

            {!loading && subjectFolders.length === 0 ? (
              <EmptyState
                title="No subjects configured"
                text="The school administrator must add subjects for your class, section and stream before subject folders can be displayed."
              />
            ) : (
              <div
                className="subject-folder-grid"
                aria-label="Subject folders"
              >
                {subjectFolders.map((subject) => (
                  <button
                    key={subject._folderKey}
                    type="button"
                    className={`subject-folder-card ${
                      subject.count === 0 ? "is-empty" : ""
                    }`}
                    onClick={() =>
                      openSubjectFolder(
                        subject._folderKey
                      )
                    }
                  >
                    <span className="subject-folder-card-top">
                      <span
                        className="subject-folder-icon"
                        aria-hidden="true"
                      >
                        {subject._folderIcon}
                      </span>

                      <span className="subject-folder-total">
                        {subject.count}
                      </span>
                    </span>

                    <span className="subject-folder-copy">
                      <h4 title={subject._folderName}>
                        {subject._folderName}
                      </h4>
                      <p>
                        {subject._folderCode
                          ? `${subject._folderCode} • `
                          : ""}
                        {subject.type ||
                          subject.subjectType ||
                          "School subject"}
                      </p>
                    </span>

                    <span className="subject-folder-stats">
                      <span>
                        ⏳ {subject.pendingCount} pending
                      </span>
                      <span>
                        ✅ {subject.submittedCount} submitted
                      </span>
                    </span>

                    <span className="subject-folder-open">
                      <span>
                        {subject.count > 0
                          ? "Open homework folder"
                          : "Open empty folder"}
                      </span>
                      <span aria-hidden="true">→</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="subject-workspace-heading">
              <div className="subject-workspace-identity">
                <span aria-hidden="true">
                  {selectedSubject._folderIcon}
                </span>

                <div>
                  <h3>
                    {selectedSubject._folderName}
                  </h3>
                  <p>
                    {selectedSubject._folderCode
                      ? `${selectedSubject._folderCode} • `
                      : ""}
                    {selectedSubject.type ||
                      selectedSubject.subjectType ||
                      "Subject"}{" "}
                    • {selectedSubjectRecords.length} homework item
                    {selectedSubjectRecords.length === 1
                      ? ""
                      : "s"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="subject-back-button"
                onClick={returnToSubjectFolders}
              >
                ← All subject folders
              </button>
            </div>

            <div
              className="homework-folder-grid"
              aria-label={`${selectedSubject._folderName} homework folders`}
            >
              {homeworkFolders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={`homework-folder-card ${
                    homeworkFilter === folder.id
                      ? "is-active"
                      : ""
                  }`}
                  onClick={() =>
                    setHomeworkFilter(folder.id)
                  }
                >
                  <span className="homework-folder-top">
                    <span
                      className="homework-folder-icon"
                      aria-hidden="true"
                    >
                      {folder.icon}
                    </span>

                    <span className="homework-folder-count">
                      {folder.count}
                    </span>
                  </span>

                  <span className="homework-folder-copy">
                    <strong>{folder.label}</strong>
                    <span>{folder.description}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="homework-explorer">
              <div className="homework-explorer-toolbar">
                <div className="homework-search-wrap">
                  <span
                    className="homework-search-icon"
                    aria-hidden="true"
                  >
                    🔎
                  </span>

                  <input
                    className="homework-control"
                    type="search"
                    placeholder={`Search ${selectedSubject._folderName} homework...`}
                    value={homeworkSearch}
                    onChange={(event) =>
                      setHomeworkSearch(
                        event.target.value
                      )
                    }
                  />
                </div>

                <select
                  className="homework-control"
                  value={homeworkSort}
                  onChange={(event) =>
                    setHomeworkSort(
                      event.target.value
                    )
                  }
                  aria-label="Sort homework"
                >
                  <option value="newest">
                    Newest first
                  </option>
                  <option value="due">
                    Due date
                  </option>
                  <option value="oldest">
                    Oldest first
                  </option>
                  <option value="title">
                    Title A–Z
                  </option>
                </select>

                <div
                  className="homework-view-switch"
                  aria-label="Change homework view"
                >
                  <button
                    type="button"
                    className={`homework-view-button ${
                      homeworkView === "grid"
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() =>
                      setHomeworkView("grid")
                    }
                    aria-label="Grid view"
                    title="Grid view"
                  >
                    ▦
                  </button>

                  <button
                    type="button"
                    className={`homework-view-button ${
                      homeworkView === "list"
                        ? "is-active"
                        : ""
                    }`}
                    onClick={() =>
                      setHomeworkView("list")
                    }
                    aria-label="List view"
                    title="List view"
                  >
                    ☷
                  </button>
                </div>
              </div>

              <div className="homework-explorer-titlebar">
                <strong>
                  {selectedSubject._folderName} •{" "}
                  {homeworkFolders.find(
                    (folder) =>
                      folder.id === homeworkFilter
                  )?.label || "Homework"}
                </strong>

                <span>
                  {visibleHomeworkRecords.length} item
                  {visibleHomeworkRecords.length === 1
                    ? ""
                    : "s"}
                </span>
              </div>

              {!loading &&
              !error &&
              visibleHomeworkRecords.length === 0 ? (
                <div className="homework-empty-wrap">
                  <EmptyState
                    title={`No ${selectedSubject._folderName} homework here`}
                    text={
                      homeworkSearch
                        ? "Try changing or clearing the search."
                        : "There are no assignments in this category right now."
                    }
                  />
                </div>
              ) : (
                <div
                  className={`homework-items ${
                    homeworkView === "list"
                      ? "is-list"
                      : ""
                  }`}
                >
                  {visibleHomeworkRecords.map(
                    (record) => {
                      const {
                        task,
                        taskId,
                        submitted,
                        late,
                        dueSoon,
                        recentlyAdded,
                      } = record;

                      const title =
                        task?.title ||
                        task?.taskTitle ||
                        task?.homeworkTitle ||
                        "Homework";

                      const subject =
                        task?.subjectName ||
                        task?.subject ||
                        selectedSubject._folderName ||
                        "General";

                      const subjectCode =
                        task?.subjectCode ||
                        selectedSubject._folderCode ||
                        "";

                      const dueDate =
                        task?.dueDate ||
                        task?.deadline ||
                        "";

                      const statusText = submitted
                        ? "Submitted"
                        : late
                        ? "Late"
                        : dueSoon
                        ? "Due soon"
                        : "Pending";

                      const statusClass = submitted
                        ? "is-submitted"
                        : late
                        ? "is-late"
                        : dueSoon
                        ? "is-due"
                        : "is-pending";

                      return (
                        <article
                          key={taskId}
                          className="homework-item-card"
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            openHomeworkDetails(record)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key === "Enter" ||
                              event.key === " "
                            ) {
                              event.preventDefault();
                              openHomeworkDetails(
                                record
                              );
                            }
                          }}
                        >
                          <div className="homework-item-icon">
                            {submitted ? "📗" : "📘"}
                          </div>

                          <div className="homework-item-heading">
                            <h3 title={title}>{title}</h3>
                            <p>
                              {subject}
                              {subjectCode
                                ? ` (${subjectCode})`
                                : ""}{" "}
                              • Class{" "}
                              {task?.className ||
                                task?.class ||
                                className}
                              {task?.section || section
                                ? ` • Section ${
                                    task?.section ||
                                    section
                                  }`
                                : ""}
                            </p>
                          </div>

                          <div className="homework-item-badges">
                            <span
                              className={`homework-mini-badge ${statusClass}`}
                            >
                              {statusText}
                            </span>

                            {recentlyAdded && (
                              <span className="homework-mini-badge is-new">
                                New
                              </span>
                            )}
                          </div>

                          <div className="homework-item-meta">
                            <div className="homework-meta-box">
                              <span>Due date</span>
                              <strong>
                                {formatDate(dueDate)}
                              </strong>
                            </div>

                            <div className="homework-meta-box">
                              <span>Timeline</span>
                              <strong>
                                {submitted
                                  ? "Completed"
                                  : getRelativeDueText(
                                      dueDate
                                    )}
                              </strong>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="homework-open-button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openHomeworkDetails(
                                record
                              );
                            }}
                          >
                            {submitted
                              ? "View submission"
                              : "Open homework"}
                            <span aria-hidden="true">
                              →
                            </span>
                          </button>
                        </article>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {selectedHomework && selectedTask && (
          <div
            className="homework-modal-backdrop"
            role="presentation"
            onMouseDown={
              closeHomeworkDetails
            }
          >
            <section
              className="homework-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="homework-modal-title"
              onMouseDown={(event) =>
                event.stopPropagation()
              }
            >
              <header className="homework-modal-header">
                <div>
                  <div className="homework-item-badges">
                    <span
                      className={`homework-mini-badge ${
                        selectedHomework.submitted
                          ? "is-submitted"
                          : selectedHomework.late
                          ? "is-late"
                          : selectedHomework.dueSoon
                          ? "is-due"
                          : "is-pending"
                      }`}
                    >
                      {selectedHomework.submitted
                        ? "Submitted"
                        : selectedHomework.late
                        ? "Late"
                        : selectedHomework.dueSoon
                        ? "Due soon"
                        : "Pending"}
                    </span>

                    {selectedHomework.recentlyAdded && (
                      <span className="homework-mini-badge is-new">
                        Just added
                      </span>
                    )}
                  </div>

                  <h2 id="homework-modal-title">
                    {selectedTask.title ||
                      selectedTask.taskTitle ||
                      selectedTask.homeworkTitle ||
                      "Homework"}
                  </h2>
                </div>

                <button
                  type="button"
                  className="homework-modal-close"
                  onClick={closeHomeworkDetails}
                  aria-label="Close homework"
                >
                  ×
                </button>
              </header>

              <div className="homework-modal-body">
                <div className="homework-detail-grid">
                  <div className="homework-detail-box">
                    <span>Subject</span>
                    <strong>
                      {selectedTask.subjectName ||
                        selectedTask.subject ||
                        "General"}
                      {selectedTask.subjectCode
                        ? ` (${selectedTask.subjectCode})`
                        : ""}
                    </strong>
                  </div>

                  <div className="homework-detail-box">
                    <span>Due date</span>
                    <strong>
                      {formatDate(
                        selectedTask.dueDate ||
                          selectedTask.deadline
                      )}
                    </strong>
                  </div>

                  <div className="homework-detail-box">
                    <span>Class</span>
                    <strong>
                      {selectedTask.className ||
                        selectedTask.class ||
                        className}
                      {selectedTask.section ||
                      section
                        ? ` - ${
                            selectedTask.section ||
                            section
                          }`
                        : ""}
                    </strong>
                  </div>
                </div>

                <div className="homework-description-panel">
                  <h3>Assignment instructions</h3>
                  <p>
                    {selectedTask.description ||
                      selectedTask.instructions ||
                      "The teacher has not added a written description for this homework."}
                  </p>

                  <p
                    className="dashboard-muted"
                    style={{
                      marginBottom: 0,
                      fontSize: 12,
                    }}
                  >
                    Assigned{" "}
                    {formatDateTime(
                      selectedTask.createdAt ||
                        selectedTask.assignedAt
                    )}
                    {selectedTask.teacherId?.name ||
                    selectedTask.teacherName
                      ? ` by ${
                          selectedTask
                            .teacherId?.name ||
                          selectedTask
                            .teacherName
                        }`
                      : ""}
                  </p>
                </div>

                {selectedTaskFileUrl && (
                  <div className="homework-file-panel">
                    <h3>Teacher&apos;s attachment</h3>

                    <div className="homework-file-row">
                      <div className="homework-file-identity">
                        <span aria-hidden="true">
                          📎
                        </span>

                        <div>
                          <strong
                            title={
                              selectedTaskFileName
                            }
                          >
                            {selectedTaskFileName}
                          </strong>
                          <small className="dashboard-muted">
                            Assignment file
                          </small>
                        </div>
                      </div>

                      <div className="homework-file-actions">
                        <a
                          className="homework-action-primary"
                          href={
                            selectedTaskFileUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open file
                        </a>

                        <a
                          className="homework-action-secondary"
                          href={
                            selectedTaskFileUrl
                          }
                          download={
                            selectedTaskFileName
                          }
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {selectedHomework.submitted &&
                  !editingSubmission[
                    selectedHomework.taskId
                  ] && (
                    <div className="homework-submission-summary">
                      <h3>
                        ✅ Your work was submitted
                      </h3>

                      <p>
                        <b>Submission status:</b>{" "}
                        {statusLabel(
                          selectedSubmission?.status ||
                            selectedSubmission
                              ?.submissionStatus
                        )}
                      </p>

                      {selectedSubmission
                        ?.submittedAt && (
                        <p>
                          <b>Submitted:</b>{" "}
                          {formatDateTime(
                            selectedSubmission
                              .submittedAt
                          )}
                        </p>
                      )}

                      {(selectedSubmission?.answer ||
                        selectedSubmission
                          ?.submissionText) && (
                        <p>
                          <b>Your answer:</b>{" "}
                          {selectedSubmission
                            .answer ||
                            selectedSubmission
                              .submissionText}
                        </p>
                      )}

                      {(hasValue(
                        selectedSubmission?.marks
                      ) ||
                        hasValue(
                          selectedSubmission?.score
                        )) && (
                        <p>
                          <b>Marks:</b>{" "}
                          {selectedSubmission
                            .marks ??
                            selectedSubmission
                              .score}
                        </p>
                      )}

                      {selectedSubmission
                        ?.feedback && (
                        <p>
                          <b>
                            Teacher feedback:
                          </b>{" "}
                          {
                            selectedSubmission.feedback
                          }
                        </p>
                      )}

                      {selectedSubmissionFileUrl && (
                        <div className="homework-file-panel">
                          <div className="homework-file-row">
                            <div className="homework-file-identity">
                              <span aria-hidden="true">
                                📄
                              </span>

                              <div>
                                <strong
                                  title={
                                    selectedSubmissionFileName
                                  }
                                >
                                  {
                                    selectedSubmissionFileName
                                  }
                                </strong>
                                <small className="dashboard-muted">
                                  Your submitted file
                                </small>
                              </div>
                            </div>

                            <div className="homework-file-actions">
                              <a
                                className="homework-action-primary"
                                href={
                                  selectedSubmissionFileUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open
                              </a>

                              <a
                                className="homework-action-secondary"
                                href={
                                  selectedSubmissionFileUrl
                                }
                                download={
                                  selectedSubmissionFileName
                                }
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="homework-form-actions">
                        <button
                          type="button"
                          className="homework-action-secondary"
                          onClick={() =>
                            startUpdatingSubmission(
                              selectedHomework
                            )
                          }
                        >
                          Update submission
                        </button>
                      </div>
                    </div>
                  )}

                {(!selectedHomework.submitted ||
                  editingSubmission[
                    selectedHomework.taskId
                  ]) && (
                  <div className="homework-submission-form">
                    <h3>
                      {selectedHomework.submitted
                        ? "Update your submission"
                        : selectedHomework.late
                        ? "Submit late homework"
                        : "Submit your homework"}
                    </h3>

                    <label
                      htmlFor={`homework-answer-${selectedHomework.taskId}`}
                      style={{
                        display: "block",
                        marginBottom: 7,
                        color: "#334155",
                        fontSize: 12,
                        fontWeight: 900,
                      }}
                    >
                      Your answer
                    </label>

                    <textarea
                      id={`homework-answer-${selectedHomework.taskId}`}
                      className="homework-textarea"
                      placeholder="Write your answer or a short note about your attached work..."
                      value={
                        answers[
                          selectedHomework
                            .taskId
                        ] || ""
                      }
                      onChange={(event) =>
                        handleAnswerChange(
                          selectedHomework
                            .taskId,
                          event.target.value
                        )
                      }
                    />

                    <label className="homework-upload-label">
                      <span
                        style={{
                          fontSize: 25,
                        }}
                        aria-hidden="true"
                      >
                        ⬆️
                      </span>
                      <strong>
                        Choose a file from your
                        computer
                      </strong>
                      <span>
                        PDF, Word, PowerPoint,
                        Excel, image or text • Max
                        10 MB
                      </span>

                      <input
                        key={
                          fileInputKeys[
                            selectedHomework
                              .taskId
                          ] ||
                          selectedHomework.taskId
                        }
                        className="homework-upload-input"
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                        onChange={(event) =>
                          handleFileChange(
                            selectedHomework
                              .taskId,
                            event.target.files?.[0] ||
                              null
                          )
                        }
                      />
                    </label>

                    {files[
                      selectedHomework.taskId
                    ] && (
                      <p className="homework-selected-file">
                        Selected file:{" "}
                        {
                          files[
                            selectedHomework
                              .taskId
                          ].name
                        }
                      </p>
                    )}

                    <div className="homework-form-actions">
                      {selectedHomework.submitted && (
                        <button
                          type="button"
                          className="homework-action-secondary"
                          onClick={() =>
                            cancelUpdatingSubmission(
                              selectedHomework
                                .taskId
                            )
                          }
                        >
                          Cancel
                        </button>
                      )}

                      <button
                        type="button"
                        className="homework-action-primary"
                        disabled={Boolean(
                          submitting[
                            selectedHomework
                              .taskId
                          ]
                        )}
                        onClick={() =>
                          handleSubmitHomework(
                            selectedHomework
                              .taskId
                          )
                        }
                      >
                        {submitting[
                          selectedHomework
                            .taskId
                        ]
                          ? "Submitting..."
                          : selectedHomework.submitted
                          ? "Save updated submission"
                          : "Submit homework"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>

      <section className="student-two-column" hidden={!(["notices", "exams"].includes(activeView))}>
        <section id="notices" className="dashboard-card" hidden={activeView !== "notices"}>
          <h2 className="card-title">Latest Notices</h2>

          {recentNotices.length === 0 ? (
            <EmptyState
              title="No notices found"
              text="Your class has no notices right now."
            />
          ) : (
            recentNotices.map((notice, index) => (
              <div className="list-card" key={getRecordId(notice, index)}>
                <StatusBadge type="info">Notice</StatusBadge>

                <h3>{notice.title || notice.noticeTitle || "Notice"}</h3>

                <p>{notice.content || notice.message || notice.description}</p>

                {(notice.createdAt || notice.date) && (
                  <p className="dashboard-muted">
                    {formatDateTime(notice.createdAt || notice.date)}
                  </p>
                )}
              </div>
            ))
          )}
        </section>

        <section id="exams" className="dashboard-card" hidden={activeView !== "exams"}>
          <h2 className="card-title">Upcoming Exams</h2>

          {upcomingExams.length === 0 ? (
            <EmptyState
              title="No exams found"
              text="No exam schedule has been added for your class yet."
            />
          ) : (
            upcomingExams.map((exam, index) => (
              <div className="list-card" key={getRecordId(exam, index)}>
                <StatusBadge type="purple">Exam</StatusBadge>

                <h3>{exam.title || exam.examTitle || exam.name || "Exam"}</h3>

                <p>
                  <b>Subject:</b> {exam.subject || exam.subjectName || "N/A"}
                </p>

                <p>
                  <b>Date:</b> {formatDate(getExamDateValue(exam))}
                </p>

                <p>
                  <b>Max Marks:</b> {exam.maxMarks || exam.totalMarks || "N/A"}
                </p>
              </div>
            ))
          )}
        </section>
      </section>

      <section className="student-two-column" hidden={!(["results", "attendance"].includes(activeView))}>
        <section id="results" className="dashboard-card" hidden={activeView !== "results"}>
          <h2 className="card-title">My Results</h2>

          {recentResults.length === 0 ? (
            <EmptyState
              title="No results yet"
              text="Your result records will appear here after teachers publish them."
            />
          ) : (
            recentResults.map((result, index) => (
              <div className="list-card" key={getRecordId(result, index)}>
                <StatusBadge type="success">Result</StatusBadge>

                <h3>
                  {result.examTitle ||
                    result.examName ||
                    result.title ||
                    result.subject ||
                    "Result"}
                </h3>

                <p>
                  <b>Subject:</b> {result.subject || result.subjectName || "N/A"}
                </p>

                <p>
                  <b>Marks:</b> {getResultMarks(result)}
                </p>

                {result.grade && (
                  <p>
                    <b>Grade:</b> {result.grade}
                  </p>
                )}

                {result.remarks && (
                  <p>
                    <b>Remarks:</b> {result.remarks}
                  </p>
                )}

                {(result.date || result.examDate) && (
                  <p className="dashboard-muted">
                    {formatDate(result.date || result.examDate)}
                  </p>
                )}
              </div>
            ))
          )}
        </section>

        <section id="attendance" className="dashboard-card" hidden={activeView !== "attendance"}>
          <h2 className="card-title">Attendance Summary</h2>

          <div
            style={{
              background: "#f8fbff",
              border: "1px solid #e4edf7",
              borderRadius: 18,
              padding: 18,
              marginBottom: 16,
            }}
          >
            <p style={{ margin: "0 0 8px" }}>
              <b>Attendance Percentage:</b> {attendanceSummary.percentage}%
            </p>

            <div style={styles.progressTrack}>
              <div style={styles.progressBar} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
                gap: 10,
                marginTop: 16,
              }}
            >
              <div>
                <StatusBadge type="info">Total {attendanceSummary.total}</StatusBadge>
              </div>

              <div>
                <StatusBadge type="success">
                  Present {attendanceSummary.present}
                </StatusBadge>
              </div>

              <div>
                <StatusBadge type="warning">Late {attendanceSummary.late}</StatusBadge>
              </div>

              <div>
                <StatusBadge type="danger">
                  Absent {attendanceSummary.absent}
                </StatusBadge>
              </div>
            </div>
          </div>

          <h3>Recent Attendance</h3>

          {recentAttendance.length === 0 ? (
            <EmptyState
              title="No attendance records"
              text="Your attendance records will appear here."
            />
          ) : (
            recentAttendance.map((record, index) => {
              const status = record.status || record.attendanceStatus || "N/A";
              const cleanStatus = normalizeStatus(status);

              const badgeType = cleanStatus.includes("present")
                ? "success"
                : cleanStatus.includes("late")
                ? "warning"
                : cleanStatus.includes("absent")
                ? "danger"
                : "info";

              return (
                <div className="list-card" key={getRecordId(record, index)}>
                  <StatusBadge type={badgeType}>{status}</StatusBadge>

                  <p>
                    <b>Date:</b>{" "}
                    {formatDate(record.date || record.attendanceDate)}
                  </p>

                  {record.teacherName && (
                    <p>
                      <b>Marked By:</b> {record.teacherName}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </section>
      </section>

      <section
        id="timetable"
        className="schedule-page-shell"
        hidden={activeView !== "timetable"}
      >
        <div className="schedule-page-intro">
          <div>
            <h2>Schedule & Academic Calendar</h2>
            <p>
              View your class timetable, homework deadlines, exams and school.
            </p>
          </div>

          <button
            type="button"
            className="homework-refresh-button"
            onClick={fetchStudentData}
            disabled={loading}
          >
            <span aria-hidden="true">↻</span>
            {loading ? "Refreshing..." : "Refresh schedule"}
          </button>
        </div>

        <div className="schedule-summary-grid">
          <article className="schedule-summary-card">
            <span>Today</span>
            <strong>{todayDayName}</strong>
            <small>{formatCalendarDate(today)}</small>
          </article>

          <article className="schedule-summary-card">
            <span>Today&apos;s classes</span>
            <strong>{todayTimetable.length}</strong>
            <small>
              {currentTimetableItem
                ? `${getTimetableSubjectName(currentTimetableItem)} is happening now`
                : nextTimetableItem
                ? `${getTimetableSubjectName(nextTimetableItem)} is next`
                : "No more classes scheduled today"}
            </small>
          </article>

          <article className="schedule-summary-card">
            <span>Visible month</span>
            <strong>{selectedMonthEvents.length} items</strong>
            <small>
              Classes, exams, deadlines and school events
            </small>
          </article>

          <article className="schedule-summary-card">
            <span>Your placement</span>
            <strong>
              Class {className || "N/A"}
              {section ? `-${section}` : ""}
            </strong>
            <small>
              {Number(className) >= 11
                ? `${studentStream || "General"} programme`
                : "General programme"}
              {academicYear ? ` • ${academicYear}` : ""}
            </small>
          </article>
        </div>

        <section className="schedule-panel">
          <header className="schedule-panel-header">
            <div>
              <h3>Today&apos;s timeline</h3>
              <p>
                The current and next periods are highlighted automatically.
              </p>
            </div>

            <StatusBadge type="info">
              {todayDayName}
            </StatusBadge>
          </header>

          {todayTimetable.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No classes today"
                text="There are no active timetable periods for today."
              />
            </div>
          ) : (
            <div className="today-timeline">
              {todayTimetable.map((item, index) => {
                const isCurrent =
                  String(getRecordId(item)) ===
                  String(getRecordId(currentTimetableItem));

                const isNext =
                  String(getRecordId(item)) ===
                  String(getRecordId(nextTimetableItem));

                return (
                  <button
                    key={getRecordId(item, index)}
                    type="button"
                    className={`today-timeline-item ${
                      isCurrent
                        ? "is-current"
                        : isNext
                        ? "is-next"
                        : ""
                    }`}
                    onClick={() =>
                      openTimetableDetails(item, today)
                    }
                  >
                    <span className="today-timeline-time">
                      {getTimeRangeText(item)}
                    </span>

                    <span className="today-timeline-rail">
                      <span className="today-timeline-dot" />
                    </span>

                    <span className="today-timeline-card">
                      <h4>
                        {getTimetableSubjectName(item)}
                      </h4>
                      <p>
                        {getTimetableTeacherName(item) ||
                          item?.classType ||
                          "School period"}
                        {item?.room ? ` • ${item.room}` : ""}
                      </p>
                      {(isCurrent || isNext) && (
                        <StatusBadge
                          type={isCurrent ? "success" : "warning"}
                        >
                          {isCurrent ? "Happening now" : "Next class"}
                        </StatusBadge>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="schedule-panel">
          <header className="schedule-panel-header">
            <div>
              <h3>Weekly class timetable</h3>
              <p>
                View your weekly class schedule.
              </p>
            </div>

            <span className="dashboard-muted">
              {sortedTimetable.length} active period
              {sortedTimetable.length === 1 ? "" : "s"}
            </span>
          </header>

          {sortedTimetable.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No timetable found"
                text="Your weekly timetable has not been added yet."
              />
            </div>
          ) : (
            <div className="weekly-table-scroll">
              <table className="weekly-schedule-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    {DAYS_OF_WEEK.map((day) => (
                      <th key={day}>{day}</th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {timetableTimeSlots.map((slot) => (
                    <tr key={slot.key}>
                      <td className="weekly-schedule-time">
                        {slot.startTime || "N/A"}
                        <br />
                        <span>
                          {slot.endTime
                            ? `to ${slot.endTime}`
                            : ""}
                        </span>
                      </td>

                      {DAYS_OF_WEEK.map((day) => {
                        const matchingItems = (
                          timetableByDay[day] || []
                        ).filter(
                          (item) =>
                            String(item?.startTime || "") ===
                              slot.startTime &&
                            String(item?.endTime || "") ===
                              slot.endTime
                        );

                        return (
                          <td
                            key={`${slot.key}-${day}`}
                            className="weekly-schedule-cell"
                          >
                            {matchingItems.map((item, index) => (
                              <button
                                key={getRecordId(
                                  item,
                                  `${day}-${slot.key}-${index}`
                                )}
                                type="button"
                                className="week-period-button"
                                onClick={() =>
                                  openTimetableDetails(item)
                                }
                              >
                                <strong>
                                  {getTimetableSubjectName(item)}
                                </strong>
                                <span>
                                  {getTimetableTeacherName(item) ||
                                    item?.classType ||
                                    "School period"}
                                  {item?.room
                                    ? ` • ${item.room}`
                                    : ""}
                                </span>
                              </button>
                            ))}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="schedule-panel">
          <header className="schedule-panel-header">
            <div>
              <h3>Academic calendar</h3>
              <p>
                View your classes, homework deadlines, exams and school
              </p>
            </div>

            <div className="calendar-toolbar">
              <strong>
                {calendarCursor.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </strong>

              <div className="calendar-toolbar-actions">
                <button
                  type="button"
                  className="calendar-toolbar-button"
                  onClick={() => changeCalendarMonth(-1)}
                  aria-label="Previous month"
                >
                  ←
                </button>

                <button
                  type="button"
                  className="calendar-toolbar-button"
                  onClick={returnCalendarToToday}
                >
                  Today
                </button>

                <button
                  type="button"
                  className="calendar-toolbar-button"
                  onClick={() => changeCalendarMonth(1)}
                  aria-label="Next month"
                >
                  →
                </button>
              </div>
            </div>
          </header>

          <div className="weekly-table-scroll">
            <div className="academic-calendar-grid">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={`calendar-heading-${day}`}
                  className="calendar-weekday"
                >
                  {day.slice(0, 3)}
                </div>
              ))}

              {calendarGridDates.map((date) => {
                const dateKey = toLocalDateKey(date);
                const dayEvents =
                  calendarEventsByDate.get(dateKey) || [];
                const isOutsideMonth =
                  date.getMonth() !==
                  calendarCursor.getMonth();
                const isToday = dateKey === todayDateKey;
                const visibleEvents = dayEvents.slice(0, 3);

                return (
                  <div
                    key={dateKey}
                    className={`calendar-day-cell ${
                      isOutsideMonth ? "is-outside" : ""
                    } ${isToday ? "is-today" : ""}`}
                  >
                    <div className="calendar-day-number">
                      {date.getDate()}
                    </div>

                    {visibleEvents.map((event) => {
                      const eventMeta =
                        CALENDAR_EVENT_META[event.type] ||
                        CALENDAR_EVENT_META.class;

                      return (
                        <button
                          key={event.id}
                          type="button"
                          className={`calendar-event-button is-${event.type}`}
                          onClick={() =>
                            setSelectedScheduleItem(event)
                          }
                          title={`${eventMeta.label}: ${event.title}`}
                        >
                          <span aria-hidden="true">
                            {eventMeta.icon}
                          </span>
                          <span>
                            {event.startTime
                              ? `${event.startTime} `
                              : ""}
                            {event.title}
                          </span>
                        </button>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <p className="calendar-more-label">
                        +{dayEvents.length - 3} more
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="calendar-legend">
            <span>
              <i className="calendar-legend-dot is-class" />
              Classes
            </span>
            <span>
              <i className="calendar-legend-dot is-exam" />
              Exams
            </span>
            <span>
              <i className="calendar-legend-dot is-homework" />
              Homework deadlines
            </span>
            <span>
              <i className="calendar-legend-dot is-notice" />
              School events and timed notices
            </span>
          </div>
        </section>
      </section>

      {selectedScheduleItem && (
        <div
          className="schedule-detail-backdrop"
          role="presentation"
          onMouseDown={() =>
            setSelectedScheduleItem(null)
          }
        >
          <section
            className="schedule-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-detail-title"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <header className="schedule-detail-header">
              <div>
                <StatusBadge
                  type={
                    selectedScheduleItem.type === "exam"
                      ? "purple"
                      : selectedScheduleItem.type === "homework"
                      ? "warning"
                      : selectedScheduleItem.type === "notice"
                      ? "success"
                      : "info"
                  }
                >
                  {selectedScheduleMeta.icon}{" "}
                  {selectedScheduleMeta.label}
                </StatusBadge>

                <h2 id="schedule-detail-title">
                  {selectedScheduleItem.title}
                </h2>
              </div>

              <button
                type="button"
                className="schedule-detail-close"
                onClick={() =>
                  setSelectedScheduleItem(null)
                }
                aria-label="Close details"
              >
                ×
              </button>
            </header>

            <div className="schedule-detail-body">
              <div className="schedule-detail-grid">
                <div className="schedule-detail-box">
                  <span>Date</span>
                  <strong>
                    {selectedScheduleItem.date
                      ? formatCalendarDate(
                          selectedScheduleItem.date
                        )
                      : selectedScheduleItem.type === "class"
                      ? getRoutineDayName(selectedScheduleSource) ||
                        "Weekly recurring period"
                      : "N/A"}
                  </strong>
                </div>

                <div className="schedule-detail-box">
                  <span>Time</span>
                  <strong>
                    {selectedScheduleItem.allDay
                      ? "All day"
                      : selectedScheduleItem.startTime ||
                        selectedScheduleItem.endTime
                      ? `${selectedScheduleItem.startTime || "N/A"}${
                          selectedScheduleItem.endTime
                            ? ` – ${selectedScheduleItem.endTime}`
                            : ""
                        }`
                      : getTimeRangeText(selectedScheduleSource)}
                  </strong>
                </div>

                <div className="schedule-detail-box">
                  <span>Class</span>
                  <strong>
                    Class {selectedScheduleSource.className ||
                      selectedScheduleSource.class ||
                      className ||
                      "N/A"}
                    {(selectedScheduleSource.section || section)
                      ? ` • Section ${
                          selectedScheduleSource.section || section
                        }`
                      : ""}
                  </strong>
                </div>

                <div className="schedule-detail-box">
                  <span>Subject / Category</span>
                  <strong>
                    {selectedScheduleSource.subjectId?.name ||
                      selectedScheduleSource.subjectName ||
                      selectedScheduleSource.subject ||
                      selectedScheduleSource.noticeType ||
                      selectedScheduleSource.classType ||
                      selectedScheduleItem.subtitle ||
                      "N/A"}
                  </strong>
                </div>

                <div className="schedule-detail-box">
                  <span>Teacher / Organiser</span>
                  <strong>
                    {getTimetableTeacherName(selectedScheduleSource) ||
                      selectedScheduleSource.teacherName ||
                      selectedScheduleSource.createdBy?.name ||
                      (typeof selectedScheduleSource.createdBy === "string"
                        ? selectedScheduleSource.createdBy
                        : "") ||
                      "School administration"}
                  </strong>
                </div>

                <div className="schedule-detail-box">
                  <span>Location</span>
                  <strong>
                    {selectedScheduleSource.room ||
                      selectedScheduleSource.location ||
                      selectedScheduleSource.venue ||
                      "Not specified"}
                  </strong>
                </div>

                {hasValue(
                  selectedScheduleSource.maxMarks ||
                    selectedScheduleSource.totalMarks
                ) && (
                  <div className="schedule-detail-box">
                    <span>Maximum marks</span>
                    <strong>
                      {selectedScheduleSource.maxMarks ||
                        selectedScheduleSource.totalMarks}
                    </strong>
                  </div>
                )}

                {selectedScheduleSource.validFrom && (
                  <div className="schedule-detail-box">
                    <span>Timetable valid from</span>
                    <strong>
                      {formatDate(
                        selectedScheduleSource.validFrom
                      )}
                    </strong>
                  </div>
                )}

                {selectedScheduleSource.validUntil && (
                  <div className="schedule-detail-box">
                    <span>Timetable valid until</span>
                    <strong>
                      {formatDate(
                        selectedScheduleSource.validUntil
                      )}
                    </strong>
                  </div>
                )}
              </div>

              <div className="schedule-detail-description">
                <h3>Details</h3>
                <p>
                  {selectedScheduleSource.content ||
                    selectedScheduleSource.message ||
                    selectedScheduleSource.description ||
                    selectedScheduleSource.instructions ||
                    selectedScheduleSource.notes ||
                    (selectedScheduleItem.type === "class"
                      ? `${getTimetableSubjectName(
                          selectedScheduleSource
                        )} is scheduled ${getRoutineDayName(
                          selectedScheduleSource
                        ) || "weekly"} from ${getTimeRangeText(
                          selectedScheduleSource
                        )}.`
                      : "No additional details were added.")}
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
      </div>
    </PortalLayout>
  );
}