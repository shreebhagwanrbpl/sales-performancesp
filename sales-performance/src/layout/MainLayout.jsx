import { Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

export default function MainLayout() {
  const navigate = useNavigate();

  const [user, setUser] = useState({
    name: "",
    role: "",
  });

  useEffect(() => {
    setUser({
      name: localStorage.getItem("employeeName"),
      role: localStorage.getItem("role"),
    });
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("uid");
    localStorage.removeItem("employeeName");
    localStorage.removeItem("role");
    localStorage.removeItem("tlId");

    navigate("/login");
  };

  return (
    <div className="h-screen flex bg-gray-100 overflow-hidden">
      {/* SIDEBAR – FIXED */}
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER – FIXED */}
        <div className="h-16 bg-white shadow px-6 flex justify-between items-center flex-shrink-0">
          <h1 className="font-bold text-xl text-gray-700">Sales System</h1>

          <div className="flex items-center gap-4">
            <div className="text-right leading-tight">
              <p className="text-sm font-semibold text-gray-800">{user.name}</p>
              <p className="text-xs text-gray-500 uppercase">{user.role}</p>
            </div>

            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-500 hover:underline"
            >
              Logout
            </button>
          </div>
        </div>

        {/* 🔥 SCROLLABLE CONTENT ONLY */}
        <div className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

