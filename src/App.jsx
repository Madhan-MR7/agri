import { Routes, Route } from "react-router-dom";
import Home from "./Home";
import Register from "./Register";
import Login from "./Login";
import Core from "./Core";
import Work from "./Work";
import Dashboard from "./Dashboard";
import ProtectedRoute from "./ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/work" element={<Work />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route
        path="/core"
        element={
          <ProtectedRoute>
            <Core />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
