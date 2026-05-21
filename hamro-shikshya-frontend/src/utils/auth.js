export const VALID_ROLES = ["admin", "teacher", "student"];

export const getDashboardPath = (role) => {
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher";
  if (role === "student") return "/student";
  return "/login";
};

export const getStoredAuth = () => {
  const token = localStorage.getItem("token");
  const userText = localStorage.getItem("user");

  let user = null;

  try {
    user = userText ? JSON.parse(userText) : null;
  } catch (error) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return { token: null, user: null };
  }

  if (!token || !user || !VALID_ROLES.includes(user.role)) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    return { token: null, user: null };
  }

  return { token, user };
};

export const saveAuth = (token, user) => {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
};

export const logout = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};