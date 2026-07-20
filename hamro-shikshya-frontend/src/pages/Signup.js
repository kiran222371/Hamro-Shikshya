import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../api";
import "../styles/App.css";

const initialForm = {
  adminName: "",
  adminEmail: "",
  schoolName: "",
  phone: "",
  address: "",
  password: "",
  confirmPassword: "",
};

const cleanText = (value) => String(value ?? "").trim();

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const signupEndpoint = `${String(API_URL || "")
    .replace(/\/+$/, "")}/auth/signup`;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previousForm) => ({
      ...previousForm,
      [name]: value,
    }));

    if (error) {
      setError("");
    }

    if (success) {
      setSuccess("");
    }
  };

  const getErrorMessage = async (response) => {
    try {
      const contentType =
        response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const data = await response.json();

        return (
          data?.message ||
          data?.error ||
          "Unable to create the admin account."
        );
      }

      const responseText = await response.text();

      return (
        responseText ||
        "Unable to create the admin account."
      );
    } catch {
      return "Unable to create the admin account.";
    }
  };

  const validateForm = () => {
    const adminName = cleanText(form.adminName);

    const adminEmail = cleanText(
      form.adminEmail
    ).toLowerCase();

    const schoolName = cleanText(form.schoolName);

    const password = String(form.password || "");

    const confirmPassword = String(
      form.confirmPassword || ""
    );

    if (!adminName) {
      return "Please enter the administrator's full name.";
    }

    if (adminName.length < 2) {
      return "Administrator name must contain at least 2 characters.";
    }

    if (!adminEmail) {
      return "Please enter the administrator's email address.";
    }

    if (!isValidEmail(adminEmail)) {
      return "Please enter a valid email address.";
    }

    if (!schoolName) {
      return "Please enter the school or college name.";
    }

    if (schoolName.length < 2) {
      return "School or college name must contain at least 2 characters.";
    }

    if (!password) {
      return "Please enter a password.";
    }

    if (password.length < 6) {
      return "Password must be at least 6 characters long.";
    }

    if (!confirmPassword) {
      return "Please confirm the password.";
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    return "";
  };

  const handleSignup = async (event) => {
    event.preventDefault();

    if (loading) {
      return;
    }

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const adminName = cleanText(form.adminName);

    const adminEmail = cleanText(
      form.adminEmail
    ).toLowerCase();

    const schoolName = cleanText(form.schoolName);

    const phone = cleanText(form.phone);

    const address = cleanText(form.address);

    try {
      setLoading(true);

      const response = await fetch(signupEndpoint, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          /*
            These names are included for compatibility with
            the different names accepted by the backend.
          */
          name: adminName,
          fullName: adminName,
          adminName,

          email: adminEmail,

          password: form.password,

          role: "admin",

          schoolName,
          nameOfSchool: schoolName,

          phone,
          address,

          principalName: adminName,

          country: "Nepal",
        }),
      });

      if (!response.ok) {
        const message = await getErrorMessage(
          response
        );

        throw new Error(message);
      }

      const data = await response.json();

      if (!data?.user || !data?.user?.schoolId) {
        throw new Error(
          "The account was created, but the school information was not returned correctly."
        );
      }

      setSuccess(
        `${data.user.schoolName || schoolName} has been registered successfully. You can now log in as the school administrator.`
      );

      setForm(initialForm);

      window.setTimeout(() => {
        navigate("/login", {
          replace: true,

          state: {
            signupSuccess: true,

            message:
              "School and administrator account created successfully. Please log in.",

            email: adminEmail,
          },
        });
      }, 1500);
    } catch (requestError) {
      console.error(
        "Admin signup error:",
        requestError
      );

      if (
        requestError instanceof TypeError &&
        requestError.message
          .toLowerCase()
          .includes("fetch")
      ) {
        setError(
          "Unable to connect to the backend. Make sure the backend is running on port 5000."
        );

        return;
      }

      setError(
        requestError.message ||
          "Unable to create the admin account. Please try again."
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
            <div className="app-brand-icon">
              🎓
            </div>

            <span>Hamro Shikshya</span>
          </div>

          <h1 className="auth-title">
            Register your institution
          </h1>

          <p className="auth-subtitle">
            Create a separate school or college workspace
            and become its first administrator.
          </p>

          <form
            className="auth-card"
            onSubmit={handleSignup}
            noValidate
          >
            <h2 className="form-title">
              Create Admin Account
            </h2>

            <p className="auth-link-text">
              Teachers and students will be added later
              by this administrator.
            </p>

            {error && (
              <div
                className="error-box"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="success-box"
                role="status"
              >
                {success}
              </div>
            )}

            <div className="auth-form-group">
              <label htmlFor="adminName">
                Administrator Full Name
              </label>

              <input
                id="adminName"
                className="auth-input"
                type="text"
                name="adminName"
                placeholder="Enter administrator's full name"
                value={form.adminName}
                onChange={handleChange}
                autoComplete="name"
                disabled={loading}
                maxLength={100}
                autoFocus
                required
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="adminEmail">
                Administrator Email
              </label>

              <input
                id="adminEmail"
                className="auth-input"
                type="email"
                name="adminEmail"
                placeholder="Enter administrator's email"
                value={form.adminEmail}
                onChange={handleChange}
                autoComplete="email"
                disabled={loading}
                maxLength={150}
                required
              />

              <small>
                This email will be used to log in to the
                admin dashboard.
              </small>
            </div>

            <div className="auth-form-group">
              <label htmlFor="schoolName">
                School or College Name
              </label>

              <input
                id="schoolName"
                className="auth-input"
                type="text"
                name="schoolName"
                placeholder="Enter school or college name"
                value={form.schoolName}
                onChange={handleChange}
                disabled={loading}
                maxLength={150}
                required
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="phone">
                Institution Phone
              </label>

              <input
                id="phone"
                className="auth-input"
                type="tel"
                name="phone"
                placeholder="Enter phone number (optional)"
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
                disabled={loading}
                maxLength={30}
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="address">
                Institution Address
              </label>

              <input
                id="address"
                className="auth-input"
                type="text"
                name="address"
                placeholder="Enter address (optional)"
                value={form.address}
                onChange={handleChange}
                autoComplete="street-address"
                disabled={loading}
                maxLength={250}
              />
            </div>

            <div className="auth-form-group">
              <label htmlFor="password">
                Password
              </label>

              <div className="auth-password-wrap">
                <input
                  id="password"
                  className="auth-input password-input"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  placeholder="Create a password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (previousValue) =>
                        !previousValue
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <small>
                Password must contain at least 6
                characters.
              </small>
            </div>

            <div className="auth-form-group">
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>

              <div className="auth-password-wrap">
                <input
                  id="confirmPassword"
                  className="auth-input password-input"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  name="confirmPassword"
                  placeholder="Enter the password again"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={6}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      (previousValue) =>
                        !previousValue
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirmed password"
                      : "Show confirmed password"
                  }
                >
                  {showConfirmPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            <button
              className="auth-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Creating institution..."
                : "Create Admin Account"}
            </button>

            <p className="auth-link-text">
              Already registered?{" "}

              <Link to="/login">
                Log in
              </Link>
            </p>
          </form>
        </section>

        <section className="auth-right">
          <div>
            <p className="showcase-topline">
              One platform for every institution.
            </p>

            <h2 className="showcase-title">
              Each school or college receives its own
              protected workspace, administrator,
              teachers, students and academic records.
            </h2>
          </div>

          <div className="showcase-center">
            <div className="showcase-badge">
              🏫
            </div>
          </div>

          <div className="showcase-footer">
            <strong>
              Designed for Nepal's education system
            </strong>

            <div className="brand-row">
              <span>Schools</span>
              <span>Colleges</span>
              <span>Teachers</span>
              <span>Students</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}