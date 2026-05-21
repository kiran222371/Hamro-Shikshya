import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL, getApiErrorMessage, login } from "../api";
import "../styles/App.css";

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const getDashboardPath = (role) => {
    const cleanRole = String(role || "").toLowerCase().trim();

    if (cleanRole === "admin") return "/admin";
    if (cleanRole === "teacher") return "/teacher";
    if (cleanRole === "student") return "/student";

    return null;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!email || !password) {
      setError("Please enter email and password.");
      return;
    }

    try {
      setLoading(true);

      console.log("LOGIN API URL:", API_URL);

      const res = await login({
        email,
        password,
      });

      console.log("LOGIN RESPONSE:", res.data);

      const token = res.data?.token;
      const user = res.data?.user;

      if (!token) {
        setError("Login successful but token is missing.");
        return;
      }

      if (!user) {
        setError("Login successful but user data is missing.");
        return;
      }

      const userRole = String(user.role || "").toLowerCase().trim();
      const dashboardPath = getDashboardPath(userRole);

      if (!dashboardPath) {
        setError(`Unknown user role: ${user.role}`);
        return;
      }

      const cleanUser = {
        ...user,
        role: userRole,
      };

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(cleanUser));

      navigate(dashboardPath, { replace: true });
    } catch (err) {
      console.log("LOGIN ERROR:", err.response?.data || err.message);

      setError(
        getApiErrorMessage(
          err,
          "Login failed. Please check your email and password."
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-left">
          <div className="app-brand">
            <div className="app-brand-icon">🎓</div>
            <span>Hamro Shikshya</span>
          </div>

          <h1 className="auth-title">Welcome back</h1>

          <p className="auth-subtitle">
            Sign in to continue managing your school life.
          </p>

          <div className="auth-card">
            <h2>Sign in</h2>

            {error && <div className="error-box">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="auth-form-group">
                <label>Email</label>
                <input
                  className="auth-input"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-form-group">
                <label>Password</label>

                <div className="password-field">
                  <input
                    className="auth-input password-input"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange}
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className="password-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <button className="auth-button" type="submit" disabled={loading}>
                {loading ? "Logging in..." : "Continue"}
              </button>
            </form>

            <div className="auth-link-text">
              First time? <Link to="/signup">Create Admin Account</Link>
            </div>
          </div>
        </section>

        <section className="auth-right">
          <div>
            <div className="showcase-topline">
              Everything you need to stay on track.
            </div>

            <div className="showcase-title">
              Manage your classes, homework, attendance, exams, and more. All in
              one place.
            </div>
          </div>

          <div className="showcase-center">
            <div className="showcase-badge">🎓</div>
          </div>

          <div className="showcase-footer">
            <strong>Built for students, teachers, and schools</strong>

            <div className="brand-row">
              <span>Attendance</span>
              <span>Homework</span>
              <span>Exams</span>
              <span>Notices</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}