// import { useEffect, useMemo, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   collection,
//   onSnapshot,
//   orderBy,
//   query,
//   limit,
//   where,
//   getDocs,
// } from "firebase/firestore";
// import { db } from "../firebase";

// const formatDate = (ms, fallback = "") => {
//   if (!ms) return fallback || "-";
//   try {
//     return new Date(ms).toLocaleDateString();
//   } catch {
//     return fallback || "-";
//   }
// };

// export default function ExcelSalesDetail() {
//   const navigate = useNavigate();
//   const role = localStorage.getItem("role");

//   const [rows, setRows] = useState([]);
//   const [batchId, setBatchId] = useState("");
//   const [batches, setBatches] = useState([]);

//   // ✅ ADMIN GUARD
//   useEffect(() => {
//     if (role !== "ADMIN") navigate("/dashboard");
//   }, [role, navigate]);

//   // ✅ Fetch latest batches list (dropdown)
//   useEffect(() => {
//     const qLatest = query(
//       collection(db, "excel_sales_raw"),
//       orderBy("uploadedAt", "desc"),
//       limit(200),
//     );

//     const unsub = onSnapshot(qLatest, (snap) => {
//       const list = [];
//       snap.docs.forEach((d) => {
//         const b = d.data()?.batchId;
//         if (b) list.push(b);
//       });

//       // unique in order
//       const uniq = [];
//       const set = new Set();
//       for (const b of list) {
//         if (!set.has(b)) {
//           set.add(b);
//           uniq.push(b);
//         }
//       }

//       setBatches(uniq);

//       // default select latest
//       if (!batchId && uniq.length) setBatchId(uniq[0]);
//     });

//     return () => unsub();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // ✅ Fetch selected batch rows
//   useEffect(() => {
//     if (!batchId) return;

//     //     const q = query(
//     //   collection(db, "excel_sales_raw"),
//     //   where("batchId", "==", batchId)
//     // );
//     // const q = query(collection(db, "excel_sales_raw"));
//     const q = query(
//   collection(db, "excel_sales_raw"),
//   where("batchId", "==", batchId)
// );

//     const unsub = onSnapshot(q, (snap) => {
//       const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
//       setRows(list);
//     });

//     return () => unsub();
//   }, [batchId]);

//   useEffect(() => {
//     console.log("🧪 role:", role);
//     console.log("🧪 batchId:", batchId);
//     console.log("🧪 rows length:", rows.length);
//   }, [batchId, rows]);

//   // ✅ Grouped view exactly like image + total per person
//   const grouped = useMemo(() => {
//     const map = new Map();

//     rows.forEach((r) => {
//       const name = (r.salesPerson || "").trim();
//       if (!name) return;

//       if (!map.has(name)) {
//         map.set(name, {
//           name,
//           total: 0,
//           items: [],
//         });
//       }

//       const g = map.get(name);
//       const amt = Number(r.amount || 0);
//       g.total += amt;
//       g.items.push({
//         dateMs: r.dateMs,
//         dateStr: r.dateStr,
//         amount: amt,
//       });
//     });

//     return Array.from(map.values());
//   }, [rows]);

//   const grandTotal = useMemo(() => {
//     return grouped.reduce((sum, g) => sum + (g.total || 0), 0);
//   }, [grouped]);

//   return (
//     <div className="p-6 space-y-4">
//       <div className="flex flex-wrap items-center justify-between gap-3">
//         <div>
//           <h1 className="text-xl font-bold text-gray-800">
//             Excel Sales Detail
//           </h1>
//           <p className="text-sm text-gray-500">
//             This page shows ONLY Excel imported data (raw).
//           </p>
//         </div>

//         <div className="flex items-center gap-3">
//           <select
//             className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white"
//             value={batchId}
//             onChange={(e) => setBatchId(e.target.value)}
//           >
//             {!batches.length && <option value="">No batch found</option>}
//             {batches.map((b) => (
//               <option key={b} value={b}>
//                 {b}
//               </option>
//             ))}
//           </select>

