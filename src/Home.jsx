import agri1 from "./agri1.jpg";
import "./Home.css";
import { Link, useNavigate, useLocation } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleContinue = () => {
    navigate("/register");
  };

  // Function to add active class if current path matches
  const isActive = (path) => location.pathname === path ? "active-link" : "";

  return (
    <div>
      {/* ✅ Navbar */}
      <header className="navbar">
        <div className="nav-logo">
          🌱 <span>SmartAgri</span>
        </div>
        <nav className="nav-links">
          <Link to="/" className={isActive("/")}>Home</Link>
          <Link to="/dashboard" className={isActive("/dashboard")}>Dashboard</Link>
          <Link to="/work" className={isActive("/work")}>Workflow</Link>
        </nav>
        <button className="nav-btn" onClick={handleContinue}>
          Login
        </button>
      </header>

      {/* ✅ Fullscreen Hero Section */}
      <div className="fullscreen-hero" style={{ backgroundImage: `url(${agri1})` }}>
        <div className="hero-overlay">
          <div className="hero-content">
            <h1 className="hero-title">
              <span>🌾</span> Your <span>Smart Crop</span> Companion
            </h1>
            <p className="hero-subtitle">
              AI-powered crop advisory system to help farmers detect diseases,
              get recommendations, and boost yield.
            </p>

           <button
          onClick={() => handleContinue()}
          className="button"
          style={{ "--clr": "#00ad54" }}
        >
          <span className="button-decor"></span>
          <div className="button-content">
            <div className="button__icon">
              <svg
                viewBox="0 0 50 50"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
              >
                <circle
                  opacity="0.5"
                  cx="25"
                  cy="25"
                  r="23"
                  fill="url(#icon-payments-cat_svg__paint0_linear_1141_21101)"
                ></circle>
                <mask id="icon-payments-cat_svg__a" fill="#fff">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M34.42 15.93c.382-1.145-.706-2.234-1.851-1.852l-18.568 6.189c-1.186.395-1.362 2-.29 2.644l5.12 3.072a1.464 1.464 0 001.733-.167l5.394-4.854a1.464 1.464 0 011.958 2.177l-5.154 4.638a1.464 1.464 0 00-.276 1.841l3.101 5.17c.644 1.072 2.25.896 2.645-.29L34.42 15.93z"
                  ></path>
                </mask>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M34.42 15.93c.382-1.145-.706-2.234-1.851-1.852l-18.568 6.189c-1.186.395-1.362 2-.29 2.644l5.12 3.072a1.464 1.464 0 001.733-.167l5.394-4.854a1.464 1.464 0 011.958 2.177l-5.154 4.638a1.464 1.464 0 00-.276 1.841l3.101 5.17c.644 1.072 2.25.896 2.645-.29L34.42 15.93z"
                  fill="#fff"
                ></path>
                <defs>
                  <linearGradient
                    id="icon-payments-cat_svg__paint0_linear_1141_21101"
                    x1="25"
                    y1="2"
                    x2="25"
                    y2="48"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#fff" stopOpacity="0.71"></stop>
                    <stop offset="1" stopColor="#fff" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span className="button__text">Continue</span>
          </div>
        </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
