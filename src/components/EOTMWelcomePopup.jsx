import { useEffect, useState, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  TrophyIcon,
  SparklesIcon,
  XMarkIcon,
  CalendarIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

export default function EOTMWelcomePopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentWinner, setCurrentWinner] = useState(null);
  const [prevWinner, setPrevWinner] = useState(null);
  const [activeTab, setActiveTab] = useState("PREVIOUS"); // "CURRENT" | "PREVIOUS"
  const [currentMonthName, setCurrentMonthName] = useState("");
  const [prevMonthName, setPrevMonthName] = useState("");
  const [clapped, setClapped] = useState(false);
  const dismissedRef = useRef(
    sessionStorage.getItem("eotm_welcome_popup_dismissed") === "true"
  );

  const normalizeName = (name = "") => {
    return name
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/mr |mrs |ms /g, "")
      .trim();
  };

  const findMatchingEmpKey = (targetMap, rawPerson = "") => {
    const normRaw = normalizeName(rawPerson);
    if (!normRaw) return null;

    const keys = Object.keys(targetMap);

    let matched = keys.find((key) => key === normRaw);
    if (matched) return matched;

    matched = keys.find((key) => key.includes(normRaw) || normRaw.includes(key));
    if (matched) return matched;

    const firstName = normRaw.split(" ")[0];
    if (firstName && firstName.length > 2) {
      const candidates = keys.filter((key) => {
        const kFirst = key.split(" ")[0];
        return key === firstName || kFirst === firstName;
      });

      if (candidates.length === 1) {
        return candidates[0];
      }
    }

    return normRaw;
  };

  useEffect(() => {
    if (dismissedRef.current || sessionStorage.getItem("eotm_welcome_popup_dismissed") === "true") {
      return;
    }

    const now = new Date();
    const currYear = now.getFullYear();
    const currMonth = now.getMonth(); // 0-indexed

    const currMonthDate = new Date(currYear, currMonth, 1);
    const prevMonthDate = new Date(currYear, currMonth - 1, 1);

    const currMonthStr = currMonthDate.toLocaleString("default", { month: "long", year: "numeric" });
    const prevMonthStr = prevMonthDate.toLocaleString("default", { month: "long", year: "numeric" });

    setCurrentMonthName(currMonthStr);
    setPrevMonthName(prevMonthStr);

    const currMonthKey = `${currYear}-${String(currMonth + 1).padStart(2, "0")}`;
    const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}`;

    let isMounted = true;

    const fetchEOTM = async () => {
      try {
        const [salesSnap, excelSnap, usersSnap, employeesSnap] = await Promise.all([
          getDocs(collection(db, "sales")),
          getDocs(collection(db, "excel_sales_raw")),
          getDocs(collection(db, "users")),
          getDocs(collection(db, "employees")),
        ]);

        if (!isMounted) return;

        const userList = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const employeeList = employeesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        const createEmpTotals = () => {
          const map = {};
          userList.forEach((u) => {
            const normName = normalizeName(u.name || u.email || "");
            if (!normName) return;
            map[normName] = {
              id: u.id,
              name: u.name || u.email || "Employee",
              email: u.email || "",
              department: u.department || "Sales Department",
              designation: u.role || "Sales Executive",
              photoUrl: u.photoUrl || "",
              totalAmount: 0,
            };
          });
          employeeList.forEach((emp) => {
            const normName = normalizeName(emp.name || emp.email || "");
            if (normName && map[normName]) {
              map[normName].department = emp.department || map[normName].department;
              map[normName].designation = emp.designation || map[normName].designation;
              if (emp.photoUrl) map[normName].photoUrl = emp.photoUrl;
            }
          });
          return map;
        };

        const currEmpMap = createEmpTotals();
        const prevEmpMap = createEmpTotals();

        const getSaleMonthKey = (data) => {
          let d = null;
          if (data.createdAtMs && typeof data.createdAtMs === "number") d = new Date(data.createdAtMs);
          else if (data.dateMs && typeof data.dateMs === "number") d = new Date(data.dateMs);
          else if (data.createdAt) {
            if (typeof data.createdAt.toMillis === "function") d = new Date(data.createdAt.toMillis());
            else if (typeof data.createdAt.toDate === "function") d = data.createdAt.toDate();
            else d = new Date(data.createdAt);
          } else if (data.uploadedAt) {
            if (typeof data.uploadedAt.toMillis === "function") d = new Date(data.uploadedAt.toMillis());
            else if (typeof data.uploadedAt.toDate === "function") d = data.uploadedAt.toDate();
            else d = new Date(data.uploadedAt);
          } else if (data.date || data.billDate || data.invoiceDate) {
            d = new Date(data.date || data.billDate || data.invoiceDate);
          }

          if (!d || isNaN(d.getTime())) return null;
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        };

        // Process Firestore Sales
        salesSnap.docs.forEach((doc) => {
          const data = doc.data();
          const key = getSaleMonthKey(data);
          if (!key) return;

          const amt = Number(data.saleAmount ?? data.amount ?? 0);
          const empName = data.employeeName || data.employeeEmail || "";
          const normName = normalizeName(empName);
          if (!normName) return;

          if (key === currMonthKey) {
            if (!currEmpMap[normName]) {
              currEmpMap[normName] = { id: normName, name: empName, email: data.employeeEmail || "", department: "Sales Department", designation: "Sales Executive", totalAmount: 0 };
            }
            currEmpMap[normName].totalAmount += amt;
          } else if (key === prevMonthKey) {
            if (!prevEmpMap[normName]) {
              prevEmpMap[normName] = { id: normName, name: empName, email: data.employeeEmail || "", department: "Sales Department", designation: "Sales Executive", totalAmount: 0 };
            }
            prevEmpMap[normName].totalAmount += amt;
          }
        });

        // Process Excel Sales
        excelSnap.docs.forEach((doc) => {
          const data = doc.data();
          const amt = Number(data.amount || 0);
          const rawPerson = data.salesPerson || data.employeeName || "";
          if (!rawPerson || !amt) return;

          const key = getSaleMonthKey(data);
          if (!key) return;

          const updateMap = (targetMap) => {
            let matchedKey = findMatchingEmpKey(targetMap, rawPerson);
            if (!matchedKey || !targetMap[matchedKey]) {
              matchedKey = normalizeName(rawPerson);
              targetMap[matchedKey] = {
                id: matchedKey,
                name: rawPerson,
                email: "",
                department: "Sales Department",
                designation: "Sales Executive",
                totalAmount: 0,
              };
            }
            targetMap[matchedKey].totalAmount += amt;
          };

          if (key === currMonthKey) {
            updateMap(currEmpMap);
          } else if (key === prevMonthKey) {
            updateMap(prevEmpMap);
          }
        });

        const sortedCurr = Object.values(currEmpMap)
          .filter((e) => e.totalAmount > 0)
          .sort((a, b) => b.totalAmount - a.totalAmount);
        const sortedPrev = Object.values(prevEmpMap)
          .filter((e) => e.totalAmount > 0)
          .sort((a, b) => b.totalAmount - a.totalAmount);

        const currTop = sortedCurr[0] || null;
        const prevTop = sortedPrev[0] || null;

        setCurrentWinner(currTop);
        setPrevWinner(prevTop);

        const dayOfMonth = now.getDate();
        if (dayOfMonth <= 10) {
          setActiveTab("PREVIOUS");
        } else if (currTop) {
          setActiveTab("CURRENT");
        } else {
          setActiveTab("PREVIOUS");
        }

        if (!dismissedRef.current && sessionStorage.getItem("eotm_welcome_popup_dismissed") !== "true") {
          setIsOpen(true);
        }
      } catch (err) {
        console.error("EOTM Welcome Popup error:", err);
      }
    };

    fetchEOTM();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleClose = () => {
    dismissedRef.current = true;
    sessionStorage.setItem("eotm_welcome_popup_dismissed", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const displayWinner = activeTab === "CURRENT" ? currentWinner : prevWinner;
  const activeMonthName = activeTab === "CURRENT" ? currentMonthName : prevMonthName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-fadeIn">
      {/* Floating Confetti Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {[...Array(24)].map((_, i) => (
          <span
            key={i}
            className="absolute text-xl animate-bounce"
            style={{
              top: `${Math.random() * 90}%`,
              left: `${Math.random() * 90}%`,
              animationDuration: `${1.5 + Math.random() * 2}s`,
              animationDelay: `${Math.random() * 1.5}s`,
              opacity: 0.8,
            }}
          >
            {["🎉", "🎊", "✨", "🌟", "🎈", "🏆", "💫"][i % 7]}
          </span>
        ))}
      </div>

      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden relative border border-amber-200 z-20 animate-scaleUp">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-900 flex items-center justify-center shadow-md border border-slate-100 transition-all hover:rotate-90"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* CELEBRATION BANNER */}
        <div className="bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 p-6 text-white text-center relative overflow-hidden shadow-md">
          <div className="absolute -left-10 -bottom-10 w-36 h-36 bg-white/20 rounded-full blur-2xl" />
          <div className="absolute -right-10 -top-10 w-36 h-36 bg-yellow-200/30 rounded-full blur-2xl" />

          {/* Header Title */}
          <div className="inline-flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-4 py-1 rounded-full text-xs font-black tracking-wider text-yellow-100 uppercase shadow-inner mb-3 border border-white/20">
            <SparklesIcon className="w-4 h-4 text-yellow-300 animate-spin" />
            EMPLOYEE OF THE MONTH
          </div>

          {/* Month Toggle Tabs */}
          <div className="flex justify-center items-center gap-1 bg-black/25 backdrop-blur-md p-1 rounded-xl max-w-xs mx-auto mb-4 border border-white/20">
            <button
              onClick={() => setActiveTab("PREVIOUS")}
              className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all ${
                activeTab === "PREVIOUS" || new Date().getDate() <= 10
                  ? "bg-white text-amber-900 shadow-sm"
                  : "text-amber-100 hover:text-white hover:bg-white/10"
              }`}
            >
              {new Date().getDate() <= 10 ? "Reigning Winner" : prevMonthName ? prevMonthName.split(" ")[0] : "Prev Month"} ({prevMonthName ? prevMonthName.split(" ")[0] : "Aug"}) 🏆
            </button>

            {new Date().getDate() > 10 && (
              <button
                onClick={() => setActiveTab("CURRENT")}
                className={`flex-1 py-1 px-2 text-[11px] font-bold rounded-lg transition-all ${
                  activeTab === "CURRENT"
                    ? "bg-white text-amber-900 shadow-sm"
                    : "text-amber-100 hover:text-white hover:bg-white/10"
                }`}
              >
                {currentMonthName ? currentMonthName.split(" ")[0] : "Current"} (Sept) ⚡
              </button>
            )}
          </div>

          {displayWinner ? (
            <>
              {/* Winner Crown & Avatar */}
              <div className="relative mx-auto w-24 h-24 mb-3">
                <div className="w-24 h-24 rounded-full bg-white p-1.5 shadow-2xl mx-auto flex items-center justify-center overflow-hidden">
                  {displayWinner.photoUrl ? (
                    <img
                      src={displayWinner.photoUrl}
                      alt={displayWinner.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center text-3xl font-black text-amber-800 uppercase shadow-inner">
                      {displayWinner.name ? displayWinner.name.substring(0, 2) : "E"}
                    </div>
                  )}
                </div>

                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-lg shadow-lg border-2 border-white">
                  👑
                </div>

                <div className="absolute bottom-0 right-0 bg-amber-700 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                  <TrophyIcon className="w-4 h-4 text-yellow-300" />
                </div>
              </div>

              <h2 className="text-2xl font-black text-white drop-shadow-md">
                {displayWinner.name}
              </h2>

              <p className="text-xs font-bold text-amber-100 mt-0.5 tracking-wide">
                {displayWinner.designation || "Sales Executive"} • {displayWinner.department || "Sales Department"}
              </p>

              <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-[11px] font-extrabold text-amber-50">
                🌟 {activeMonthName.toUpperCase()} {activeTab === "PREVIOUS" ? "WINNER (REIGNING EOTM)" : "WINNER"}
              </span>
            </>
          ) : (
            <div className="py-6 space-y-2">
              <div className="text-4xl">🚀</div>
              <h3 className="text-lg font-black text-white">
                {activeMonthName} Sales In Progress!
              </h3>
              <p className="text-xs text-amber-100 max-w-xs mx-auto">
                No sales have been closed yet for {activeMonthName}. Switch to Previous Month tab to see the reigning Employee of the Month!
              </p>
            </div>
          )}
        </div>

        {/* POPUP BODY CONTENT */}
        <div className="p-6 text-center space-y-4">
          <div className="bg-gradient-to-br from-amber-50 to-yellow-50/70 p-4 rounded-2xl border border-amber-200/70 text-amber-900 shadow-xs">
            <span className="text-2xl">🎉 🎊</span>
            <h3 className="text-sm font-black text-amber-950 mt-1">
              Honor & Excellence!
            </h3>
            <p className="text-xs text-amber-800/90 leading-relaxed mt-1">
              {displayWinner
                ? `Celebrating outstanding dedication, teamwork, and sales achievement in ${activeMonthName}.`
                : `New month started today! Ready for groundbreaking sales performance in ${currentMonthName}!`}
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                setClapped(true);
                dismissedRef.current = true;
                sessionStorage.setItem("eotm_welcome_popup_dismissed", "true");
                setTimeout(() => setIsOpen(false), 1200);
              }}
              className={`w-full py-3 rounded-2xl font-extrabold text-sm shadow-md transition-all duration-300 cursor-pointer ${
                clapped
                  ? "bg-emerald-600 text-white shadow-emerald-200 scale-95"
                  : "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white hover:brightness-105"
              }`}
            >
              {clapped ? "Applauded! 👏🎉" : "Clap & Celebrate 👏"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