//           <div className="text-sm font-semibold text-gray-700">
//             Total: ₹{grandTotal.toLocaleString("en-IN")}
//           </div>
//         </div>
//       </div>

//       <div className="overflow-hidden rounded-xl border bg-white">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead className="bg-gray-50 border-b">
//               <tr>
//                 <th className="px-4 py-3 text-left font-semibold text-gray-600">
//                   Sales Person
//                 </th>
//                 <th className="px-4 py-3 text-left font-semibold text-gray-600">
//                   Purchase Date
//                 </th>
//                 <th className="px-4 py-3 text-right font-semibold text-gray-600">
//                   Total Amount
//                 </th>
//               </tr>
//             </thead>

//             <tbody>
//               {!grouped.length ? (
//                 <tr>
//                   <td className="px-4 py-6 text-gray-500" colSpan={3}>
//                     No excel data found for selected batch.
//                   </td>
//                 </tr>
//               ) : (
//                 grouped.map((g, gi) => (
//                   <FragmentGroup key={g.name} group={g} isAlt={gi % 2 === 1} />
//                 ))
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }

// function FragmentGroup({ group, isAlt }) {
//   const bg = isAlt ? "bg-gray-50" : "bg-white";

//   return (
//     <>
//       {group.items.map((it, idx) => (
//         <tr key={idx} className={bg}>
//           <td className="px-4 py-3 font-semibold text-gray-800">
//             {idx === 0 ? group.name : ""}
//           </td>
//           <td className="px-4 py-3 text-gray-700">
//             {it.dateMs
//               ? new Date(it.dateMs).toLocaleDateString()
//               : it.dateStr || "-"}
//           </td>
//           <td className="px-4 py-3 text-right font-semibold text-green-700">
//             ₹{Number(it.amount || 0).toLocaleString("en-IN")}
//           </td>
//         </tr>
//       ))}

//       {/* ✅ Total row per Sales Person */}
//       <tr className="border-t">
//         <td
//           className="px-4 py-2 text-sm font-semibold text-gray-600"
//           colSpan={2}
//         >
//           Total ({group.name})
//         </td>
//         <td className="px-4 py-2 text-right font-bold text-gray-900">
//           ₹{group.total.toLocaleString("en-IN")}
//         </td>
//       </tr>
//     </>
//   );
// }

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
} from "firebase/firestore";
import { db } from "../firebase";

const formatDateNice = (ms, fallback = "-") => {
  if (!ms) return fallback;
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(ms));
  } catch {
    return fallback;
  }
};

