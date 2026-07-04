import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function DailyEntry() {
  const [form, setForm] = useState({
    quotations: "",
    invoices: "",
    calls: "",
    sale: "",
  });

  const [rows, setRows] = useState([]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = async () => {
    if (!form.quotations || !form.calls) return;
    await addDoc(collection(db, "dailyEntries"), {
      quotations: form.quotations,
      invoices: form.invoices,
      calls: form.calls,
      sale: form.sale,
      date: new Date().toLocaleDateString(),
      createdAt: serverTimestamp(),
    });

    setRows([
      ...rows,
      {
        ...form,
        date: new Date().toLocaleDateString(),
      },
    ]);

    setForm({
      quotations: "",
      invoices: "",
      calls: "",
      sale: "",
    });
  };

  return (
    <div className="space-y-8">
      {/* ===== ENTRY CARD ===== */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">
          Daily Work Entry
        </h2>

        <div className="grid md:grid-cols-4 gap-4">
          <input
            name="quotations"
            value={form.quotations}
            onChange={handleChange}
            className="input"
            placeholder="Quotations"
          />
          <input
            name="invoices"
            value={form.invoices}
            onChange={handleChange}
            className="input"
            placeholder="Performa Invoice"
          />
          <input
            name="calls"
            value={form.calls}
            onChange={handleChange}
            className="input"
            placeholder="Calls Made"
          />
          <input
            name="sale"
            value={form.sale}
            onChange={handleChange}
            className="input"
            placeholder="Today Sale ₹"
          />
        </div>

        <div className="text-right mt-6">
          <button
            onClick={handleAdd}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
            Add Entry
          </button>
        </div>
      </div>

      {/* ===== TABLE ===== */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Today’s Entries
        </h3>

        {rows.length === 0 ? (
          <p className="text-gray-500 text-sm">No entries added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Quotations</th>
                  <th className="p-3 text-left">Invoices</th>
                  <th className="p-3 text-left">Calls</th>
                  <th className="p-3 text-left">Sale (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="p-3">{r.date}</td>
                    <td className="p-3">{r.quotations}</td>
                    <td className="p-3">{r.invoices}</td>
                    <td className="p-3">{r.calls}</td>
                    <td className="p-3 font-medium">₹{r.sale || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
