import axios from "axios";

const DEPLOYED_BACKEND_API_URL =
  "https://hamro-shikshya-backend.onrender.com/api";

const cleanText = (value) => String(value ?? "").trim();

const getEnvValue = (key, fallback = "") => {
  try {
    if (
      typeof process !== "undefined" &&
      process.env &&
      process.env[key]
    ) {
      return process.env[key];
    }

    return fallback;
  } catch {
    return fallback;
  }
};

const removeTrailingSlash = (value) =>
  cleanText(value).replace(/\/+$/, "");

const getBrowserHostname = () => {
  try {
    return window.location.hostname;
  } catch {
    return "";
  }
};

const isLocalFrontend = () => {
  const hostname = getBrowserHostname();

  return (
    !hostname ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  );
};

const getDefaultApiUrl = () => {
  if (isLocalFrontend()) {
    return "http://localhost:5000/api";
  }

  return DEPLOYED_BACKEND_API_URL;
};

const rawApiUrl =
  getEnvValue("REACT_APP_API_URL") ||
  getDefaultApiUrl();

export const API_URL =
  removeTrailingSlash(rawApiUrl);

export const API_BASE_URL =
  API_URL.replace(/\/api\/?$/, "");

export const GOOGLE_MAPS_API_KEY =
  getEnvValue("REACT_APP_GOOGLE_MAPS_API_KEY") ||
  "";

