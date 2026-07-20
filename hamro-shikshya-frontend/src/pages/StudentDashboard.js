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

const readLoggedUser = () => {
  try {
    const savedUser = localStorage.getItem("user");
    return savedUser ? JSON.parse(savedUser) : {};
  } catch {
    return {};
  }
};

const getRecordId = (item, fallback = "") => {
  return String(item?._id || item?.id || item?.taskId || item?.homeworkId || fallback);
};

const toArray = (res) => {
  const body = res?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.tasks)) return body.tasks;
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
  const schoolId = String(loggedUser.schoolId || loggedUser.school?._id || "").trim();

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

  const recentAttendance = useMemo(() => {
    return sortByDateDesc(attendance, ["date", "attendanceDate", "createdAt"]).slice(
      0,
      8
    );
  }, [attendance]);

  const recentResults = useMemo(() => {
    return sortByDateDesc(results, ["date", "examDate", "createdAt"]).slice(0, 8);
  }, [results]);

  const recentNotices = useMemo(() => {
    return sortByDateDesc(notices, ["createdAt", "date"]).slice(0, 8);
  }, [notices]);

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
    window.location.href = "/login";
  };

  const styles = {
    grid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: "16px",
    },
    statCard: {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "16px",
      padding: "16px",
      boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
    },
    statNumber: {
      fontSize: "28px",
      fontWeight: "800",
      margin: "8px 0 0",
      color: "#0f172a",
    },
    sectionGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
      gap: "18px",
      alignItems: "start",
    },
    smallBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 10px",
      borderRadius: "999px",
      background: "#eef2ff",
      color: "#3730a3",
      fontSize: "12px",
      fontWeight: "700",
      marginRight: "8px",
      marginBottom: "8px",
    },
    dangerBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 10px",
      borderRadius: "999px",
      background: "#fee2e2",
      color: "#991b1b",
      fontSize: "12px",
      fontWeight: "700",
      marginRight: "8px",
      marginBottom: "8px",
    },
    successBadge: {
      display: "inline-flex",
      alignItems: "center",
      padding: "5px 10px",
      borderRadius: "999px",
      background: "#dcfce7",
      color: "#166534",
      fontSize: "12px",
      fontWeight: "700",
      marginRight: "8px",
      marginBottom: "8px",
    },
    buttonRow: {
      display: "flex",
      gap: "10px",
      flexWrap: "wrap",
      marginTop: "10px",
    },
  };

  return (
    <main className="dashboard-page">
      <section className="dashboard-card dashboard-header">
        <div>
          <h1 className="dashboard-main-title">Student Dashboard</h1>

          <p className="dashboard-muted">
            Welcome back, <b>{studentName}</b>
          </p>

          <p className="dashboard-muted">
            Class: <b>{className || "Missing"}</b>{" "}
            Section: <b>{section || "Missing"}</b>
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button className="primary-btn" onClick={fetchStudentData}>
            Refresh
          </button>

          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </section>

      {(loading || message || error) && (
        <section className="dashboard-card">
          {loading && <p>Loading student dashboard data...</p>}

          {message && <div className="success-box">{message}</div>}

          {error && <div className="error-box">{error}</div>}
        </section>
      )}

      <section style={styles.grid}>
        <div style={styles.statCard}>
          <span className="dashboard-muted">Total Homework</span>
          <p style={styles.statNumber}>{homeworkSummary.total}</p>
        </div>

        <div style={styles.statCard}>
          <span className="dashboard-muted">Submitted</span>
          <p style={styles.statNumber}>{homeworkSummary.submitted}</p>
        </div>

        <div style={styles.statCard}>
          <span className="dashboard-muted">Pending</span>
          <p style={styles.statNumber}>{homeworkSummary.pending}</p>
        </div>

        <div style={styles.statCard}>
          <span className="dashboard-muted">Attendance</span>
          <p style={styles.statNumber}>{attendanceSummary.percentage}%</p>
        </div>

        <div style={styles.statCard}>
          <span className="dashboard-muted">Notices</span>
          <p style={styles.statNumber}>{notices.length}</p>
        </div>

        <div style={styles.statCard}>
          <span className="dashboard-muted">Results</span>
          <p style={styles.statNumber}>{results.length}</p>
        </div>
      </section>

      <section style={styles.sectionGrid}>
        <section className="dashboard-card">
          <h2 className="card-title">My Profile</h2>

          <p>
            <b>Name:</b> {studentName}
          </p>

          <p>
            <b>Email:</b> {loggedUser.email || "N/A"}
          </p>

          <p>
            <b>Class:</b> {className || "N/A"}
          </p>

          <p>
            <b>Section:</b> {section || "N/A"}
          </p>

          <p>
            <b>Role:</b> Student
          </p>
        </section>

        <section className="dashboard-card">
          <h2 className="card-title">Attendance Summary</h2>

          <p>
            <b>Attendance Percentage:</b> {attendanceSummary.percentage}%
          </p>

          <p>
            <b>Total Records:</b> {attendanceSummary.total}
          </p>

          <p>
            <b>Present:</b> {attendanceSummary.present}
          </p>

          <p>
            <b>Late:</b> {attendanceSummary.late}
          </p>

          <p>
            <b>Absent:</b> {attendanceSummary.absent}
          </p>
        </section>
      </section>

      <section className="dashboard-card">
        <h2 className="card-title">Homework / Tasks</h2>

        {!loading && !error && sortedTasks.length === 0 && (
          <p>No homework or tasks found for your class.</p>
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
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h3>{task.title || task.taskTitle || "Homework"}</h3>

                    <div>
                      {submitted ? (
                        <span style={styles.successBadge}>Submitted</span>
                      ) : late ? (
                        <span style={styles.dangerBadge}>Late</span>
                      ) : (
                        <span style={styles.smallBadge}>Pending</span>
                      )}

                      {(task.subject || task.subjectName) && (
                        <span style={styles.smallBadge}>
                          {task.subject || task.subjectName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <b>Due:</b> {formatDate(dueDate)}
                  </div>
                </div>

                <p>
                  <b>Description:</b>{" "}
                  {task.description || task.instructions || "No description"}
                </p>

                <p>
                  <b>Class:</b> {task.className || task.class || className || "N/A"}{" "}
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
                        className="primary-btn"
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
                      {statusLabel(mySubmission.status || mySubmission.submissionStatus)}
                    </p>

                    {(mySubmission.marks || mySubmission.score) && (
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
                            className="primary-btn"
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
                  <>
                    <textarea
                      className="auth-input"
                      placeholder="Write your homework answer here..."
                      value={answers[taskId] || ""}
                      onChange={(event) =>
                        handleAnswerChange(taskId, event.target.value)
                      }
                      rows={4}
                    />

                    <input
                      key={fileInputKeys[taskId] || taskId}
                      className="auth-input"
                      type="file"
                      accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"
                      onChange={(event) =>
                        handleFileChange(taskId, event.target.files[0] || null)
                      }
                    />

                    {files[taskId] && (
                      <p className="dashboard-muted">
                        Selected file: <b>{files[taskId].name}</b>
                      </p>
                    )}

                    <button
                      className="primary-btn"
                      disabled={Boolean(submitting[taskId])}
                      onClick={() => handleSubmitHomework(taskId)}
                    >
                      {submitting[taskId] ? "Submitting..." : "Submit Homework"}
                    </button>
                  </>
                )}
              </div>
            );
          })}
      </section>

      <section style={styles.sectionGrid}>
        <section className="dashboard-card">
          <h2 className="card-title">Latest Notices</h2>

          {recentNotices.length === 0 ? (
            <p>No notices found for your class.</p>
          ) : (
            recentNotices.map((notice, index) => (
              <div className="list-card" key={getRecordId(notice, index)}>
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

        <section className="dashboard-card">
          <h2 className="card-title">Upcoming Exams</h2>

          {exams.length === 0 ? (
            <p>No exams found for your class.</p>
          ) : (
            exams.map((exam, index) => (
              <div className="list-card" key={getRecordId(exam, index)}>
                <h3>{exam.title || exam.examTitle || exam.name || "Exam"}</h3>

                <p>
                  <b>Subject:</b> {exam.subject || "N/A"}
                </p>

                <p>
                  <b>Date:</b> {formatDate(exam.date || exam.examDate)}
                </p>

                <p>
                  <b>Max Marks:</b> {exam.maxMarks || exam.totalMarks || "N/A"}
                </p>
              </div>
            ))
          )}
        </section>
      </section>

      <section style={styles.sectionGrid}>
        <section className="dashboard-card">
          <h2 className="card-title">My Results</h2>

          {recentResults.length === 0 ? (
            <p>No result records found yet.</p>
          ) : (
            recentResults.map((result, index) => (
              <div className="list-card" key={getRecordId(result, index)}>
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

        <section className="dashboard-card">
          <h2 className="card-title">Recent Attendance</h2>

          {recentAttendance.length === 0 ? (
            <p>No attendance records found yet.</p>
          ) : (
            recentAttendance.map((record, index) => {
              const status = record.status || record.attendanceStatus || "N/A";

              return (
                <div className="list-card" key={getRecordId(record, index)}>
                  <p>
                    <b>Date:</b> {formatDate(record.date || record.attendanceDate)}
                  </p>

                  <p>
                    <b>Status:</b> {status}
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

      <section className="dashboard-card">
        <h2 className="card-title">Weekly Timetable</h2>

        {timetable.length === 0 ? (
          <p>No timetable found for your class yet.</p>
        ) : (
          <div style={styles.sectionGrid}>
            {timetable.map((item, index) => (
              <div className="list-card" key={getRecordId(item, index)}>
                <h3>{item.day || item.weekDay || item.date || "Class Routine"}</h3>

                <p>
                  <b>Subject:</b> {item.subject || item.subjectName || "N/A"}
                </p>

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