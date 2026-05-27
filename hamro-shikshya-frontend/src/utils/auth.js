export const VALID_ROLES = ["admin", "teacher", "student"];

export const FRONTEND_URL = "https://hamro-shikshya-frontend.onrender.com";
export const BACKEND_URL = "https://hamro-shikshya-backend.onrender.com";
export const API_URL = `${BACKEND_URL}/api`;

const cleanText = (value) => String(value || "").trim();

const cleanRole = (role) => cleanText(role).toLowerCase();

export const clearAuth = () => {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  } catch {
    // ignore localStorage errors
  }
};

export const getDashboardPath = (role) => {
  const normalizedRole = cleanRole(role);

  if (normalizedRole === "admin") return "/admin";
  if (normalizedRole === "teacher") return "/teacher";
  if (normalizedRole === "student") return "/student";

  return "/login";
};

export const normalizeUser = (user) => {
  if (!user || typeof user !== "object") return null;

  const role = cleanRole(user.role);

  if (!VALID_ROLES.includes(role)) return null;

  return {
    ...user,
    role,
    name: cleanText(user.name),
    email: cleanText(user.email).toLowerCase(),
    schoolId: user.schoolId || user.school?._id || user.school?.id || "",
    schoolName: cleanText(user.schoolName || user.school?.schoolName || user.school?.name),
  };
};

export const getStoredAuth = () => {
  try {
    const token = localStorage.getItem("token");
    const userText = localStorage.getItem("user");

    if (!token || !userText || userText === "undefined" || userText === "null") {
      clearAuth();

      return {
        token: null,
        user: null,
      };
    }

    const parsedUser = JSON.parse(userText);
    const user = normalizeUser(parsedUser);

    if (!user) {
      clearAuth();

      return {
        token: null,
        user: null,
      };
    }

    return {
      token,
      user,
    };
  } catch {
    clearAuth();

    return {
      token: null,
      user: null,
    };
  }
};

export const saveAuth = (token, user) => {
  const cleanToken = cleanText(token);
  const normalizedUser = normalizeUser(user);

  if (!cleanToken || !normalizedUser) {
    clearAuth();
    return false;
  }

  try {
    localStorage.setItem("token", cleanToken);
    localStorage.setItem("user", JSON.stringify(normalizedUser));
    return true;
  } catch {
    return false;
  }
};

export const logout = () => {
  clearAuth();
  window.location.href = "/login";
};

export const isLoggedIn = () => {
  const { token, user } = getStoredAuth();
  return Boolean(token && user);
};

export const getCurrentUser = () => {
  const { user } = getStoredAuth();
  return user;
};

export const getCurrentToken = () => {
  const { token } = getStoredAuth();
  return token;
};