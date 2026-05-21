import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup } from "../api";
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

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    if (
      !form.name.trim() ||
      !form.email.trim() ||
      !form.password.trim() ||
      !form.schoolName.trim()
    ) {
      setError("Please fill in all fields.");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await signup({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        schoolName: form.schoolName.trim(),
        role: "admin",
      });

      alert("Admin account created successfully. Please login.");
      navigate("/login", { replace: true });
    } catch (err) {
      console.log("SIGNUP ERROR:", err.response?.data || err.message);

      setError(err.response?.data?.message || "Signup failed. Try again.");
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
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
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
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
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