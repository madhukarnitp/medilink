import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/UI";
import { loginStyles as styles } from "../../styles/tailwindStyles";
import logo from "../../assets/logo.png";

const getResetToken = (location) => {
  const route =
    location.hash.replace(/^#\/?/, "") || location.pathname.replace(/^\/+/, "");
  const parts = route.split(/[?#]/)[0].split("/").filter(Boolean);
  return parts[0] === "reset-password" && parts[1]
    ? decodeURIComponent(parts[1])
    : "";
};

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(() => getResetToken(location), [location]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e && e.preventDefault();
    setError("");
    setNotice("");

    if (!token) {
      setError("Password reset link is invalid or missing.");
      return;
    }
    if (!password || !confirmPassword) {
      setError("Enter and confirm your new password");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { auth } = await import("../../services/api");
      await auth.resetPassword(token, password);
      setPassword("");
      setConfirmPassword("");
      setNotice("Password updated. You can now login with your new password.");
      window.setTimeout(() => navigate("/", { replace: true }), 1200);
    } catch (err) {
      setError(err.message || "Could not reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.background} />
      <div className={styles.card}>
        <div className={styles.header}>
          <img src={logo} alt="MediLink logo" className={styles.logoImage} />
          <h1>Set New Password</h1>
          <p>Choose a new password for your MediLink account</p>
        </div>

        {notice && <div className={styles.notice}>{notice}</div>}
        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleReset} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              disabled={loading || !token}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              disabled={loading || !token}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <Button
            variant="primary"
            className={styles.loginBtn}
            disabled={loading || !token}
            type="submit"
          >
            {loading ? "Updating..." : "Update Password"}
          </Button>
        </form>

        <div className={styles.authSwitch}>
          <span>Remembered it?</span>
          <button onClick={() => navigate("/")} type="button">
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}
