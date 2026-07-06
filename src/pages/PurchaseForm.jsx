// ============================
// IMPORTS
// ============================
import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
  getDocs,
  getDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { db, auth } from "../firebase";

// ============================
// DEFAULT ITEM
// ============================

const createEmptyItem = () => ({
  requisitionPerson: "",
  itemName: "",
  description: "",
  expiryDate: "",
  duration: "",
  unit: "",
  hsnCode: "",
  quantity: "",
  price: "",
  discount: "",
  gst: "",
});

// ============================
// DEFAULT FORM
// ============================

const emptyForm = {
  vendorName: "",
  contactNumber: "",
  alternateNumber: "",
  email: "",
  location: "",
  remarks: "",

  items: [createEmptyItem()],
};

// ============================
// COMPONENT
// ============================

export default function PurchaseForm() {
  const [purchases, setPurchases] = useState([]);
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const role = localStorage.getItem("role");
  const uid = auth.currentUser?.uid;

  // ============================
  // LOAD PURCHASES
  // ============================

  const loadPurchases = async () => {
    try {
      let snap;

      if (role === "ADMIN") {
        snap = await getDocs(collection(db, "purchases"));
      } else {
        const q = query(
          collection(db, "purchases"),
          where("createdBy", "==", uid),
        );

        snap = await getDocs(q);
      }

      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setPurchases(data);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  // ============================
  // VENDOR INPUT CHANGE
  // ============================

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // ============================
  // ITEM CHANGE
  // ============================

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...form.items];

    updatedItems[index][field] = value;

    setForm({
      ...form,
      items: updatedItems,
    });
  };

  // ============================
  // ADD ITEM
  // ============================

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, createEmptyItem()],
    }));
  };

  // ============================
  // REMOVE ITEM
  // ============================

  const removeItem = (index) => {
    if (form.items.length === 1) return;

    const updatedItems = form.items.filter((_, i) => i !== index);

    setForm({
      ...form,
      items: updatedItems,
    });
  };

  // ============================
  // RESET FORM
  // ============================

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  // ============================
  // VALIDATION
  // ============================

  const validateForm = () => {
    if (
      !form.vendorName.trim() ||
      !form.contactNumber.trim() ||
      // !form.email.trim() ||
      !form.location.trim()
    ) {
      alert("Please fill Vendor Details.");
      return false;
    }

    for (let item of form.items) {
      if (
        !item.requisitionPerson.trim() ||
        !item.itemName.trim() ||
        !item.quantity ||
        !item.price ||
        !item.gst
      ) {
        alert("Please complete all Item Details.");
        return false;
      }
    }

    return true;
  };

  // ============================
  // SAVE / UPDATE PURCHASE
  // ============================

  // const handleSubmit = async (e) => {
  //   e.preventDefault();

  //   if (!validateForm()) return;

  //   try {
  //     const userRef = doc(db, "users", auth.currentUser.uid);
  //     const userSnap = await getDoc(userRef);

  //     if (!userSnap.exists()) {
  //       alert("User not found.");
  //       return;
  //     }

  //     const userData = userSnap.data();

  //     const purchaseData = {
  //       vendorName: form.vendorName,
  //       contactNumber: form.contactNumber,
  //       alternateNumber: form.alternateNumber,
  //       email: form.email,
  //       location: form.location,
  //       remarks: form.remarks,

  //       items: form.items,

  //       createdBy: auth.currentUser.uid,
  //       createdByName: userData.name,
  //       createdByEmail: userData.email,
  //       createdRole: userData.role,
  //     };

  //     if (editingId) {
  //       await updateDoc(doc(db, "purchases", editingId), purchaseData);
  //     } else {
  //       await addDoc(collection(db, "purchases"), {
  //         ...purchaseData,
  //         createdAt: serverTimestamp(),
  //       });
  //     }

  //     await loadPurchases();

  //     resetForm();
  //     setOpenForm(false);
  //   } catch (err) {
  //     console.log(err);
  //     alert(err.message);
  //   }
  // };
  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!validateForm()) return;

  try {
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("User not found.");
      return;
    }

    const userData = userSnap.data();

    const purchaseData = {
      vendorName: form.vendorName || "",
      contactNumber: form.contactNumber || "",
      alternateNumber: form.alternateNumber || "",
      email: form.email || "",
      location: form.location || "",
      remarks: form.remarks || "",

      items: form.items.map((item) => ({
        requisitionPerson: item.requisitionPerson || "",
        itemName: item.itemName || "",
        description: item.description || "",
        expiryDate: item.expiryDate || "",
        duration: item.duration || "",
        unit: item.unit || "",
        hsnCode: item.hsnCode || "",
        quantity: item.quantity || "",
        price: item.price || "",
        discount: item.discount || "",
        gst: item.gst || "",
      })),

      createdBy: auth.currentUser.uid,
      createdByName: userData?.name || "",
      createdByEmail: userData?.email || "",
      createdRole: userData?.role || "",
    };

    console.log("USER DATA =>", userData);
    console.log("PURCHASE DATA =>", purchaseData);

    if (editingId) {
      await updateDoc(doc(db, "purchases", editingId), purchaseData);
    } else {
      await addDoc(collection(db, "purchases"), {
        ...purchaseData,
        createdAt: serverTimestamp(),
      });
    }

    alert("Purchase Saved Successfully");

    await loadPurchases();
    resetForm();
    setOpenForm(false);

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

  // ============================
  // DELETE
  // ============================

  const handleDelete = async (id) => {
    if (!window.confirm("Delete Purchase?")) return;

    await deleteDoc(doc(db, "purchases", id));

    loadPurchases();
  };

  // ============================
  // EDIT PURCHASE
  // ============================

  const handleEdit = (purchase) => {
    setEditingId(purchase.id);

    setForm({
      vendorName: purchase.vendorName || "",
      contactNumber: purchase.contactNumber || "",
      alternateNumber: purchase.alternateNumber || "",
      email: purchase.email || "",
      location: purchase.location || "",
      remarks: purchase.remarks || "",

      items:
        purchase.items && purchase.items.length
          ? purchase.items
          : [createEmptyItem()],
    });

    setOpenForm(true);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // ============================
  // SEARCH
  // ============================

  const filteredPurchases = purchases.filter((purchase) => {
    const searchText = search.toLowerCase();

    const vendorMatch = purchase.vendorName?.toLowerCase().includes(searchText);

    const creatorMatch = purchase.createdByName
      ?.toLowerCase()
      .includes(searchText);
    const itemMatch = purchase.items?.some(
      (item) =>
        item.itemName?.toLowerCase().includes(searchText) ||
        item.requisitionPerson?.toLowerCase().includes(searchText),
    );

    return vendorMatch || creatorMatch || itemMatch;
  });

  // ============================
  // TOTAL CALCULATION
  // ============================

  const calculateTotal = (items = []) => {
    return items.reduce((total, item) => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || 0);
      const discount = Number(item.discount || 0);

      let amount = qty * price;

      amount -= (amount * discount) / 100;

      return total + amount;
    }, 0);
  };

  const downloadDemoExcel = () => {
    const demo = [
      {
        "Vendor Name": "Raj Biosis",
        "Contact Number": "9876543210",
        "Alternate Number": "9876543211",
        Email: "raj@gmail.com",
        Location: "Jaipur",
        Remarks: "Demo Purchase",
        "Requisition Person": "Ajay",
        "Item Name": "Erba Kit",
        Description: "Electrolyte",
        "Expiry Date": "2026-07-15",
        Duration: "5 Days",
        Unit: "2",
        "HSN Code": "64533",
        MOQ: "20",
        Price: "2000",
        Discount: "20",
        GST: "12%",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(demo);

    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Purchase Demo");

    XLSX.writeFile(wb, "Purchase_Demo.xlsx");
  };

  const importExcel = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setUploading(true);

    const data = await file.arrayBuffer();

    const workbook = XLSX.read(data);

    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    const rows = XLSX.utils.sheet_to_json(sheet);

    try {
      const grouped = {};

      rows.forEach((row) => {
        const vendor = row["Vendor Name"];

        if (!grouped[vendor]) {
          grouped[vendor] = {
            vendorName: vendor,
            contactNumber: row["Contact Number"],
            alternateNumber: row["Alternate Number"],
            email: row["Email"],
            location: row["Location"],
            remarks: row["Remarks"],

            items: [],
          };
        }

        grouped[vendor].items.push({
          requisitionPerson: row["Requisition Person"],
          itemName: row["Item Name"],
          description: row["Description"],
          expiryDate: row["Expiry Date"],
          duration: row["Duration"],
          unit: row["Unit"],
          hsnCode: row["HSN Code"],
          quantity: row["MOQ"],
          price: row["Price"],
          discount: row["Discount"],
          gst: row["GST"],
        });
      });

      const userRef = doc(db, "users", auth.currentUser.uid);

      const userSnap = await getDoc(userRef);

      const user = userSnap.data();

      for (const key in grouped) {
        await addDoc(collection(db, "purchases"), {
          ...grouped[key],

          createdBy: auth.currentUser.uid,
          createdByName: user.name,
          createdByEmail: user.email,
          createdRole: user.role,

          createdAt: serverTimestamp(),
        });
      }

      alert("Excel Imported Successfully");

      loadPurchases();
    } catch (err) {
      console.log(err);

      alert(err.message);
    }

    setUploading(false);
  };

  return (
    <>
      {/* ===========================
        PURCHASE FORM
    ============================ */}

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 mb-8">
        {/* Header */}

        <div
          onClick={() => setOpenForm(!openForm)}
          className="cursor-pointer flex justify-between items-center"
        >
          <div>
            <h2 className="text-3xl font-bold text-gray-800">
              {editingId ? "Update Purchase" : "New Purchase"}
            </h2>

            <p className="text-gray-500 mt-1">
              Click to {openForm ? "collapse" : "expand"} purchase form
            </p>
          </div>

          <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-3xl text-indigo-700">
            {openForm ? "−" : "+"}
          </div>
        </div>

        {/* FORM */}

        {openForm && (
          <form onSubmit={handleSubmit} className="mt-8">
            {/* ======================
              VENDOR DETAILS
          ====================== */}

            <h3 className="text-xl font-bold mb-5 border-b pb-2">
              Vendor Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <Input
                label="Vendor Name"
                name="vendorName"
                value={form.vendorName}
                onChange={handleChange}
              />

              <Input
                label="Contact Number"
                name="contactNumber"
                value={form.contactNumber}
                onChange={handleChange}
              />

              <Input
                label="Alternate Number"
                name="alternateNumber"
                value={form.alternateNumber}
                onChange={handleChange}
              />

              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />

              <Input
                label="Location"
                name="location"
                value={form.location}
                onChange={handleChange}
              />
            </div>

            <div className="mt-6">
              <label className="block mb-2 font-semibold">Remarks</label>

              <textarea
                rows={4}
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                className="w-full rounded-xl border border-gray-300 px-4 py-3"
              />
            </div>

            {/* ======================
              ITEMS
          ====================== */}

            <div className="flex justify-between items-center mt-10 mb-4">
              <h3 className="text-xl font-bold">Purchase Items</h3>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={downloadDemoExcel}
                  className="bg-green-600 text-white px-5 py-2 rounded-xl"
                >
                  📥 Download Demo
                </button>

                <label className="bg-orange-500 text-white px-5 py-2 rounded-xl cursor-pointer">
                  📤 Import Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={importExcel}
                  />
                </label>

                {uploading && (
                  <div className="mt-4">
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div className="bg-indigo-200 h-3 rounded-full animate-pulse w-full"></div>
                    </div>

                    <p className="text-sm text-indigo-200 mt-2">
                      Uploading Excel...
                    </p>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={addItem}
                className="bg-indigo-200 text-black px-5 py-2 rounded-xl"
              >
                + Add Item
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border">
                <thead className="bg-indigo-200 text-text-black">
                  <tr>
                    <th className="p-3">Requisition Person</th>

                    <th>Item</th>

                    <th>Description</th>

                    <th>Expiry</th>

                    <th>Duration</th>

                    <th>Unit</th>

                    <th>HSN</th>

                    <th>MOQ</th>

                    <th>Price</th>

                    <th>Discount</th>

                    <th>GST</th>

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {form.items.map((item, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.requisitionPerson}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "requisitionPerson",
                              e.target.value,
                            )
                          }
                          className="w-44 border rounded-lg px-3 py-2"
                          placeholder="Requisition Person"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          value={item.itemName}
                          onChange={(e) =>
                            handleItemChange(index, "itemName", e.target.value)
                          }
                          className="w-44 border rounded-lg px-3 py-2"
                          placeholder="Item Name"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "description",
                              e.target.value,
                            )
                          }
                          className="w-52 border rounded-lg px-3 py-2"
                          placeholder="Description"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) =>
                            handleItemChange(
                              index,
                              "expiryDate",
                              e.target.value,
                            )
                          }
                          className="border rounded-lg px-3 py-2"
                        />
                      </td>

                      <td className="p-2">
                        <select
                          value={item.duration}
                          onChange={(e) =>
                            handleItemChange(index, "duration", e.target.value)
                          }
                          className="border rounded-lg px-3 py-2"
                        >
                          <option value="">Select</option>
                          <option>Same Day</option>
                          <option>1 Day</option>
                          <option>2 Days</option>
                          <option>3 Days</option>
                          <option>5 Days</option>
                          <option>7 Days</option>
                          <option>10 Days</option>
                          <option>15 Days</option>
                          <option>20 Days</option>
                          <option>30 Days</option>
                          <option>45 Days</option>
                          <option>60 Days</option>
                          <option>90 Days</option>
                        </select>
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          value={item.unit}
                          onChange={(e) =>
                            handleItemChange(index, "unit", e.target.value)
                          }
                          className="w-24 border rounded-lg px-3 py-2"
                          placeholder="Unit"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="text"
                          value={item.hsnCode}
                          onChange={(e) =>
                            handleItemChange(index, "hsnCode", e.target.value)
                          }
                          className="w-28 border rounded-lg px-3 py-2"
                          placeholder="HSN"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                          className="w-24 border rounded-lg px-3 py-2"
                          placeholder="MOQ"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) =>
                            handleItemChange(index, "price", e.target.value)
                          }
                          className="w-28 border rounded-lg px-3 py-2"
                          placeholder="Price"
                        />
                      </td>

                      <td className="p-2">
                        <input
                          type="number"
                          value={item.discount}
                          onChange={(e) =>
                            handleItemChange(index, "discount", e.target.value)
                          }
                          className="w-24 border rounded-lg px-3 py-2"
                          placeholder="%"
                        />
                      </td>

                      <td className="p-2">
                        <select
                          value={item.gst}
                          onChange={(e) =>
                            handleItemChange(index, "gst", e.target.value)
                          }
                          className="border rounded-lg px-3 py-2"
                        >
                          <option value="">GST</option>
                          <option>0%</option>
                          <option>5%</option>
                          <option>12%</option>
                          <option>18%</option>
                          <option>28%</option>
                        </select>
                      </td>

                      <td className="p-2 text-center">
                        {form.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center mt-8">
              <div className="text-xl font-bold text-green-700">
                {/* Grand Total : ₹ {calculateTotal(form.items)} */}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="border px-6 py-3 rounded-xl"
                >
                  Reset
                </button>

                <button
                  type="submit"
                  className="bg-indigo-200 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl"
                >
                  {editingId ? "Update Purchase" : "Save Purchase"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ===========================
    PURCHASE HISTORY
=========================== */}

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-6 mt-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Purchase History
            </h2>

            <p className="text-gray-500 text-sm">
              Vendor wise purchase records
            </p>
          </div>

          <input
            type="text"
            placeholder="Search Vendor / Item / Saved By..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-80 rounded-xl border border-gray-300 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="space-y-6">
          {filteredPurchases.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No Purchase Found
            </div>
          ) : (
            filteredPurchases.map((purchase, index) => {
              const subtotal =
                purchase.items?.reduce((sum, item) => {
                  return (
                    sum + Number(item.quantity || 0) * Number(item.price || 0)
                  );
                }, 0) || 0;

              const totalDiscount =
                purchase.items?.reduce((sum, item) => {
                  const amount =
                    Number(item.quantity || 0) * Number(item.price || 0);

                  return sum + (amount * Number(item.discount || 0)) / 100;
                }, 0) || 0;

              const grandTotal = subtotal - totalDiscount;

              return (
                <div
                  key={purchase.id}
                  className="border rounded-2xl overflow-hidden shadow-sm"
                >
                  {/* Vendor Header */}

                  <div className="bg-indigo-200 text-black p-5">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold">
                          {index + 1}. {purchase.vendorName}
                        </h3>

                        <p className="text-sm mt-1">
                          {purchase.contactNumber}
                          {purchase.email && ` | ${purchase.email}`}
                        </p>

                        <p className="text-sm">{purchase.location}</p>
                      </div>

                      <div className="flex gap-2">
                        {(role === "ADMIN" || purchase.createdBy === uid) && (
                          <>
                            <button
                              onClick={() => handleEdit(purchase)}
                              className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg text-white"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDelete(purchase.id)}
                              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-white"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Table */}

                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="border px-4 py-3 text-center">#</th>
                          <th className="border px-4 py-3 text-center">
                            {" "}
                            Requisition Person
                          </th>
                          <th className="border px-4 py-3 text-center">
                            Item Name
                          </th>
                          <th className="border px-4 py-3 text-center">
                            Description
                          </th>
                          <th className="border px-4 py-3 text-center">
                            Expiry
                          </th>
                          <th className="border px-4 py-3 text-center">
                            Duration
                          </th>
                          <th className="border px-4 py-3 text-center">Unit</th>
                          <th className="border px-4 py-3 text-center">HSN</th>
                          <th className="border px-4 py-3 text-center">MOQ</th>
                          <th className="border px-4 py-3 text-center">
                            Price
                          </th>
                          <th className="border px-4 py-3 text-center">
                            Discount
                          </th>
                          <th className="border px-4 py-3 text-center">GST</th>
                        </tr>
                      </thead>

                      <tbody>
                        {purchase.items?.map((item, i) => (
                          <tr key={i} className="hover:bg-indigo-50 transition">
                            <td className="border px-4 py-3 text-center font-semibold">
                              {i + 1}
                            </td>
                            <td className="border px-4 py-3 text-center font-medium">
                              {item.requisitionPerson}
                            </td>

                            <td className="border px-4 py-3 font-semibold">
                              {item.itemName}
                            </td>

                            <td className="border px-4 py-3">
                              {item.description}
                            </td>

                            <td className="border px-4 py-3 text-center">
                              {item.expiryDate}
                            </td>

                            <td className="border px-4 py-3 text-center">
                              {item.duration}
                            </td>

                            <td className="border px-4 py-3 text-center">
                              {item.unit}
                            </td>

                            <td className="border px-4 py-3 text-center">
                              {item.hsnCode}
                            </td>

                            <td className="border px-4 py-3 text-center font-semibold text-indigo-200">
                              {item.quantity}
                            </td>

                            <td className="border px-4 py-3 text-center font-semibold text-green-600">
                              ₹ {Number(item.price).toLocaleString()}
                            </td>

                            <td className="border px-4 py-3 text-center">
                              <span className="inline-flex items-center rounded-full bg-red-100 text-red-600 px-3 py-1 text-xs font-bold">
                                {item.discount}%
                              </span>
                            </td>

                            <td className="border px-4 py-3 text-center">
                              <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">
                                {item.gst}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer */}

                  {/*    <div className="bg-gray-50 px-6 py-5"> */}

                  <div className="flex justify-between items-center m-4">
                    <div className="text-sm text-gray-600">
                      Saved By :
                      <span className="font-semibold ml-2">
                        {purchase.createdByName}
                      </span>
                    </div>
                  </div>

                  {/*  <div className="flex justify-end mt-4">

              <div className="w-80 rounded-xl border bg-white p-5 shadow-sm">

                <div className="flex justify-between mb-2">
                  <span>Subtotal</span>
                  <span>₹ {subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-red-600 mb-2">
                  <span>Total Discount</span>
                  <span>- ₹ {totalDiscount.toFixed(2)}</span>
                </div>

                <hr className="my-3" />
<div className="mb-4 border rounded-xl overflow-hidden bg-white">

  <table className="w-full text-xs">

    <thead className="bg-gray-100">

      <tr>
        <th className="px-3 py-2 text-left">Item</th>
        <th className="px-3 py-2 text-center">Qty</th>
        <th className="px-3 py-2 text-center">MOQ</th>
        <th className="px-3 py-2 text-center">Price</th>
        <th className="px-3 py-2 text-center">Disc.</th>
        <th className="px-3 py-2 text-right">Amount</th>
      </tr>

    </thead>

    <tbody>

      {purchase.items?.map((item, i) => {

        const amount =
          Number(item.quantity || 0) *
          Number(item.price || 0);

        const discountAmt =
          (amount * Number(item.discount || 0)) / 100;

        const finalAmount = amount - discountAmt;

        return (
          <tr key={i} className="border-t">

            <td className="px-3 py-2 font-medium">
              {item.itemName}
            </td>

            <td className="text-center">
              {item.quantity}
            </td>

            <td className="text-center">
              {item.quantity}
            </td>

            <td className="text-center">
              ₹ {item.price}
            </td>

            <td className="text-center text-red-500">
              {item.discount}%
            </td>

            <td className="text-right px-3 font-semibold text-green-600">
              ₹ {finalAmount.toFixed(2)}
            </td>

          </tr>
        );

      })}

    </tbody>

  </table>

</div>
                <div className="flex justify-between text-2xl font-bold text-green-600">
                  <span>Grand Total</span>
                  <span>₹ {grandTotal.toFixed(2)}</span>
                </div>

              </div>

            </div>

          </div> */}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

// ============================
// INPUT COMPONENT
// ============================

function Input({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
}) {
  return (
    <div>
      <label className="block mb-2 text-sm font-semibold text-gray-700">
        {label}
      </label>

      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        placeholder={placeholder || `Enter ${label}`}
        className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition"
      />
    </div>
  );
}
