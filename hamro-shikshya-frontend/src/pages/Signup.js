import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../api";
import "../styles/App.css";

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    schoolName: "",
    role: "admin",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const cleanApiUrl = String(API_URL || "").replace(/\/$/, "");
  const signupUrl = `${cleanApiUrl}/auth/signup`;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));
  };

  const getErrorMessage = async (response) => {
    try {
      const data = await response.json();

      if (data?.message) return data.message;
      if (data?.error) return data.error;

      return "Signup failed. Please try again.";
    } catch {
      return "Signup failed. Please try again.";
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const name = form.name.trim();
    const email = form.email.trim().toLowerCase();
    const schoolName = form.schoolName.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    if (!name || !email || !password || !confirmPassword || !schoolName) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      console.log("SIGNUP API URL:", signupUrl);

      const response = await fetch(signupUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          fullName: name,
          adminName: name,
          email,
          password,
          schoolName,
          role: "admin",
        }),
      });

      if (!response.ok) {
        const message = await getErrorMessage(response);
        throw new Error(message);
      }

      await response.json();

      alert("Admin account created successfully. Please login.");
      navigate("/login", { replace: true });
    } catch (err) {
      console.log("SIGNUP ERROR:", err);
      setError(err.message || "Signup failed. Please try again.");
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

          <h1 className="auth-title">Create account</h1>

          <p className="auth-subtitle">
            Build your school workspace and manage everything easily.
          </p>

          <form className="auth-card" onSubmit={handleSignup}>
            <h2 className="form-title">Sign up</h2>

            {error && <div className="error-box">{error}</div>}

            <div className="auth-form-group">
              <label>Full Name</label>
              <input
                className="auth-input"
                type="text"
                name="name"
                placeholder="Enter full name"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                disabled={loading}
                required
              />
            </div>

            <div className="auth-form-group">
              <label>Email</label>
              <input
                className="auth-input"
                type="email"
                name="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
                required
              />
            </div>

            <div className="auth-form-group">
              <label>Password</label>

              <div className="auth-password-wrap">
                <input
                  className="auth-input password-input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  placeholder="Enter password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={loading}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="auth-form-group">
              <label>Confirm Password</label>

              <div className="auth-password-wrap">
                <input
                  className="auth-input password-input"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  disabled={loading}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="auth-form-group">
              <label>School Name</label>

              <input
                className="auth-input"
                type="text"
                name="schoolName"
                placeholder="Enter school name"
                value={form.schoolName}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>

            <button className="auth-button" type="submit" disabled={loading}>
              {loading ? "Creating..." : "Continue"}
            </button>

            <p className="auth-link-text">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </form>
        </section>

        <section className="auth-right">
          <div>
            <p className="showcase-topline">
              Everything you need to stay on track.
            </p>

            <h2 className="showcase-title">
              Create your school space and manage classes, tasks, exams, and
              student records in one place.
            </h2>
          </div>

          <div className="showcase-center">
            <div className="showcase-badge">📘</div>
          </div>

          <div className="showcase-footer">
            <strong>Designed for modern school management</strong>

            <div className="brand-row">
              <span>Schools</span>
              <span>Teachers</span>
              <span>Students</span>
              <span>Reports</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}