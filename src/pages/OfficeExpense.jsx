import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FaMoneyBillWave,
  FaSave,
  FaEdit,
  FaTrash,
  FaSearch,
  FaFilter,
  FaCalendarAlt,
  FaWallet,
  FaFileInvoiceDollar,
  FaPlus,
} from "react-icons/fa";

export default function OfficeExpense() {
  const emptyForm = {
    expenseDate: new Date().toISOString().slice(0, 10),
    category: "",
    title: "",
    amount: "",
    paymentMode: "",
    vendor: "",
    invoiceNo: "",
    employee: "",
    description: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const expenseRef = collection(db, "officeExpenses");

  const categories = [
    "Office Supplies",
    "Stationery",
    "Electricity",
    "Internet",
    "Rent",
    "Travel",
    "Fuel",
    "Salary",
    "Marketing",
    "Food",
    "Maintenance",
    "Miscellaneous",
  ];

  const paymentModes = [
    "Cash",
    "UPI",
    "Bank Transfer",
    "Credit Card",
    "Debit Card",
    "Cheque",
  ];

  const loadExpenses = async () => {
    setLoading(true);

    const snap = await getDocs(expenseRef);

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    data.sort(
      (a, b) =>
        new Date(b.expenseDate).getTime() - new Date(a.expenseDate).getTime(),
    );

    setExpenses(data);

    setLoading(false);
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.expenseDate || !form.category || !form.title || !form.amount) {
      alert("Please fill all required fields.");
      return;
    }

    setLoading(true);

    try {
      if (editId) {
        await updateDoc(doc(db, "officeExpenses", editId), {
          ...form,
          amount: Number(form.amount),
        });

        alert("Expense Updated Successfully");
      } else {
        await addDoc(expenseRef, {
          ...form,
          amount: Number(form.amount),
          createdAt: serverTimestamp(),
        });

        alert("Expense Saved Successfully");
      }

      setForm(emptyForm);
      setEditId(null);

      loadExpenses();
    } catch (err) {
      console.log(err);
      alert("Something went wrong.");
    }

    setLoading(false);
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditId(item.id);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;

    await deleteDoc(doc(db, "officeExpenses", id));

    loadExpenses();
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const searchMatch =
        item.title?.toLowerCase().includes(search.toLowerCase()) ||
        item.vendor?.toLowerCase().includes(search.toLowerCase()) ||
        item.employee?.toLowerCase().includes(search.toLowerCase());

      const categoryMatch = categoryFilter
        ? item.category === categoryFilter
        : true;

      const dateMatch = dateFilter ? item.expenseDate === dateFilter : true;

      return searchMatch && categoryMatch && dateMatch;
    });
  }, [expenses, search, categoryFilter, dateFilter]);

  const totalExpense = filteredExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const todayExpense = filteredExpenses
    .filter(
      (item) => item.expenseDate === new Date().toISOString().slice(0, 10),
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const thisMonthExpense = filteredExpenses
    .filter((item) =>
      item.expenseDate.startsWith(new Date().toISOString().slice(0, 7)),
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return (
    <>
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-blue-700 to-indigo-700 rounded-3xl p-8 text-white shadow-xl">
            <h1 className="text-4xl font-bold">Office Expense Management</h1>

            <p className="opacity-90 mt-2">
              Track Office Expenses with Complete History
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-6 mt-8">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-gray-500">Total Expense</p>

                  <h2 className="text-3xl font-bold mt-2">
                    ₹ {totalExpense.toLocaleString()}
                  </h2>
                </div>

                <FaWallet className="text-5xl text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-gray-500">Today's Expense</p>

                  <h2 className="text-3xl font-bold mt-2">
                    ₹ {todayExpense.toLocaleString()}
                  </h2>
                </div>

                <FaMoneyBillWave className="text-5xl text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex justify-between">
                <div>
                  <p className="text-gray-500">This Month</p>

                  <h2 className="text-3xl font-bold mt-2">
                    ₹ {thisMonthExpense.toLocaleString()}
                  </h2>
                </div>

                <FaFileInvoiceDollar className="text-5xl text-red-600" />
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl shadow-xl p-8 mt-8"
          >
            <div className="flex items-center gap-3 mb-8">
              <FaPlus className="text-blue-700 text-2xl" />

              <h2 className="text-2xl font-bold">Office Expense Form</h2>
            </div>

            <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-5">
              <div>
                <label className="font-semibold">Expense Date</label>

                <input
                  type="date"
                  name="expenseDate"
                  value={form.expenseDate}
                  onChange={handleChange}
                  className="w-full mt-2 border rounded-xl p-3"
                />
              </div>

              <div>
                <label className="font-semibold">Expense Category</label>

                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className="w-full mt-2 border rounded-xl p-3"
                >
                  <option value="">Select Category</option>

                  {categories.map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}

                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold">Expense Title</label>

                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="Expense Title"
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold">Amount</label>

                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="₹ Amount"
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold">Payment Mode</label>

                <select
                  name="paymentMode"
                  value={form.paymentMode}
                  onChange={handleChange}
                  className="w-full mt-2 border rounded-xl p-3"
                >
                  <option value="">Select Payment</option>

                  {paymentModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold">Vendor Name</label>

                <input
                  type="text"
                  name="vendor"
                  value={form.vendor}
                  onChange={handleChange}
                  placeholder="Vendor Name"
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold">Invoice No.</label>

                <input
                  type="text"
                  name="invoiceNo"
                  value={form.invoiceNo}
                  onChange={handleChange}
                  placeholder="Invoice Number"
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold">Employee Name</label>

                <input
                  type="text"
                  name="employee"
                  value={form.employee}
                  onChange={handleChange}
                  placeholder="Employee Name"
                  className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="font-semibold">Description</label>

              <textarea
                rows="4"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Expense Description..."
                className="w-full mt-2 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-4 mt-8">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-700 hover:bg-blue-800 text-white px-8 py-3 rounded-xl flex items-center gap-3"
              >
                <FaSave />

                {editId ? "Update Expense" : "Save Expense"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setForm(emptyForm);
                  setEditId(null);
                }}
                className="bg-gray-200 hover:bg-gray-300 px-8 py-3 rounded-xl"
              >
                Reset
              </button>
            </div>
          </form>

          <div className="bg-white rounded-3xl shadow-xl p-6 mt-8">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <h2 className="text-2xl font-bold">Expense Records</h2>

              <div className="flex flex-wrap gap-3">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-4 text-gray-500" />

                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="border rounded-xl pl-10 pr-4 py-3"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="border rounded-xl px-4 py-3"
                >
                  <option value="">All Categories</option>

                  {categories.map((cat) => (
                    <option key={cat}>{cat}</option>
                  ))}
                </select>

                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="border rounded-xl px-4 py-3"
                />
              </div>
            </div>

            <div className="overflow-x-auto mt-8">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-700 text-white">
                    <th className="p-4">#</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Title</th>
                    <th className="p-4">Vendor</th>
                    <th className="p-4">Invoice</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan="10"
                        className="text-center py-12 text-gray-500 text-lg"
                      >
                        Loading Expenses...
                      </td>
                    </tr>
                  ) : filteredExpenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan="10"
                        className="text-center py-12 text-gray-400 text-lg"
                      >
                        No Expense Found
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((item, index) => (
                      <tr
                        key={item.id}
                        className="border-b hover:bg-slate-50 transition"
                      >
                        <td className="p-4 font-semibold">{index + 1}</td>

                        <td className="p-4">{item.expenseDate}</td>

                        <td className="p-4">
                          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                            {item.category}
                          </span>
                        </td>

                        <td className="p-4 font-medium">{item.title}</td>

                        <td className="p-4">{item.vendor || "-"}</td>

                        <td className="p-4">{item.invoiceNo || "-"}</td>

                        <td className="p-4">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium

                          ${
                            item.paymentMode === "Cash"
                              ? "bg-yellow-100 text-yellow-700"
                              : item.paymentMode === "UPI"
                                ? "bg-green-100 text-green-700"
                                : item.paymentMode === "Bank Transfer"
                                  ? "bg-blue-100 text-blue-700"
                                  : item.paymentMode === "Credit Card"
                                    ? "bg-purple-100 text-purple-700"
                                    : item.paymentMode === "Debit Card"
                                      ? "bg-pink-100 text-pink-700"
                                      : "bg-gray-100 text-gray-700"
                          }

                        `}
                          >
                            {item.paymentMode}
                          </span>
                        </td>

                        <td className="p-4">{item.employee || "-"}</td>

                        <td className="p-4">
                          <span className="font-bold text-green-700 text-lg">
                            ₹ {Number(item.amount).toLocaleString()}
                          </span>
                        </td>

                        <td className="p-4">
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleEdit(item)}
                              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl"
                            >
                              <FaEdit />
                            </button>

                            <button
                              onClick={() => handleDelete(item.id)}
                              className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-xl"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
