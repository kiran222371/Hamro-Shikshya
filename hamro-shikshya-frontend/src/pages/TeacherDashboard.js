import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api, {
  createTask,
  getTasksByClass,
  getSubmissionsByTask,
  markAttendance,
  getAttendanceByClass,
  createExam,
  getExamsByClass,
  createNotice,
  getNoticesByClass,
  getUsers,
  getTeacherSubjects,
  getSubjectsByClass,
} from "../api";
import PortalLayout from "../components/PortalLayout";
import "../styles/App.css";

const API_BASE_URL = (
  process.env.REACT_APP_API_URL || "http://localhost:5000/api"
).replace(/\/api\/?$/, "");

const SUBMISSION_REVIEWS_STORAGE_KEY =
  "hamro_shikshya_teacher_submission_reviews";
const EXAM_MARKS_STORAGE_KEY = "hamro_shikshya_teacher_exam_marks";

const LOCAL_ATTENDANCE_STORAGE_KEY = "hamro_shikshya_local_attendance_records";
const LOCAL_EXAMS_STORAGE_KEY = "hamro_shikshya_local_exams";
const LOCAL_NOTICES_STORAGE_KEY = "hamro_shikshya_local_notices";

const ATTENDANCE_STATUS_OPTIONS = ["Present", "Absent", "Late"];

const HOMEWORK_FILTER_OPTIONS = [
  { id: "all", label: "All Homework", icon: "📁" },
  { id: "recent", label: "Recently Added", icon: "🆕" },
  { id: "due-soon", label: "Due Soon", icon: "⏰" },
  { id: "past-due", label: "Past Due", icon: "⚠️" },
  { id: "with-submissions", label: "With Submissions", icon: "📥" },
];

const SUBMISSION_FILTER_OPTIONS = [
  { id: "all", label: "All Submissions", icon: "📂" },
  { id: "new", label: "Needs Review", icon: "🆕" },
  { id: "reviewed", label: "Reviewed", icon: "✅" },
  { id: "late", label: "Late", icon: "⏰" },
];

const TEACHER_NAVIGATION = [
  { to: "/teacher/overview", label: "Overview", icon: "▦" },
  { to: "/teacher/profile", label: "Profile", icon: "👤" },
  { to: "/teacher/classes", label: "My Classes", icon: "🏫" },
  { to: "/teacher/students", label: "Students", icon: "🎓" },
  { to: "/teacher/homework", label: "Homework", icon: "📚" },
  { to: "/teacher/submissions", label: "Submissions", icon: "✅" },
  { to: "/teacher/attendance", label: "Attendance", icon: "🗓️" },
  { to: "/teacher/exams", label: "Exams & Marks", icon: "📝" },
  { to: "/teacher/notices", label: "Notices", icon: "📢" },
];

const TEACHER_VIEWS = new Set(
  TEACHER_NAVIGATION.map((item) => item.to.split("/").filter(Boolean).pop())
);

const getToday = () => new Date().toISOString().slice(0, 10);

const getId = (item) =>
  item?._id || item?.id || item?.userId || item?.studentId || "";

const getTaskId = (task) => task?._id || task?.id || task?.taskId || "";

const getExamId = (exam) =>
  exam?._id || exam?.id || exam?.examId || exam?.localId || "";

const getSubmissionId = (submission) =>
  submission?._id ||
  submission?.id ||
  submission?.submissionId ||
  submission?.studentSubmissionId ||
  "";

const getSubjectId = (subject) =>
  String(
    subject?._id ||
      subject?.id ||
      subject?.subjectId?._id ||
      subject?.subjectId ||
      ""
  );

const getSubjectName = (subject) =>
  cleanText(
    subject?.name ||
      subject?.subjectName ||
      subject?.subject ||
      ""
  );

const getSubjectCode = (subject) =>
  cleanText(
    subject?.subjectCode ||
      subject?.code ||
      ""
  );

const getSubjectOptionValue = (subject) => {
  const subjectId = getSubjectId(subject);

  if (subjectId) {
    return subjectId;
  }

  const name = getSubjectName(subject).toLowerCase();

  return name ? `name:${name}` : "";
};

const getRecordSubjectId = (record) =>
  String(
    record?.subjectId?._id ||
      record?.subjectId ||
      record?.subject?._id ||
      ""
  );

const getRecordSubjectName = (record) =>
  cleanText(
    record?.subjectName ||
      (typeof record?.subject === "string"
        ? record.subject
        : record?.subject?.name) ||
      record?.subjectTitle ||
      ""
  );

const getRecordSubjectCode = (record) =>
  cleanText(
    record?.subjectCode ||
      record?.code ||
      record?.subject?.subjectCode ||
      record?.subject?.code ||
      ""
  );

const dedupeSubjects = (subjects = []) => {
  const used = new Set();
  const result = [];

  subjects.forEach((subject) => {
    const id = getSubjectId(subject);
    const name = getSubjectName(subject).toLowerCase();
    const code = getSubjectCode(subject).toLowerCase();
    const key = id || `${name}::${code}`;

    if (!key || used.has(key)) {
      return;
    }

    used.add(key);
    result.push(subject);
  });

  return result.sort((a, b) =>
    getSubjectName(a).localeCompare(getSubjectName(b))
  );
};

const safeReadStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const safeWriteStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage error
  }
};

const cleanText = (value) => String(value || "").trim();

const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "";

const makeLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toArray = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.users)) return res.data.users;
  if (Array.isArray(res?.data?.students)) return res.data.students;
  if (Array.isArray(res?.data?.subjects)) return res.data.subjects;
  if (Array.isArray(res?.data?.tasks)) return res.data.tasks;
  if (Array.isArray(res?.data?.homework)) return res.data.homework;
  if (Array.isArray(res?.data?.submissions)) return res.data.submissions;
  if (Array.isArray(res?.data?.attendance)) return res.data.attendance;
  if (Array.isArray(res?.data?.records)) return res.data.records;
  if (Array.isArray(res?.data?.exams)) return res.data.exams;
  if (Array.isArray(res?.data?.notices)) return res.data.notices;
  if (Array.isArray(res?.data?.results)) return res.data.results;
  return [];
};

const extractSavedObject = (res, fallbackData, possibleKeys = []) => {
  const body = res?.data;

  if (!body || Array.isArray(body)) {
    return {
      ...fallbackData,
      localId: makeLocalId(),
      createdAt: new Date().toISOString(),
    };
  }

  for (const key of possibleKeys) {
    if (body[key] && typeof body[key] === "object") return body[key];
  }

  if (body.data && typeof body.data === "object" && !Array.isArray(body.data)) {
    return body.data;
  }

  if (typeof body === "object") return body;

  return {
    ...fallbackData,
    localId: makeLocalId(),
    createdAt: new Date().toISOString(),
  };
};

const requestWithFallback = async (requests, options = {}) => {
  const requestList = Array.isArray(requests) ? requests.filter(Boolean) : [];
  const continueStatuses = options.continueStatuses || [400, 404, 405, 422];

  let lastError = null;

  for (const request of requestList) {
    try {
      if (typeof request === "function") {
        return await request();
      }

      if (typeof request.fn === "function") {
        return await request.fn();
      }

      const method = String(request.method || "get").toLowerCase();

      if (method === "get") {
        return await api.get(request.url, request.config || {});
      }

      if (method === "delete") {
        return await api.delete(request.url, {
          ...(request.config || {}),
          ...(request.data ? { data: request.data } : {}),
        });
      }

      return await api[method](
        request.url,
        request.data || {},
        request.config || {}
      );
    } catch (err) {
      lastError = err;

      const status = err.response?.status;

      if (status && continueStatuses.includes(status)) {
        continue;
      }

      throw err;
    }
  }

  throw lastError || new Error("Request failed.");
};

const buildFileUrl = (filePath) => {
  if (!filePath) return "";

  const cleanPath = String(filePath).trim().replace(/\\/g, "/");

  if (!cleanPath) return "";

  if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
    return cleanPath;
  }

  if (cleanPath.startsWith("/uploads")) {
    return `${API_BASE_URL}${cleanPath}`;
  }

  if (cleanPath.startsWith("uploads")) {
    return `${API_BASE_URL}/${cleanPath}`;
  }

  return `${API_BASE_URL}/uploads/${cleanPath}`;
};

const getFileNameFromPath = (filePath, fallback = "attached-file") => {
  if (!filePath) return fallback;

  const clean = String(filePath).split("?")[0].replace(/\\/g, "/");
  const name = clean.split("/").pop();

  return name || fallback;
};

const getTaskFilePath = (task) => {
  if (!task) return "";

  const filesArray = Array.isArray(task.files) ? task.files : [];
  const firstFile = filesArray[0];

  return (
    task.fileUrl ||
    task.attachmentUrl ||
    task.taskFileUrl ||
    task.materialUrl ||
    task.filePath ||
    task.uploadedFile ||
    task.file ||
    task.file?.url ||
    task.file?.path ||
    task.attachment?.url ||
    task.attachment?.path ||
    firstFile?.url ||
    firstFile?.path ||
    firstFile ||
    ""
  );
};

const getSubmissionFilePath = (submission) => {
  if (!submission) return "";

  const filesArray = Array.isArray(submission.files) ? submission.files : [];
  const firstFile = filesArray[0];

  return (
    submission.fileUrl ||
    submission.fileLink ||
    submission.attachmentUrl ||
    submission.submissionFileUrl ||
    submission.submittedFileUrl ||
    submission.filePath ||
    submission.uploadedFile ||
    submission.file ||
    submission.file?.url ||
    submission.file?.path ||
    submission.attachment?.url ||
    submission.attachment?.path ||
    firstFile?.url ||
    firstFile?.path ||
    firstFile ||
    ""
  );
};

const getStudentIdFromSubmission = (submission) => {
  if (!submission) return "";

  if (typeof submission.studentId === "object") {
    return getId(submission.studentId);
  }

  if (typeof submission.student === "object") {
    return getId(submission.student);
  }

  return (
    submission.studentId ||
    submission.student ||
    submission.userId ||
    submission.submittedBy ||
    ""
  );
};

const getTaskKey = (task, index = 0) => {
  return getTaskId(task) || `local-task-${index}-${task?.title || "task"}`;
};

const getSubmissionReviewKey = (task, submission, index = 0) => {
  const submissionId = getSubmissionId(submission);

  if (submissionId) return String(submissionId);

  return `${getTaskId(task) || task?.title || "task"}-${
    getStudentIdFromSubmission(submission) || "student"
  }-${submission?.submittedAt || index}`;
};

const getClassScopedStorageKey = (baseKey, className, section) =>
  `${baseKey}:${cleanText(className) || "missing"}:${
    cleanText(section) || "all"
  }`;

const getMergeKey = (item) =>
  item?._id ||
  item?.id ||
  item?.localId ||
  `${item?.title || item?.studentId || item?.studentName || ""}-${
    item?.subject || ""
  }-${item?.date || item?.createdAt || ""}`;

const mergeUniqueItems = (backendItems, localItems) => {
  const seen = new Set();
  const merged = [];

  [...localItems, ...backendItems].forEach((item) => {
    const key = String(getMergeKey(item));

    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  });

  return merged;
};

const getTaskTeacherId = (task) => {
  if (!task) return "";

  if (typeof task.teacherId === "object") {
    return String(task.teacherId?._id || task.teacherId?.id || "");
  }

  return String(task.teacherId || task.createdBy || "");
};

const isTaskOwnedByTeacher = (task, teacherId) => {
  const ownerId = getTaskTeacherId(task);
  const cleanTeacherId = String(teacherId || "");

  /*
    Older homework records may not contain teacherId.
    Keep those visible so existing project data is not lost.
  */
  if (!ownerId || !cleanTeacherId) return true;

  return ownerId === cleanTeacherId;
};

const parseDateValue = (value) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDisplayDate = (value, fallback = "No date") => {
  const date = parseDateValue(value);

  return date
    ? date.toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : fallback;
};

const formatDisplayDateTime = (value, fallback = "N/A") => {
  const date = parseDateValue(value);

  return date
    ? date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : fallback;
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const isDatePast = (value) => {
  const date = parseDateValue(value);

  if (!date) return false;

  date.setHours(0, 0, 0, 0);

  return date < startOfToday();
};

const isDateDueSoon = (value, days = 7) => {
  const date = parseDateValue(value);

  if (!date) return false;

  const today = startOfToday();
  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);
  date.setHours(0, 0, 0, 0);

  return date >= today && date <= limit;
};

const isRecentlyCreated = (value, days = 3) => {
  const date = parseDateValue(value);

  if (!date) return false;

  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - days);

  return date >= threshold && date <= now;
};

const normalizeSubmissionStatus = (value) =>
  cleanText(value).toLowerCase();

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(135deg, #e0f2fe 0%, #f8fafc 45%, #e0e7ff 100%)",
    padding: "24px",
    color: "#0f172a",
  },
  shell: {
    maxWidth: "1440px",
    margin: "0 auto",
  },
  hero: {
    background:
      "linear-gradient(135deg, rgba(37,99,235,0.98), rgba(79,70,229,0.96), rgba(14,165,233,0.9))",
    borderRadius: "30px",
    padding: "28px",
    color: "#ffffff",
    boxShadow: "0 24px 70px rgba(37,99,235,0.24)",
    marginBottom: "22px",
    position: "relative",
    overflow: "hidden",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.8fr",
    gap: "22px",
    alignItems: "stretch",
  },
  heroTitle: {
    fontSize: "clamp(34px, 5vw, 62px)",
    lineHeight: "1",
    margin: "0 0 14px",
    fontWeight: 900,
    letterSpacing: "-1.5px",
  },
  heroSubtitle: {
    margin: "0 0 22px",
    color: "rgba(255,255,255,0.86)",
    fontSize: "17px",
    maxWidth: "680px",
  },
  profilePanel: {
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "24px",
    padding: "20px",
    backdropFilter: "blur(16px)",
  },
  avatar: {
    width: "86px",
    height: "86px",
    borderRadius: "26px",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(226,232,240,0.88))",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "34px",
    fontWeight: 900,
    boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    borderRadius: "999px",
    padding: "8px 13px",
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255,255,255,0.24)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "13px",
  },
  heroActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "20px",
  },
  whiteButton: {
    border: "0",
    borderRadius: "16px",
    padding: "13px 18px",
    background: "#ffffff",
    color: "#1d4ed8",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(15,23,42,0.18)",
  },
  ghostButton: {
    border: "1px solid rgba(255,255,255,0.35)",
    borderRadius: "16px",
    padding: "13px 18px",
    background: "rgba(255,255,255,0.12)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  logoutButton: {
    border: "0",
    borderRadius: "16px",
    padding: "13px 18px",
    background: "#fb7185",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(244,63,94,0.26)",
  },
  card: {
    background: "rgba(255,255,255,0.9)",
    border: "1px solid rgba(226,232,240,0.9)",
    borderRadius: "26px",
    padding: "24px",
    boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
    marginBottom: "22px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "18px",
  },
  title: {
    margin: 0,
    fontSize: "26px",
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },
  muted: {
    color: "#64748b",
    margin: "6px 0 0",
    fontSize: "15px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: "16px",
  },
  statCard: {
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.95))",
    border: "1px solid #e2e8f0",
    borderRadius: "24px",
    padding: "20px",
    boxShadow: "0 12px 30px rgba(15,23,42,0.06)",
  },
  statIcon: {
    width: "46px",
    height: "46px",
    borderRadius: "16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#eff6ff",
    fontSize: "22px",
    marginBottom: "16px",
  },
  statNumber: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 900,
    color: "#0f172a",
  },
  statLabel: {
    margin: "4px 0 0",
    color: "#64748b",
    fontWeight: 700,
  },
  quickNav: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
    gap: "12px",
  },
  navButton: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    borderRadius: "18px",
    padding: "14px 16px",
    cursor: "pointer",
    fontWeight: 900,
    color: "#0f172a",
    textAlign: "left",
    boxShadow: "0 10px 24px rgba(15,23,42,0.05)",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: "14px",
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
  },
  textarea: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    padding: "14px 16px",
    fontSize: "15px",
    outline: "none",
    background: "#ffffff",
    color: "#0f172a",
    resize: "vertical",
  },
  label: {
    display: "block",
    fontWeight: 800,
    marginBottom: "8px",
    color: "#334155",
  },
  primaryButton: {
    border: "0",
    borderRadius: "16px",
    padding: "14px 20px",
    background: "linear-gradient(135deg, #2563eb, #4f46e5)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 34px rgba(37,99,235,0.22)",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: "16px",
    padding: "12px 16px",
    background: "#ffffff",
    color: "#0f172a",
    fontWeight: 900,
    cursor: "pointer",
  },
  dangerButton: {
    border: "0",
    borderRadius: "16px",
    padding: "12px 16px",
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 900,
    cursor: "pointer",
  },
  listCard: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "22px",
    padding: "18px",
    marginTop: "14px",
    boxShadow: "0 10px 30px rgba(15,23,42,0.05)",
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: "18px",
    background: "#ffffff",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "720px",
  },
  th: {
    textAlign: "left",
    padding: "14px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#334155",
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  td: {
    padding: "14px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    verticalAlign: "top",
  },
  success: {
    borderRadius: "16px",
    padding: "14px 16px",
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 800,
    marginBottom: "12px",
  },
  error: {
    borderRadius: "16px",
    padding: "14px 16px",
    background: "#fee2e2",
    color: "#991b1b",
    fontWeight: 800,
    marginBottom: "12px",
  },
  empty: {
    padding: "24px",
    borderRadius: "20px",
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontWeight: 700,
  },
};

