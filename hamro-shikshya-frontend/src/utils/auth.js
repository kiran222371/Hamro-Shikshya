export const VALID_ROLES = ["admin", "teacher", "student"];

export const FRONTEND_URL = "https://hamro-shikshya-frontend.onrender.com";
export const BACKEND_URL = "https://hamro-shikshya-backend.onrender.com";
export const API_URL = `${BACKEND_URL}/api`;

const cleanRole = (role) => String(role || "").trim().toLowerCase();

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
  } catch (error) {
    clearAuth();

    return {
      token: null,
      user: null,
    };
  }
};

export const saveAuth = (token, user) => {
  const cleanToken = String(token || "").trim();
  const normalizedUser = normalizeUser(user);

  if (!cleanToken || !normalizedUser) {
    clearAuth();
    return false;
  }

  localStorage.setItem("token", cleanToken);
  localStorage.setItem("user", JSON.stringify(normalizedUser));

  return true;
};

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
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