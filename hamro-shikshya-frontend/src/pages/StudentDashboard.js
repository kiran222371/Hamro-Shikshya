import { useEffect, useMemo, useState } from "react";
import "../styles/App.css";
import {
  buildFileUrl,
  getAttendanceByStudent,
  getExamsByClass,
  getNoticesByClass,
  getResultsByStudent,
  getSubmissionsByStudent,
  getTasksByClass,
  getTimetableByClass,
  submitHomework,
} from "../api";

const emptyArray = [];

const WEEK_ORDER = {
  sunday: 1,
  monday: 2,
  tuesday: 3,
  wednesday: 4,
  thursday: 5,
  friday: 6,
  saturday: 7,
};

const readLoggedUser = () => {
  try {
    const savedUser = localStorage.getItem("user");

    if (!savedUser || savedUser === "undefined" || savedUser === "null") {
      return {};
    }

    return JSON.parse(savedUser);
  } catch {
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
  return exam?.date || exam?.examDate || exam?.startDate || exam?.createdAt || "";
};

const getRoutineDayNumber = (item) => {
  const day = String(item?.day || item?.weekDay || "").trim().toLowerCase();
  return WEEK_ORDER[day] || 99;
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
  const [tasks, setTasks] = useState(emptyArray);
  const [submissions, setSubmissions] = useState(emptyArray);
  const [exams, setExams] = useState(emptyArray);
  const [notices, setNotices] = useState(emptyArray);
  const [attendance, setAttendance] = useState(emptyArray);
  const [results, setResults] = useState(emptyArray);
  const [timetable, setTimetable] = useState(emptyArray);

  const [answers, setAnswers] = useState({});
  const [files, setFiles] = useState({});
  const [fileInputKeys, setFileInputKeys] = useState({});
  const [submitting, setSubmitting] = useState({});

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

  const schoolId = String(
    loggedUser.schoolId || loggedUser.school?._id || ""
  ).trim();

  const studentInitial = studentName ? studentName.charAt(0).toUpperCase() : "S";

  const getMySubmission = (task) => {
    const taskId = String(task?._id || task?.id || "");

    const fromTask = Array.isArray(task?.submissions)
      ? task.submissions.find((submission) => {
          return getStudentIdFromSubmission(submission) === String(studentId);
        })
      : null;

    if (fromTask) return fromTask;

    const fromSubmissionList = submissions.find((item) => {
      return getTaskIdFromSubmission(item) === taskId;
    });

    if (fromSubmissionList?.submission) return fromSubmissionList.submission;

    return fromSubmissionList || null;
  };

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
  }, [tasks, submissions]);

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
      const aDate = new Date(a?.dueDate || a?.deadline || a?.createdAt || 0);
      const bDate = new Date(b?.dueDate || b?.deadline || b?.createdAt || 0);

      return aDate.getTime() - bDate.getTime();
    });
  }, [tasks]);

  const pendingTasks = useMemo(() => {
    return sortedTasks
      .filter((task) => !getMySubmission(task))
      .slice(0, 3);
  }, [sortedTasks, submissions]);

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
    return [...timetable].sort((a, b) => {
      const dayDiff = getRoutineDayNumber(a) - getRoutineDayNumber(b);

      if (dayDiff !== 0) return dayDiff;

      return String(a?.startTime || a?.time || "").localeCompare(
        String(b?.startTime || b?.time || "")
      );
    });
  }, [timetable]);

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
        getTimetableByClass(className, section),
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

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.replace("/login");
  };

  const styles = {
    hero: {
      background:
        "radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 30%), linear-gradient(135deg, #0f8cff 0%, #48b8f6 100%)",
      color: "#ffffff",
      borderRadius: 28,
      padding: 28,
      marginBottom: 24,
      boxShadow: "0 22px 55px rgba(15, 140, 255, 0.22)",
      display: "grid",
      gridTemplateColumns: "1.4fr 0.8fr",
      gap: 22,
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
    },
    heroText: {
      margin: 0,
      color: "rgba(255,255,255,0.92)",
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
    quickLinks: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 18,
    },
    quickLink: {
      background: "#ffffff",
      color: "#0f8cff",
      borderRadius: 999,
      padding: "10px 14px",
      fontWeight: 900,
      fontSize: 14,
      textDecoration: "none",
      boxShadow: "0 8px 18px rgba(15, 23, 42, 0.08)",
    },
    actionRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 18,
    },
    statsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
      gap: 16,
      marginBottom: 24,
    },
    twoColumn: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      gap: 18,
      alignItems: "start",
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

  return (
    <main className="dashboard-page">
      <section style={styles.hero}>
        <div>
          <div style={styles.avatar}>{studentInitial}</div>

          <h1 style={styles.heroTitle}>Welcome back, {studentName}</h1>

          <p style={styles.heroText}>
            This is your learning space. Check homework, notices, exams,
            attendance, results, and timetable from one simple dashboard.
          </p>

          <div style={styles.quickLinks}>
            <a style={styles.quickLink} href="#homework">
              Homework
            </a>
            <a style={styles.quickLink} href="#notices">
              Notices
            </a>
            <a style={styles.quickLink} href="#exams">
              Exams
            </a>
            <a style={styles.quickLink} href="#results">
              Results
            </a>
            <a style={styles.quickLink} href="#attendance">
              Attendance
            </a>
            <a style={styles.quickLink} href="#timetable">
              Timetable
            </a>
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
            <p style={{ margin: "0 0 6px", opacity: 0.9 }}>Class</p>
            <h2 style={{ margin: 0, fontSize: 28 }}>
              {className || "Missing"} {section ? `- ${section}` : ""}
            </h2>
          </div>

          <div style={styles.heroMetric}>
            <p style={{ margin: "0 0 6px", opacity: 0.9 }}>Attendance</p>
            <h2 style={{ margin: 0, fontSize: 28 }}>
              {attendanceSummary.percentage}%
            </h2>
          </div>

          <div style={{ ...styles.heroMetric, marginBottom: 0 }}>
            <p style={{ margin: "0 0 6px", opacity: 0.9 }}>Pending Homework</p>
            <h2 style={{ margin: 0, fontSize: 28 }}>{homeworkSummary.pending}</h2>
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

      <section style={styles.statsGrid}>
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

      <section style={styles.twoColumn}>
        <section className="dashboard-card">
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

        <section className="dashboard-card">
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
                        <b>Due:</b>{" "}
                        {formatDate(task.dueDate || task.deadline)}
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
        className="dashboard-card"
        style={{ marginTop: 24 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div>
            <h2 className="card-title">Homework / Tasks</h2>
            <p className="dashboard-muted" style={{ marginTop: -8 }}>
              Submit your homework answers and attached files here.
            </p>
          </div>

          <div>
            <StatusBadge type="success">
              Submitted: {homeworkSummary.submitted}
            </StatusBadge>
            <StatusBadge type="warning">Pending: {homeworkSummary.pending}</StatusBadge>
            {homeworkSummary.late > 0 && (
              <StatusBadge type="danger">Late: {homeworkSummary.late}</StatusBadge>
            )}
          </div>
        </div>

        {!loading && !error && sortedTasks.length === 0 && (
          <EmptyState
            title="No homework found"
            text="No homework or tasks have been assigned to your class yet."
          />
        )}

        {!loading &&
          !error &&
          sortedTasks.map((task, index) => {
            const taskId = String(task._id || task.id || index);
            const mySubmission = getMySubmission(task);
            const submitted = Boolean(mySubmission);

            const taskFilePath = getTaskFilePath(task);
            const taskFileUrl = buildFileUrl(taskFilePath);
            const taskFileName = getFileName(taskFilePath);

            const submittedFilePath = getSubmissionFilePath(mySubmission);
            const submittedFileUrl = buildFileUrl(submittedFilePath);
            const submittedFileName = getFileName(submittedFilePath);

            const dueDate = task.dueDate || task.deadline || "";
            const late = !submitted && isPastDue(dueDate);

            return (
              <div className="list-card" key={taskId}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3>{task.title || task.taskTitle || "Homework"}</h3>

                    <div>
                      {submitted ? (
                        <StatusBadge type="success">Submitted</StatusBadge>
                      ) : late ? (
                        <StatusBadge type="danger">Late</StatusBadge>
                      ) : (
                        <StatusBadge type="warning">Pending</StatusBadge>
                      )}

                      {(task.subject || task.subjectName) && (
                        <StatusBadge type="purple">
                          {task.subject || task.subjectName}
                        </StatusBadge>
                      )}
                    </div>
                  </div>

                  <div
                    style={{
                      background: "#f8fbff",
                      border: "1px solid #e4edf7",
                      borderRadius: 14,
                      padding: "10px 14px",
                      minWidth: 130,
                      textAlign: "center",
                    }}
                  >
                    <span className="dashboard-muted">Due Date</span>
                    <br />
                    <b>{formatDate(dueDate)}</b>
                  </div>
                </div>

                <p>
                  <b>Description:</b>{" "}
                  {task.description || task.instructions || "No description"}
                </p>

                <p>
                  <b>Class:</b>{" "}
                  {task.className || task.class || className || "N/A"}{" "}
                  <b>Section:</b> {task.section || section || "N/A"}
                </p>

                {taskFileUrl && (
                  <div className="file-box">
                    <p>
                      <b>Teacher Attached File:</b> {taskFileName}
                    </p>

                    <div style={styles.buttonRow}>
                      <a
                        className="primary-btn"
                        href={taskFileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open File
                      </a>

                      <a
                        className="secondary-btn"
                        href={taskFileUrl}
                        download={taskFileName}
                      >
                        Download File
                      </a>
                    </div>
                  </div>
                )}

                {submitted ? (
                  <div className="success-box">
                    <p>
                      <b>Status:</b>{" "}
                      {statusLabel(
                        mySubmission.status || mySubmission.submissionStatus
                      )}
                    </p>

                    {(hasValue(mySubmission.marks) ||
                      hasValue(mySubmission.score)) && (
                      <p>
                        <b>Marks:</b> {mySubmission.marks || mySubmission.score}
                      </p>
                    )}

                    {mySubmission.feedback && (
                      <p>
                        <b>Teacher Feedback:</b> {mySubmission.feedback}
                      </p>
                    )}

                    {(mySubmission.answer || mySubmission.submissionText) && (
                      <p>
                        <b>Your Answer:</b>{" "}
                        {mySubmission.answer || mySubmission.submissionText}
                      </p>
                    )}

                    {submittedFileUrl && (
                      <div>
                        <p>
                          <b>Your Submitted File:</b> {submittedFileName}
                        </p>

                        <div style={styles.buttonRow}>
                          <a
                            className="primary-btn"
                            href={submittedFileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Open Submitted File
                          </a>

                          <a
                            className="secondary-btn"
                            href={submittedFileUrl}
                            download={submittedFileName}
                          >
                            Download Submitted File
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ marginTop: 14 }}>
                    <div className="auth-form-group">
                      <label>Your Answer</label>
                      <textarea
                        className="auth-input"
                        placeholder="Write your homework answer here..."
                        value={answers[taskId] || ""}
                        onChange={(event) =>
                          handleAnswerChange(taskId, event.target.value)
                        }
                        rows={4}
                      />
                    </div>

                    <div className="auth-form-group">
                      <label>Upload File</label>
                      <input
                        key={fileInputKeys[taskId] || taskId}
                        className="auth-input"
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                        onChange={(event) =>
                          handleFileChange(
                            taskId,
                            event.target.files?.[0] || null
                          )
                        }
                      />
                    </div>

                    {files[taskId] && (
                      <p className="dashboard-muted">
                        Selected file: <b>{files[taskId].name}</b>
                      </p>
                    )}

                    <button
                      className="primary-btn"
                      type="button"
                      disabled={Boolean(submitting[taskId])}
                      onClick={() => handleSubmitHomework(taskId)}
                    >
                      {submitting[taskId] ? "Submitting..." : "Submit Homework"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
      </section>

      <section style={styles.twoColumn}>
        <section id="notices" className="dashboard-card">
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

        <section id="exams" className="dashboard-card">
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

      <section style={styles.twoColumn}>
        <section id="results" className="dashboard-card">
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

        <section id="attendance" className="dashboard-card">
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
                <StatusBadge type="danger">Absent {attendanceSummary.absent}</StatusBadge>
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

      <section id="timetable" className="dashboard-card">
        <h2 className="card-title">Weekly Timetable</h2>

        {sortedTimetable.length === 0 ? (
          <EmptyState
            title="No timetable found"
            text="Your weekly timetable has not been added yet."
          />
        ) : (
          <div style={styles.twoColumn}>
            {sortedTimetable.map((item, index) => (
              <div className="list-card" key={getRecordId(item, index)}>
                <StatusBadge type="info">
                  {item.day || item.weekDay || item.date || "Routine"}
                </StatusBadge>

                <h3>{item.subject || item.subjectName || "Subject"}</h3>

                <p>
                  <b>Teacher:</b> {item.teacherName || item.teacher || "N/A"}
                </p>

                <p>
                  <b>Time:</b>{" "}
                  {item.time ||
                    `${item.startTime || "N/A"} - ${item.endTime || "N/A"}`}
                </p>

                {item.room && (
                  <p>
                    <b>Room:</b> {item.room}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}