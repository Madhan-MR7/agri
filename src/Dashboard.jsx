import "./Dashboard.css";
import { FaCloudSun, FaHistory, FaChartPie, FaUpload, FaComments } from "react-icons/fa";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Dashboard() {
  const user = { name: "Farmer Rajesh", phone: "9876543210", location: "Kerala" };

  const recentReports = [
    { id: 1, crop: "Tomato", disease: "Blight Disease", date: "2 days ago", status: "⚠️ Infected" },
    { id: 2, crop: "Paddy", disease: "Healthy", date: "5 days ago", status: "✅ Healthy" },
    { id: 3, crop: "Cotton", disease: "Wilt", date: "1 week ago", status: "⚠️ Infected" },
  ];

  // Chart Data (Dummy for now – can be replaced with API data)
  const healthTrend = [
    { name: "Week 1", Healthy: 4, Infected: 1 },
    { name: "Week 2", Healthy: 5, Infected: 2 },
    { name: "Week 3", Healthy: 6, Infected: 1 },
    { name: "Week 4", Healthy: 7, Infected: 3 },
  ];

  return (
    <div className="dashboard-page">
      {/* Greeting */}
      <h1 className="dashboard-title">Welcome, {user.name}!</h1>
      <p className="dashboard-subtitle">
        Location: {user.location} | Phone: {user.phone}
      </p>

      {/* Quick Stats */}
      <div className="dashboard-cards">
        <div className="card">
          <FaChartPie size={30} className="card-icon" />
          <h3>12</h3>
          <p>Total Detections</p>
        </div>
        <div className="card">
          <FaHistory size={30} className="card-icon" />
          <h3>8</h3>
          <p>Recommendations Given</p>
        </div>
        <div className="card">
          <FaCloudSun size={30} className="card-icon" />
          <h3>32°C</h3>
          <p>Sunny Today</p>
        </div>
      </div>

      {/* Health Trend Chart */}
      <div className="chart-section">
        <h2 className="chart-title">📊 Crop Health Trend</h2>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={healthTrend}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="Healthy" stroke="#00ad54" strokeWidth={2} />
            <Line type="monotone" dataKey="Infected" stroke="#ff4d4d" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Detect New Disease */}
      <div className="detect-section">
        <button className="detect-btn">
          <FaUpload /> Upload New Image for Detection
        </button>
      </div>

      {/* Recent Reports */}
      <h2 className="recent-title">📜 Recent Reports</h2>
      <div className="recent-reports">
        {recentReports.map((report) => (
          <div key={report.id} className="report-card">
            <p><strong>{report.crop}</strong> - {report.disease}</p>
            <span className="report-meta">{report.date} | {report.status}</span>
          </div>
        ))}
      </div>

      {/* Teleconsulting Shortcut */}
      <div className="tele-section">
        <button className="tele-btn">
          <FaComments /> Talk to an Agri Expert
        </button>
      </div>
    </div>
  );
}
