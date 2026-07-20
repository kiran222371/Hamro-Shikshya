import { useEffect, useMemo, useRef, useState } from "react";
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
  GOOGLE_MAPS_API_KEY,
} from "../api";
import "../styles/App.css";

const SUBJECTS_STORAGE_KEY = "hamro_shikshya_subjects";
const SCHOOL_PROFILE_STORAGE_KEY = "hamro_shikshya_school_profile";
const GOOGLE_SCRIPT_ID = "hamro-shikshya-google-places-script";

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

const emptyAssignedClass = {
  className: "",
  section: "",
};

const emptyCreateForm = {
  name: "",
  email: "",
  password: "",
  role: "teacher",
  className: "",
  section: "",
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

const getId = (item) => item?._id || item?.id || item?.userId || "";

const getSubjectId = (subject) =>
  subject?._id || subject?.id || subject?.subjectId || "";

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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/#/login";
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
    try {
      const savedSubjects = safeReadStorage(SUBJECTS_STORAGE_KEY, []);
      const res = await getSubjects(loggedUser.schoolId || "");
      const apiSubjects = toArray(res).map(normaliseSubject);

      const finalSubjects = apiSubjects.length > 0 ? apiSubjects : savedSubjects;

      setSubjects(finalSubjects);
      safeWriteStorage(SUBJECTS_STORAGE_KEY, finalSubjects);
    } catch (err) {
      console.warn("SUBJECTS BACKEND NOT AVAILABLE:", err);
      const savedSubjects = safeReadStorage(SUBJECTS_STORAGE_KEY, []);
      setSubjects(savedSubjects);
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
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleRoleChange = (e) => {
    setForm({
      ...emptyCreateForm,
      role: e.target.value,
    });
  };

  const handleAssignedClassChange = (index, field, value) => {
    const updatedClasses = [...form.assignedClasses];

    updatedClasses[index] = {
      ...updatedClasses[index],
      [field]: value,
    };

    setForm({
      ...form,
      assignedClasses: updatedClasses,
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
      payload.className = form.className.trim();
      payload.section = form.section.trim();
    }

    if (form.role === "teacher") {
      payload.assignedClasses = form.assignedClasses
        .map((item) => ({
          className: String(item.className || "").trim(),
          section: String(item.section || "").trim(),
        }))
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
    }

    if (form.role === "teacher") {
      const cleanAssignedClasses = form.assignedClasses
        .map((item) => ({
          className: String(item.className || "").trim(),
          section: String(item.section || "").trim(),
        }))
        .filter((item) => item.className && item.section);

      if (cleanAssignedClasses.length === 0) {
        return "Please assign at least one class to the teacher.";
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
      assignedClasses:
        Array.isArray(user.assignedClasses) && user.assignedClasses.length > 0
          ? user.assignedClasses.map((item) => ({
              className: item.className || "",
              section: item.section || "",
            }))
          : [{ ...emptyAssignedClass }],
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingUser(null);
    setEditForm(emptyCreateForm);
  };

  const handleEditChange = (e) => {
    setEditForm({
      ...editForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleEditRoleChange = (e) => {
    setEditForm({
      ...editForm,
      role: e.target.value,
      className: "",
      section: "",
      assignedClasses: [{ ...emptyAssignedClass }],
    });
  };

  const handleEditAssignedClassChange = (index, field, value) => {
    const updatedClasses = [...editForm.assignedClasses];

    updatedClasses[index] = {
      ...updatedClasses[index],
      [field]: value,
    };

    setEditForm({
      ...editForm,
      assignedClasses: updatedClasses,
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
    }

    if (editForm.role === "teacher") {
      const cleanAssignedClasses = editForm.assignedClasses
        .map((item) => ({
          className: String(item.className || "").trim(),
          section: String(item.section || "").trim(),
        }))
        .filter((item) => item.className && item.section);

      if (cleanAssignedClasses.length === 0) {
        return "Please assign at least one class to the teacher.";
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
      payload.className = editForm.className.trim();
      payload.section = editForm.section.trim();
      payload.assignedClasses = [];
    }

    if (editForm.role === "teacher") {
      payload.className = "";
      payload.section = "";
      payload.assignedClasses = editForm.assignedClasses
        .map((item) => ({
          className: String(item.className || "").trim(),
          section: String(item.section || "").trim(),
        }))
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

    if (!subjectForm.name.trim() || !subjectForm.className.trim()) {
      showError("Please add subject name and class.");
      return;
    }

    try {
      setSubjectSaving(true);
      setError("");
      setSuccess("");

      const payload = buildSubjectPayload();

      if (editingSubject) {
        const subjectId = getSubjectId(editingSubject);

        let updatedSubject = normaliseSubject({
          ...editingSubject,
          ...payload,
          id: subjectId,
        });

        try {
          const res = await updateSubject(subjectId, payload);

          updatedSubject = normaliseSubject(
            res?.data?.subject || res?.data?.data || res?.data || updatedSubject
          );
        } catch (backendErr) {
          console.warn("SUBJECT UPDATED LOCALLY:", backendErr);
        }

        const nextSubjects = subjects.map((subject) =>
          String(getSubjectId(subject)) === String(subjectId)
            ? updatedSubject
            : subject
        );

        setSubjects(nextSubjects);
        safeWriteStorage(SUBJECTS_STORAGE_KEY, nextSubjects);
        showSuccess("Subject updated successfully.");
      } else {
        let newSubject = normaliseSubject(payload);

        try {
          const res = await createSubject(payload);

          newSubject = normaliseSubject(
            res?.data?.subject || res?.data?.data || res?.data || newSubject
          );
        } catch (backendErr) {
          console.warn("SUBJECT SAVED LOCALLY:", backendErr);
        }

        const nextSubjects = [...subjects, newSubject];

        setSubjects(nextSubjects);
        safeWriteStorage(SUBJECTS_STORAGE_KEY, nextSubjects);
        showSuccess("Subject added successfully.");
      }

      resetSubjectForm();
    } catch (err) {
      console.error("SUBJECT SAVE ERROR:", err);
      showError("Failed to save subject.");
    } finally {
      setSubjectSaving(false);
    }
  };

  const handleAutoAddNepalSubjects = async () => {
    if (!subjectForm.className) {
      showError("Select class first before auto-adding subjects.");
      return;
    }

    try {
      setSubjectSaving(true);
      setError("");
      setSuccess("");

      const templateSubjects = getNepalSubjectTemplates(
        subjectForm.className,
        subjectForm.stream || "General"
      );

      const section = subjectForm.section.trim() || "All";

      const newSubjects = templateSubjects
        .map((item) =>
          normaliseSubject({
            ...item,
            className: subjectForm.className,
            section,
            subjectCode: makeSubjectCode(item.name, subjectForm.className),
            code: makeSubjectCode(item.name, subjectForm.className),
            level: getNepalLevel(subjectForm.className),
            schoolId: loggedUser.schoolId || schoolProfile.schoolId || "",
          })
        )
        .filter((newSubject) => {
          return !subjects.some((existing) => {
            return (
              String(existing.name).toLowerCase() ===
                String(newSubject.name).toLowerCase() &&
              String(existing.className) === String(newSubject.className) &&
              String(existing.section || "All") ===
                String(newSubject.section || "All") &&
              String(existing.stream || "General") ===
                String(newSubject.stream || "General")
            );
          });
        });

      if (newSubjects.length === 0) {
        showError("These subjects already exist for the selected class/stream.");
        return;
      }

      try {
        await bulkCreateSubjects({
          subjects: newSubjects,
          schoolId: loggedUser.schoolId || schoolProfile.schoolId || "",
        });
      } catch (bulkErr) {
        console.warn("BULK SUBJECT BACKEND NOT AVAILABLE:", bulkErr);

        for (const subject of newSubjects) {
          try {
            await createSubject(subject);
          } catch (singleErr) {
            console.warn("SUBJECT SAVED LOCALLY:", singleErr);
          }
        }
      }

      const nextSubjects = [...subjects, ...newSubjects];

      setSubjects(nextSubjects);
      safeWriteStorage(SUBJECTS_STORAGE_KEY, nextSubjects);
      showSuccess(`${newSubjects.length} Nepal curriculum subjects added.`);
    } catch (err) {
      console.error("AUTO ADD SUBJECTS ERROR:", err);
      showError("Failed to auto-add subjects.");
    } finally {
      setSubjectSaving(false);
    }
  };

  const startSubjectEdit = (subject) => {
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

  return (
    <main className="dashboard-page admin-dashboard-page">
      <section className="dashboard-card dashboard-header admin-hero">
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

      <section className="admin-stats-grid">
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

      <section className="admin-quick-grid">
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

      <section className="dashboard-card admin-section-card">
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

      <section className="dashboard-card admin-section-card">
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

      <section className="dashboard-card admin-section-card">
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
        <section className="dashboard-card admin-section-card">
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
                <h3>Student Class</h3>

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
                </div>
              </div>
            )}

            {editForm.role === "teacher" && (
              <div className="admin-inner-box">
                <h3>Teacher Assigned Classes</h3>

                {editForm.assignedClasses.map((item, index) => (
                  <div className="form-grid" key={index}>
                    <div className="auth-form-group">
                      <label>Class</label>
                      <select
                        className="auth-select"
                        value={item.className}
                        onChange={(e) =>
                          handleEditAssignedClassChange(
                            index,
                            "className",
                            e.target.value
                          )
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
                        value={item.section}
                        onChange={(e) =>
                          handleEditAssignedClassChange(
                            index,
                            "section",
                            e.target.value
                          )
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
                      <label>&nbsp;</label>
                      <button
                        className="small-btn remove-btn"
                        type="button"
                        onClick={() => removeEditTeacherClass(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  className="small-btn add-btn"
                  type="button"
                  onClick={addEditTeacherClass}
                >
                  Add Another Class
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

      <section className="dashboard-card admin-section-card">
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
              <h3>Student Class</h3>

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
              </div>
            </div>
          )}

          {form.role === "teacher" && (
            <div className="admin-inner-box">
              <h3>Teacher Classes</h3>

              {form.assignedClasses.map((item, index) => (
                <div className="form-grid" key={index}>
                  <div className="auth-form-group">
                    <label>Class</label>
                    <select
                      className="auth-select"
                      value={item.className}
                      onChange={(e) =>
                        handleAssignedClassChange(
                          index,
                          "className",
                          e.target.value
                        )
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
                      value={item.section}
                      onChange={(e) =>
                        handleAssignedClassChange(
                          index,
                          "section",
                          e.target.value
                        )
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
                    <label>&nbsp;</label>
                    <button
                      className="small-btn remove-btn"
                      type="button"
                      onClick={() => removeTeacherClass(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              <button
                className="small-btn add-btn"
                type="button"
                onClick={addTeacherClass}
              >
                Add Another Class
              </button>
            </div>
          )}

          <button className="primary-btn" type="submit" disabled={creating}>
            {creating ? "Creating..." : "Create User"}
          </button>
        </form>
      </section>

      <section className="dashboard-card admin-section-card">
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

      <section className="dashboard-card admin-section-card">
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
                <p>
                  <b>Classes:</b>{" "}
                  {teacher.assignedClasses?.length > 0
                    ? teacher.assignedClasses
                        .map(
                          (item) =>
                            `Class ${item.className} Section ${item.section}`
                        )
                        .join(", ")
                    : "No class assigned"}
                </p>

                {renderUserActions(teacher)}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-card admin-section-card">
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

                {renderUserActions(student)}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}