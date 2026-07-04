import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import * as XLSX from "xlsx";

export default function ReportPage() {
  const [rangeType, setRangeType] = useState("MONTH");
  const [data, setData] = useState([]);
  const [totalSale, setTotalSale] = useState(0);
  const [openEmployee, setOpenEmployee] = useState("");
  const [sourceType, setSourceType] = useState("ALL");
  const role = localStorage.getItem("role");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");
  const [employeeList, setEmployeeList] = useState([]);

  const auth = getAuth();
  const normalize = (name = "") =>
    name.toLowerCase().replace(/\s+/g, "").trim();
  const getRange = () => {
    const now = new Date();
    if (rangeType === "DAILY") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    if (rangeType === "3MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return { start, end: now };
    }
    if (rangeType === "6MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return { start, end: now };
    }
    if (rangeType === "YEAR") {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start, end: now };
    }
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: now };
  };

  const fetchReport = async () => {
    const { start, end } = getRange();

    const uid = auth.currentUser?.uid;

    let salesQ;

    if (role === "EMPLOYEE") {
      salesQ = query(
        collection(db, "sales"),
        where("employeeId", "==", uid),
        where("createdAtMs", ">=", start.getTime()),
        where("createdAtMs", "<", end.getTime()),
      );
    } else {
      salesQ = query(
        collection(db, "sales"),
        where("createdAtMs", ">=", start.getTime()),
        where("createdAtMs", "<", end.getTime()),
      );
    }

    const salesSnap = await getDocs(salesQ);

    const salesData = salesSnap.docs.map((d) => ({
      type: "Manual",
      ...d.data(),
    }));

    // let excelQ;
    // if (rangeType === "YEAR") {
    //   excelQ = query(collection(db, "excel_sales_raw"));
    // } else {
    //   excelQ = query(
    //     collection(db, "excel_sales_raw"),
    //     where("dateMs", ">=", start.getTime()),
    //     where("dateMs", "<", end.getTime()),
    //   );
    // }
    let excelQ;
    if (role === "EMPLOYEE") {
      excelQ = null;
    } else {
      if (rangeType === "YEAR") {
        excelQ = query(collection(db, "excel_sales_raw"));
      } else {
        excelQ = query(
          collection(db, "excel_sales_raw"),
          where("dateMs", ">=", start.getTime()),
          where("dateMs", "<", end.getTime()),
        );
      }
    }

    // const excelSnap = await getDocs(excelQ);
    // const excelData = excelSnap.docs.map((d) => ({
    //   type: "Excel",
    //   ...d.data(),
    // }));

    let excelData = [];

    if (excelQ) {
      const excelSnap = await getDocs(excelQ);

      excelData = excelSnap.docs.map((d) => {
        const data = d.data();

        return {
          type: "Excel",
          ...data,
          employeeName:
            data.employeeName ||
            data.salesPerson ||
            data.employee ||
            data.executive ||
            "", // fallback
        };
      });
    }

    let merged = [];

    if (sourceType === "EXCEL") {
      merged = excelData;
    } else if (sourceType === "SALES") {
      merged = salesData;
    } else {
      merged = [...salesData, ...excelData];
    }
    // 🔥 EMPLOYEE FILTER APPLY
    if (sourceType === "EMPLOYEE" && employeeFilter !== "ALL") {
      merged = merged.filter((r) => {
        const name =
          r.employeeName || r.salesPerson || r.employee || r.executive || "";
        return normalize(name) === normalize(employeeFilter);
      });
    }

    // 🔥 GROUPING + DAILY BREAKDOWN
    const grouped = {};

    merged.forEach((r) => {
      const rawName = r.employeeName || r.salesPerson || "Unknown";
      const key = normalize(rawName);

      if (!grouped[key]) {
        grouped[key] = {
          name: rawName,
          total: 0,
          daily: {},
        };
      }

      //

      const amount = r.saleAmount || r.amount || 0;
      grouped[key].total += amount;

      // 🔥 FIXED DATE PARSING
      let date = null;

      if (r.createdAtMs) {
        date = new Date(r.createdAtMs);
      } else if (r.dateMs) {
        date = new Date(r.dateMs);
      } else if (r.date) {
        const parts = r.date.split(/[\/\-]/);

        if (parts.length === 3) {
          // DD/MM/YYYY fix
          date = new Date(
            Number(parts[2]),
            Number(parts[1]) - 1,
            Number(parts[0]),
          );
        }
      }

      // ❌ invalid date skip
      if (!date || isNaN(date.getTime())) return;

      const day = date.toLocaleDateString();
      if (!grouped[key].daily[day]) {
        grouped[key].daily[day] = [];
      }
      grouped[key].daily[day].push({
        amount: amount,
        piNumber:
          r.piNumber ||
          r.piNo ||
          r.pi ||
          r.invoiceNumber ||
          // 🔥 SALES FORM FIX
          (Array.isArray(r.pis) && r.pis.length > 0
            ? r.pis.map((p) => p.piNo).join(", ")
            : "") ||
          (Array.isArray(r.sales) && r.sales.length > 0
            ? r.sales.map((s) => s.piNo).join(", ")
            : "") ||
          (r.type === "Excel" ? "Excel Entry" : "-"),
      });
    });

    const finalData = Object.values(grouped);

    const total = finalData.reduce((sum, e) => sum + e.total, 0);

    setData(finalData);
    setTotalSale(total);
  };

  useEffect(() => {
    fetchReport();
  }, [rangeType, sourceType, employeeFilter]);

  const toggleRow = (name) => {
    setOpenEmployee((prev) => (prev === name ? "" : name));
  };

  const currentMonthName = new Date().toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    const fetchEmployees = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map((d) => ({
        id: d.id,
        name: d.data().name || d.data().displayName || d.data().email,
      }));
      setEmployeeList(list);
    };

    if (role !== "EMPLOYEE") fetchEmployees();
  }, []);

  const handleExport = () => {
    let exportData = [];

    data.forEach((emp) => {
      Object.keys(emp.daily).forEach((date) => {
        emp.daily[date].forEach((entry) => {
          exportData.push({
            Employee: emp.name,
            Date: date,
            "PI Number": entry.piNumber,
            Amount: entry.amount,
          });
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Report");

    XLSX.writeFile(workbook, "Sales_Report.xlsx");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">📊 Sales Report</h1>
          <p className="text-sm text-gray-500">
            {rangeType === "DAILY"
              ? "Today"
              : rangeType === "3MONTH"
                ? "Last 3 Months"
                : rangeType === "6MONTH"
                  ? "Last 6 Months"
                  : rangeType === "YEAR"
                    ? "Full Year"
                    : currentMonthName}
          </p>
        </div>

        <div className="text-lg font-semibold text-green-600">
          Total Sale: ₹ {totalSale.toLocaleString("en-IN")}
        </div>

        {role !== "EMPLOYEE" && (
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
          >
            Export Excel
          </button>
        )}
      </div>

      <div className="flex gap-3 items-center">
        {[
          { label: "Today", value: "DAILY" },
          { label: "3 Months", value: "3MONTH" },
          { label: "6 Months", value: "6MONTH" },
          { label: "Year", value: "YEAR" },
        ].map((btn) => (
          <button
            key={btn.value}
            onClick={() => setRangeType(btn.value)}
            className={`px-4 py-2 rounded-lg ${
              rangeType === btn.value ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            {btn.label}
          </button>
        ))}

        {role !== "EMPLOYEE" && (
          <>
            {/* SOURCE */}
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="px-3 py-2 rounded-lg border bg-white shadow-sm"
            >
              <option value="ALL">All</option>
              <option value="EXCEL">From Excel</option>
              <option value="SALES">From Sales</option>
              <option value="EMPLOYEE">Employee Wise</option>
            </select>

            {/* EMPLOYEE FILTER */}
            {sourceType === "EMPLOYEE" && (
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border bg-white shadow-sm"
              >
                <option value="ALL">Select Employee</option>
                {employeeList.map((emp) => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-right">Total Sale</th>
            </tr>
          </thead>

          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan="2" className="text-center p-6">
                  No Data
                </td>
              </tr>
            ) : (
              data.map((row, i) => {
                const isOpen = openEmployee === row.name;

                return (
                  <>
                    {/* 🔥 MAIN ROW */}
                    <tr key={i} className="border-b">
                      <td className="p-3 font-medium">{row.name}</td>

                      <td className="p-3 text-right">
                        <button
                          onClick={() => toggleRow(row.name)}
                          className="text-green-600 font-bold hover:underline"
                        >
                          ₹ {row.total.toLocaleString("en-IN")}{" "}
                          {isOpen ? "▲" : "▼"}
                        </button>
                      </td>
                    </tr>

                    {/* 🔥 DETAIL ROW */}
                    {isOpen && role !== "EMPLOYEE" && (
                      <tr>
                        <td colSpan="2" className="p-4 bg-gray-50">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-white">
                                <th className="p-2 text-left">Date</th>
                                <th className="p-2 text-left">PI Number</th>
                                <th className="p-2 text-right">Amount</th>
                              </tr>
                            </thead>

                            <tbody>
                              {(() => {
                                const sortedDays = Object.keys(row.daily).sort(
                                  (a, b) => new Date(b) - new Date(a),
                                );

                                return sortedDays.map((date, idx) => {
                                  const entries = row.daily[date];

                                  return entries.map((e, j) => (
                                    <tr key={idx + "-" + j}>
                                      <td className="p-2 font-semibold text-gray-700">
                                        {date}
                                      </td>
                                      <td className="p-2">{e.piNumber}</td>
                                      <td className="p-2 text-right text-green-600">
                                        ₹ {e.amount.toLocaleString("en-IN")}
                                      </td>
                                    </tr>
                                  ));
                                });
                              })()}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