const formatMoney = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ExcelSalesDetail() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  const [rows, setRows] = useState([]);
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState([]);
  const [openPerson, setOpenPerson] = useState(""); // ✅ which employee is expanded

  // ✅ ADMIN GUARD
  useEffect(() => {
    if (role !== "ADMIN") navigate("/dashboard");
  }, [role, navigate]);

  // ✅ Fetch latest batches list (dropdown)
  useEffect(() => {
    const qLatest = query(
      collection(db, "excel_sales_raw"),
      orderBy("uploadedAt", "desc"),
      limit(200),
    );

    const unsub = onSnapshot(qLatest, (snap) => {
      const list = [];
      snap.docs.forEach((d) => {
        const b = d.data()?.batchId;
        if (b) list.push(b);
      });

      // unique in order
      const uniq = [];
      const set = new Set();
      for (const b of list) {
        if (!set.has(b)) {
          set.add(b);
          uniq.push(b);
        }
      }

      setBatches(uniq);

      // default select latest
      if (!batchId && uniq.length) setBatchId(uniq[0]);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Fetch selected batch rows
  useEffect(() => {
    if (!batchId) return;

    const q = query(
      collection(db, "excel_sales_raw"),
      where("batchId", "==", batchId),
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(list);
    });

    return () => unsub();
  }, [batchId]);

  // ✅ Group by sales person (summary + details)
  const grouped = useMemo(() => {
    const map = new Map();

    rows.forEach((r) => {
      const name = (r.salesPerson || "").trim();
      if (!name) return;

      if (!map.has(name)) {
        map.set(name, { name, total: 0, items: [] });
      }

      const g = map.get(name);

      // amount safe
      const amt = Number(r.amount || 0);
      g.total += isNaN(amt) ? 0 : amt;

      // date normalize
      const ms =
        typeof r.dateMs === "number"
          ? r.dateMs
          : typeof r.dateMs?.toMillis === "function"
            ? r.dateMs.toMillis()
            : null;

      g.items.push({
        id: r.id,
        dateMs: ms,
        dateStr: r.dateStr,
        amount: isNaN(amt) ? 0 : amt,
      });
    });

    // sort items by date (newest first)
    const arr = Array.from(map.values()).map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => (b.dateMs || 0) - (a.dateMs || 0)),
    }));

    // sort people by total desc
    arr.sort((a, b) => (b.total || 0) - (a.total || 0));
    return arr;
  }, [rows]);

  const grandTotal = useMemo(
    () => grouped.reduce((sum, g) => sum + (g.total || 0), 0),
    [grouped],
  );

  const togglePerson = (name) => {
    setOpenPerson((prev) => (prev === name ? "" : name));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            Excel Sales Detail
          </h1>
          <p className="text-sm text-gray-500">
            Summary view (click total to expand employee detail).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            className="h-9 px-3 rounded-lg border border-gray-300 text-sm bg-white"
            value={batchId}
            onChange={(e) => {
              setBatchId(e.target.value);
              setOpenPerson(""); // ✅ reset expand when batch changes
            }}
          >
            {!batches.length && <option value="">No batch found</option>}
            {batches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          <div className="text-sm font-semibold text-gray-700">
            Total: {formatMoney(grandTotal)}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">
                  Sales Person
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Total Amount (Click)
                </th>
              </tr>
            </thead>

            <tbody>
              {!grouped.length ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={2}>
                    No excel data found for selected batch.
                  </td>
                </tr>
              ) : (
                grouped.map((g, idx) => {
                  const isOpen = openPerson === g.name;
                  const bg = idx % 2 === 0 ? "bg-white" : "bg-gray-50";

                  return (
                    <Fragment key={g.name}>
                      {/* ✅ SUMMARY ROW */}
                      <tr className={`${bg} border-b`}>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {g.name}
                          <span className="ml-2 text-xs text-gray-500 font-normal">
                            ({g.items.length} rows)
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => togglePerson(g.name)}
                            className="font-bold text-green-700 hover:underline"
                            title="Click to view full detail"
                          >
                            {formatMoney(g.total)} {isOpen ? "▲" : "▼"}
                          </button>
                        </td>
                      </tr>

                      {/* ✅ DETAIL ROWS (EXPAND) */}
                      {isOpen && (
                        <tr className="bg-white">
                          <td colSpan={2} className="px-4 py-4">
                            <div className="rounded-xl border bg-gray-50 p-3">
                              <div className="flex items-center justify-between mb-3">
                                <div className="font-semibold text-gray-800">
                                  Detail: {g.name}
                                </div>
                                <div className="text-sm font-bold text-gray-900">
                                  Total: {formatMoney(g.total)}
                                </div>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-white border-b">
                                    <tr>
                                      <th className="px-3 py-2 text-left font-semibold text-gray-600">
                                        Purchase Date
                                      </th>
                                      <th className="px-3 py-2 text-right font-semibold text-gray-600">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {g.items.map((it, i) => (
                                      <tr key={it.id || i} className="border-b">
                                        <td className="px-3 py-2 text-gray-700">
                                          {it.dateMs
                                            ? formatDateNice(it.dateMs)
                                            : it.dateStr || "-"}
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-green-700">
                                          {formatMoney(it.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ✅ tiny Fragment helper without importing React.Fragment separately
function Fragment({ children }) {
  return <>{children}</>;
}
