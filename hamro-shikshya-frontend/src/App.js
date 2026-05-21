import { HashRouter, Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import StudentDashboard from "./pages/StudentDashboard";

import "./styles/App.css";

function getSavedUser() {
  try {
    const savedUser = localStorage.getItem("user");

    if (!savedUser || savedUser === "undefined" || savedUser === "null") {
      return null;
    }

    return JSON.parse(savedUser);
  } catch (error) {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return null;
  }
}

function getToken() {
  const token = localStorage.getItem("token");

  if (!token || token === "undefined" || token === "null") {
    return null;
  }

  return token;
}

function getUserRole(user) {
  return String(user?.role || "").trim().toLowerCase();
}

function clearAuthStorage() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

function getDashboardPathByRole(role) {
  const cleanRole = String(role || "").trim().toLowerCase();

  if (cleanRole === "admin") return "/admin";
  if (cleanRole === "teacher") return "/teacher";
  if (cleanRole === "student") return "/student";

  return "/login";
}

function HomeRedirect() {
  const token = getToken();
  const user = getSavedUser();

  if (!token || !user) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  const role = getUserRole(user);
  const dashboardPath = getDashboardPathByRole(role);

  if (dashboardPath === "/login") {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={dashboardPath} replace />;
}

function ProtectedRoute({ children, allowedRole }) {
  const token = getToken();
  const user = getSavedUser();

  if (!token || !user) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  const role = getUserRole(user);

  if (!role) {
    clearAuthStorage();
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to={getDashboardPathByRole(role)} replace />;
  }

  return children;
}

function GuestRoute({ children }) {
  const token = getToken();
  const user = getSavedUser();

  if (token && user) {
    const role = getUserRole(user);
    const dashboardPath = getDashboardPathByRole(role);

    if (dashboardPath !== "/login") {
      return <Navigate to={dashboardPath} replace />;
    }

    clearAuthStorage();
  }

  return children;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeRedirect />} />

        <Route
          path="/login"
          element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          }
        />

        <Route
          path="/signup"
          element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}