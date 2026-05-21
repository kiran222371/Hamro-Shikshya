import { useEffect, useMemo, useState } from "react";
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
} from "../api";
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

const makeLocalId = () =>
  `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toArray = (res) => {
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.data?.data)) return res.data.data;
  if (Array.isArray(res?.data?.users)) return res.data.users;
  if (Array.isArray(res?.data?.students)) return res.data.students;
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

  const [taskTitle, setTaskTitle] = useState("");
  const [taskSubject, setTaskSubject] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [taskFile, setTaskFile] = useState(null);
  const [taskFileKey, setTaskFileKey] = useState(Date.now());

  const [attendanceDate, setAttendanceDate] = useState(getToday());
  const [attendanceMap, setAttendanceMap] = useState({});

  const [examTitle, setExamTitle] = useState("");
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
        },
      ];
    }

    return [];
  }, [teacher]);

  const currentClass =
    assignedClasses[Number(selectedClassIndex)] || assignedClasses[0] || null;

  const currentClassName = currentClass?.className || "";
  const currentSection = currentClass?.section || "";

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

  const dashboardStats = useMemo(() => {
    return {
      assignedClasses: assignedClasses.length,
      students: studentsForCurrentClass.length,
      tasks: tasks.length,
      exams: exams.length,
      notices: notices.length,
      attendanceRecords: attendanceRecords.length,
    };
  }, [
    assignedClasses.length,
    studentsForCurrentClass.length,
    tasks.length,
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

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
                fn: () => getTasksByClass(currentClassId, currentSection),
              },
              {
                fn: () => getTasksByClass(currentClassName, currentSection),
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
                  getAttendanceByClass(currentClassId, currentSection),
              },
              {
                fn: () =>
                  getAttendanceByClass(currentClassName, currentSection),
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
                fn: () => getExamsByClass(currentClassId, currentSection),
              },
              {
                fn: () => getExamsByClass(currentClassName, currentSection),
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
                fn: () => getNoticesByClass(currentClassId, currentSection),
              },
              {
                fn: () => getNoticesByClass(currentClassName, currentSection),
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

      setTasks(fetchedTasks);
      await loadSubmissionsForTasks(fetchedTasks);

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

    const taskPayload = {
      title: taskTitle.trim(),
      subject: taskSubject.trim(),
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
      setError("");
      setMessage("");

      await createTask(taskPayload);

      setTaskTitle("");
      setTaskSubject("");
      setTaskDesc("");
      setTaskDue("");
      setTaskFile(null);
      setTaskFileKey(Date.now());

      showSuccess("Homework created successfully.");
      fetchDashboardData();
    } catch (err) {
      console.log("Create task error:", err.response?.data || err);
      showError(err.response?.data?.message || "Failed to create homework.");
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

    if (Number(examMaxMarks) <= 0) {
      showError("Max marks must be greater than 0.");
      return;
    }

    const examData = {
      title: examTitle.trim(),
      subject: examSubject.trim(),
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
      subject: exam.subject || "",
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
    const reviewKey = getSubmissionReviewKey(task, submission, index);
    const localReview = submissionReviews[reviewKey] || {};

    return {
      reviewKey,
      marks:
        localReview.marks ??
        submission.marks ??
        submission.score ??
        submission.obtainedMarks ??
        "",
      feedback: localReview.feedback ?? submission.feedback ?? "",
      status: localReview.status ?? submission.status ?? "Submitted",
    };
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
    window.location.href = "/login";
  };

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
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
                  onClick={() => scrollToSection("homework")}
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

        <section style={styles.card}>
          {message && <div style={styles.success}>{message}</div>}
          {error && <div style={styles.error}>{error}</div>}

          {!currentClassName && (
            <div style={styles.error}>
              No class assigned to this teacher. Admin must assign class and
              section from the admin dashboard.
            </div>
          )}

          <div style={styles.quickNav}>
            <button style={styles.navButton} onClick={() => scrollToSection("profile")}>
              👤 Profile
            </button>
            <button style={styles.navButton} onClick={() => scrollToSection("students")}>
              👨‍🎓 Students
            </button>
            <button style={styles.navButton} onClick={() => scrollToSection("homework")}>
              📚 Homework
            </button>
            <button style={styles.navButton} onClick={() => scrollToSection("submissions")}>
              ✅ Submissions
            </button>
            <button style={styles.navButton} onClick={() => scrollToSection("attendance")}>
              🗓️ Attendance
            </button>
            <button style={styles.navButton} onClick={() => scrollToSection("exams")}>
              📝 Exams
            </button>
            <button style={styles.navButton} onClick={() => scrollToSection("notices")}>
              📢 Notices
            </button>
          </div>
        </section>

        <section style={styles.card}>
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

        <section id="profile" style={styles.card}>
          <SectionHeader
            icon="👤"
            title="Teacher Profile"
            subtitle="This makes the account look more like a real app profile system."
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

        <section style={styles.card}>
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

        <section id="students" style={styles.card}>
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

        <section id="homework" style={styles.card}>
          <SectionHeader
            icon="📚"
            title="Homework Creation"
            subtitle="Create homework with description, due date and optional file."
          />

          <form onSubmit={handleAddTask}>
            <div style={styles.formGrid}>
              <input
                style={styles.input}
                placeholder="Homework Title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
              />

              <input
                style={styles.input}
                placeholder="Subject"
                value={taskSubject}
                onChange={(e) => setTaskSubject(e.target.value)}
                required
              />

              <input
                style={styles.input}
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                required
              />

              <input
                key={taskFileKey}
                style={styles.input}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                onChange={(e) => setTaskFile(e.target.files?.[0] || null)}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <label style={styles.label}>Description / Instructions</label>
              <textarea
                style={styles.textarea}
                placeholder="Write homework instructions here"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                rows={4}
              />
            </div>

            {taskFile && (
              <p style={styles.muted}>
                Selected file: <b>{taskFile.name}</b>
              </p>
            )}

            <button
              style={{ ...styles.primaryButton, marginTop: 16 }}
              type="submit"
              disabled={!currentClassName}
            >
              Create Homework
            </button>
          </form>
        </section>

        <section id="submissions" style={styles.card}>
          <SectionHeader
            icon="✅"
            title="Homework Submissions and Feedback"
            subtitle="Check student submissions, download files, give marks and feedback."
          />

          {tasks.length === 0 ? (
            <EmptyState text="No homework added yet." />
          ) : (
            tasks.map((task, taskIndex) => {
              const taskKey = getTaskKey(task, taskIndex);
              const taskFilePath = getTaskFilePath(task);
              const submissionsList = submissionsByTask[taskKey] || [];

              return (
                <div style={styles.listCard} key={taskKey}>
                  <h3>{task.title || "Untitled Homework"}</h3>

                  <p>
                    <b>Subject:</b> {task.subject || "N/A"}
                  </p>

                  <p>
                    <b>Description:</b> {task.description || "No description"}
                  </p>

                  <p>
                    <b>Class:</b> {task.className || currentClassName}{" "}
                    <b>Section:</b> {task.section || currentSection || "N/A"}
                  </p>

                  {task.dueDate && (
                    <p>
                      <b>Due Date:</b>{" "}
                      {new Date(task.dueDate).toLocaleDateString()}
                    </p>
                  )}

                  {taskFilePath ? (
                    <>
                      <p>
                        <b>Teacher Attached File:</b>{" "}
                        {getFileNameFromPath(taskFilePath)}
                      </p>
                      <FileActions
                        filePath={taskFilePath}
                        downloadLabel="Download Homework File"
                      />
                    </>
                  ) : (
                    <p style={styles.muted}>No teacher file attached.</p>
                  )}

                  <hr style={{ margin: "22px 0", borderColor: "#e2e8f0" }} />

                  <h4>Student Submissions</h4>

                  {submissionsList.length === 0 ? (
                    <EmptyState text="No submissions yet." />
                  ) : (
                    submissionsList.map((submission, submissionIndex) => {
                      const submissionFilePath = getSubmissionFilePath(submission);
                      const review = getDisplaySubmissionReview(
                        task,
                        submission,
                        submissionIndex
                      );

                      return (
                        <div style={styles.listCard} key={review.reviewKey}>
                          <p>
                            <b>Student:</b>{" "}
                            {submission.studentName ||
                              submission.student?.name ||
                              submission.studentId?.name ||
                              getStudentName(getStudentIdFromSubmission(submission))}
                          </p>

                          <p>
                            <b>Email:</b>{" "}
                            {submission.studentEmail ||
                              submission.student?.email ||
                              submission.studentId?.email ||
                              getStudentEmail(getStudentIdFromSubmission(submission)) ||
                              "N/A"}
                          </p>

                          {(submission.answer || submission.submissionText) && (
                            <p>
                              <b>Answer:</b>{" "}
                              {submission.answer || submission.submissionText}
                            </p>
                          )}

                          {submission.submittedAt && (
                            <p>
                              <b>Submitted At:</b>{" "}
                              {new Date(submission.submittedAt).toLocaleString()}
                            </p>
                          )}

                          {submissionFilePath ? (
                            <>
                              <p>
                                <b>Submitted File:</b>{" "}
                                {getFileNameFromPath(submissionFilePath)}
                              </p>

                              <FileActions
                                filePath={submissionFilePath}
                                downloadLabel="Download Submitted File"
                              />
                            </>
                          ) : (
                            <p style={styles.muted}>No submitted file.</p>
                          )}

                          <div style={{ ...styles.formGrid, marginTop: 16 }}>
                            <input
                              style={styles.input}
                              type="number"
                              placeholder="Marks"
                              value={review.marks}
                              onChange={(e) =>
                                handleSubmissionReviewChange(
                                  review.reviewKey,
                                  "marks",
                                  e.target.value
                                )
                              }
                            />

                            <select
                              style={styles.input}
                              value={review.status}
                              onChange={(e) =>
                                handleSubmissionReviewChange(
                                  review.reviewKey,
                                  "status",
                                  e.target.value
                                )
                              }
                            >
                              <option value="Submitted">Submitted</option>
                              <option value="Checked">Checked</option>
                              <option value="Needs Improvement">Needs Improvement</option>
                              <option value="Late">Late</option>
                            </select>
                          </div>

                          <div style={{ marginTop: 16 }}>
                            <label style={styles.label}>Feedback</label>
                            <textarea
                              style={styles.textarea}
                              placeholder="Write feedback for student"
                              value={review.feedback}
                              onChange={(e) =>
                                handleSubmissionReviewChange(
                                  review.reviewKey,
                                  "feedback",
                                  e.target.value
                                )
                              }
                              rows={3}
                            />
                          </div>

                          <button
                            style={{ ...styles.primaryButton, marginTop: 14 }}
                            type="button"
                            onClick={() =>
                              handleSaveSubmissionReview(
                                task,
                                submission,
                                submissionIndex
                              )
                            }
                            disabled={savingReviewKey === review.reviewKey}
                          >
                            {savingReviewKey === review.reviewKey
                              ? "Saving..."
                              : "Save Marks and Feedback"}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })
          )}
        </section>

        <section id="attendance" style={styles.card}>
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

        <section id="exams" style={styles.card}>
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

              <input
                style={styles.input}
                placeholder="Subject"
                value={examSubject}
                onChange={(e) => setExamSubject(e.target.value)}
                required
              />

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
              disabled={!currentClassName || savingExam}
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
                  <b>Subject:</b> {exam.subject || "N/A"}
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

        <section id="notices" style={styles.card}>
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
    </main>
  );
}