import { useState } from "react";
import { auth } from "./Firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import "./Auth.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function Login() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    // ✅ Validation
    if (!phone || phone.length !== 10) {
      return setMessage("📱 Phone number must be exactly 10 digits.");
    }
    if (!password || password.length < 4) {
      return setMessage("🔑 Password must be at least 4 characters.");
    }

    try {
      const email = `${phone}@smartagri.com`;
      await signInWithEmailAndPassword(auth, email, password);

      localStorage.setItem("userPhone", phone);
      setMessage("✅ Login successful!");
      navigate("/core");
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="container" style={{width:"200%"}}>
        <div className="heading">Login</div>

        <form className="form" onSubmit={handleLogin} style={{width:"100%"}}>
          {/* Phone Input */}
          <input
            required
            className="input"
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            style={{ position: "relative", right: "20px" }}
          />

          {/* Password Input with Eye Icon */}
          <div style={{ position: "relative", width: "100%" }}>
            <input
              required
              className="input"
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ position: "relative", right: "20px",width:"100%" }}
            />

            {/* 👁 Eye Icon Inside Input */}
            <span
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "-10px",
                bottom:"45px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
                color: "#2d6a4f",
                fontSize: "16px",
              }}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </span>
          </div>

          <button type="submit" className="login-button">
            Login
          </button>
        </form>

        <p style={{ marginTop: "10px", textAlign: "center", fontSize: "14px" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color: "#0099ff", textDecoration: "none" }}>
            Register here
          </Link>
        </p>

        {message && (
          <p style={{ color: message.includes("✅") ? "green" : "red", marginTop: "10px" }}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
