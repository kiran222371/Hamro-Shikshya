import { useNavigate } from "react-router-dom";
import { logout } from "../utils/auth";

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <button className="btn secondary" onClick={handleLogout}>
      Logout
    </button>
  );
}

export default LogoutButton;