function SectionHeader({ icon, title, subtitle }) {
  return (
    <div style={styles.cardHeader}>
      <div>
        <h2 style={styles.title}>
          {icon} {title}
        </h2>
        {subtitle && <p style={styles.muted}>{subtitle}</p>}
      </div>
    </div>
  );
}

function StatCard({ icon, number, label }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}>{icon}</div>
      <h3 style={styles.statNumber}>{number}</h3>
      <p style={styles.statLabel}>{label}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return <div style={styles.empty}>{text}</div>;
}

export default function TeacherDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const activeView = useMemo(() => {
    const segment = location.pathname.split("/").filter(Boolean)[1] || "overview";
    return TEACHER_VIEWS.has(segment) ? segment : "overview";
  }, [location.pathname]);

  useEffect(() => {
    const segment = location.pathname.split("/").filter(Boolean)[1];

    if (!segment || !TEACHER_VIEWS.has(segment)) {
      navigate("/teacher/overview", { replace: true });
    }
  }, [location.pathname, navigate]);
  const savedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const [teacher, setTeacher] = useState(savedUser);
  const [selectedClassIndex, setSelectedClassIndex] = useState("0");

  const [allStudents, setAllStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [submissionsByTask, setSubmissionsByTask] = useState({});
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [exams, setExams] = useState([]);
  const [notices, setNotices] = useState([]);

  const [availableSubjects, setAvailableSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsMessage, setSubjectsMessage] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubjectId, setTaskSubjectId] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskFile, setTaskFile] = useState(null);
  const [taskFileKey, setTaskFileKey] = useState(Date.now());
  const [savingTask, setSavingTask] = useState(false);

  const [showHomeworkComposer, setShowHomeworkComposer] = useState(true);
  const [homeworkFilter, setHomeworkFilter] = useState("all");
  const [homeworkSubjectFilter, setHomeworkSubjectFilter] = useState("all");
  const [homeworkSearch, setHomeworkSearch] = useState("");
  const [homeworkSort, setHomeworkSort] = useState("newest");
  const [homeworkViewMode, setHomeworkViewMode] = useState("grid");
  const [selectedHomeworkTask, setSelectedHomeworkTask] = useState(null);

  const [submissionFilter, setSubmissionFilter] = useState("all");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [selectedSubmissionContext, setSelectedSubmissionContext] =
    useState(null);

  const [attendanceDate, setAttendanceDate] = useState(getToday());
  const [attendanceMap, setAttendanceMap] = useState({});

  const [examTitle, setExamTitle] = useState("");
  const [examSubjectId, setExamSubjectId] = useState("");
  const [examSubject, setExamSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examMaxMarks, setExamMaxMarks] = useState("");

  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeContent, setNoticeContent] = useState("");

  const [submissionReviews, setSubmissionReviews] = useState(() =>
    safeReadStorage(SUBMISSION_REVIEWS_STORAGE_KEY, {})
  );

  const [examMarks, setExamMarks] = useState(() =>
    safeReadStorage(EXAM_MARKS_STORAGE_KEY, {})
  );

  const [loading, setLoading] = useState(true);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingReviewKey, setSavingReviewKey] = useState("");
  const [savingExamMarkKey, setSavingExamMarkKey] = useState("");
  const [savingExam, setSavingExam] = useState(false);
  const [savingNotice, setSavingNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const teacherId = getId(teacher);

  const schoolId =
    teacher.schoolId ||
    teacher.school?._id ||
    teacher.school?.id ||
    savedUser.schoolId ||
    "";

  const assignedClasses = useMemo(() => {
    const classes = Array.isArray(teacher.assignedClasses)
      ? teacher.assignedClasses
      : [];

    const cleanedClasses = classes
      .map((item) => ({
        className: cleanText(item.className || item.class),
        section: cleanText(item.section),
        classId: item.classId || item._id || item.id || "",
        stream: cleanText(item.stream || teacher.stream || ""),
        academicYear: cleanText(
          item.academicYear || teacher.academicYear || ""
        ),
        subjects: Array.isArray(item.subjects)
          ? item.subjects.map(cleanText).filter(Boolean)
          : [],
      }))
      .filter((item) => item.className);

    if (cleanedClasses.length > 0) {
      return cleanedClasses;
    }

    const singleClass = cleanText(teacher.className || teacher.class);
    const singleSection = cleanText(teacher.section);

    if (singleClass) {
      return [
        {
          className: singleClass,
          section: singleSection,
          classId: teacher.classId || "",
          stream: cleanText(teacher.stream || ""),
          academicYear: cleanText(teacher.academicYear || ""),
          subjects: Array.isArray(teacher.subjects)
            ? teacher.subjects.map(cleanText).filter(Boolean)
            : [],
        },
      ];
    }

    return [];
  }, [teacher]);

  const currentClass =
    assignedClasses[Number(selectedClassIndex)] || assignedClasses[0] || null;

  const currentClassName = currentClass?.className || "";
  const currentSection = currentClass?.section || "";
  const currentStream = cleanText(
    currentClass?.stream || teacher.stream || ""
  );
  const currentAcademicYear = cleanText(
    currentClass?.academicYear || teacher.academicYear || ""
  );

  const currentAssignedSubjectNames = useMemo(() => {
    const names = [
      ...(Array.isArray(currentClass?.subjects)
        ? currentClass.subjects
        : []),
      ...(Array.isArray(teacher.subjects) ? teacher.subjects : []),
    ];

    const used = new Set();

    return names
      .map(cleanText)
      .filter((name) => {
        const key = name.toLowerCase();

        if (!key || used.has(key)) {
          return false;
        }

        used.add(key);
        return true;
      });
  }, [currentClass, teacher.subjects]);

  const currentClassId =
    currentClass?.classId ||
    (currentClassName
      ? `${currentClassName}-${currentSection || "all"}`
      : "");

  const studentsForCurrentClass = useMemo(() => {
    return allStudents.filter((student) => {
      const studentClass = cleanText(student.className || student.class);
      const studentSection = cleanText(student.section);

      return (
        String(student.role || "").toLowerCase() === "student" &&
        studentClass === currentClassName &&
        (!currentSection || studentSection === currentSection)
      );
    });
  }, [allStudents, currentClassName, currentSection]);

  const selectedTaskSubject = useMemo(() => {
    return (
      availableSubjects.find(
        (subject) =>
          getSubjectOptionValue(subject) === String(taskSubjectId)
      ) || null
    );
  }, [availableSubjects, taskSubjectId]);

  const selectedExamSubject = useMemo(() => {
    return (
      availableSubjects.find(
        (subject) =>
          getSubjectOptionValue(subject) === String(examSubjectId)
      ) || null
    );
  }, [availableSubjects, examSubjectId]);

  const teacherTasks = useMemo(() => {
    return tasks.filter((task) => isTaskOwnedByTeacher(task, teacherId));
  }, [tasks, teacherId]);

  const readSubmissionReview = (task, submission, index = 0) => {
    const reviewKey = getSubmissionReviewKey(task, submission, index);
    const localReview = submissionReviews[reviewKey] || {};

    return {
      reviewKey,
      marks:
        localReview.marks ??
        submission?.marks ??
        submission?.score ??
        submission?.obtainedMarks ??
        "",
      feedback:
        localReview.feedback ??
        submission?.feedback ??
        "",
      status:
        localReview.status ??
        submission?.status ??
        submission?.submissionStatus ??
        "Submitted",
    };
  };

  const getTaskSubmissionList = (task, index = 0) => {
    const taskKey = getTaskKey(task, index);

    return Array.isArray(submissionsByTask[taskKey])
      ? submissionsByTask[taskKey]
      : [];
  };

  const homeworkMetrics = useMemo(() => {
    const total = teacherTasks.length;
    let recent = 0;
    let dueSoon = 0;
    let pastDue = 0;
    let withSubmissions = 0;
    let submissions = 0;

    teacherTasks.forEach((task, index) => {
      const submissionList = getTaskSubmissionList(task, index);
      const dueDate = task?.dueDate || task?.deadline;
      const createdAt = task?.createdAt || task?.date;

      if (isRecentlyCreated(createdAt)) recent += 1;
      if (isDateDueSoon(dueDate)) dueSoon += 1;
      if (isDatePast(dueDate)) pastDue += 1;

      if (submissionList.length > 0) {
        withSubmissions += 1;
        submissions += submissionList.length;
      }
    });

    return {
      total,
      recent,
      dueSoon,
      pastDue,
      withSubmissions,
      submissions,
    };
  }, [teacherTasks, submissionsByTask]);

  const visibleHomework = useMemo(() => {
    const search = homeworkSearch.trim().toLowerCase();

    const filtered = teacherTasks.filter((task, index) => {
      const submissionList = getTaskSubmissionList(task, index);
      const dueDate = task?.dueDate || task?.deadline;
      const createdAt = task?.createdAt || task?.date;

      const matchesFolder =
        homeworkFilter === "all" ||
        (homeworkFilter === "recent" && isRecentlyCreated(createdAt)) ||
        (homeworkFilter === "due-soon" && isDateDueSoon(dueDate)) ||
        (homeworkFilter === "past-due" && isDatePast(dueDate)) ||
        (homeworkFilter === "with-submissions" &&
          submissionList.length > 0);

      const selectedFilterSubject =
        homeworkSubjectFilter === "all"
          ? null
          : availableSubjects.find(
              (subject) =>
                getSubjectOptionValue(subject) ===
                homeworkSubjectFilter
            );

      const taskSubjectIdValue = getRecordSubjectId(task);
      const taskSubjectNameValue =
        getRecordSubjectName(task).toLowerCase();

      const filterSubjectId = selectedFilterSubject
        ? getSubjectId(selectedFilterSubject)
        : "";

      const filterSubjectName = selectedFilterSubject
        ? getSubjectName(selectedFilterSubject).toLowerCase()
        : "";

      const matchesSubject =
        homeworkSubjectFilter === "all" ||
        Boolean(
          (taskSubjectIdValue &&
            filterSubjectId &&
            taskSubjectIdValue === filterSubjectId) ||
            (taskSubjectNameValue &&
              filterSubjectName &&
              taskSubjectNameValue === filterSubjectName)
        );

      if (!matchesFolder || !matchesSubject) return false;
      if (!search) return true;

      return [
        task?.title,
        getRecordSubjectName(task),
        getRecordSubjectCode(task),
        task?.description,
        task?.className,
        task?.section,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(search)
      );
    });

    return [...filtered].sort((a, b) => {
      if (homeworkSort === "title") {
        return String(a?.title || "").localeCompare(
          String(b?.title || "")
        );
      }

      if (homeworkSort === "due-first") {
        const aTime =
          parseDateValue(a?.dueDate || a?.deadline)?.getTime() ||
          Number.MAX_SAFE_INTEGER;
        const bTime =
          parseDateValue(b?.dueDate || b?.deadline)?.getTime() ||
          Number.MAX_SAFE_INTEGER;

        return aTime - bTime;
      }

      if (homeworkSort === "oldest") {
        const aTime =
          parseDateValue(a?.createdAt)?.getTime() || 0;
        const bTime =
          parseDateValue(b?.createdAt)?.getTime() || 0;

        return aTime - bTime;
      }

      const aTime =
        parseDateValue(a?.createdAt)?.getTime() || 0;
      const bTime =
        parseDateValue(b?.createdAt)?.getTime() || 0;

      return bTime - aTime;
    });
  }, [
    teacherTasks,
    submissionsByTask,
    homeworkFilter,
    homeworkSubjectFilter,
    availableSubjects,
    homeworkSearch,
    homeworkSort,
  ]);

  const submissionRows = useMemo(() => {
    const rows = [];

    teacherTasks.forEach((task, taskIndex) => {
      getTaskSubmissionList(task, taskIndex).forEach(
        (submission, submissionIndex) => {
          const review = readSubmissionReview(
            task,
            submission,
            submissionIndex
          );

          const cleanStatus = normalizeSubmissionStatus(
            review.status
          );

          const reviewed =
            hasValue(review.marks) ||
            Boolean(cleanText(review.feedback)) ||
            [
              "checked",
              "reviewed",
              "needs improvement",
              "graded",
            ].some((status) => cleanStatus.includes(status));

          const submittedDate = parseDateValue(
            submission?.submittedAt ||
              submission?.createdAt
          );

          const dueDate = parseDateValue(
            task?.dueDate || task?.deadline
          );

          const late =
            cleanStatus.includes("late") ||
            Boolean(
              submittedDate &&
                dueDate &&
                submittedDate.getTime() > dueDate.getTime()
            );

          rows.push({
            task,
            taskIndex,
            submission,
            submissionIndex,
            review,
            reviewed,
            late,
          });
        }
      );
    });

    return rows.sort((a, b) => {
      const aTime =
        parseDateValue(
          a.submission?.submittedAt ||
            a.submission?.createdAt
        )?.getTime() || 0;
      const bTime =
        parseDateValue(
          b.submission?.submittedAt ||
            b.submission?.createdAt
        )?.getTime() || 0;

      return bTime - aTime;
    });
  }, [
    teacherTasks,
    submissionsByTask,
    submissionReviews,
  ]);

  const submissionMetrics = useMemo(() => {
    return {
      all: submissionRows.length,
      new: submissionRows.filter((row) => !row.reviewed)
        .length,
      reviewed: submissionRows.filter((row) => row.reviewed)
        .length,
      late: submissionRows.filter((row) => row.late)
        .length,
    };
  }, [submissionRows]);

  const visibleSubmissionRows = useMemo(() => {
    const search = submissionSearch
      .trim()
      .toLowerCase();

    return submissionRows.filter((row) => {
      const matchesFolder =
        submissionFilter === "all" ||
        (submissionFilter === "new" && !row.reviewed) ||
        (submissionFilter === "reviewed" && row.reviewed) ||
        (submissionFilter === "late" && row.late);

      if (!matchesFolder) return false;
      if (!search) return true;

      const studentId = getStudentIdFromSubmission(
        row.submission
      );

      const studentRecord = allStudents.find(
        (student) =>
          String(getId(student)) === String(studentId)
      );

      return [
        row.task?.title,
        getRecordSubjectName(row.task),
        getRecordSubjectCode(row.task),
        row.submission?.studentName,
        row.submission?.student?.name,
        row.submission?.studentId?.name,
        studentRecord?.name,
        row.submission?.studentEmail,
        row.submission?.student?.email,
        row.submission?.studentId?.email,
        studentRecord?.email,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(search)
      );
    });
  }, [
    submissionRows,
    submissionFilter,
    submissionSearch,
    allStudents,
  ]);

  const dashboardStats = useMemo(() => {
    return {
      assignedClasses: assignedClasses.length,
      students: studentsForCurrentClass.length,
      tasks: teacherTasks.length,
      exams: exams.length,
      notices: notices.length,
      attendanceRecords: attendanceRecords.length,
    };
  }, [
    assignedClasses.length,
    studentsForCurrentClass.length,
    teacherTasks.length,
    exams.length,
    notices.length,
    attendanceRecords.length,
  ]);

  const teacherInitial = String(teacher.name || teacher.email || "T")
    .trim()
    .charAt(0)
    .toUpperCase();

  const profileCompletion = useMemo(() => {
    const fields = [
      teacher.name,
      teacher.email,
      teacher.role,
      schoolId,
      assignedClasses.length > 0,
    ];

    const completed = fields.filter(Boolean).length;

    return Math.round((completed / fields.length) * 100);
  }, [teacher, schoolId, assignedClasses.length]);

  const getLocalClassItems = (baseKey) => {
    return safeReadStorage(
      getClassScopedStorageKey(baseKey, currentClassName, currentSection),
      []
    );
  };

  const saveLocalClassItems = (baseKey, items) => {
    safeWriteStorage(
      getClassScopedStorageKey(baseKey, currentClassName, currentSection),
      items
    );
  };

  const addLocalClassItem = (baseKey, item) => {
    const existing = getLocalClassItems(baseKey);
    const next = [item, ...existing];
    saveLocalClassItems(baseKey, next);
    return next;
  };

  const addLocalClassItems = (baseKey, items) => {
    const existing = getLocalClassItems(baseKey);
    const next = [...items, ...existing];
    saveLocalClassItems(baseKey, next);
    return next;
  };

  const showSuccess = (text) => {
    setMessage(text);
    setError("");
    setTimeout(() => setMessage(""), 3500);
  };

  const showError = (text) => {
    setError(text);
    setMessage("");
  };

  const openView = (view) => {
    navigate(`/teacher/${view}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getStudentName = (studentIdOrObject) => {
    if (!studentIdOrObject) return "Student";

    if (typeof studentIdOrObject === "object") {
      return (
        studentIdOrObject.name ||
        studentIdOrObject.fullName ||
        studentIdOrObject.email ||
        "Student"
      );
    }

    const cleanId = String(studentIdOrObject);

    const student = allStudents.find((item) => String(getId(item)) === cleanId);

    return student?.name || student?.email || "Student";
  };

  const getStudentEmail = (studentId) => {
    const cleanId = String(studentId || "");
    const student = allStudents.find((item) => String(getId(item)) === cleanId);

    return student?.email || "";
  };

  const loadUsers = async () => {
    try {
      const res = await getUsers();
      const users = toArray(res);

      const updatedTeacher = users.find((user) => {
        const sameId = teacherId && String(getId(user)) === String(teacherId);

        const sameEmail =
          teacher.email &&
          String(user.email || "").toLowerCase() ===
            String(teacher.email || "").toLowerCase();

        return (
          String(user.role || "").toLowerCase() === "teacher" &&
          (sameId || sameEmail)
        );
      });

      if (updatedTeacher) {
        const refreshedTeacher = {
          ...teacher,
          ...updatedTeacher,
        };

        setTeacher(refreshedTeacher);
        localStorage.setItem("user", JSON.stringify(refreshedTeacher));
      }

      setAllStudents(
        users.filter(
          (user) => String(user.role || "").toLowerCase() === "student"
        )
      );
    } catch (err) {
      console.log("Load users error:", err.response?.data || err.message);
    }
  };


  const loadTeacherSubjectOptions = async () => {
    if (!teacherId || !currentClassName) {
      setAvailableSubjects([]);
      setSubjectsMessage("");
      return;
    }

    try {
      setLoadingSubjects(true);
      setSubjectsMessage("");

      const teacherSubjectResponse = await getTeacherSubjects(teacherId, {
        className: currentClassName,
        section: currentSection,
        stream: currentStream,
        academicYear: currentAcademicYear,
      });

      let subjects = toArray(teacherSubjectResponse);
      let source = "assigned";

      if (subjects.length === 0) {
        const classSubjectResponse = await getSubjectsByClass(
          currentClassName,
          currentSection,
          {
            schoolId,
            stream: currentStream,
            academicYear: currentAcademicYear,
            activeOnly: true,
          }
        );

        const classSubjects = toArray(classSubjectResponse);

        if (currentAssignedSubjectNames.length > 0) {
          const allowedNames = new Set(
            currentAssignedSubjectNames.map((name) =>
              name.toLowerCase()
            )
          );

          subjects = classSubjects.filter((subject) =>
            allowedNames.has(getSubjectName(subject).toLowerCase())
          );

          if (subjects.length > 0) {
            source = "profile-matched";
          }
        }

        if (subjects.length === 0 && classSubjects.length > 0) {
          subjects = classSubjects;
          source = "class-catalogue";
        }
      }

      if (
        subjects.length === 0 &&
        currentAssignedSubjectNames.length > 0
      ) {
        subjects = currentAssignedSubjectNames.map((name, index) => ({
          id: `legacy-subject-${index}-${name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")}`,
          name,
          subjectName: name,
          subjectCode: "",
          code: "",
          className: currentClassName,
          section: currentSection || "All",
          stream: currentStream,
          academicYear: currentAcademicYear,
          type: "Compulsory",
          isActive: true,
          isLegacySubject: true,
        }));

        source = "legacy-profile";
      }

      const cleanedSubjects = dedupeSubjects(
        subjects.filter(
          (subject) => subject?.isActive !== false
        )
      );

      setAvailableSubjects(cleanedSubjects);

      if (source === "class-catalogue") {
        setSubjectsMessage(
          "Showing active subjects configured for this class. Ask the admin to assign only your teaching subjects for stricter access."
        );
      } else if (source === "legacy-profile") {
        setSubjectsMessage(
          "Using subject names from your teacher profile. The admin should connect them to the central Subjects section."
        );
      } else if (cleanedSubjects.length === 0) {
        setSubjectsMessage(
          "No subject is configured for this teacher and class. Ask the admin to create subjects and assign them to you."
        );
      } else {
        setSubjectsMessage("");
      }
    } catch (err) {
      console.log(
        "Load teacher subjects error:",
        err.response?.data || err.message
      );

      const legacySubjects = currentAssignedSubjectNames.map(
        (name, index) => ({
          id: `legacy-subject-${index}-${name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")}`,
          name,
          subjectName: name,
          className: currentClassName,
          section: currentSection || "All",
          stream: currentStream,
          academicYear: currentAcademicYear,
          isActive: true,
          isLegacySubject: true,
        })
      );

      setAvailableSubjects(dedupeSubjects(legacySubjects));
      setSubjectsMessage(
        legacySubjects.length > 0
          ? "Could not load the central subject catalogue, so teacher-profile subjects are shown temporarily."
          : "Could not load subjects. Check the backend and the admin subject setup."
      );
    } finally {
      setLoadingSubjects(false);
    }
  };

  const loadSubmissionsForTasks = async (taskList) => {
    const nextSubmissions = {};

    await Promise.all(
      taskList.map(async (task, index) => {
        const taskKey = getTaskKey(task, index);
        const taskId = getTaskId(task);
        const directSubmissions = Array.isArray(task.submissions)
          ? task.submissions
          : [];

        if (!taskId) {
          nextSubmissions[taskKey] = directSubmissions;
          return;
        }

        try {
          const res = await getSubmissionsByTask(taskId);
          const fetchedSubmissions = toArray(res);

          nextSubmissions[taskKey] =
            fetchedSubmissions.length > 0
              ? fetchedSubmissions
              : directSubmissions;
        } catch (err) {
          console.log("Load submissions error:", err.response?.data || err);
          nextSubmissions[taskKey] = directSubmissions;
        }
      })
    );

    setSubmissionsByTask(nextSubmissions);
  };

  const fetchArraySafely = async (requests, label) => {
    try {
      const res = await requestWithFallback(requests);
      return toArray(res);
    } catch (err) {
      console.log(`${label} fetch error:`, err.response?.data || err.message);
      return [];
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError("");

      if (!currentClassName) {
        setTasks([]);
        setSubmissionsByTask({});
        setAttendanceRecords([]);
        setExams([]);
        setNotices([]);
        return;
      }

      const localAttendance = getLocalClassItems(LOCAL_ATTENDANCE_STORAGE_KEY);
      const localExams = getLocalClassItems(LOCAL_EXAMS_STORAGE_KEY);
      const localNotices = getLocalClassItems(LOCAL_NOTICES_STORAGE_KEY);

      const [fetchedTasks, fetchedAttendance, fetchedExams, fetchedNotices] =
        await Promise.all([
          fetchArraySafely(
            [
              {
                fn: () => getTasksByClass(currentClassName, currentSection),
              },
              {
                fn: () => getTasksByClass(currentClassId, currentSection),
              },
              {
                method: "get",
                url: `/tasks/class/${encodeURIComponent(currentClassId)}`,
              },
              {
                method: "get",
                url: `/tasks/class/${encodeURIComponent(currentClassName)}`,
                config: {
                  params: {
                    section: currentSection,
                    schoolId,
                  },
                },
              },
              {
                method: "get",
                url: "/tasks",
                config: {
                  params: {
                    classId: currentClassId,
                    className: currentClassName,
                    section: currentSection,
                    schoolId,
                  },
                },
              },
            ],
            "Tasks"
          ),

          fetchArraySafely(
            [
              {
                fn: () =>
                  getAttendanceByClass(currentClassName, currentSection),
              },
              {
                fn: () =>
                  getAttendanceByClass(currentClassId, currentSection),
              },
              {
                method: "get",
                url: `/attendance/class/${encodeURIComponent(currentClassId)}`,
              },
              {
                method: "get",
                url: `/attendance/class/${encodeURIComponent(
                  currentClassName
                )}`,
                config: {
                  params: {
                    section: currentSection,
                    schoolId,
                  },
                },
              },
              {
                method: "get",
                url: "/attendance",
                config: {
                  params: {
                    classId: currentClassId,
                    className: currentClassName,
                    section: currentSection,
                    schoolId,
                  },
                },
              },
            ],
            "Attendance"
          ),

          fetchArraySafely(
            [
              {
                fn: () => getExamsByClass(currentClassName, currentSection),
              },
              {
                fn: () => getExamsByClass(currentClassId, currentSection),
              },
              {
                method: "get",
                url: `/exams/class/${encodeURIComponent(currentClassId)}`,
              },
              {
                method: "get",
                url: `/exam/class/${encodeURIComponent(currentClassId)}`,
              },
              {
                method: "get",
                url: `/exams/class/${encodeURIComponent(currentClassName)}`,
                config: {
                  params: {
                    section: currentSection,
                    schoolId,
                  },
                },
              },
              {
                method: "get",
                url: "/exams",
                config: {
                  params: {
                    classId: currentClassId,
                    className: currentClassName,
                    section: currentSection,
                    schoolId,
                  },
                },
              },
            ],
            "Exams"
          ),

          fetchArraySafely(
            [
              {
                fn: () => getNoticesByClass(currentClassName, currentSection),
              },
              {
                fn: () => getNoticesByClass(currentClassId, currentSection),
              },
              {
                method: "get",
                url: `/notices/class/${encodeURIComponent(currentClassId)}`,
              },
              {
                method: "get",
                url: `/notice/class/${encodeURIComponent(currentClassId)}`,
              },
              {
                method: "get",
                url: `/notices/class/${encodeURIComponent(currentClassName)}`,
                config: {
                  params: {
                    section: currentSection,
                    schoolId,
                  },
                },
              },
              {
                method: "get",
                url: "/notices",
                config: {
                  params: {
                    classId: currentClassId,
                    className: currentClassName,
                    section: currentSection,
                    schoolId,
                  },
                },
              },
            ],
            "Notices"
          ),
        ]);

      const ownedTasks = fetchedTasks.filter((task) =>
        isTaskOwnedByTeacher(task, teacherId)
      );

      setTasks(ownedTasks);
      await loadSubmissionsForTasks(ownedTasks);

      setAttendanceRecords(
        mergeUniqueItems(fetchedAttendance, localAttendance)
      );
      setExams(mergeUniqueItems(fetchedExams, localExams));
      setNotices(mergeUniqueItems(fetchedNotices, localNotices));
    } catch (err) {
      console.log("Teacher dashboard error:", err.response?.data || err);
      showError(
        err.response?.data?.message || "Failed to load teacher dashboard data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClassName, currentSection]);

  useEffect(() => {
    loadTeacherSubjectOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    teacherId,
    currentClassName,
    currentSection,
    currentStream,
    currentAcademicYear,
  ]);

  useEffect(() => {
    setTaskSubjectId("");
    setTaskSubject("");
    setExamSubjectId("");
    setExamSubject("");
    setHomeworkSubjectFilter("all");
  }, [currentClassName, currentSection]);

  useEffect(() => {
    if (availableSubjects.length !== 1) {
      return;
    }

    const onlySubject = availableSubjects[0];
    const optionValue = getSubjectOptionValue(onlySubject);
    const name = getSubjectName(onlySubject);

    if (!taskSubjectId) {
      setTaskSubjectId(optionValue);
      setTaskSubject(name);
    }

    if (!examSubjectId) {
      setExamSubjectId(optionValue);
      setExamSubject(name);
    }
  }, [
    availableSubjects,
    taskSubjectId,
    examSubjectId,
  ]);

  useEffect(() => {
    setAttendanceMap((prev) => {
      const next = { ...prev };
      const currentIds = new Set(studentsForCurrentClass.map((s) => getId(s)));

      studentsForCurrentClass.forEach((student) => {
        const studentId = getId(student);

        if (!next[studentId]) {
          next[studentId] = "Present";
        }
      });

      Object.keys(next).forEach((studentId) => {
        if (!currentIds.has(studentId)) {
          delete next[studentId];
        }
      });

      return next;
    });
  }, [studentsForCurrentClass]);

  const handleDownloadFile = async (filePath) => {
    try {
      const fileUrl = buildFileUrl(filePath);

      if (!fileUrl) {
        alert("File URL not found.");
        return;
      }

      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new Error("Could not download file.");
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = getFileNameFromPath(filePath);
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download error:", err);

      const fileUrl = buildFileUrl(filePath);

      if (fileUrl) {
        window.open(fileUrl, "_blank", "noopener,noreferrer");
      } else {
        alert("Download failed. File not found.");
      }
    }
  };

  const FileActions = ({ filePath, downloadLabel = "Download File" }) => {
    const fileUrl = buildFileUrl(filePath);

    if (!fileUrl) return null;

    return (
      <div
        style={{
          marginTop: 12,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          style={{ ...styles.secondaryButton, textDecoration: "none" }}
        >
          Open File
        </a>

        <button
          type="button"
          style={styles.primaryButton}
          onClick={() => handleDownloadFile(filePath)}
        >
          {downloadLabel}
        </button>
      </div>
    );
  };

  const handleAddTask = async (e) => {
    e.preventDefault();

    if (!currentClassName) {
      showError("No class assigned to this teacher.");
      return;
    }

    if (!selectedTaskSubject) {
      showError("Please select a subject from the dropdown.");
      return;
    }

    const selectedSubjectId = getSubjectId(selectedTaskSubject);
    const selectedSubjectName = getSubjectName(selectedTaskSubject);
    const selectedSubjectCode = getSubjectCode(selectedTaskSubject);

    const taskPayload = {
      title: taskTitle.trim(),
      subjectId: selectedTaskSubject.isLegacySubject
        ? ""
        : selectedSubjectId,
      subject: selectedSubjectName,
      subjectName: selectedSubjectName,
      subjectCode: selectedSubjectCode,
      subjectType: selectedTaskSubject.type || "",
      stream: selectedTaskSubject.stream || currentStream,
      academicYear:
        selectedTaskSubject.academicYear || currentAcademicYear,
      description: taskDesc.trim(),
      dueDate: taskDue,
      className: currentClassName,
      section: currentSection,
      classId: currentClassId,
      schoolId,
      teacherId,
      teacherName: teacher.name || "",
    };

    if (taskFile) {
      taskPayload.file = taskFile;
    }

    try {
      setSavingTask(true);
      setError("");
      setMessage("");

      await createTask(taskPayload);

      setTaskTitle("");
      setTaskSubjectId("");
      setTaskSubject("");
      setTaskDesc("");
      setTaskDue("");
      setTaskFile(null);
      setTaskFileKey(Date.now());
      setHomeworkFilter("recent");

      showSuccess("Homework created successfully.");
      await fetchDashboardData();
      setShowHomeworkComposer(false);
    } catch (err) {
      console.log("Create task error:", err.response?.data || err);
      showError(err.response?.data?.message || "Failed to create homework.");
    } finally {
      setSavingTask(false);
    }
  };

  const handleAttendanceStatusChange = (studentId, status) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const setAllAttendanceStatus = (status) => {
    const next = {};

    studentsForCurrentClass.forEach((student) => {
      next[getId(student)] = status;
    });

    setAttendanceMap(next);
  };

  const saveAttendanceRecordsToBackend = async (records) => {
    try {
      await requestWithFallback([
        {
          method: "post",
          url: "/attendance/bulk",
          data: {
            records,
            classId: currentClassId,
            className: currentClassName,
            section: currentSection,
            date: attendanceDate,
            schoolId,
            teacherId,
          },
        },
        {
          method: "post",
          url: "/attendance/mark-bulk",
          data: {
            records,
            classId: currentClassId,
            className: currentClassName,
            section: currentSection,
            date: attendanceDate,
            schoolId,
            teacherId,
          },
        },
        {
          method: "post",
          url: "/attendances/bulk",
          data: {
            records,
            classId: currentClassId,
            className: currentClassName,
            section: currentSection,
            date: attendanceDate,
            schoolId,
            teacherId,
          },
        },
      ]);

      return;
    } catch {
      await Promise.all(
        records.map((record) =>
          requestWithFallback([
            {
              fn: () => markAttendance(record),
            },
            {
              method: "post",
              url: "/attendance/mark",
              data: record,
            },
            {
              method: "post",
              url: "/attendance/create",
              data: record,
            },
            {
              method: "post",
              url: "/attendance",
              data: record,
            },
            {
              method: "post",
              url: "/attendances",
              data: record,
            },
          ])
        )
      );
    }
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();

    if (!currentClassName) {
      showError("No class assigned to this teacher.");
      return;
    }

    if (studentsForCurrentClass.length === 0) {
      showError("No students found for this class.");
      return;
    }

    const records = studentsForCurrentClass.map((student) => {
      const studentId = getId(student);

      return {
        studentId,
        studentName: student.name || "",
        studentEmail: student.email || "",
        classId: currentClassId,
        className: currentClassName,
        section: currentSection,
        status: attendanceMap[studentId] || "Present",
        date: attendanceDate,
        schoolId,
        teacherId,
        markedBy: teacherId,
        markedByName: teacher.name || "",
      };
    });

    try {
      setSavingAttendance(true);
      setError("");
      setMessage("");

      await saveAttendanceRecordsToBackend(records);

      showSuccess("Attendance saved successfully.");
      fetchDashboardData();
    } catch (err) {
      console.log("Attendance backend error:", err.response?.data || err);

      const localRecords = records.map((record) => ({
        ...record,
        localId: makeLocalId(),
        createdAt: new Date().toISOString(),
        savedMode: "local",
      }));

      const nextLocalRecords = addLocalClassItems(
        LOCAL_ATTENDANCE_STORAGE_KEY,
        localRecords
      );

      setAttendanceRecords((prev) => mergeUniqueItems(prev, nextLocalRecords));

      showSuccess(
        "Attendance saved locally. Backend attendance route is not ready yet."
      );
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleAddExam = async (e) => {
    e.preventDefault();

    if (!currentClassName) {
      showError("No class assigned to this teacher.");
      return;
    }

    if (!selectedExamSubject) {
      showError("Please select an exam subject from the dropdown.");
      return;
    }

    if (Number(examMaxMarks) <= 0) {
      showError("Max marks must be greater than 0.");
      return;
    }

    const selectedSubjectId = getSubjectId(selectedExamSubject);
    const selectedSubjectName = getSubjectName(selectedExamSubject);
    const selectedSubjectCode = getSubjectCode(selectedExamSubject);

    const examData = {
      title: examTitle.trim(),
      subjectId: selectedExamSubject.isLegacySubject
        ? ""
        : selectedSubjectId,
      subject: selectedSubjectName,
      subjectName: selectedSubjectName,
      subjectCode: selectedSubjectCode,
      subjectType: selectedExamSubject.type || "",
      stream: selectedExamSubject.stream || currentStream,
      academicYear:
        selectedExamSubject.academicYear || currentAcademicYear,
      date: examDate,
      maxMarks: Number(examMaxMarks),
      totalMarks: Number(examMaxMarks),
      classId: currentClassId,
      className: currentClassName,
      section: currentSection,
      schoolId,
      teacherId,
      teacherName: teacher.name || "",
    };

    try {
      setSavingExam(true);
      setError("");
      setMessage("");

      const res = await requestWithFallback([
        {
          fn: () => createExam(examData),
        },
        {
          method: "post",
          url: "/exams/create",
          data: examData,
        },
        {
          method: "post",
          url: "/exams",
          data: examData,
        },
        {
          method: "post",
          url: "/exam/create",
          data: examData,
        },
        {
          method: "post",
          url: "/teacher/exams",
          data: examData,
        },
      ]);

      const savedExam = extractSavedObject(res, examData, ["exam"]);

      setExamTitle("");
      setExamSubjectId("");
      setExamSubject("");
      setExamDate("");
      setExamMaxMarks("");

      setExams((prev) => mergeUniqueItems([savedExam, ...prev], []));
      showSuccess("Exam created successfully.");
      fetchDashboardData();
    } catch (err) {
      console.log("Create exam backend error:", err.response?.data || err);

      const localExam = {
        ...examData,
        localId: makeLocalId(),
        createdAt: new Date().toISOString(),
        savedMode: "local",
      };

      addLocalClassItem(LOCAL_EXAMS_STORAGE_KEY, localExam);
      setExams((prev) => mergeUniqueItems([localExam, ...prev], []));

      setExamTitle("");
      setExamSubjectId("");
      setExamSubject("");
      setExamDate("");
      setExamMaxMarks("");

      showSuccess("Exam saved locally. Backend exam route is not ready yet.");
    } finally {
      setSavingExam(false);
    }
  };

  const handleAddNotice = async (e) => {
    e.preventDefault();

    if (!currentClassName) {
      showError("No class assigned to this teacher.");
      return;
    }

    const noticeData = {
      title: noticeTitle.trim(),
      message: noticeContent.trim(),
      content: noticeContent.trim(),
      description: noticeContent.trim(),
      classId: currentClassId,
      className: currentClassName,
      section: currentSection,
      schoolId,
      teacherId,
      teacherName: teacher.name || "",
      createdBy: teacherId,
      createdAt: new Date().toISOString(),
    };

    try {
      setSavingNotice(true);
      setError("");
      setMessage("");

      const res = await requestWithFallback([
        {
          fn: () => createNotice(noticeData),
        },
        {
          method: "post",
          url: "/notices/create",
          data: noticeData,
        },
        {
          method: "post",
          url: "/notices",
          data: noticeData,
        },
        {
          method: "post",
          url: "/notice/create",
          data: noticeData,
        },
        {
          method: "post",
          url: "/teacher/notices",
          data: noticeData,
        },
      ]);

      const savedNotice = extractSavedObject(res, noticeData, ["notice"]);

      setNoticeTitle("");
      setNoticeContent("");

      setNotices((prev) => mergeUniqueItems([savedNotice, ...prev], []));
      showSuccess("Notice created successfully.");
      fetchDashboardData();
    } catch (err) {
      console.log("Create notice backend error:", err.response?.data || err);

      const localNotice = {
        ...noticeData,
        localId: makeLocalId(),
        savedMode: "local",
      };

      addLocalClassItem(LOCAL_NOTICES_STORAGE_KEY, localNotice);
      setNotices((prev) => mergeUniqueItems([localNotice, ...prev], []));

      setNoticeTitle("");
      setNoticeContent("");

      showSuccess("Notice saved locally. Backend notice route is not ready yet.");
    } finally {
      setSavingNotice(false);
    }
  };

  const handleSubmissionReviewChange = (reviewKey, field, value) => {
    setSubmissionReviews((prev) => ({
      ...prev,
      [reviewKey]: {
        ...(prev[reviewKey] || {}),
        [field]: value,
      },
    }));
  };

  const saveSubmissionReviewLocally = (reviewKey, reviewData) => {
    const nextReviews = {
      ...submissionReviews,
      [reviewKey]: {
        ...(submissionReviews[reviewKey] || {}),
        ...reviewData,
      },
    };

    setSubmissionReviews(nextReviews);
    safeWriteStorage(SUBMISSION_REVIEWS_STORAGE_KEY, nextReviews);
  };

  const handleSaveSubmissionReview = async (task, submission, index) => {
    const taskId = getTaskId(task);
    const submissionId = getSubmissionId(submission);
    const reviewKey = getSubmissionReviewKey(task, submission, index);
    const review = submissionReviews[reviewKey] || {};

    const reviewData = {
      marks: review.marks || "",
      feedback: review.feedback || "",
      status: review.status || "Checked",
      checkedAt: new Date().toISOString(),
      checkedBy: teacherId,
      teacherName: teacher.name || "",
    };

    if (!reviewData.marks && !reviewData.feedback) {
      showError("Please add marks or feedback before saving.");
      return;
    }

    try {
      setSavingReviewKey(reviewKey);
      setError("");
      setMessage("");

      if (taskId && submissionId) {
        await requestWithFallback([
          {
            method: "patch",
            url: `/tasks/${taskId}/submissions/${submissionId}`,
            data: reviewData,
          },
          {
            method: "put",
            url: `/tasks/${taskId}/submissions/${submissionId}`,
            data: reviewData,
          },
          {
            method: "patch",
            url: `/submissions/${submissionId}`,
            data: reviewData,
          },
          {
            method: "put",
            url: `/submissions/${submissionId}`,
            data: reviewData,
          },
          {
            method: "patch",
            url: `/homework/submissions/${submissionId}`,
            data: reviewData,
          },
        ]);
      }

      saveSubmissionReviewLocally(reviewKey, reviewData);
      showSuccess("Submission review saved successfully.");
      fetchDashboardData();
    } catch (err) {
      console.warn("Submission review saved locally:", err);
      saveSubmissionReviewLocally(reviewKey, reviewData);
      showSuccess("Review saved locally. Backend review route is not ready yet.");
    } finally {
      setSavingReviewKey("");
    }
  };

  const getExamMarkKey = (exam, student) => {
    return `${getExamId(exam) || exam?.title || "exam"}:${getId(student)}`;
  };

  const handleExamMarkChange = (markKey, field, value) => {
    setExamMarks((prev) => ({
      ...prev,
      [markKey]: {
        ...(prev[markKey] || {}),
        [field]: value,
      },
    }));
  };

  const saveExamMarkLocally = (markKey, markData) => {
    const nextMarks = {
      ...examMarks,
      [markKey]: {
        ...(examMarks[markKey] || {}),
        ...markData,
      },
    };

    setExamMarks(nextMarks);
    safeWriteStorage(EXAM_MARKS_STORAGE_KEY, nextMarks);
  };

  const handleSaveExamMark = async (exam, student) => {
    const examId = getExamId(exam);
    const studentId = getId(student);
    const markKey = getExamMarkKey(exam, student);
    const mark = examMarks[markKey] || {};

    if (!mark.obtainedMarks && mark.obtainedMarks !== 0) {
      showError("Please add obtained marks.");
      return;
    }

    const markData = {
      examId,
      examTitle: exam.title || "",
      subjectId: getRecordSubjectId(exam),
      subject: getRecordSubjectName(exam),
      subjectName: getRecordSubjectName(exam),
      subjectCode: getRecordSubjectCode(exam),
      studentId,
      studentName: student.name || "",
      studentEmail: student.email || "",
      classId: currentClassId,
      className: currentClassName,
      section: currentSection,
      schoolId,
      teacherId,
      maxMarks: Number(exam.maxMarks || exam.totalMarks || 0),
      obtainedMarks: Number(mark.obtainedMarks),
      marksObtained: Number(mark.obtainedMarks),
      remarks: mark.remarks || "",
      savedAt: new Date().toISOString(),
    };

    try {
      setSavingExamMarkKey(markKey);
      setError("");
      setMessage("");

      await requestWithFallback([
        {
          method: "post",
          url: "/results/create",
          data: markData,
        },
        {
          method: "post",
          url: "/exam-results/create",
          data: markData,
        },
        {
          method: "post",
          url: `/exams/${examId}/marks`,
          data: markData,
        },
        {
          method: "post",
          url: "/results",
          data: markData,
        },
        {
          method: "put",
          url: `/results/${examId}/${studentId}`,
          data: markData,
        },
      ]);

      saveExamMarkLocally(markKey, markData);
      showSuccess("Exam mark saved successfully.");
    } catch (err) {
      console.warn("Exam mark saved locally:", err);
      saveExamMarkLocally(markKey, markData);
      showSuccess("Exam mark saved locally. Backend result route is not ready yet.");
    } finally {
      setSavingExamMarkKey("");
    }
  };

  const getDisplaySubmissionReview = (task, submission, index) => {
    return readSubmissionReview(task, submission, index);
  };

  const getAttendanceStudentName = (record) => {
    return (
      record.studentId?.name ||
      record.student?.name ||
      record.studentName ||
      getStudentName(record.studentId || record.student) ||
      "Student"
    );
  };

  const getAttendanceDate = (record) => {
    if (!record.date && !record.createdAt) return "N/A";

    return new Date(record.date || record.createdAt).toLocaleDateString();
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <PortalLayout
      role="teacher"
      portalName="Teacher Portal"
      user={teacher}
      navigation={TEACHER_NAVIGATION}
      onLogout={logout}
      headerMeta={
        <>
          <span className="portal-header-pill">
            🏫 Class {currentClassName || "Not assigned"}
            {currentSection ? ` · Section ${currentSection}` : ""}
          </span>
          {loading && <span className="portal-header-pill">Refreshing…</span>}
        </>
      }
    >
      <div className="portal-page-stack" style={styles.shell}>
        <style>
          {`
            .teacher-workflow-section {
              overflow: visible;
            }

            .teacher-workflow-heading {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 18px;
              margin-bottom: 22px;
            }

            .teacher-workflow-heading h2 {
              margin: 4px 0 7px;
              color: #0f172a;
              font-size: clamp(25px, 3vw, 34px);
              font-weight: 950;
              letter-spacing: -0.8px;
            }

            .teacher-workflow-heading p {
              max-width: 720px;
              margin: 0;
              color: #64748b;
              line-height: 1.6;
            }

            .teacher-eyebrow {
              color: #2563eb;
              font-size: 11px;
              font-weight: 950;
              letter-spacing: 1.1px;
              text-transform: uppercase;
            }

            .teacher-workflow-heading-actions {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              flex-wrap: wrap;
            }

            .teacher-primary-action,
            .teacher-soft-button {
              min-height: 42px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
              padding: 10px 15px;
              border-radius: 13px;
              font: inherit;
              font-size: 13px;
              font-weight: 900;
              cursor: pointer;
              transition:
                transform 160ms ease,
                box-shadow 160ms ease,
                border-color 160ms ease,
                background 160ms ease;
            }

            .teacher-primary-action {
              border: 0;
              background: linear-gradient(135deg, #2563eb, #4f46e5);
              color: #ffffff;
              box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
            }

            .teacher-soft-button {
              border: 1px solid #dbe3ef;
              background: #ffffff;
              color: #334155;
            }

            .teacher-primary-action:hover:not(:disabled),
            .teacher-soft-button:hover:not(:disabled) {
              transform: translateY(-1px);
            }

            .teacher-primary-action:disabled,
            .teacher-soft-button:disabled {
              opacity: 0.55;
              cursor: not-allowed;
            }

            .teacher-folder-grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(150px, 1fr));
              gap: 12px;
              margin-bottom: 22px;
            }

            .teacher-submission-folders {
              grid-template-columns: repeat(4, minmax(170px, 1fr));
            }

            .teacher-folder-card {
              min-width: 0;
              display: flex;
              align-items: center;
              gap: 11px;
              padding: 15px;
              border: 1px solid #dce6f2;
              border-radius: 17px;
              background: linear-gradient(180deg, #ffffff, #f8fbff);
              color: #0f172a;
              text-align: left;
              cursor: pointer;
              box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
              transition:
                transform 160ms ease,
                border-color 160ms ease,
                box-shadow 160ms ease;
            }

            .teacher-folder-card:hover {
              transform: translateY(-2px);
              border-color: #93c5fd;
              box-shadow: 0 13px 28px rgba(37, 99, 235, 0.1);
            }

            .teacher-folder-card.is-active {
              border-color: #60a5fa;
              background: linear-gradient(135deg, #eff6ff, #eef2ff);
              box-shadow: 0 13px 30px rgba(37, 99, 235, 0.14);
            }

            .teacher-folder-icon {
              width: 42px;
              height: 42px;
              flex: 0 0 42px;
              display: grid;
              place-items: center;
              border-radius: 13px;
              background: #eaf2ff;
              font-size: 21px;
            }

            .teacher-folder-copy {
              min-width: 0;
              flex: 1;
            }

            .teacher-folder-copy strong,
            .teacher-folder-copy small {
              display: block;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .teacher-folder-copy strong {
              font-size: 13px;
              font-weight: 900;
            }

            .teacher-folder-copy small {
              margin-top: 3px;
              color: #64748b;
              font-size: 11px;
            }

            .teacher-folder-count {
              min-width: 27px;
              height: 27px;
              display: grid;
              place-items: center;
              border-radius: 9px;
              background: #ffffff;
              color: #1d4ed8;
              font-size: 12px;
              font-weight: 950;
              box-shadow: 0 5px 12px rgba(15, 23, 42, 0.07);
            }

            .teacher-composer-panel {
              margin-bottom: 22px;
              padding: 20px;
              border: 1px solid #bfdbfe;
              border-radius: 22px;
              background:
                radial-gradient(circle at top right, rgba(96, 165, 250, 0.15), transparent 30%),
                linear-gradient(135deg, #f8fbff, #ffffff);
              box-shadow: 0 15px 38px rgba(37, 99, 235, 0.08);
            }

            .teacher-composer-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 14px;
              margin-bottom: 18px;
            }

            .teacher-composer-header > div {
              display: flex;
              align-items: center;
              gap: 12px;
            }

            .teacher-composer-header h3 {
              margin: 0;
              color: #0f172a;
              font-size: 19px;
              font-weight: 950;
            }

            .teacher-composer-header p {
              margin: 4px 0 0;
              color: #64748b;
              font-size: 13px;
            }

            .teacher-composer-icon {
              width: 46px;
              height: 46px;
              display: grid;
              place-items: center;
              border-radius: 14px;
              background: #dbeafe;
              font-size: 22px;
            }

            .teacher-class-target {
              padding: 8px 12px;
              border: 1px solid #bfdbfe;
              border-radius: 999px;
              background: #ffffff;
              color: #1e40af;
              font-size: 12px;
              font-weight: 900;
              white-space: nowrap;
            }

            .teacher-composer-grid,
            .teacher-review-form {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 14px;
            }

            .teacher-review-form {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              padding-top: 4px;
            }

            .teacher-field label {
              display: block;
              margin-bottom: 7px;
              color: #334155;
              font-size: 12px;
              font-weight: 900;
            }

            .teacher-field input,
            .teacher-field select,
            .teacher-field textarea {
              width: 100%;
              min-height: 46px;
              padding: 11px 13px;
              border: 1px solid #cbd5e1;
              border-radius: 13px;
              background: #ffffff;
              color: #0f172a;
              font: inherit;
              outline: none;
            }

            .teacher-field textarea {
              min-height: 112px;
              resize: vertical;
            }

            .teacher-field input:focus,
            .teacher-field select:focus,
            .teacher-field textarea:focus {
              border-color: #60a5fa;
              box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
            }

            .teacher-subject-help {
              display: block;
              margin-top: 7px;
              color: #64748b;
              font-size: 11px;
              line-height: 1.45;
            }

            .teacher-subject-warning {
              margin: 0 0 16px;
              padding: 11px 13px;
              border: 1px solid #fde68a;
              border-radius: 13px;
              background: #fffbeb;
              color: #92400e;
              font-size: 12px;
              font-weight: 750;
              line-height: 1.5;
            }

            .teacher-subject-summary {
              display: flex;
              align-items: center;
              gap: 8px;
              flex-wrap: wrap;
              margin: 0 0 16px;
            }

            .teacher-subject-summary span {
              display: inline-flex;
              align-items: center;
              min-height: 30px;
              padding: 6px 10px;
              border: 1px solid #dbeafe;
              border-radius: 999px;
              background: #eff6ff;
              color: #1e40af;
              font-size: 11px;
              font-weight: 850;
            }

            .teacher-field-wide {
              grid-column: 1 / -1;
              margin-top: 14px;
            }

            .teacher-upload-row {
              display: grid;
              grid-template-columns: minmax(0, 1fr) auto;
              gap: 14px;
              align-items: stretch;
              margin-top: 15px;
            }

            .teacher-upload-box {
              min-width: 0;
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 13px 15px;
              border: 1px dashed #93c5fd;
              border-radius: 15px;
              background: rgba(255, 255, 255, 0.82);
              cursor: pointer;
            }

            .teacher-upload-box input {
              position: absolute;
              width: 1px;
              height: 1px;
              opacity: 0;
              pointer-events: none;
            }

            .teacher-upload-icon {
              width: 39px;
              height: 39px;
              flex: 0 0 39px;
              display: grid;
              place-items: center;
              border-radius: 12px;
              background: #eff6ff;
              font-size: 19px;
            }

            .teacher-upload-box span:last-child {
              min-width: 0;
            }

            .teacher-upload-box strong,
            .teacher-upload-box small {
              display: block;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .teacher-upload-box strong {
              color: #1e3a8a;
              font-size: 13px;
            }

            .teacher-upload-box small {
              margin-top: 3px;
              color: #64748b;
              font-size: 11px;
            }

            .teacher-create-submit {
              min-width: 165px;
            }

            .teacher-workflow-toolbar {
              display: flex;
              align-items: center;
              gap: 11px;
              margin-bottom: 18px;
              padding: 12px;
              border: 1px solid #e2e8f0;
              border-radius: 17px;
              background: #f8fafc;
            }

            .teacher-search-control {
              min-width: 220px;
              flex: 1;
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 0 12px;
              border: 1px solid #d7e0eb;
              border-radius: 12px;
              background: #ffffff;
            }

            .teacher-search-control span {
              color: #64748b;
              font-size: 20px;
            }

            .teacher-search-control input {
              width: 100%;
              min-height: 42px;
              border: 0;
              background: transparent;
              color: #0f172a;
              font: inherit;
              outline: none;
            }

            .teacher-sort-control {
              min-height: 43px;
              padding: 0 12px;
              border: 1px solid #d7e0eb;
              border-radius: 12px;
              background: #ffffff;
              color: #334155;
              font: inherit;
              font-size: 13px;
              font-weight: 800;
            }

            .teacher-view-toggle {
              display: flex;
              padding: 3px;
              border: 1px solid #d7e0eb;
              border-radius: 12px;
              background: #ffffff;
            }

            .teacher-view-toggle button {
              width: 37px;
              height: 35px;
              border: 0;
              border-radius: 9px;
              background: transparent;
              color: #64748b;
              font-size: 18px;
              cursor: pointer;
            }

            .teacher-view-toggle button.is-active {
              background: #e0e7ff;
              color: #3730a3;
            }

            .teacher-homework-collection.is-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 15px;
            }

            .teacher-homework-collection.is-list {
              display: grid;
              gap: 12px;
            }

            .teacher-homework-card {
              min-width: 0;
              display: flex;
              flex-direction: column;
              padding: 18px;
              border: 1px solid #dce6f2;
              border-top: 4px solid #60a5fa;
              border-radius: 19px;
              background: #ffffff;
              box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
            }

            .teacher-homework-card.is-overdue {
              border-top-color: #f87171;
            }

            .teacher-homework-card.is-due-soon {
              border-top-color: #f59e0b;
            }

            .teacher-homework-collection.is-list .teacher-homework-card {
              display: grid;
              grid-template-columns: minmax(240px, 1.3fr) minmax(260px, 1fr) auto;
              gap: 18px;
              align-items: center;
            }

            .teacher-homework-card-top {
              display: flex;
              align-items: flex-start;
              gap: 12px;
            }

            .teacher-homework-file-icon {
              width: 46px;
              height: 46px;
              flex: 0 0 46px;
              display: grid;
              place-items: center;
              border-radius: 14px;
              background: #eff6ff;
              font-size: 22px;
            }

            .teacher-homework-card-heading {
              min-width: 0;
            }

            .teacher-homework-card-heading h3 {
              margin: 8px 0 4px;
              color: #0f172a;
              font-size: 18px;
              font-weight: 950;
              overflow-wrap: anywhere;
            }

            .teacher-homework-card-heading p {
              margin: 0;
              color: #64748b;
              font-size: 13px;
              font-weight: 750;
            }

            .teacher-homework-badges {
              display: flex;
              align-items: center;
              gap: 6px;
              flex-wrap: wrap;
            }

            .teacher-status-pill {
              display: inline-flex;
              align-items: center;
              min-height: 24px;
              padding: 4px 8px;
              border-radius: 999px;
              background: #e0f2fe;
              color: #075985;
              font-size: 10px;
              font-weight: 950;
              letter-spacing: 0.2px;
              text-transform: uppercase;
            }

            .teacher-status-pill.is-new {
              background: #ede9fe;
              color: #5b21b6;
            }

            .teacher-status-pill.is-reviewed {
              background: #dcfce7;
              color: #166534;
            }

            .teacher-status-pill.is-due-soon {
              background: #fef3c7;
              color: #92400e;
            }

            .teacher-status-pill.is-overdue {
              background: #fee2e2;
              color: #991b1b;
            }

            .teacher-homework-description {
              display: -webkit-box;
              min-height: 42px;
              margin: 14px 0;
              overflow: hidden;
              color: #475569;
              font-size: 13px;
              line-height: 1.55;
              -webkit-box-orient: vertical;
              -webkit-line-clamp: 2;
            }

            .teacher-homework-meta-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 8px;
              margin-top: auto;
            }

            .teacher-homework-meta-grid > div {
              min-width: 0;
              padding: 10px;
              border-radius: 12px;
              background: #f8fafc;
            }

            .teacher-homework-meta-grid span,
            .teacher-homework-meta-grid strong {
              display: block;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .teacher-homework-meta-grid span {
              color: #64748b;
              font-size: 10px;
              font-weight: 800;
              text-transform: uppercase;
            }

            .teacher-homework-meta-grid strong {
              margin-top: 4px;
              color: #0f172a;
              font-size: 12px;
            }

            .teacher-homework-progress {
              height: 7px;
              margin: 13px 0;
              overflow: hidden;
              border-radius: 999px;
              background: #e2e8f0;
            }

            .teacher-homework-progress span {
              display: block;
              height: 100%;
              border-radius: 999px;
              background: linear-gradient(90deg, #2563eb, #4f46e5);
            }

            .teacher-homework-card-actions {
              display: flex;
              gap: 8px;
              margin-top: auto;
            }

            .teacher-homework-card-actions > * {
              flex: 1;
            }

            .teacher-professional-empty {
              display: grid;
              place-items: center;
              min-height: 260px;
              padding: 32px;
              border: 1px dashed #bfdbfe;
              border-radius: 21px;
              background: linear-gradient(135deg, #f8fbff, #ffffff);
              text-align: center;
            }

            .teacher-professional-empty > span {
              font-size: 44px;
            }

            .teacher-professional-empty h3 {
              margin: 12px 0 6px;
              color: #0f172a;
              font-size: 20px;
              font-weight: 950;
            }

            .teacher-professional-empty p {
              max-width: 540px;
              margin: 0 0 16px;
              color: #64748b;
              line-height: 1.6;
            }

            .teacher-submission-summary {
              display: flex;
              align-items: center;
              gap: 9px;
              flex-wrap: wrap;
            }

            .teacher-submission-summary span {
              padding: 9px 12px;
              border-radius: 999px;
              background: #ffffff;
              color: #475569;
              font-size: 12px;
              font-weight: 800;
            }

            .teacher-submission-list {
              display: grid;
              gap: 11px;
            }

            .teacher-submission-row {
              display: grid;
              grid-template-columns: auto minmax(0, 1fr) auto;
              gap: 14px;
              align-items: center;
              padding: 15px;
              border: 1px solid #dce6f2;
              border-left: 4px solid #8b5cf6;
              border-radius: 17px;
              background: #ffffff;
              box-shadow: 0 8px 23px rgba(15, 23, 42, 0.05);
            }

            .teacher-submission-row.is-reviewed {
              border-left-color: #22c55e;
            }

            .teacher-submission-avatar {
              width: 46px;
              height: 46px;
              flex: 0 0 46px;
              display: grid;
              place-items: center;
              border-radius: 14px;
              background: linear-gradient(135deg, #dbeafe, #e0e7ff);
              color: #3730a3;
              font-size: 16px;
              font-weight: 950;
            }

            .teacher-submission-main {
              min-width: 0;
            }

            .teacher-submission-title-line {
              display: flex;
              justify-content: space-between;
              gap: 12px;
            }

            .teacher-submission-title-line h3 {
              margin: 0;
              color: #0f172a;
              font-size: 15px;
              font-weight: 950;
            }

            .teacher-submission-title-line p {
              margin: 3px 0 0;
              color: #64748b;
              font-size: 11px;
            }

            .teacher-submission-task-line,
            .teacher-submission-meta {
              display: flex;
              align-items: center;
              gap: 7px;
              flex-wrap: wrap;
            }

            .teacher-submission-task-line {
              margin-top: 9px;
              color: #334155;
              font-size: 13px;
            }

            .teacher-submission-meta {
              margin-top: 7px;
              color: #64748b;
              font-size: 11px;
            }

            .teacher-review-button {
              min-width: 118px;
            }

            .teacher-modal-backdrop {
              position: fixed;
              inset: 0;
              z-index: 1000;
              display: grid;
              place-items: center;
              padding: 20px;
              background: rgba(15, 23, 42, 0.58);
              backdrop-filter: blur(7px);
            }

            .teacher-detail-modal {
              width: min(760px, 100%);
              max-height: calc(100vh - 40px);
              overflow-y: auto;
              border: 1px solid rgba(255, 255, 255, 0.5);
              border-radius: 24px;
              background: #ffffff;
              box-shadow: 0 28px 90px rgba(15, 23, 42, 0.28);
            }

            .teacher-review-modal {
              width: min(850px, 100%);
            }

            .teacher-modal-header {
              position: sticky;
              top: 0;
              z-index: 2;
              display: flex;
              justify-content: space-between;
              gap: 16px;
              padding: 20px 22px;
              border-bottom: 1px solid #e2e8f0;
              background: rgba(255, 255, 255, 0.96);
              backdrop-filter: blur(12px);
            }

            .teacher-modal-header h2 {
              margin: 4px 0 3px;
              color: #0f172a;
              font-size: 24px;
              font-weight: 950;
            }

            .teacher-modal-header p {
              margin: 0;
              color: #64748b;
            }

            .teacher-modal-close {
              width: 39px;
              height: 39px;
              flex: 0 0 39px;
              border: 1px solid #dbe3ef;
              border-radius: 12px;
              background: #ffffff;
              color: #334155;
              font-size: 25px;
              line-height: 1;
              cursor: pointer;
            }

            .teacher-modal-stat-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 11px;
              padding: 18px 22px 0;
            }

            .teacher-modal-stat-grid > div {
              padding: 13px;
              border-radius: 14px;
              background: #f8fafc;
            }

            .teacher-modal-stat-grid span,
            .teacher-modal-stat-grid strong {
              display: block;
            }

            .teacher-modal-stat-grid span {
              color: #64748b;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
            }

            .teacher-modal-stat-grid strong {
              margin-top: 5px;
              color: #0f172a;
              font-size: 13px;
            }

            .teacher-modal-section {
              margin: 18px 22px 0;
              padding: 17px;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              background: #ffffff;
            }

            .teacher-modal-section h3 {
              margin: 0 0 9px;
              color: #0f172a;
              font-size: 15px;
              font-weight: 950;
            }

            .teacher-modal-section p {
              margin: 0;
              color: #475569;
              line-height: 1.65;
              white-space: pre-wrap;
            }

            .teacher-modal-footer {
              display: flex;
              justify-content: flex-end;
              gap: 10px;
              padding: 20px 22px;
            }

            .teacher-review-student-strip {
              display: flex;
              align-items: center;
              gap: 12px;
              margin: 18px 22px 0;
              padding: 14px;
              border-radius: 16px;
              background: linear-gradient(135deg, #eff6ff, #eef2ff);
            }

            .teacher-review-student-strip > div:nth-child(2) {
              min-width: 0;
              flex: 1;
            }

            .teacher-review-student-strip strong,
            .teacher-review-student-strip span {
              display: block;
            }

            .teacher-review-student-strip strong {
              color: #0f172a;
            }

            .teacher-review-student-strip > div:nth-child(2) span {
              margin-top: 3px;
              color: #64748b;
              font-size: 12px;
            }

            .teacher-answer-panel {
              min-height: 90px;
              padding: 14px;
              border-radius: 13px;
              background: #f8fafc;
              color: #334155;
              line-height: 1.65;
              white-space: pre-wrap;
            }

            .teacher-review-form {
              margin: 18px 22px 0;
              padding: 18px;
              border: 1px solid #bfdbfe;
              border-radius: 17px;
              background: #f8fbff;
            }

            @media (max-width: 1240px) {
              .teacher-folder-grid {
                grid-template-columns: repeat(3, minmax(160px, 1fr));
              }

              .teacher-homework-collection.is-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }

            @media (max-width: 900px) {
              .teacher-workflow-heading,
              .teacher-composer-header {
                align-items: stretch;
                flex-direction: column;
              }

              .teacher-workflow-heading-actions {
                justify-content: flex-start;
              }

              .teacher-folder-grid,
              .teacher-submission-folders {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }

              .teacher-homework-collection.is-list .teacher-homework-card {
                display: flex;
              }

              .teacher-workflow-toolbar {
                align-items: stretch;
                flex-direction: column;
              }

              .teacher-search-control {
                min-width: 0;
              }

              .teacher-composer-grid {
                grid-template-columns: 1fr;
              }

              .teacher-review-form {
                grid-template-columns: 1fr;
              }

              .teacher-upload-row {
                grid-template-columns: 1fr;
              }

              .teacher-submission-row {
                grid-template-columns: auto minmax(0, 1fr);
              }

              .teacher-review-button {
                grid-column: 1 / -1;
              }
            }

            @media (max-width: 620px) {
              .teacher-folder-grid,
              .teacher-submission-folders,
              .teacher-homework-collection.is-grid {
                grid-template-columns: 1fr;
              }

              .teacher-homework-card-actions,
              .teacher-modal-footer {
                flex-direction: column;
              }

              .teacher-modal-stat-grid {
                grid-template-columns: 1fr;
              }

              .teacher-submission-row {
                grid-template-columns: 1fr;
              }

              .teacher-submission-avatar {
                width: 42px;
                height: 42px;
              }

              .teacher-submission-title-line {
                flex-direction: column;
              }

              .teacher-modal-backdrop {
                padding: 8px;
              }

              .teacher-detail-modal {
                max-height: calc(100vh - 16px);
                border-radius: 18px;
              }
            }
          `}
        </style>
        <section style={styles.hero} hidden={activeView !== "overview"}>
          <div style={styles.heroGrid}>
            <div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span style={styles.badge}>🟢 Teacher Portal</span>
                <span style={styles.badge}>
                  Class {currentClassName || "Not assigned"}
                  {currentSection ? ` - Section ${currentSection}` : ""}
                </span>
              </div>

              <h1 style={styles.heroTitle}>Teacher Dashboard</h1>

              <p style={styles.heroSubtitle}>
                Manage homework, attendance, exams, notices, submissions and
                student progress from one clean professional dashboard.
              </p>

              <div style={styles.heroActions}>
                <button
                  type="button"
                  style={styles.whiteButton}
                  onClick={fetchDashboardData}
                >
                  {loading ? "Refreshing..." : "Refresh Dashboard"}
                </button>

                <button
                  type="button"
                  style={styles.ghostButton}
                  onClick={() => openView("homework")}
                >
                  Create Homework
                </button>

                <button type="button" style={styles.logoutButton} onClick={logout}>
                  Logout
                </button>
              </div>
            </div>

            <aside style={styles.profilePanel}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={styles.avatar}>{teacherInitial}</div>

                <div>
                  <h2 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
                    {teacher.name || "Teacher"}
                  </h2>
                  <p style={{ margin: "5px 0", color: "rgba(255,255,255,0.82)" }}>
                    {teacher.email || "No email found"}
                  </p>
                  <span style={styles.badge}>Verified Teacher Account</span>
                </div>
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
                    Role
                  </p>
                  <b>{teacher.role || "Teacher"}</b>
                </div>

                <div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
                    Classes
                  </p>
                  <b>{assignedClasses.length}</b>
                </div>

                <div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
                    School ID
                  </p>
                  <b>{schoolId ? "Connected" : "Missing"}</b>
                </div>

                <div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)" }}>
                    Profile
                  </p>
                  <b>{profileCompletion}% Complete</b>
                </div>
              </div>

              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.2)",
                  overflow: "hidden",
                  marginTop: 18,
                }}
              >
                <div
                  style={{
                    width: `${profileCompletion}%`,
                    height: "100%",
                    background: "#ffffff",
                    borderRadius: 999,
                  }}
                />
              </div>
            </aside>
          </div>
        </section>

        <section
          style={styles.card}
          hidden={!message && !error && Boolean(currentClassName)}
        >
          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}

          {!currentClassName && (
            <div style={styles.error}>
              No class assigned to this teacher. Admin must assign class and
              section from the admin dashboard.
            </div>
          )}

        </section>

        <section style={styles.card} hidden={activeView !== "overview"}>
          <SectionHeader
            icon="📊"
            title="Overview"
            subtitle="Live summary of your assigned class activities."
          />

          <div style={styles.grid}>
            <StatCard
              icon="🏫"
              number={dashboardStats.assignedClasses}
              label="Assigned Classes"
            />
            <StatCard icon="👨‍🎓" number={dashboardStats.students} label="Students" />
            <StatCard
              icon="📘"
              number={availableSubjects.length}
              label="Assigned Subjects"
            />
            <StatCard icon="📚" number={dashboardStats.tasks} label="Homework" />
            <StatCard icon="📝" number={dashboardStats.exams} label="Exams" />
            <StatCard icon="📢" number={dashboardStats.notices} label="Notices" />
            <StatCard
              icon="🗓️"
              number={dashboardStats.attendanceRecords}
              label="Attendance Records"
            />
          </div>
        </section>

        <section id="profile" style={styles.card} hidden={activeView !== "profile"}>
          <SectionHeader
            icon="👤"
            title="Teacher Profile"
            subtitle="Manage your profile and account settings."
          />

          <div style={styles.grid}>
            <div style={styles.statCard}>
              <p style={styles.muted}>Full Name</p>
              <h3>{teacher.name || "Teacher"}</h3>
            </div>

            <div style={styles.statCard}>
              <p style={styles.muted}>Email</p>
              <h3 style={{ fontSize: 18 }}>{teacher.email || "N/A"}</h3>
            </div>

            <div style={styles.statCard}>
              <p style={styles.muted}>Current Class</p>
              <h3>
                {currentClassName
                  ? `Class ${currentClassName}${
                      currentSection ? ` Section ${currentSection}` : ""
                    }`
                  : "Missing"}
              </h3>
            </div>

            <div style={styles.statCard}>
              <p style={styles.muted}>Account Status</p>
              <h3>Active</h3>
            </div>
          </div>

          {assignedClasses.length > 1 && (
            <div style={{ marginTop: 20, maxWidth: 480 }}>
              <label style={styles.label}>Switch Assigned Class</label>
              <select
                style={styles.input}
                value={selectedClassIndex}
                onChange={(e) => setSelectedClassIndex(e.target.value)}
              >
                {assignedClasses.map((item, index) => (
                  <option key={`${item.className}-${item.section}`} value={index}>
                    Class {item.className}
                    {item.section ? ` Section ${item.section}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        <section style={styles.card} hidden={activeView !== "classes"}>
          <SectionHeader
            icon="🏫"
            title="My Assigned Classes"
            subtitle="Classes connected to this teacher account."
          />

          {assignedClasses.length === 0 ? (
            <EmptyState text="No assigned classes found." />
          ) : (
            <div style={styles.grid}>
              {assignedClasses.map((item, index) => (
                <div style={styles.statCard} key={`${item.className}-${item.section}-${index}`}>
                  <h3>
                    Class {item.className}
                    {item.section ? ` Section ${item.section}` : " All Sections"}
                  </h3>

                  {Array.isArray(item.subjects) &&
                    item.subjects.length > 0 && (
                      <p style={styles.muted}>
                        <b>Subjects:</b> {item.subjects.join(", ")}
                      </p>
                    )}

                  {Number(selectedClassIndex) === index ? (
                    <p style={{ color: "#16a34a", fontWeight: 900 }}>
                      Currently selected
                    </p>
                  ) : (
                    <button
                      style={styles.primaryButton}
                      type="button"
                      onClick={() => setSelectedClassIndex(String(index))}
                    >
                      Open This Class
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section id="students" style={styles.card} hidden={activeView !== "students"}>
          <SectionHeader
            icon="👨‍🎓"
            title="Student List"
            subtitle="Students available in the selected class."
          />

          {studentsForCurrentClass.length === 0 ? (
            <EmptyState text="No students found for this class. Add students from admin first." />
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Class</th>
                    <th style={styles.th}>Section</th>
                  </tr>
                </thead>

                <tbody>
                  {studentsForCurrentClass.map((student) => (
                    <tr key={getId(student)}>
                      <td style={styles.td}>
                        <b>{student.name || "N/A"}</b>
                      </td>
                      <td style={styles.td}>{student.email || "N/A"}</td>
                      <td style={styles.td}>
                        {student.className || student.class || currentClassName}
                      </td>
                      <td style={styles.td}>{student.section || currentSection || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          id="homework"
          style={styles.card}
          hidden={activeView !== "homework"}
          className="teacher-workflow-section"
        >
          <div className="teacher-workflow-heading">
            <div>
              <span className="teacher-eyebrow">Homework workspace</span>
              <h2>Published Homework</h2>
              <p>
                Create assignments, organise them by status and follow every
                student submission from one place.
              </p>
            </div>

            <div className="teacher-workflow-heading-actions">
              <button
                type="button"
                className="teacher-soft-button"
                onClick={fetchDashboardData}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "↻ Refresh"}
              </button>

              <button
                type="button"
                className="teacher-primary-action"
                onClick={() =>
                  setShowHomeworkComposer((previous) => !previous)
                }
              >
                {showHomeworkComposer ? "Close Creator" : "＋ Create Homework"}
              </button>
            </div>
          </div>

          <div className="teacher-folder-grid">
            {HOMEWORK_FILTER_OPTIONS.map((option) => {
              const countMap = {
                all: homeworkMetrics.total,
                recent: homeworkMetrics.recent,
                "due-soon": homeworkMetrics.dueSoon,
                "past-due": homeworkMetrics.pastDue,
                "with-submissions": homeworkMetrics.withSubmissions,
              };

              return (
                <button
                  type="button"
                  key={option.id}
                  className={`teacher-folder-card ${
                    homeworkFilter === option.id ? "is-active" : ""
                  }`}
                  onClick={() => setHomeworkFilter(option.id)}
                >
                  <span className="teacher-folder-icon">{option.icon}</span>
                  <span className="teacher-folder-copy">
                    <strong>{option.label}</strong>
                    <small>
                      {countMap[option.id] || 0}{" "}
                      {(countMap[option.id] || 0) === 1 ? "item" : "items"}
                    </small>
                  </span>
                  <span className="teacher-folder-count">
                    {countMap[option.id] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {showHomeworkComposer && (
            <form
              onSubmit={handleAddTask}
              className="teacher-composer-panel"
            >
              <div className="teacher-composer-header">
                <div>
                  <span className="teacher-composer-icon">📝</span>
                  <div>
                    <h3>Create a new assignment</h3>
                    <p>
                      It will be delivered to Class {currentClassName || "N/A"}
                      {currentSection ? `, Section ${currentSection}` : ""}.
                    </p>
                  </div>
                </div>

                <span className="teacher-class-target">
                  🎓 {studentsForCurrentClass.length} student
                  {studentsForCurrentClass.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="teacher-subject-summary">
                <span>📚 {availableSubjects.length} available subject{availableSubjects.length === 1 ? "" : "s"}</span>
                <span>🏫 Class {currentClassName || "N/A"}{currentSection ? ` · ${currentSection}` : ""}</span>
                {currentStream && <span>🎓 {currentStream}</span>}
                {currentAcademicYear && (
                  <span>🗓️ Academic year {currentAcademicYear}</span>
                )}
              </div>

              {subjectsMessage && (
                <div className="teacher-subject-warning">
                  {subjectsMessage}
                </div>
              )}

              <div className="teacher-composer-grid">
                <div className="teacher-field">
                  <label>Homework title</label>
                  <input
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="e.g. Algebra practice"
                    required
                  />
                </div>

                <div className="teacher-field">
                  <label>Subject</label>
                  <select
                    value={taskSubjectId}
                    onChange={(event) => {
                      const value = event.target.value;
                      const selected = availableSubjects.find(
                        (subject) =>
                          getSubjectOptionValue(subject) === value
                      );

                      setTaskSubjectId(value);
                      setTaskSubject(
                        selected ? getSubjectName(selected) : ""
                      );
                    }}
                    disabled={
                      loadingSubjects || availableSubjects.length === 0
                    }
                    required
                  >
                    <option value="">
                      {loadingSubjects
                        ? "Loading subjects…"
                        : availableSubjects.length === 0
                        ? "No subjects configured"
                        : "Select a subject"}
                    </option>

                    {availableSubjects.map((subject) => {
                      const name = getSubjectName(subject);
                      const code = getSubjectCode(subject);

                      return (
                        <option
                          key={getSubjectOptionValue(subject)}
                          value={getSubjectOptionValue(subject)}
                        >
                          {name}
                          {code ? ` (${code})` : ""}
                          {subject.type ? ` — ${subject.type}` : ""}
                        </option>
                      );
                    })}
                  </select>
                  <small className="teacher-subject-help">
                    Only subjects connected to this teacher and class are shown.
                  </small>
                </div>

                <div className="teacher-field">
                  <label>Due date</label>
                  <input
                    type="date"
                    value={taskDue}
                    onChange={(event) => setTaskDue(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="teacher-field teacher-field-wide">
                <label>Description and instructions</label>
                <textarea
                  value={taskDesc}
                  onChange={(event) => setTaskDesc(event.target.value)}
                  placeholder="Explain the task, expected work and any important instructions."
                  rows={5}
                />
              </div>

              <div className="teacher-upload-row">
                <label className="teacher-upload-box">
                  <input
                    key={taskFileKey}
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                    onChange={(event) =>
                      setTaskFile(event.target.files?.[0] || null)
                    }
                  />
                  <span className="teacher-upload-icon">📎</span>
                  <span>
                    <strong>
                      {taskFile ? taskFile.name : "Attach a homework file"}
                    </strong>
                    <small>
                      PDF, Word, PowerPoint, Excel, image or text — maximum
                      10 MB
                    </small>
                  </span>
                </label>

                <button
                  type="submit"
                  className="teacher-primary-action teacher-create-submit"
                  disabled={
                    !currentClassName ||
                    !selectedTaskSubject ||
                    loadingSubjects ||
                    savingTask
                  }
                >
                  {savingTask ? "Publishing…" : "Publish Homework"}
                </button>
              </div>
            </form>
          )}

          <div className="teacher-workflow-toolbar">
            <label className="teacher-search-control">
              <span>⌕</span>
              <input
                value={homeworkSearch}
                onChange={(event) =>
                  setHomeworkSearch(event.target.value)
                }
                placeholder="Search homework or subject"
              />
            </label>

            <select
              className="teacher-sort-control"
              value={homeworkSubjectFilter}
              onChange={(event) =>
                setHomeworkSubjectFilter(event.target.value)
              }
            >
              <option value="all">All subjects</option>
              {availableSubjects.map((subject) => (
                <option
                  key={`filter-${getSubjectOptionValue(subject)}`}
                  value={getSubjectOptionValue(subject)}
                >
                  {getSubjectName(subject)}
                  {getSubjectCode(subject)
                    ? ` (${getSubjectCode(subject)})`
                    : ""}
                </option>
              ))}
            </select>

            <select
              className="teacher-sort-control"
              value={homeworkSort}
              onChange={(event) =>
                setHomeworkSort(event.target.value)
              }
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="due-first">Due date first</option>
              <option value="title">Title A–Z</option>
            </select>

            <div className="teacher-view-toggle">
              <button
                type="button"
                className={
                  homeworkViewMode === "grid" ? "is-active" : ""
                }
                onClick={() => setHomeworkViewMode("grid")}
                aria-label="Grid view"
              >
                ▦
              </button>
              <button
                type="button"
                className={
                  homeworkViewMode === "list" ? "is-active" : ""
                }
                onClick={() => setHomeworkViewMode("list")}
                aria-label="List view"
              >
                ☷
              </button>
            </div>
          </div>

          {teacherTasks.length === 0 ? (
            <div className="teacher-professional-empty">
              <span>📚</span>
              <h3>No homework published yet</h3>
              <p>
                Create your first assignment and it will appear here and on
                the correct students’ homework page.
              </p>
              {!showHomeworkComposer && (
                <button
                  type="button"
                  className="teacher-primary-action"
                  onClick={() => setShowHomeworkComposer(true)}
                >
                  Create First Homework
                </button>
              )}
            </div>
          ) : visibleHomework.length === 0 ? (
            <div className="teacher-professional-empty">
              <span>🔎</span>
              <h3>No matching homework</h3>
              <p>Try a different folder, search word or sorting option.</p>
            </div>
          ) : (
            <div
              className={`teacher-homework-collection ${
                homeworkViewMode === "list" ? "is-list" : "is-grid"
              }`}
            >
              {visibleHomework.map((task, taskIndex) => {
                const taskKey = getTaskKey(task, taskIndex);
                const submissionList =
                  getTaskSubmissionList(task, taskIndex);
                const dueDate = task?.dueDate || task?.deadline;
                const pastDue = isDatePast(dueDate);
                const dueSoon = isDateDueSoon(dueDate);
                const recentlyAdded = isRecentlyCreated(
                  task?.createdAt || task?.date
                );
                const taskFilePath = getTaskFilePath(task);

                const statusClass = pastDue
                  ? "is-overdue"
                  : dueSoon
                  ? "is-due-soon"
                  : "is-open";

                const statusLabel = pastDue
                  ? "Past due"
                  : dueSoon
                  ? "Due soon"
                  : "Open";

                return (
                  <article
                    className={`teacher-homework-card ${statusClass}`}
                    key={taskKey}
                  >
                    <div className="teacher-homework-card-top">
                      <div className="teacher-homework-file-icon">
                        {taskFilePath ? "📄" : "📘"}
                      </div>

                      <div className="teacher-homework-card-heading">
                        <div className="teacher-homework-badges">
                          <span className={`teacher-status-pill ${statusClass}`}>
                            {statusLabel}
                          </span>
                          {recentlyAdded && (
                            <span className="teacher-status-pill is-new">
                              New
                            </span>
                          )}
                        </div>

                        <h3>{task.title || "Untitled Homework"}</h3>
                        <p>{getRecordSubjectName(task) || "No subject"}</p>
                      </div>
                    </div>

                    <p className="teacher-homework-description">
                      {task.description ||
                        "No description was added for this homework."}
                    </p>

                    <div className="teacher-homework-meta-grid">
                      <div>
                        <span>Due date</span>
                        <strong>{formatDisplayDate(dueDate)}</strong>
                      </div>
                      <div>
                        <span>Submissions</span>
                        <strong>
                          {submissionList.length}/
                          {studentsForCurrentClass.length}
                        </strong>
                      </div>
                      <div>
                        <span>Attachment</span>
                        <strong>{taskFilePath ? "Included" : "None"}</strong>
                      </div>
                    </div>

                    <div className="teacher-homework-progress">
                      <span
                        style={{
                          width: `${
                            studentsForCurrentClass.length > 0
                              ? Math.min(
                                  100,
                                  Math.round(
                                    (submissionList.length /
                                      studentsForCurrentClass.length) *
                                      100
                                  )
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    <div className="teacher-homework-card-actions">
                      <button
                        type="button"
                        className="teacher-soft-button"
                        onClick={() =>
                          setSelectedHomeworkTask({
                            task,
                            taskIndex,
                          })
                        }
                      >
                        View Details
                      </button>

                      <button
                        type="button"
                        className="teacher-primary-action"
                        onClick={() => {
                          setSubmissionFilter("all");
                          setSubmissionSearch(task.title || "");
                          openView("submissions");
                        }}
                      >
                        Review {submissionList.length} Submission
                        {submissionList.length === 1 ? "" : "s"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section
          id="submissions"
          style={styles.card}
          hidden={activeView !== "submissions"}
          className="teacher-workflow-section"
        >
          <div className="teacher-workflow-heading">
            <div>
              <span className="teacher-eyebrow">Student work</span>
              <h2>Homework Submissions</h2>
              <p>
                Review student submissions, provide feedback and marks.
              </p>
            </div>

            <div className="teacher-workflow-heading-actions">
              <button
                type="button"
                className="teacher-soft-button"
                onClick={fetchDashboardData}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "↻ Refresh"}
              </button>
              <button
                type="button"
                className="teacher-primary-action"
                onClick={() => openView("homework")}
              >
                View Homework
              </button>
            </div>
          </div>

          <div className="teacher-folder-grid teacher-submission-folders">
            {SUBMISSION_FILTER_OPTIONS.map((option) => {
              const count = submissionMetrics[option.id] || 0;

              return (
                <button
                  type="button"
                  key={option.id}
                  className={`teacher-folder-card ${
                    submissionFilter === option.id ? "is-active" : ""
                  }`}
                  onClick={() => setSubmissionFilter(option.id)}
                >
                  <span className="teacher-folder-icon">{option.icon}</span>
                  <span className="teacher-folder-copy">
                    <strong>{option.label}</strong>
                    <small>
                      {count} {count === 1 ? "submission" : "submissions"}
                    </small>
                  </span>
                  <span className="teacher-folder-count">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="teacher-workflow-toolbar">
            <label className="teacher-search-control">
              <span>⌕</span>
              <input
                value={submissionSearch}
                onChange={(event) =>
                  setSubmissionSearch(event.target.value)
                }
                placeholder="Search student, homework or subject"
              />
            </label>

            <div className="teacher-submission-summary">
              <span>
                <b>{submissionMetrics.new}</b> need review
              </span>
              <span>
                <b>{submissionMetrics.reviewed}</b> reviewed
              </span>
            </div>
          </div>

          {teacherTasks.length === 0 ? (
            <div className="teacher-professional-empty">
              <span>📚</span>
              <h3>No homework available</h3>
              <p>
                Publish homework first. Student submissions will then appear
                here automatically.
              </p>
              <button
                type="button"
                className="teacher-primary-action"
                onClick={() => openView("homework")}
              >
                Create Homework
              </button>
            </div>
          ) : submissionRows.length === 0 ? (
            <div className="teacher-professional-empty">
              <span>📥</span>
              <h3>No student submissions yet</h3>
              <p>
                Your published homework is visible to the selected class.
                Submitted work will appear here after students send it.
              </p>
            </div>
          ) : visibleSubmissionRows.length === 0 ? (
            <div className="teacher-professional-empty">
              <span>🔎</span>
              <h3>No matching submissions</h3>
              <p>Change the folder or clear the search box.</p>
            </div>
          ) : (
            <div className="teacher-submission-list">
              {visibleSubmissionRows.map((row) => {
                const {
                  task,
                  submission,
                  review,
                  reviewed,
                  late,
                } = row;

                const studentId =
                  getStudentIdFromSubmission(submission);

                const studentName =
                  submission.studentName ||
                  submission.student?.name ||
                  submission.studentId?.name ||
                  getStudentName(studentId);

                const studentEmail =
                  submission.studentEmail ||
                  submission.student?.email ||
                  submission.studentId?.email ||
                  getStudentEmail(studentId);

                const submissionFilePath =
                  getSubmissionFilePath(submission);

                return (
                  <article
                    className={`teacher-submission-row ${
                      reviewed ? "is-reviewed" : "is-new"
                    }`}
                    key={review.reviewKey}
                  >
                    <div className="teacher-submission-avatar">
                      {String(studentName || "S")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="teacher-submission-main">
                      <div className="teacher-submission-title-line">
                        <div>
                          <h3>{studentName || "Student"}</h3>
                          <p>{studentEmail || "No email available"}</p>
                        </div>

                        <div className="teacher-homework-badges">
                          {late && (
                            <span className="teacher-status-pill is-overdue">
                              Late
                            </span>
                          )}
                          <span
                            className={`teacher-status-pill ${
                              reviewed ? "is-reviewed" : "is-new"
                            }`}
                          >
                            {reviewed ? "Reviewed" : "Needs review"}
                          </span>
                        </div>
                      </div>

                      <div className="teacher-submission-task-line">
                        <strong>{task.title || "Untitled Homework"}</strong>
                        <span>•</span>
                        <span>{getRecordSubjectName(task) || "No subject"}</span>
                      </div>

                      <div className="teacher-submission-meta">
                        <span>
                          🕒{" "}
                          {formatDisplayDateTime(
                            submission.submittedAt ||
                              submission.createdAt
                          )}
                        </span>
                        <span>
                          {submissionFilePath
                            ? "📎 File attached"
                            : "📝 Text response"}
                        </span>
                        {hasValue(review.marks) && (
                          <span>🏅 Marks: {review.marks}</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="teacher-primary-action teacher-review-button"
                      onClick={() =>
                        setSelectedSubmissionContext(row)
                      }
                    >
                      {reviewed ? "Open Review" : "Review Work"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {selectedHomeworkTask &&
          (() => {
            const { task, taskIndex } = selectedHomeworkTask;
            const taskFilePath = getTaskFilePath(task);
            const submissionList =
              getTaskSubmissionList(task, taskIndex);
            const dueDate = task?.dueDate || task?.deadline;

            return (
              <div
                className="teacher-modal-backdrop"
                role="presentation"
                onMouseDown={() => setSelectedHomeworkTask(null)}
              >
                <section
                  className="teacher-detail-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Homework details"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="teacher-modal-header">
                    <div>
                      <span className="teacher-eyebrow">Homework details</span>
                      <h2>{task.title || "Untitled Homework"}</h2>
                      <p>{getRecordSubjectName(task) || "No subject"}</p>
                    </div>

                    <button
                      type="button"
                      className="teacher-modal-close"
                      onClick={() => setSelectedHomeworkTask(null)}
                      aria-label="Close homework details"
                    >
                      ×
                    </button>
                  </div>

                  <div className="teacher-modal-stat-grid">
                    <div>
                      <span>Class</span>
                      <strong>
                        {task.className || currentClassName}
                        {task.section || currentSection
                          ? ` · ${task.section || currentSection}`
                          : ""}
                      </strong>
                    </div>
                    <div>
                      <span>Due date</span>
                      <strong>{formatDisplayDate(dueDate)}</strong>
                    </div>
                    <div>
                      <span>Submissions</span>
                      <strong>
                        {submissionList.length}/
                        {studentsForCurrentClass.length}
                      </strong>
                    </div>
                  </div>

                  <div className="teacher-modal-section">
                    <h3>Instructions</h3>
                    <p>
                      {task.description ||
                        "No description was added for this homework."}
                    </p>
                  </div>

                  <div className="teacher-modal-section">
                    <h3>Teacher attachment</h3>
                    {taskFilePath ? (
                      <>
                        <p>{getFileNameFromPath(taskFilePath)}</p>
                        <FileActions
                          filePath={taskFilePath}
                          downloadLabel="Download Attachment"
                        />
                      </>
                    ) : (
                      <p style={styles.muted}>No file attached.</p>
                    )}
                  </div>

                  <div className="teacher-modal-footer">
                    <button
                      type="button"
                      className="teacher-soft-button"
                      onClick={() => setSelectedHomeworkTask(null)}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="teacher-primary-action"
                      onClick={() => {
                        setSubmissionFilter("all");
                        setSubmissionSearch(task.title || "");
                        setSelectedHomeworkTask(null);
                        openView("submissions");
                      }}
                    >
                      Open Submissions
                    </button>
                  </div>
                </section>
              </div>
            );
          })()}

        {selectedSubmissionContext &&
          (() => {
            const {
              task,
              submission,
              submissionIndex,
              review,
              reviewed,
              late,
            } = selectedSubmissionContext;

            const currentReview = getDisplaySubmissionReview(
              task,
              submission,
              submissionIndex
            );

            const studentId =
              getStudentIdFromSubmission(submission);

            const studentName =
              submission.studentName ||
              submission.student?.name ||
              submission.studentId?.name ||
              getStudentName(studentId);

            const studentEmail =
              submission.studentEmail ||
              submission.student?.email ||
              submission.studentId?.email ||
              getStudentEmail(studentId);

            const submissionFilePath =
              getSubmissionFilePath(submission);

            return (
              <div
                className="teacher-modal-backdrop"
                role="presentation"
                onMouseDown={() =>
                  setSelectedSubmissionContext(null)
                }
              >
                <section
                  className="teacher-detail-modal teacher-review-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Review student submission"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <div className="teacher-modal-header">
                    <div>
                      <span className="teacher-eyebrow">
                        {reviewed ? "Submission review" : "New submission"}
                      </span>
                      <h2>{studentName || "Student"}</h2>
                      <p>
                        {task.title || "Homework"} ·{" "}
                        {getRecordSubjectName(task) || "No subject"}
                      </p>
                    </div>

                    <button
                      type="button"
                      className="teacher-modal-close"
                      onClick={() =>
                        setSelectedSubmissionContext(null)
                      }
                      aria-label="Close submission review"
                    >
                      ×
                    </button>
                  </div>

                  <div className="teacher-review-student-strip">
                    <div className="teacher-submission-avatar">
                      {String(studentName || "S")
                        .trim()
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <strong>{studentName || "Student"}</strong>
                      <span>{studentEmail || "No email available"}</span>
                    </div>
                    <div className="teacher-homework-badges">
                      {late && (
                        <span className="teacher-status-pill is-overdue">
                          Late
                        </span>
                      )}
                      <span
                        className={`teacher-status-pill ${
                          reviewed ? "is-reviewed" : "is-new"
                        }`}
                      >
                        {currentReview.status || "Submitted"}
                      </span>
                    </div>
                  </div>

                  <div className="teacher-modal-section">
                    <h3>Student answer</h3>
                    <div className="teacher-answer-panel">
                      {submission.answer ||
                        submission.submissionText ||
                        "No written answer was submitted."}
                    </div>
                  </div>

                  <div className="teacher-modal-section">
                    <h3>Submitted attachment</h3>
                    {submissionFilePath ? (
                      <>
                        <p>
                          {getFileNameFromPath(submissionFilePath)}
                        </p>
                        <FileActions
                          filePath={submissionFilePath}
                          downloadLabel="Download Student File"
                        />
                      </>
                    ) : (
                      <p style={styles.muted}>
                        No student file was attached.
                      </p>
                    )}
                  </div>

                  <div className="teacher-review-form">
                    <div className="teacher-field">
                      <label>Marks</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="Enter marks"
                        value={currentReview.marks}
                        onChange={(event) =>
                          handleSubmissionReviewChange(
                            currentReview.reviewKey,
                            "marks",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="teacher-field">
                      <label>Review status</label>
                      <select
                        value={currentReview.status}
                        onChange={(event) =>
                          handleSubmissionReviewChange(
                            currentReview.reviewKey,
                            "status",
                            event.target.value
                          )
                        }
                      >
                        <option value="Submitted">Submitted</option>
                        <option value="Checked">Checked</option>
                        <option value="Needs Improvement">
                          Needs Improvement
                        </option>
                        <option value="Late">Late</option>
                      </select>
                    </div>

                    <div className="teacher-field teacher-field-wide">
                      <label>Feedback for the student</label>
                      <textarea
                        rows={4}
                        placeholder="Write clear and helpful feedback."
                        value={currentReview.feedback}
                        onChange={(event) =>
                          handleSubmissionReviewChange(
                            currentReview.reviewKey,
                            "feedback",
                            event.target.value
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="teacher-modal-footer">
                    <button
                      type="button"
                      className="teacher-soft-button"
                      onClick={() =>
                        setSelectedSubmissionContext(null)
                      }
                    >
                      Close
                    </button>

                    <button
                      type="button"
                      className="teacher-primary-action"
                      disabled={
                        savingReviewKey === currentReview.reviewKey
                      }
                      onClick={async () => {
                        await handleSaveSubmissionReview(
                          task,
                          submission,
                          submissionIndex
                        );
                      }}
                    >
                      {savingReviewKey === currentReview.reviewKey
                        ? "Saving Review…"
                        : "Save Marks & Feedback"}
                    </button>
                  </div>
                </section>
              </div>
            );
          })()}

        <section id="attendance" style={styles.card} hidden={activeView !== "attendance"}>
          <SectionHeader
            icon="🗓️"
            title="Attendance"
            subtitle="Mark student attendance for the selected class."
          />

          <form onSubmit={handleSaveAttendance}>
            <div style={styles.formGrid}>
              <input
                style={styles.input}
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                required
              />

              <button
                style={styles.secondaryButton}
                type="button"
                onClick={() => setAllAttendanceStatus("Present")}
              >
                Mark All Present
              </button>

              <button
                style={styles.dangerButton}
                type="button"
                onClick={() => setAllAttendanceStatus("Absent")}
              >
                Mark All Absent
              </button>

              <button
                style={styles.secondaryButton}
                type="button"
                onClick={() => setAllAttendanceStatus("Late")}
              >
                Mark All Late
              </button>
            </div>

            {studentsForCurrentClass.length === 0 ? (
              <div style={{ marginTop: 16 }}>
                <EmptyState text="No students found for this class." />
              </div>
            ) : (
              <div style={{ ...styles.tableWrap, marginTop: 16 }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Student</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {studentsForCurrentClass.map((student) => {
                      const studentId = getId(student);

                      return (
                        <tr key={studentId}>
                          <td style={styles.td}>
                            <b>{student.name || "N/A"}</b>
                          </td>
                          <td style={styles.td}>{student.email || "N/A"}</td>
                          <td style={styles.td}>
                            <select
                              style={styles.input}
                              value={attendanceMap[studentId] || "Present"}
                              onChange={(e) =>
                                handleAttendanceStatusChange(
                                  studentId,
                                  e.target.value
                                )
                              }
                            >
                              {ATTENDANCE_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <button
              style={{ ...styles.primaryButton, marginTop: 16 }}
              type="submit"
              disabled={
                !currentClassName ||
                studentsForCurrentClass.length === 0 ||
                savingAttendance
              }
            >
              {savingAttendance ? "Saving..." : "Save Attendance"}
            </button>
          </form>

          <hr style={{ margin: "24px 0", borderColor: "#e2e8f0" }} />

          <h3>Attendance Records</h3>

          {attendanceRecords.length === 0 ? (
            <EmptyState text="No attendance records found." />
          ) : (
            attendanceRecords.slice(0, 30).map((record, index) => (
              <div
                style={styles.listCard}
                key={record._id || record.id || record.localId || index}
              >
                <b>{getAttendanceStudentName(record)}</b>
                <p>Status: {record.status || "N/A"}</p>
                <p>Date: {getAttendanceDate(record)}</p>
                {record.savedMode === "local" && (
                  <p style={styles.muted}>Saved locally only</p>
                )}
              </div>
            ))
          )}
        </section>

        <section id="exams" style={styles.card} hidden={activeView !== "exams"}>
          <SectionHeader
            icon="📝"
            title="Create Exam"
            subtitle="Create exams and add marks for each student."
          />

          <form onSubmit={handleAddExam}>
            <div style={styles.formGrid}>
              <input
                style={styles.input}
                placeholder="Exam Title"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                required
              />

              <select
                style={styles.input}
                value={examSubjectId}
                onChange={(event) => {
                  const value = event.target.value;
                  const selected = availableSubjects.find(
                    (subject) =>
                      getSubjectOptionValue(subject) === value
                  );

                  setExamSubjectId(value);
                  setExamSubject(
                    selected ? getSubjectName(selected) : ""
                  );
                }}
                disabled={
                  loadingSubjects || availableSubjects.length === 0
                }
                required
              >
                <option value="">
                  {loadingSubjects
                    ? "Loading subjects…"
                    : availableSubjects.length === 0
                    ? "No subjects configured"
                    : "Select subject"}
                </option>

                {availableSubjects.map((subject) => (
                  <option
                    key={`exam-${getSubjectOptionValue(subject)}`}
                    value={getSubjectOptionValue(subject)}
                  >
                    {getSubjectName(subject)}
                    {getSubjectCode(subject)
                      ? ` (${getSubjectCode(subject)})`
                      : ""}
                  </option>
                ))}
              </select>

              <input
                style={styles.input}
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                required
              />

              <input
                style={styles.input}
                type="number"
                placeholder="Max Marks"
                value={examMaxMarks}
                onChange={(e) => setExamMaxMarks(e.target.value)}
                required
              />
            </div>

            <button
              style={{ ...styles.primaryButton, marginTop: 16 }}
              type="submit"
              disabled={
                !currentClassName ||
                !selectedExamSubject ||
                loadingSubjects ||
                savingExam
              }
            >
              {savingExam ? "Saving..." : "Add Exam"}
            </button>
          </form>

          <hr style={{ margin: "24px 0", borderColor: "#e2e8f0" }} />

          <h3>Exams and Marks Entry</h3>

          {exams.length === 0 ? (
            <EmptyState text="No exams added yet." />
          ) : (
            exams.map((exam, examIndex) => (
              <div style={styles.listCard} key={getExamId(exam) || examIndex}>
                <h3>{exam.title || "Untitled Exam"}</h3>

                {exam.savedMode === "local" && (
                  <p style={styles.muted}>Saved locally only</p>
                )}

                <p>
                  <b>Subject:</b> {getRecordSubjectName(exam) || "N/A"}
                </p>

                {exam.date && (
                  <p>
                    <b>Date:</b> {new Date(exam.date).toLocaleDateString()}
                  </p>
                )}

                <p>
                  <b>Max Marks:</b> {exam.maxMarks || exam.totalMarks || "N/A"}
                </p>

                {studentsForCurrentClass.length === 0 ? (
                  <EmptyState text="No students available for marks entry." />
                ) : (
                  <div style={{ ...styles.tableWrap, marginTop: 12 }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Student</th>
                          <th style={styles.th}>Marks</th>
                          <th style={styles.th}>Remarks</th>
                          <th style={styles.th}>Action</th>
                        </tr>
                      </thead>

                      <tbody>
                        {studentsForCurrentClass.map((student) => {
                          const markKey = getExamMarkKey(exam, student);
                          const mark = examMarks[markKey] || {};

                          return (
                            <tr key={markKey}>
                              <td style={styles.td}>
                                <b>{student.name || "N/A"}</b>
                                <br />
                                <small>{student.email || ""}</small>
                              </td>

                              <td style={styles.td}>
                                <input
                                  style={styles.input}
                                  type="number"
                                  placeholder="Marks"
                                  value={mark.obtainedMarks ?? ""}
                                  onChange={(e) =>
                                    handleExamMarkChange(
                                      markKey,
                                      "obtainedMarks",
                                      e.target.value
                                    )
                                  }
                                />
                              </td>

                              <td style={styles.td}>
                                <input
                                  style={styles.input}
                                  placeholder="Remarks"
                                  value={mark.remarks || ""}
                                  onChange={(e) =>
                                    handleExamMarkChange(
                                      markKey,
                                      "remarks",
                                      e.target.value
                                    )
                                  }
                                />
                              </td>

                              <td style={styles.td}>
                                <button
                                  style={styles.primaryButton}
                                  type="button"
                                  onClick={() => handleSaveExamMark(exam, student)}
                                  disabled={savingExamMarkKey === markKey}
                                >
                                  {savingExamMarkKey === markKey
                                    ? "Saving..."
                                    : "Save"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          )}
        </section>

        <section id="notices" style={styles.card} hidden={activeView !== "notices"}>
          <SectionHeader
            icon="📢"
            title="Create Notice"
            subtitle="Publish announcements for students in the selected class."
          />

          <form onSubmit={handleAddNotice}>
            <div style={styles.formGrid}>
              <input
                style={styles.input}
                placeholder="Notice Title"
                value={noticeTitle}
                onChange={(e) => setNoticeTitle(e.target.value)}
                required
              />

              <textarea
                style={styles.textarea}
                placeholder="Notice Content"
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                required
                rows={4}
              />
            </div>

            <button
              style={{ ...styles.primaryButton, marginTop: 16 }}
              type="submit"
              disabled={!currentClassName || savingNotice}
            >
              {savingNotice ? "Saving..." : "Add Notice"}
            </button>
          </form>

          <hr style={{ margin: "24px 0", borderColor: "#e2e8f0" }} />

          <h3>Notices</h3>

          {notices.length === 0 ? (
            <EmptyState text="No notices added yet." />
          ) : (
            notices.map((notice, index) => (
              <div
                style={styles.listCard}
                key={notice._id || notice.id || notice.localId || index}
              >
                <b>{notice.title || "Untitled Notice"}</b>
                <p>
                  {notice.message ||
                    notice.content ||
                    notice.description ||
                    "No content"}
                </p>
                {notice.savedMode === "local" && (
                  <p style={styles.muted}>Saved locally only</p>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </PortalLayout>
  );
}