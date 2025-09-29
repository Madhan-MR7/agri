import "./Work.css";
import { FaCamera, FaCloudUploadAlt, FaListAlt } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Work() {
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    navigate(path);
  };

  return (
    <div>
      <header className="navbar">
        <div className="nav-logo">
          🌱 <span>SmartAgri</span>
        </div>
        <nav className="nav-links">
          <a href="/" onClick={() => handleNavigate("/")}>Home</a>
          <a href="/dashboard" onClick={() => handleNavigate("/dashboard")}>Dashboard</a>
        </nav>
        <button className="nav-btn" onClick={() => handleNavigate("/login")}>
          Login
        </button>
      </header>

      {/* ✅ Work Section */}
      <div className="work-page">
        <h1 className="work-title">How it works?</h1>
        <div className="work-steps">
          {/* Step 1 */}
          <div className="work-step">
            <div className="icon-circle">
              <FaCamera size={40} />
            </div>
            <h3>Click a Pic</h3>
            <p>Take a clear picture of your plant leaf using your phone or camera.</p>
          </div>

          {/* Step 2 */}
          <div className="work-step">
            <div className="icon-circle">
              <FaCloudUploadAlt size={40} />
            </div>
            <h3>Upload on Plant AI</h3>
            <p>
              Visit our platform and click <strong>Try Now</strong> to upload your
              captured picture for analysis.
            </p>
          </div>

          {/* Step 3 */}
          <div className="work-step">
            <div className="icon-circle">
              <FaListAlt size={40} />
            </div>
            <h3>Get Final Report</h3>
            <p>
              Our AI will process the image and provide a detailed report with
              suggestions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