export const getGoogleMapsScriptUrl = (
  libraries = "places"
) => {
  if (!GOOGLE_MAPS_API_KEY) {
    return "";
  }

  const params = new URLSearchParams({
    key: GOOGLE_MAPS_API_KEY,
    libraries,
    v: "weekly",
  });

  return `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
};



const readLocalStorage = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors.
  }
};

const removeLocalStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage errors.
  }
};

export const getStoredUser = () => {
  const savedUser = readLocalStorage("user");

  if (
    !savedUser ||
    savedUser === "undefined" ||
    savedUser === "null"
  ) {
    return {};
  }

  try {
    return JSON.parse(savedUser);
  } catch {
    return {};
  }
};

const extractSchoolId = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return cleanText(value);
  }

  if (typeof value === "object") {
    return cleanText(
      value._id ||
        value.id ||
        value.schoolId
    );
  }

  return cleanText(value);
};

export const getCurrentSchoolId = () => {
  const user = getStoredUser();

  return (
    extractSchoolId(user.schoolId) ||
    extractSchoolId(
      readLocalStorage("schoolId")
    )
  );
};

export const getAuthToken = () =>
  cleanText(readLocalStorage("token"));

export const saveAuthSession = (
  token,
  user
) => {
  const cleanToken = cleanText(token);

  if (cleanToken) {
    writeLocalStorage("token", cleanToken);
  }

  if (user && typeof user === "object") {
    writeLocalStorage(
      "user",
      JSON.stringify(user)
    );

    const schoolId = extractSchoolId(
      user.schoolId
    );

    if (schoolId) {
      writeLocalStorage(
        "schoolId",
        schoolId
      );
    }
  }
};

export const clearAuthSession = () => {
  removeLocalStorage("token");
  removeLocalStorage("user");
  removeLocalStorage("schoolId");
};

const isPublicAuthRequest = (url = "") => {
  const cleanUrl = String(url || "")
    .split("?")[0]
    .replace(/\/+$/, "");

  const publicPaths = [
    "/auth/signup",
    "/auth/register",
    "/auth/login",
    "/auth/signin",
  ];

  return publicPaths.some(
    (path) =>
      cleanUrl === path ||
      cleanUrl.endsWith(path)
  );
};

const addSchoolIdToRequest = (config) => {
  const schoolId = getCurrentSchoolId();

  if (
    !schoolId ||
    isPublicAuthRequest(config.url)
  ) {
    return config;
  }

  const method = String(
    config.method || "get"
  ).toLowerCase();

  if (
    method === "get" ||
    method === "delete"
  ) {
    config.params = {
      ...(config.params || {}),
    };

    const urlAlreadyHasSchoolId =
      /[?&]schoolId=/.test(
        String(config.url || "")
      );

    if (
      !config.params.schoolId &&
      !urlAlreadyHasSchoolId
    ) {
      config.params.schoolId = schoolId;
    }

    return config;
  }

  if (
    typeof FormData !== "undefined" &&
    config.data instanceof FormData
  ) {
    if (!config.data.has("schoolId")) {
      config.data.append(
        "schoolId",
        schoolId
      );
    }

    return config;
  }

  if (
    config.data &&
    typeof config.data === "object" &&
    !Array.isArray(config.data)
  ) {
    if (!config.data.schoolId) {
      config.data = {
        ...config.data,
        schoolId,
      };
    }
  }

  return config;
};

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();

    config.headers =
      config.headers || {};

    if (token) {
      config.headers.Authorization =
        `Bearer ${token}`;
    }

    return addSchoolIdToRequest(config);
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.userMessage =
        `Cannot connect to backend server. Current API URL: ${API_URL}`;
    }

    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (
  error,
  fallbackMessage = "Request failed."
) => {
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }

  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  if (error?.userMessage) {
    return error.userMessage;
  }

  if (error?.message === "Network Error") {
    return `Network error. Frontend cannot reach backend at ${API_URL}`;
  }

  return (
    error?.message ||
    fallbackMessage
  );
};

const withSchoolId = (
  data = {},
  schoolId = ""
) => {
  const resolvedSchoolId =
    extractSchoolId(schoolId) ||
    extractSchoolId(data.schoolId) ||
    getCurrentSchoolId();

  return {
    ...data,
    ...(resolvedSchoolId
      ? { schoolId: resolvedSchoolId }
      : {}),
  };
};

export const buildClassId = (
  className,
  section = ""
) => {
  const cleanClassName = cleanText(className);
  const cleanSection = cleanText(section);

  if (!cleanClassName) {
    return "";
  }

  return `${cleanClassName}-${cleanSection || "all"}`;
};

const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(
    ([key, value]) => {
      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        searchParams.append(key, value);
      }
    }
  );

  const query = searchParams.toString();

  return query ? `?${query}` : "";
};

export const buildFileUrl = (filePath) => {
  if (!filePath) {
    return "";
  }

  const cleanPath = String(filePath)
    .trim()
    .replace(/\\/g, "/");

  if (!cleanPath) {
    return "";
  }

  if (
    cleanPath.startsWith("http://") ||
    cleanPath.startsWith("https://")
  ) {
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

const isFile = (value) => {
  return (
    typeof File !== "undefined" &&
    value instanceof File
  );
};

const hasFile = (data) => {
  if (
    !data ||
    typeof data !== "object"
  ) {
    return false;
  }

  return Object.values(data).some(
    (value) => {
      if (isFile(value)) {
        return true;
      }

      if (Array.isArray(value)) {
        return value.some(
          (item) => isFile(item)
        );
      }

      if (
        value &&
        typeof value === "object"
      ) {
        return hasFile(value);
      }

      return false;
    }
  );
};

const findFirstFile = (...values) => {
  for (const value of values) {
    if (isFile(value)) {
      return value;
    }

    if (Array.isArray(value)) {
      const found = value.find(
        (item) => isFile(item)
      );

      if (found) {
        return found;
      }
    }

    if (
      value &&
      typeof value === "object"
    ) {
      const nestedFile =
        value.file ||
        value.attachment ||
        value.taskFile ||
        value.submissionFile ||
        value.uploadedFile ||
        value.submittedFile;

      if (isFile(nestedFile)) {
        return nestedFile;
      }
    }
  }

  return null;
};

const convertToFormData = (data) => {
  const formData = new FormData();

  Object.entries(data || {}).forEach(
    ([key, value]) => {
      if (
        value === undefined ||
        value === null
      ) {
        return;
      }

      if (isFile(value)) {
        formData.append(key, value);
        return;
      }

      if (Array.isArray(value)) {
        const fileItems = value.filter(
          (item) => isFile(item)
        );

        if (fileItems.length > 0) {
          fileItems.forEach((item) =>
            formData.append(key, item)
          );

          return;
        }

        formData.append(
          key,
          JSON.stringify(value)
        );

        return;
      }

      if (typeof value === "object") {
        formData.append(
          key,
          JSON.stringify(value)
        );

        return;
      }

      formData.append(key, value);
    }
  );

  return formData;
};

const postData = (url, data) => {
  if (hasFile(data)) {
    return api.post(
      url,
      convertToFormData(data)
    );
  }

  return api.post(url, data);
};

export const getArrayFromApiResponse = (
  res
) => {
  const body = res?.data;

  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.users)) return body.users;
  if (Array.isArray(body?.students)) return body.students;
  if (Array.isArray(body?.teachers)) return body.teachers;
  if (Array.isArray(body?.tasks)) return body.tasks;
  if (Array.isArray(body?.task)) return body.task;
  if (Array.isArray(body?.homework)) return body.homework;
  if (Array.isArray(body?.homeworks)) return body.homeworks;
  if (Array.isArray(body?.submissions)) return body.submissions;
  if (Array.isArray(body?.attendance)) return body.attendance;
  if (Array.isArray(body?.attendances)) return body.attendances;
  if (Array.isArray(body?.records)) return body.records;
  if (Array.isArray(body?.exams)) return body.exams;
  if (Array.isArray(body?.notices)) return body.notices;
  if (Array.isArray(body?.results)) return body.results;
  if (Array.isArray(body?.marks)) return body.marks;
  if (Array.isArray(body?.timetable)) return body.timetable;
  if (Array.isArray(body?.timetables)) return body.timetables;
  if (Array.isArray(body?.routine)) return body.routine;
  if (Array.isArray(body?.routines)) return body.routines;

  return [];
};

export const requestWithFallback = async (
  requests
) => {
  const requestList = Array.isArray(requests)
    ? requests.filter(Boolean)
    : [requests];

  let lastError = null;

  for (const request of requestList) {
    try {
      if (
        typeof request === "function"
      ) {
        return await request();
      }

      if (
        typeof request.fn === "function"
      ) {
        return await request.fn();
      }

      const method = String(
        request.method || "get"
      ).toLowerCase();

      if (method === "get") {
        return await api.get(
          request.url,
          request.config || {}
        );
      }

      if (method === "delete") {
        return await api.delete(
          request.url,
          {
            ...(request.config || {}),

            ...(request.data
              ? { data: request.data }
              : {}),
          }
        );
      }

      if (hasFile(request.data)) {
        return await api[method](
          request.url,
          convertToFormData(request.data),
          request.config || {}
        );
      }

      return await api[method](
        request.url,
        request.data || {},
        request.config || {}
      );
    } catch (error) {
      lastError = error;

      const status =
        error.response?.status;

      if (
        status === 404 ||
        status === 405
      ) {
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ||
    new Error("Request failed.")
  );
};

const postWithFallback = async (
  urls,
  data
) => {
  const routeList = Array.isArray(urls)
    ? urls
    : [urls];

  let lastError = null;

  for (const url of routeList) {
    try {
      return await postData(url, data);
    } catch (error) {
      lastError = error;

      const status =
        error.response?.status;

      if (
        status === 404 ||
        status === 405
      ) {
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ||
    new Error("Request failed.")
  );
};

const safeGet = async (
  urls,
  fallbackData = []
) => {
  const routeList = Array.isArray(urls)
    ? urls
    : [urls];

  let lastError = null;

  for (const url of routeList) {
    try {
      return await api.get(url);
    } catch (error) {
      lastError = error;

      const status =
        error.response?.status;

      if (
        status === 404 ||
        status === 405
      ) {
        continue;
      }

      throw error;
    }
  }

  console.warn(
    "API route not found:",
    routeList.join(" or ")
  );

  return {
    data: fallbackData,
    error: lastError,
  };
};

const safeGetFirstNonEmpty = async (
  urls,
  fallbackData = []
) => {
  const routeList = Array.isArray(urls)
    ? urls
    : [urls];

  let firstSuccess = null;
  let lastError = null;

  for (const url of routeList) {
    try {
      const res = await api.get(url);

      if (!firstSuccess) {
        firstSuccess = res;
      }

      const arrayData =
        getArrayFromApiResponse(res);

      if (arrayData.length > 0) {
        return res;
      }
    } catch (error) {
      lastError = error;

      const status =
        error.response?.status;

      if (
        status === 404 ||
        status === 405
      ) {
        continue;
      }

      throw error;
    }
  }

  if (firstSuccess) {
    return firstSuccess;
  }

  console.warn(
    "API route not found:",
    routeList.join(" or ")
  );

  return {
    data: fallbackData,
    error: lastError,
  };
};


const prepareSubjectPayload = (
  data = {}
) => {
  const subjectName = cleanText(
    data.name || data.subjectName
  );

  const subjectCode = cleanText(
    data.subjectCode || data.code
  );

  const section =
    cleanText(data.section) || "All";

  return {
    ...data,

    name: subjectName,
    subjectName,

    code: subjectCode,
    subjectCode,

    className: cleanText(
      data.className || data.class
    ),

    section,

    stream: cleanText(data.stream),

    type:
      data.type || "Compulsory",

    schoolId:
      extractSchoolId(data.schoolId) ||
      getCurrentSchoolId(),

    teacherId:
      data.teacherId || null,
  };
};

const prepareBulkSubjectsPayload = (
  data
) => {
  if (Array.isArray(data)) {
    return {
      subjects: data.map(
        prepareSubjectPayload
      ),
    };
  }

  if (Array.isArray(data?.subjects)) {
    return {
      ...data,

      subjects: data.subjects.map(
        prepareSubjectPayload
      ),
    };
  }

  return data;
};

const prepareTaskPayload = (
  data = {}
) => {
  const className = cleanText(
    data.className || data.class
  );

  const section = cleanText(
    data.section
  );

  const title = cleanText(
    data.title ||
      data.taskTitle ||
      data.homeworkTitle
  );

  const subject = cleanText(
    data.subject || data.subjectName
  );

  const description = cleanText(
    data.description ||
      data.instructions ||
      data.content ||
      data.message
  );

  const dueDate =
    data.dueDate ||
    data.deadline ||
    data.date ||
    "";

  const selectedFile = findFirstFile(
    data.file,
    data.taskFile,
    data.attachment,
    data.homeworkFile,
    data.materialFile,
    data.uploadedFile,
    data.files
  );

  const payload = {
    ...data,

    title,
    taskTitle: title,
    homeworkTitle: title,

    subject,
    subjectName: subject,

    description,
    instructions: description,

    dueDate,
    deadline: dueDate,

    classId:
      data.classId ||
      buildClassId(
        className,
        section
      ),

    className,
    class: className,
    section,

    schoolId:
      extractSchoolId(data.schoolId) ||
      getCurrentSchoolId(),

    teacherId:
      data.teacherId || "",

    teacherName:
      data.teacherName || "",
  };

  if (isFile(payload.taskFile)) {
    delete payload.taskFile;
  }

  if (isFile(payload.attachment)) {
    delete payload.attachment;
  }

  if (isFile(payload.homeworkFile)) {
    delete payload.homeworkFile;
  }

  if (isFile(payload.materialFile)) {
    delete payload.materialFile;
  }

  if (isFile(payload.uploadedFile)) {
    delete payload.uploadedFile;
  }

  if (
    Array.isArray(payload.files) &&
    payload.files.some(
      (item) => isFile(item)
    )
  ) {
    delete payload.files;
  }

  if (selectedFile) {
    payload.file = selectedFile;
  }

  return payload;
};

const prepareHomeworkSubmissionPayload = (
  data = {}
) => {
  const selectedFile = findFirstFile(
    data.file,
    data.submissionFile,
    data.submittedFile,
    data.attachment,
    data.uploadedFile,
    data.files
  );

  const payload = {
    ...data,

    answer: cleanText(
      data.answer ||
        data.submissionText ||
        data.content
    ),

    submissionText: cleanText(
      data.submissionText ||
        data.answer ||
        data.content
    ),

    studentId:
      data.studentId ||
      data.userId ||
      "",

    userId:
      data.userId ||
      data.studentId ||
      "",

    studentName:
      data.studentName ||
      data.name ||
      "",

    className:
      data.className ||
      data.class ||
      "",

    class:
      data.class ||
      data.className ||
      "",

    section:
      data.section || "",

    schoolId:
      extractSchoolId(data.schoolId) ||
      getCurrentSchoolId(),
  };

  if (
    isFile(payload.submissionFile)
  ) {
    delete payload.submissionFile;
  }

  if (
    isFile(payload.submittedFile)
  ) {
    delete payload.submittedFile;
  }

  if (isFile(payload.attachment)) {
    delete payload.attachment;
  }

  if (isFile(payload.uploadedFile)) {
    delete payload.uploadedFile;
  }

  if (
    Array.isArray(payload.files) &&
    payload.files.some(
      (item) => isFile(item)
    )
  ) {
    delete payload.files;
  }

  if (selectedFile) {
    payload.file = selectedFile;
  }

  return payload;
};

const prepareAttendancePayload = (
  data = {}
) => {
  const studentId = cleanText(
    data.studentId ||
      data.student ||
      data.userId
  );

  const studentName = cleanText(
    data.studentName ||
      data.name
  );

  const className = cleanText(
    data.className ||
      data.class
  );

  const section = cleanText(
    data.section
  );

  const date = cleanText(
    data.date
  );

  const status =
    cleanText(data.status) ||
    "Present";

  return {
    ...data,

    studentId,
    student: studentId,
    userId: studentId,

    studentName,
    name: studentName,

    classId:
      data.classId ||
      buildClassId(
        className,
        section
      ),

    className,
    class: className,
    section,

    status,
    attendanceStatus: status,

    date,
    attendanceDate: date,

    schoolId:
      extractSchoolId(data.schoolId) ||
      getCurrentSchoolId(),

    teacherId:
      data.teacherId ||
      data.markedBy ||
      "",

    markedBy:
      data.markedBy ||
      data.teacherId ||
      "",
  };
};

const prepareExamPayload = (
  data = {}
) => {
  const title = cleanText(
    data.title ||
      data.examTitle ||
      data.name
  );

  const subject = cleanText(
    data.subject
  );

  const className = cleanText(
    data.className ||
      data.class
  );

  const section = cleanText(
    data.section
  );

  const maxMarks = Number(
    data.maxMarks ||
      data.totalMarks ||
      0
  );

  return {
    ...data,

    title,
    examTitle: title,
    name: title,

    subject,

    classId:
      data.classId ||
      buildClassId(
        className,
        section
      ),

    className,
    class: className,
    section,

    date:
      data.date ||
      data.examDate,

    examDate:
      data.date ||
      data.examDate,

    maxMarks,
    totalMarks: maxMarks,

    schoolId:
      extractSchoolId(data.schoolId) ||
      getCurrentSchoolId(),

    teacherId:
      data.teacherId || "",

    teacherName:
      data.teacherName || "",
  };
};

const prepareNoticePayload = (
  data = {}
) => {
  const title = cleanText(
    data.title ||
      data.noticeTitle
  );

  const content = cleanText(
    data.content ||
      data.message ||
      data.description
  );

  const className = cleanText(
    data.className ||
      data.class
  );

  const section = cleanText(
    data.section
  );

  return {
    ...data,

    title,
    noticeTitle: title,

    content,
    message: content,
    description: content,

    classId:
      data.classId ||
      buildClassId(
        className,
        section
      ),

    className,
    class: className,
    section,

    schoolId:
      extractSchoolId(data.schoolId) ||
      getCurrentSchoolId(),

    teacherId:
      data.teacherId || "",

    teacherName:
      data.teacherName || "",

    createdBy:
      data.createdBy ||
      data.teacherId ||
      data.teacherName ||
      "",
  };
};

const prepareAdminSignupPayload = (
  data = {}
) => {
  const adminName = cleanText(
    data.adminName ||
      data.name ||
      data.fullName
  );

  const email = cleanText(
    data.email ||
      data.adminEmail
  ).toLowerCase();

  const schoolName = cleanText(
    data.schoolName ||
      data.nameOfSchool ||
      data.institutionName
  );

  return {
    ...data,

    name: adminName,
    fullName: adminName,
    adminName,

    email,

    password: String(
      data.password || ""
    ),

    role: "admin",

    schoolName,
    nameOfSchool: schoolName,

    phone: cleanText(
      data.phone
    ),

    address: cleanText(
      data.address
    ),

    principalName: cleanText(
      data.principalName ||
        adminName
    ),

    country:
      cleanText(data.country) ||
      "Nepal",
  };
};


export const signup = (data) =>
  requestWithFallback([
    {
      method: "post",
      url: "/auth/signup",
      data:
        prepareAdminSignupPayload(
          data
        ),
    },

    {
      method: "post",
      url: "/auth/register",
      data:
        prepareAdminSignupPayload(
          data
        ),
    },
  ]);

export const login = (data) =>
  requestWithFallback([
    {
      method: "post",
      url: "/auth/login",

      data: {
        email: cleanText(
          data?.email
        ).toLowerCase(),

        password: String(
          data?.password || ""
        ),
      },
    },

    {
      method: "post",
      url: "/auth/signin",

      data: {
        email: cleanText(
          data?.email
        ).toLowerCase(),

        password: String(
          data?.password || ""
        ),
      },
    },
  ]);



export const createUser = (data) => {
  const payload =
    withSchoolId(data);

  return requestWithFallback([
    {
      method: "post",
      url: "/users/create",
      data: payload,
    },

    {
      method: "post",
      url: "/users",
      data: payload,
    },

    {
      method: "post",
      url: "/auth/register-user",
      data: payload,
    },
  ]);
};

export const getUsers = (
  options = {}
) => {
  const normalizedOptions =
    typeof options === "string"
      ? { role: options }
      : options || {};

  const schoolId =
    extractSchoolId(
      normalizedOptions.schoolId
    ) || getCurrentSchoolId();

  const role = cleanText(
    normalizedOptions.role
  );

  const query = buildQueryString({
    schoolId,
    role,
  });

  return safeGet(
    [
      `/users${query}`,
      `/users/all${query}`,
    ],
    []
  );
};

export const updateUser = (
  userId,
  data
) =>
  requestWithFallback([
    {
      method: "put",
      url: `/users/${userId}`,
      data,
    },

    {
      method: "patch",
      url: `/users/${userId}`,
      data,
    },

    {
      method: "put",
      url: `/users/update/${userId}`,
      data,
    },
  ]);

export const deleteUser = (
  userId
) =>
  requestWithFallback([
    {
      method: "delete",
      url: `/users/${userId}`,
    },

    {
      method: "delete",
      url: `/users/delete/${userId}`,
    },
  ]);

export const resetUserPassword = (
  userId,
  password
) =>
  requestWithFallback([
    {
      method: "patch",
      url: `/users/${userId}/reset-password`,

      data: {
        password,
        newPassword: password,
      },
    },

    {
      method: "put",
      url: `/users/${userId}/reset-password`,

      data: {
        password,
        newPassword: password,
      },
    },

    {
      method: "patch",
      url: `/users/reset-password/${userId}`,

      data: {
        password,
        newPassword: password,
      },
    },

    {
      method: "put",
      url: `/users/${userId}/password`,

      data: {
        password,
        newPassword: password,
      },
    },
  ]);

export const updateUserStatus = (
  userId,
  isActive
) =>
  requestWithFallback([
    {
      method: "patch",
      url: `/users/${userId}/status`,

      data: {
        isActive,

        status: isActive
          ? "active"
          : "deactivated",

        accountStatus: isActive
          ? "active"
          : "deactivated",
      },
    },

    {
      method: "put",
      url: `/users/${userId}/status`,

      data: {
        isActive,

        status: isActive
          ? "active"
          : "deactivated",

        accountStatus: isActive
          ? "active"
          : "deactivated",
      },
    },

    {
      method: "put",
      url: `/users/${userId}`,

      data: {
        isActive,

        status: isActive
          ? "active"
          : "deactivated",

        accountStatus: isActive
          ? "active"
          : "deactivated",
      },
    },
  ]);



export const getSchoolProfile = (
  schoolId = ""
) => {
  const cleanSchoolId =
    extractSchoolId(schoolId) ||
    getCurrentSchoolId();

  if (!cleanSchoolId) {
    return Promise.resolve({
      data: {},
    });
  }

  return safeGet(
    [
      `/school/${cleanSchoolId}`,
      `/schools/${cleanSchoolId}`,
      `/school/profile/${cleanSchoolId}`,
      `/schools/profile/${cleanSchoolId}`,
    ],
    {}
  );
};

export const saveSchoolProfile = (
  data = {}
) => {
  const schoolId =
    extractSchoolId(
      data.schoolId ||
        data._id ||
        data.id
    ) || getCurrentSchoolId();

  const payload = {
    ...data,

    schoolId,

    schoolName: cleanText(
      data.schoolName ||
        data.name
    ),

    address: cleanText(
      data.address
    ),

    phone: cleanText(
      data.phone ||
        data.contact
    ),

    email: cleanText(
      data.email
    ).toLowerCase(),

    website: cleanText(
      data.website
    ),

    principalName: cleanText(
      data.principalName ||
        data.principal
    ),

    adminName: cleanText(
      data.adminName
    ),

    logoUrl: cleanText(
      data.logoUrl
    ),
  };

  if (schoolId) {
    return requestWithFallback([
      {
        method: "put",
        url: `/school/${schoolId}`,
        data: payload,
      },

      {
        method: "patch",
        url: `/school/${schoolId}`,
        data: payload,
      },

      {
        method: "put",
        url: `/schools/${schoolId}`,
        data: payload,
      },

      {
        method: "patch",
        url: `/schools/${schoolId}`,
        data: payload,
      },

      {
        method: "put",
        url: `/school/profile/${schoolId}`,
        data: payload,
      },

      {
        method: "patch",
        url: `/school/profile/${schoolId}`,
        data: payload,
      },

      {
        method: "put",
        url: `/schools/profile/${schoolId}`,
        data: payload,
      },

      {
        method: "patch",
        url: `/schools/profile/${schoolId}`,
        data: payload,
      },
    ]);
  }

  return requestWithFallback([
    {
      method: "post",
      url: "/school/create",
      data: payload,
    },

    {
      method: "post",
      url: "/schools/create",
      data: payload,
    },

    {
      method: "post",
      url: "/school",
      data: payload,
    },

    {
      method: "post",
      url: "/schools",
      data: payload,
    },
  ]);
};



export const getAddressSuggestions = (
  input
) => {
  const cleanInput =
    cleanText(input);

  if (!cleanInput) {
    return Promise.resolve({
      data: [],
    });
  }

  return safeGet(
    [
      `/places/autocomplete?input=${encodeURIComponent(
        cleanInput
      )}`,

      `/google/places/autocomplete?input=${encodeURIComponent(
        cleanInput
      )}`,

      `/maps/places/autocomplete?input=${encodeURIComponent(
        cleanInput
      )}`,
    ],
    []
  );
};

export const geocodeAddress = (
  address
) => {
  const cleanAddress =
    cleanText(address);

  if (!cleanAddress) {
    return Promise.resolve({
      data: {},
    });
  }

  return safeGet(
    [
      `/places/geocode?address=${encodeURIComponent(
        cleanAddress
      )}`,

      `/google/geocode?address=${encodeURIComponent(
        cleanAddress
      )}`,

      `/maps/geocode?address=${encodeURIComponent(
        cleanAddress
      )}`,
    ],
    {}
  );
};



export const getSubjects = (
  schoolId = ""
) => {
  const cleanSchoolId =
    extractSchoolId(schoolId) ||
    getCurrentSchoolId();

  if (cleanSchoolId) {
    return safeGetFirstNonEmpty(
      [
        `/subjects/school/${cleanSchoolId}`,

        `/subject/school/${cleanSchoolId}`,

        `/subjects?schoolId=${encodeURIComponent(
          cleanSchoolId
        )}`,

        `/subject?schoolId=${encodeURIComponent(
          cleanSchoolId
        )}`,
      ],
      []
    );
  }

  return safeGetFirstNonEmpty(
    [
      "/subjects",
      "/subject",
    ],
    []
  );
};

export const createSubject = (
  data
) =>
  postWithFallback(
    [
      "/subjects/create",
      "/subject/create",
      "/subjects",
      "/subject",
    ],

    prepareSubjectPayload(data)
  );

export const bulkCreateSubjects = (
  data
) =>
  postWithFallback(
    [
      "/subjects/bulk",
      "/subject/bulk",
      "/subjects/create-many",
      "/subject/create-many",
    ],

    prepareBulkSubjectsPayload(data)
  );

export const updateSubject = (
  subjectId,
  data
) =>
  requestWithFallback([
    {
      method: "put",
      url: `/subjects/${subjectId}`,
      data:
        prepareSubjectPayload(
          data
        ),
    },

    {
      method: "patch",
      url: `/subjects/${subjectId}`,
      data:
        prepareSubjectPayload(
          data
        ),
    },

    {
      method: "put",
      url: `/subject/${subjectId}`,
      data:
        prepareSubjectPayload(
          data
        ),
    },

    {
      method: "patch",
      url: `/subject/${subjectId}`,
      data:
        prepareSubjectPayload(
          data
        ),
    },

    {
      method: "put",
      url: `/subjects/update/${subjectId}`,
      data:
        prepareSubjectPayload(
          data
        ),
    },
  ]);

export const deleteSubject = (
  subjectId
) =>
  requestWithFallback([
    {
      method: "delete",
      url: `/subjects/${subjectId}`,
    },

    {
      method: "delete",
      url: `/subject/${subjectId}`,
    },

    {
      method: "delete",
      url: `/subjects/delete/${subjectId}`,
    },
  ]);



export const getAdminReports = () =>
  safeGet(
    [
      "/reports/admin",
      "/admin/reports",
      "/users/reports/summary",
    ],
    null
  );



export const createTask = (
  data
) =>
  postWithFallback(
    [
      "/tasks/create",
      "/task/create",
      "/homework/create",
      "/homeworks/create",
      "/tasks",
      "/task",
      "/homework",
      "/homeworks",
    ],

    prepareTaskPayload(data)
  );

export const getTasksByClass = (
  className,
  section = ""
) => {
  const cleanClassName =
    cleanText(className);

  const cleanSection =
    cleanText(section);

  const classId =
    buildClassId(
      cleanClassName,
      cleanSection
    );

  const query = buildQueryString({
    section: cleanSection,
    className: cleanClassName,
    class: cleanClassName,
    classId,
  });

  return safeGetFirstNonEmpty(
    [
      `/tasks/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/tasks/class/${encodeURIComponent(
        classId
      )}`,

      `/task/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/task/class/${encodeURIComponent(
        classId
      )}`,

      `/homework/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/homework/class/${encodeURIComponent(
        classId
      )}`,

      `/homeworks/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/homeworks/class/${encodeURIComponent(
        classId
      )}`,

      `/tasks${query}`,
      `/task${query}`,
      `/homework${query}`,
      `/homeworks${query}`,
    ],
    []
  );
};

export const submitHomework = (
  taskId,
  data
) =>
  postWithFallback(
    [
      `/tasks/${taskId}/submit`,
      `/task/${taskId}/submit`,
      `/homework/${taskId}/submit`,
      `/homeworks/${taskId}/submit`,
      `/tasks/submit/${taskId}`,
      `/submissions/task/${taskId}`,
      "/submissions",
    ],

    {
      ...prepareHomeworkSubmissionPayload(
        data
      ),

      taskId,
      homeworkId: taskId,
    }
  );

export const getSubmissionsByTask = (
  taskId
) =>
  safeGetFirstNonEmpty(
    [
      `/tasks/${taskId}/submissions`,
      `/task/${taskId}/submissions`,
      `/homework/${taskId}/submissions`,
      `/homeworks/${taskId}/submissions`,
      `/submissions/task/${taskId}`,
    ],
    []
  );

export const getSubmissionsByStudent = (
  studentId
) => {
  const cleanStudentId =
    cleanText(studentId);

  if (!cleanStudentId) {
    return Promise.resolve({
      data: [],
    });
  }

  return safeGetFirstNonEmpty(
    [
      `/tasks/submissions/student/${cleanStudentId}`,

      `/submissions/student/${cleanStudentId}`,

      `/homework/submissions/student/${cleanStudentId}`,

      `/homeworks/submissions/student/${cleanStudentId}`,

      `/submissions?studentId=${encodeURIComponent(
        cleanStudentId
      )}`,
    ],
    []
  );
};



export const markAttendance = (
  data
) => {
  const payload =
    prepareAttendancePayload(data);

  return requestWithFallback([
    {
      method: "post",
      url: "/attendance/mark",
      data: payload,
    },

    {
      method: "post",
      url: "/attendance/create",
      data: payload,
    },

    {
      method: "post",
      url: "/attendance",
      data: payload,
    },

    {
      method: "post",
      url: "/attendances/mark",
      data: payload,
    },

    {
      method: "post",
      url: "/attendances/create",
      data: payload,
    },

    {
      method: "post",
      url: "/attendances",
      data: payload,
    },

    {
      method: "post",
      url: "/attendance/add",
      data: payload,
    },
  ]);
};

export const markAttendanceBulk = (
  records = []
) => {
  const preparedRecords =
    records.map(
      prepareAttendancePayload
    );

  return requestWithFallback([
    {
      method: "post",
      url: "/attendance/bulk",

      data: {
        records: preparedRecords,
      },
    },

    {
      method: "post",
      url: "/attendance/mark-bulk",

      data: {
        records: preparedRecords,
      },
    },

    {
      method: "post",
      url: "/attendances/bulk",

      data: {
        records: preparedRecords,
      },
    },
  ]);
};

export const getAttendanceByClass = (
  className,
  section = ""
) => {
  const cleanClassName =
    cleanText(className);

  const cleanSection =
    cleanText(section);

  const classId =
    buildClassId(
      cleanClassName,
      cleanSection
    );

  const query = buildQueryString({
    className: cleanClassName,
    class: cleanClassName,
    classId,
    section: cleanSection,
  });

  const sectionPath =
    cleanSection
      ? `/section/${encodeURIComponent(
          cleanSection
        )}`
      : "";

  return safeGetFirstNonEmpty(
    [
      `/attendance/class/${encodeURIComponent(
        classId
      )}`,

      `/attendance/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/attendance/class/${encodeURIComponent(
        cleanClassName
      )}${sectionPath}`,

      `/attendance/records/class/${encodeURIComponent(
        classId
      )}`,

      `/attendance/records/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/attendance/records${query}`,
      `/attendance${query}`,

      `/attendances/class/${encodeURIComponent(
        classId
      )}`,

      `/attendances/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/attendances${query}`,
    ],
    []
  );
};

export const getAttendanceByStudent = (
  studentId
) => {
  const cleanStudentId =
    cleanText(studentId);

  if (!cleanStudentId) {
    return Promise.resolve({
      data: [],
    });
  }

  return safeGetFirstNonEmpty(
    [
      `/attendance/student/${cleanStudentId}`,

      `/attendances/student/${cleanStudentId}`,

      `/attendance/records/student/${cleanStudentId}`,

      `/attendance/records?studentId=${encodeURIComponent(
        cleanStudentId
      )}`,

      `/attendance?studentId=${encodeURIComponent(
        cleanStudentId
      )}`,

      `/attendances?studentId=${encodeURIComponent(
        cleanStudentId
      )}`,
    ],
    []
  );
};



export const createExam = (
  data
) => {
  const payload =
    prepareExamPayload(data);

  return postWithFallback(
    [
      "/exams/create",
      "/exam/create",
      "/exams/add",
      "/exam/add",
      "/exams",
      "/exam",
    ],

    payload
  );
};

export const getExamsByClass = (
  className,
  section = ""
) => {
  const cleanClassName =
    cleanText(className);

  const cleanSection =
    cleanText(section);

  const classId =
    buildClassId(
      cleanClassName,
      cleanSection
    );

  const query = buildQueryString({
    className: cleanClassName,
    class: cleanClassName,
    classId,
    section: cleanSection,
  });

  const sectionPath =
    cleanSection
      ? `/section/${encodeURIComponent(
          cleanSection
        )}`
      : "";

  return safeGetFirstNonEmpty(
    [
      `/exams/class/${encodeURIComponent(
        classId
      )}`,

      `/exam/class/${encodeURIComponent(
        classId
      )}`,

      `/exams/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/exam/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/exams/class/${encodeURIComponent(
        cleanClassName
      )}${sectionPath}`,

      `/exam/class/${encodeURIComponent(
        cleanClassName
      )}${sectionPath}`,

      `/exams${query}`,
      `/exam${query}`,
    ],
    []
  );
};



export const saveExamResult = (
  data
) =>
  requestWithFallback([
    {
      method: "post",
      url: "/results/create",
      data,
    },

    {
      method: "post",
      url: "/results",
      data,
    },

    {
      method: "post",
      url: "/exam-results/create",
      data,
    },

    {
      method: "post",
      url: "/exam-results",
      data,
    },

    {
      method: "post",
      url: "/marks/create",
      data,
    },

    {
      method: "post",
      url: "/marks",
      data,
    },
  ]);

export const getResultsByStudent = (
  studentId
) => {
  const cleanStudentId =
    cleanText(studentId);

  if (!cleanStudentId) {
    return Promise.resolve({
      data: [],
    });
  }

  return safeGetFirstNonEmpty(
    [
      `/results/student/${cleanStudentId}`,

      `/exam-results/student/${cleanStudentId}`,

      `/marks/student/${cleanStudentId}`,

      `/results?studentId=${encodeURIComponent(
        cleanStudentId
      )}`,

      `/exam-results?studentId=${encodeURIComponent(
        cleanStudentId
      )}`,

      `/marks?studentId=${encodeURIComponent(
        cleanStudentId
      )}`,
    ],
    []
  );
};

export const getResultsByClass = (
  className,
  section = ""
) => {
  const cleanClassName =
    cleanText(className);

  const cleanSection =
    cleanText(section);

  const classId =
    buildClassId(
      cleanClassName,
      cleanSection
    );

  const query = buildQueryString({
    className: cleanClassName,
    class: cleanClassName,
    classId,
    section: cleanSection,
  });

  return safeGetFirstNonEmpty(
    [
      `/results${query}`,
      `/exam-results${query}`,
      `/marks${query}`,
    ],
    []
  );
};



export const createNotice = (
  data
) => {
  const payload =
    prepareNoticePayload(data);

  return postWithFallback(
    [
      "/notices/create",
      "/notice/create",
      "/notices/add",
      "/notice/add",
      "/notices",
      "/notice",
    ],

    payload
  );
};

export const getNoticesByClass = (
  className,
  section = ""
) => {
  const cleanClassName =
    cleanText(className);

  const cleanSection =
    cleanText(section);

  const classId =
    buildClassId(
      cleanClassName,
      cleanSection
    );

  const query = buildQueryString({
    className: cleanClassName,
    class: cleanClassName,
    classId,
    section: cleanSection,
  });

  const sectionPath =
    cleanSection
      ? `/section/${encodeURIComponent(
          cleanSection
        )}`
      : "";

  return safeGetFirstNonEmpty(
    [
      `/notices/class/${encodeURIComponent(
        classId
      )}`,

      `/notice/class/${encodeURIComponent(
        classId
      )}`,

      `/notices/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/notice/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/notices/class/${encodeURIComponent(
        cleanClassName
      )}${sectionPath}`,

      `/notice/class/${encodeURIComponent(
        cleanClassName
      )}${sectionPath}`,

      `/notices${query}`,
      `/notice${query}`,
    ],
    []
  );
};

export const getNoticesBySchool = (
  schoolId
) => {
  const cleanSchoolId =
    extractSchoolId(schoolId) ||
    getCurrentSchoolId();

  if (!cleanSchoolId) {
    return safeGetFirstNonEmpty(
      [
        "/notices/school",
        "/notice/school",
      ],
      []
    );
  }

  return safeGetFirstNonEmpty(
    [
      `/notices/school/${cleanSchoolId}`,

      `/notice/school/${cleanSchoolId}`,

      `/notices?schoolId=${encodeURIComponent(
        cleanSchoolId
      )}`,

      `/notice?schoolId=${encodeURIComponent(
        cleanSchoolId
      )}`,
    ],
    []
  );
};



export const getTimetableByClass = (
  className,
  section = ""
) => {
  const cleanClassName =
    cleanText(className);

  const cleanSection =
    cleanText(section);

  const classId =
    buildClassId(
      cleanClassName,
      cleanSection
    );

  const query = buildQueryString({
    className: cleanClassName,
    class: cleanClassName,
    classId,
    section: cleanSection,
  });

  return safeGetFirstNonEmpty(
    [
      `/timetable/class/${encodeURIComponent(
        classId
      )}`,

      `/timetables/class/${encodeURIComponent(
        classId
      )}`,

      `/routine/class/${encodeURIComponent(
        classId
      )}`,

      `/routines/class/${encodeURIComponent(
        classId
      )}`,

      `/timetable/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/timetables/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/routine/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/routines/class/${encodeURIComponent(
        cleanClassName
      )}${buildQueryString({
        section: cleanSection,
      })}`,

      `/timetable${query}`,
      `/timetables${query}`,
      `/routine${query}`,
      `/routines${query}`,
    ],
    []
  );
};

export default api;