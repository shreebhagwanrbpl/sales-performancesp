import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  TrophyIcon,
  SparklesIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CheckBadgeIcon,
  ChevronRightIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";

export default function EmployeeOfTheMonth() {
  const role = localStorage.getItem("role") || "EMPLOYEE";
  const [filterMode, setFilterMode] = useState("MONTH"); // "MONTH" | "YEAR" | "WEEK" | "DAILY"
  const [topEmployee, setTopEmployee] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [monthTitle, setMonthTitle] = useState("");
  const [clapped, setClapped] = useState(false);

  const normalizeName = (name = "") => {
    return name
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/mr |mrs |ms /g, "")
      .trim();
  };

  const getFirstName = (name = "") => {
    return normalizeName(name).split(" ")[0];
  };

  // Helper to compute date boundaries
  const getDateBoundaries = (mode) => {
    const now = new Date();
    let start, end;

    if (mode === "DAILY") {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    } else if (mode === "WEEK") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = d.getTime();
      end = now.getTime();
    } else if (mode === "YEAR") {
      // Financial Year (Apr to Mar)
      const currentMonth = now.getMonth();
      const startYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      start = new Date(startYear, 3, 1, 0, 0, 0).getTime();
      end = new Date(startYear + 1, 2, 31, 23, 59, 59).getTime();
    } else {
      // MONTH (default)
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime();
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
    }

    return { start, end };
  };

  useEffect(() => {
    const now = new Date();
    const monthStr = now.toLocaleString("default", { month: "long", year: "numeric" });
    if (filterMode === "YEAR") {
      const m = now.getMonth();
      const y = now.getFullYear();
      const startYear = m >= 3 ? y : y - 1;
      setMonthTitle(`FY ${startYear}-${(startYear + 1) % 100}`);
    } else if (filterMode === "WEEK") {
      setMonthTitle("LAST 7 DAYS");
    } else if (filterMode === "DAILY") {
      setMonthTitle(`TODAY (${now.toLocaleDateString()})`);
    } else {
      setMonthTitle(monthStr.toUpperCase());
    }

    const { start: rangeStartMs, end: rangeEndMs } = getDateBoundaries(filterMode);

    // Subscriptions to sales collections
    const unsubSales = onSnapshot(collection(db, "sales"), (salesSnap) => {
      onSnapshot(collection(db, "excel_sales_raw"), (excelSnap) => {
        onSnapshot(collection(db, "users"), (usersSnap) => {
          onSnapshot(collection(db, "employees"), (employeesSnap) => {
            try {
              const empTotalsMap = {};

              // 1. Process users metadata
              const userList = usersSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));

              const employeeList = employeesSnap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }));

              userList.forEach((u) => {
                const normName = normalizeName(u.name || u.email || "");
                if (!normName) return;

                empTotalsMap[normName] = {
                  id: u.id,
                  name: u.name || u.email || "Employee",
                  email: u.email || "",
                  department: u.department || "Sales Department",
                  designation: u.role || "Sales Executive",
                  photoUrl: u.photoUrl || "",
                  totalAmount: 0,
                  dealCount: 0,
                  topProduct: "General Sales",
                  productsMap: {},
                };
              });

              employeeList.forEach((emp) => {
                const normName = normalizeName(emp.name || emp.email || "");
                if (normName && empTotalsMap[normName]) {
                  empTotalsMap[normName].department = emp.department || empTotalsMap[normName].department;
                  empTotalsMap[normName].designation = emp.designation || empTotalsMap[normName].designation;
                  if (emp.photoUrl) {
                    empTotalsMap[normName].photoUrl = emp.photoUrl;
                  }
                }
              });

              // 2. Process Firestore Sales with Date Range Filter
              salesSnap.docs.forEach((doc) => {
                const data = doc.data();
                
                // Determine sale timestamp
                let saleMs = data.createdAtMs;
                if (!saleMs && data.createdAt) {
                  saleMs = data.createdAt.toMillis ? data.createdAt.toMillis() : new Date(data.createdAt).getTime();
                }

                // If sale timestamp exists and is outside current range, skip
                if (saleMs && (saleMs < rangeStartMs || saleMs > rangeEndMs)) {
                  return;
                }

                const amt = Number(data.saleAmount ?? data.amount ?? 0);
                const empName = data.employeeName || data.employeeEmail || "";
                const normName = normalizeName(empName);

                if (!normName) return;

                if (!empTotalsMap[normName]) {
                  empTotalsMap[normName] = {
                    id: data.employeeId || normName,
                    name: empName,
                    email: data.employeeEmail || "",
                    department: "Sales Department",
                    designation: "Sales Executive",
                    totalAmount: 0,
                    dealCount: 0,
                    topProduct: "General Sales",
                    productsMap: {},
                  };
                }

                empTotalsMap[normName].totalAmount += amt;
                empTotalsMap[normName].dealCount += 1;

                if (data.sales && Array.isArray(data.sales)) {
                  data.sales.forEach((s) => {
                    if (s.products) {
                      const prodStr = typeof s.products === "string" ? s.products : "";
                      prodStr.split(",").forEach((p) => {
                        const prod = p.trim();
                        if (prod) {
                          empTotalsMap[normName].productsMap[prod] =
                            (empTotalsMap[normName].productsMap[prod] || 0) + 1;
                        }
                      });
                    }
                  });
                }
              });

              // 3. Process Excel Raw Sales with Date Range Filter
              excelSnap.docs.forEach((doc) => {
                const data = doc.data();
                let excelMs = data.dateMs || data.uploadedAt;
                if (excelMs && typeof excelMs.toMillis === "function") {
                  excelMs = excelMs.toMillis();
                }

                if (excelMs && (excelMs < rangeStartMs || excelMs > rangeEndMs)) {
                  return;
                }

                const amt = Number(data.amount || 0);
                const rawPerson = data.salesPerson || data.employeeName || "";
                if (!rawPerson || !amt) return;

                const firstName = getFirstName(rawPerson);

                let matchedKey = Object.keys(empTotalsMap).find(
                  (key) => key.includes(firstName) || firstName.includes(key.split(" ")[0])
                );

                if (!matchedKey) {
                  matchedKey = normalizeName(rawPerson);
                  empTotalsMap[matchedKey] = {
                    id: matchedKey,
                    name: rawPerson,
                    email: "",
                    department: "Sales Department",
                    designation: "Sales Executive",
                    totalAmount: 0,
                    dealCount: 0,
                    topProduct: "Excel Sales",
                    productsMap: {},
                  };
                }

                empTotalsMap[matchedKey].totalAmount += amt;
                empTotalsMap[matchedKey].dealCount += 1;
              });

              // Sort by totalAmount descending
              const sortedList = Object.values(empTotalsMap)
                .map((emp) => {
                  const topProd = Object.entries(emp.productsMap).sort(
                    (a, b) => b[1] - a[1]
                  )[0]?.[0] || emp.topProduct || "General Sales";

                  return {
                    ...emp,
                    topProduct: topProd,
                  };
                })
                .sort((a, b) => b.totalAmount - a.totalAmount);

              setLeaderboard(sortedList);
              if (sortedList.length > 0 && sortedList[0].totalAmount > 0) {
                setTopEmployee(sortedList[0]);
              } else if (sortedList.length > 0) {
                setTopEmployee(sortedList[0]);
              }
            } catch (err) {
              console.error("EOTM calculation error:", err);
            } finally {
              setLoading(false);
            }
          });
        });
      });
    });

    return () => unsubSales();
  }, [filterMode]);

  // Export Leaderboard to Excel for Admin
  const exportEOTMReport = () => {
    if (!leaderboard.length) {
      alert("No employee performance data available to export.");
      return;
    }

    const exportData = leaderboard.map((emp, index) => ({
      Rank: index + 1,
      "Employee Name": emp.name,
      Email: emp.email || "-",
      Department: emp.department || "-",
      Designation: emp.designation || "-",
      "Total Sales (₹)": emp.totalAmount,
      "Deals Closed": emp.dealCount,
      "Top Product Sold": emp.topProduct || "-",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employee Ranking");

    const fileName = `Employee_Performance_${filterMode}_${monthTitle.replace(
      / /g,
      "_"
    )}.xlsx`;

    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });

    saveAs(new Blob([excelBuffer]), fileName);
  };

  const displayEmployee = topEmployee || {
    name: "Nikita Rajawat",
    designation: "Sales Executive",
    department: "Sales Department",
    totalAmount: 28895733,
    dealCount: 894,
    topProduct: "HemoCue HB 301 System",
  };

  const getTitleLabel = () => {
    if (filterMode === "YEAR") return "EMPLOYEE OF THE YEAR";
    if (filterMode === "WEEK") return "EMPLOYEE OF THE WEEK";
    if (filterMode === "DAILY") return "EMPLOYEE OF THE DAY";
    return "EMPLOYEE OF THE MONTH";
  };

  return (
    <div className="flex-shrink-0 w-full sm:w-[260px] flex flex-col justify-stretch">
      {/* ===== ENTERPRISE LIGHT THEME WIDGET BUTTON ===== */}
      <button
        onClick={() => setShowModal(true)}
        className="
          w-full h-full min-h-[110px]
          flex items-center gap-3.5
          px-4 py-3 rounded-2xl
          bg-gradient-to-br from-amber-50/90 via-yellow-50/50 to-white
          border border-amber-200/90
          shadow-xs hover:shadow-md hover:border-amber-300
          hover:scale-[1.01]
          transition-all duration-300 group relative overflow-hidden text-left
        "
        title="Click to view Employee performance rankings"
      >
        {/* Subtle background ambient shine */}
        <div className="absolute -right-8 -top-8 w-24 h-24 bg-amber-200/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />

        {/* 3D Trophy Badge Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-amber-500 p-0.5 shadow-sm border border-amber-200">
            <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-2xl shadow-inner">
              🏆
            </div>
          </div>
          <span className="absolute -bottom-1.5 -right-1 flex h-4 px-1 items-center justify-center rounded-full bg-gradient-to-r from-amber-600 to-yellow-600 text-[9px] font-extrabold text-white shadow-sm border border-white">
            #1
          </span>
        </div>

        {/* Text Metadata */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="inline-flex items-center gap-1 w-fit px-2 py-0.5 rounded-full bg-amber-100/70 border border-amber-200/60 text-[9.5px] font-bold text-amber-800 tracking-wide uppercase">
            <SparklesIcon className="w-3 h-3 text-amber-600 animate-pulse" />
            {filterMode === "YEAR" ? "EOY" : "EOTM"}
          </div>

          <p className="text-xs font-extrabold text-slate-900 truncate mt-1 group-hover:text-amber-900 transition-colors">
            {displayEmployee.name}
          </p>
          
          <p className="text-[10.5px] font-semibold text-amber-700/90 truncate">
            {displayEmployee.designation || "Star Performer"}
          </p>
        </div>

        {/* Action arrow indicator */}
        <div className="text-amber-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all">
          <ChevronRightIcon className="w-4 h-4" />
        </div>
      </button>

      {/* ===== ENTERPRISE LIGHT MODAL WITH FILTER TABS ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative border border-slate-100">
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-400 hover:text-slate-700 flex items-center justify-center shadow-sm border border-slate-100 transition-all"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>

            {/* LIGHT GOLD HEADER BANNER */}
            <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 p-6 text-white text-center relative overflow-hidden shadow-sm">
              <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-white/20 rounded-full blur-2xl" />
              <div className="absolute -right-12 -top-12 w-36 h-36 bg-amber-200/30 rounded-full blur-2xl" />

              <div className="inline-flex items-center gap-1.5 bg-black/15 backdrop-blur-md px-3.5 py-1 rounded-full text-[11px] font-bold tracking-wider text-amber-50 uppercase shadow-inner mb-3">
                <TrophyIcon className="w-3.5 h-3.5 text-yellow-200" />
                {getTitleLabel()} • {monthTitle}
              </div>

              {/* FILTER RANGE TABS (Monthly / Yearly / Weekly / Daily) */}
              <div className="flex justify-center items-center gap-1 bg-black/20 backdrop-blur-md p-1 rounded-xl max-w-xs mx-auto mb-4 border border-white/20">
                {[
                  { id: "MONTH", label: "Monthly" },
                  { id: "YEAR", label: "Yearly" },
                  { id: "WEEK", label: "Weekly" },
                  { id: "DAILY", label: "Daily" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilterMode(tab.id)}
                    className={`flex-1 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      filterMode === tab.id
                        ? "bg-white text-amber-900 shadow-sm"
                        : "text-amber-100 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Avatar Ring */}
              <div className="relative mx-auto w-20 h-20 mb-2">
                <div className="w-20 h-20 rounded-full bg-white p-1 shadow-lg mx-auto flex items-center justify-center overflow-hidden">
                  {displayEmployee.photoUrl ? (
                    <img
                      src={displayEmployee.photoUrl}
                      alt={displayEmployee.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-100 to-yellow-50 flex items-center justify-center text-2xl font-black text-amber-800 uppercase shadow-inner">
                      {displayEmployee.name ? displayEmployee.name.substring(0, 2) : "E"}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 bg-amber-600 text-white p-1 rounded-full shadow-md border-2 border-white">
                  <SparklesIcon className="w-3.5 h-3.5 text-yellow-300" />
                </div>
              </div>

              <h2 className="text-xl font-extrabold text-white drop-shadow-sm">
                {displayEmployee.name}
              </h2>
              <p className="text-xs font-medium text-amber-100 mt-0.5">
                {displayEmployee.designation} • {displayEmployee.department}
              </p>
            </div>

            {/* MODAL BODY */}
            <div className="p-6">
              {/* ================= EMPLOYEE / TL VIEW ================= */}
              {role !== "ADMIN" ? (
                <div className="text-center space-y-5">
                  <div className="bg-gradient-to-br from-amber-50/90 to-yellow-50/60 rounded-2xl p-4 border border-amber-200/80 shadow-sm text-center">
                    <span className="text-3xl">👏</span>
                    <h3 className="text-sm font-bold text-amber-900 mt-1">
                      Congratulations & Star Recognition!
                    </h3>
                    <p className="text-xs text-amber-800/90 leading-relaxed mt-1">
                      Recognized as top performer for <b>{monthTitle}</b>.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs">
                        <BriefcaseIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Department</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{displayEmployee.department}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                        <CheckBadgeIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">Status</p>
                        <p className="text-xs font-bold text-emerald-700">Top Performer</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <button
                      onClick={() => setClapped(true)}
                      className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all duration-200 ${
                        clapped
                          ? "bg-emerald-600 text-white shadow-emerald-200 scale-95"
                          : "bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:brightness-105"
                      }`}
                    >
                      {clapped ? "Applauded! 👏🎉" : "Send Congratulations 👏"}
                    </button>
                  </div>
                </div>
              ) : (
                /* ================= ADMIN FULL DETAIL VIEW ================= */
                <div className="space-y-5">
                  {/* Metric Cards for Admin */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200/80 text-center">
                      <p className="text-[9.5px] font-bold text-emerald-800 uppercase tracking-wider">
                        {filterMode === "YEAR" ? "Yearly Sales" : "Sales Achieved"}
                      </p>
                      <p className="text-sm font-extrabold text-emerald-700 mt-1">
                        ₹{Number(displayEmployee.totalAmount || 0).toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="bg-blue-50/80 p-3 rounded-2xl border border-blue-200/80 text-center">
                      <p className="text-[9.5px] font-bold text-blue-800 uppercase tracking-wider">
                        Deals Closed
                      </p>
                      <p className="text-sm font-extrabold text-blue-700 mt-1">
                        {displayEmployee.dealCount || 0}
                      </p>
                    </div>

                    <div className="bg-purple-50/80 p-3 rounded-2xl border border-purple-200/80 text-center truncate">
                      <p className="text-[9.5px] font-bold text-purple-800 uppercase tracking-wider">
                        Top Product
                      </p>
                      <p className="text-xs font-bold text-purple-700 mt-1 truncate" title={displayEmployee.topProduct}>
                        {displayEmployee.topProduct || "General Sales"}
                      </p>
                    </div>
                  </div>

                  {/* Top Performers Leaderboard Table */}
                  <div>
                    <div className="flex justify-between items-center mb-2.5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <ChartBarIcon className="w-4 h-4 text-amber-500" />
                        Leaderboard ({filterMode})
                      </h4>

                      <button
                        onClick={exportEOTMReport}
                        className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
                      >
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        Export Excel
                      </button>
                    </div>

                    <div className="border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {leaderboard.map((emp, index) => (
                          <div
                            key={emp.id || index}
                            className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors ${
                              index === 0
                                ? "bg-amber-50/60 font-semibold"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] ${
                                  index === 0
                                    ? "bg-amber-400 text-amber-950 shadow-xs"
                                    : index === 1
                                    ? "bg-slate-300 text-slate-800"
                                    : index === 2
                                    ? "bg-amber-700 text-white"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                              </span>
                              <div>
                                <p className="font-bold text-slate-800">{emp.name}</p>
                                <p className="text-[10px] text-slate-500">{emp.department || "Sales Department"}</p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="font-extrabold text-emerald-700">
                                ₹{Number(emp.totalAmount || 0).toLocaleString("en-IN")}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {emp.dealCount} deal{emp.dealCount > 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Admin Footer Controls */}
                  <div className="border-t pt-3 flex justify-end">
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                    >
                      Close View
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
