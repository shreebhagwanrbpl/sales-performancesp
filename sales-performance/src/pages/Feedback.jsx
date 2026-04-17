import { useEffect, useState } from "react";
import {
 collection,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "../firebase";

const FEEDBACK_SCORE = {
  Interested: { positive: 10, negative: 0 },
  Satisfied: { positive: 10, negative: 0 },
  "Not Interested": { positive: 0, negative: 12 },
  "No Response": { positive: 0, negative: 12 },
};

export default function Feedback() {
  const [sales, setSales] = useState([]);
  const role = localStorage.getItem("role"); // TL | ADMIN
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const getMonthRange = (monthStr) => {
    const [y, m] = monthStr.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime();
    return { start, end };
  };

  useEffect(() => {
    const { start, end } = getMonthRange(selectedMonth);

    const q = query(
      collection(db, "sales"),
      where("createdAtMs", ">=", start),
      where("createdAtMs", "<", end),
      orderBy("createdAtMs", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const rawDocs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      const aggregated = aggregateByEmployee(rawDocs);
      setSales(aggregated);
    });

    return () => unsub();
  }, [selectedMonth]);

  const handleFeedback = async (employeeRow, value) => {
    if (!value) return;

    if (role === "TL") {
      const alreadyGiven = employeeRow.feedbackDocs.some((d) => d.feedback);
      if (alreadyGiven) return;
    }

    const score = FEEDBACK_SCORE[value];

    for (const d of employeeRow.feedbackDocs) {
      await updateDoc(doc(db, "sales", d.id), {
        feedback: value,
        positiveScore: score.positive,
        negativeScore: score.negative,
      });
    }
  };

  // reset feedback
  const resetFeedback = async (employeeRow) => {
    if (!window.confirm("Reset feedback for this employee?")) return;

    for (const d of employeeRow.feedbackDocs) {
      await updateDoc(doc(db, "sales", d.id), {
        feedback: "",
        positiveScore: 0,
        negativeScore: 0,
        feedbackReset: true,
        feedbackResetAt: new Date(),
      });
    }
  };

  const aggregateByEmployee = (docs) => {
    const map = {};

    docs.forEach((d) => {
      const name = d.employeeName || "Unknown";

      if (!map[name]) {
        map[name] = {
          employeeName: name,
          saleAmount: 0,
          calls: 0,
          feedbackDocs: [],
          feedback: "", // ✅ employee-level feedback
        };
      }

      map[name].saleAmount += Number(d.saleAmount || 0);
      map[name].calls += Number(d.calls || 0);
      map[name].feedbackDocs.push(d);

      // ✅ agar kisi bhi sale me feedback hai → employee ka feedback
      if (d.feedback && !map[name].feedback) {
        map[name].feedback = d.feedback;
      }
    });

    return Object.values(map);
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 max-w-6xl">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">
        Customer Feedback (TL View)
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-3 text-left">Employee</th>
              <th className="px-4 py-3 text-center">Sale ₹</th>
              <th className="px-4 py-3 text-center">Calls</th>
              <th className="px-4 py-3 text-center">Feedback</th>
            </tr>
          </thead>

          <tbody>
            {sales.map((s) => (
              <tr key={s.id} className="border-t hover:bg-gray-50 transition">
                <td className="px-4 py-3 font-medium text-gray-800">
                  {s.employeeName || "Employee"}
                </td>

                <td className="px-4 py-3 text-center font-medium text-green-600">
                  ₹{s.saleAmount}
                </td>

                <td className="px-4 py-3 text-center">{s.calls}</td>
                <td className="px-4 py-3 text-center space-y-1">
                  <select
                    value={s.feedback || ""}
                    disabled={role === "TL" && !!s.feedback}
                    onChange={(e) => handleFeedback(s, e.target.value)}
                    className={`border rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500
                ${
                  role === "TL" && s.feedback
                    ? "bg-gray-100 cursor-not-allowed"
                    : ""
                }
              `}
                  >
                    <option value="">Select</option>

                    <optgroup label="Positive">
                      <option value="Interested">Interested (+10%)</option>
                      <option value="Satisfied">Satisfied (+10%)</option>
                    </optgroup>

                    <optgroup label="Negative">
                      <option value="Not Interested">
                        Not Interested (-12%)
                      </option>
                      <option value="No Response">No Response (-12%)</option>
                    </optgroup>
                  </select>

                  {/* 🔴 RESET BUTTON */}
                  {(role === "TL" || role === "ADMIN") && s.feedback && (
                    <button
                      onClick={() => resetFeedback(s)}
                      className="block mx-auto text-xs text-red-600 hover:underline"
                    >
                      Reset Feedback
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sales.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">
            No sales records found.
          </p>
        )}
      </div>
    </div>
  );
}
