import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export default function UpdateCustomerModal({ customer, onClose }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    assignedByTLName: "",
    product: "",
    category: "",
    group: "",
    city: "",
    district: "",
    state: "",
    pincode: "",
    area: "",
    country: "",
    address: "",
    salesPerson: "",
    totalAmount: "",
    purchaseDate: "",
    sellerCompanyName: "",
    salesType: "",
    source: "",
    remarks: "",
    status: "",
  });

  const employeeName = localStorage.getItem("employeeName") || "";
  const role = localStorage.getItem("role") || "";

  useEffect(() => {
    if (customer) {
      setForm({
        name: customer.name || "",
        email: customer.email || "",
        mobile: customer.mobile || "",
        assignedByTLName: customer.assignedByTLName || "",
        product: customer.purchases?.[0]?.product || "",
        category: customer.category || "",
        group: customer.group || "",

        city: customer.city || "",
        district: customer.district || "",
        state: customer.state || "",
        pincode: customer.pincode || "",
        area: customer.area || "",
        country: customer.country || "",
        address: customer.address || "",

        salesPerson: customer.salesPerson || "",
        totalAmount: customer.totalAmount || "",
        purchaseDate: customer.purchaseDate || "",
        sellerCompanyName: customer.sellerCompanyName || "",
        salesType: customer.salesType || "",
        source: customer.source || "",

        remarks: customer.remarks || "",
        status: customer.status || "",
      });
    }
  }, [customer]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleUpdate = async () => {
    try {
      const payload = {
        ...form,

        // 🔥 MASTER SOURCE = purchases[]
        purchases: form.product
          ? [
              {
                product: form.product,
                price: Number(form.totalAmount) || null,
                date: form.purchaseDate || new Date().toISOString(),
              },
            ]
          : customer.purchases || [],

        isQuickAssign: false,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: employeeName,
        lastUpdatedByRole: role,
      };

      delete payload.product;

      await updateDoc(doc(db, "existingCustomers", customer.id), payload);

      alert("Customer updated successfully ✅");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Update failed ❌");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Update Customer
            </h2>
            <p className="text-xs text-slate-500">
              Edit customer details & add remarks
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4 space-y-6">
          {/* CUSTOMER INFO */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              Customer Information
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Customer Name">
                <input
                  name="name"
                  value={form.name}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Email">
                <input
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Mobile">
                <input
                  name="mobile"
                  value={form.mobile}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="City">
                <input
                  name="city"
                  value={form.city}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="District">
                <input
                  name="district"
                  value={form.district}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="State">
                <input
                  name="state"
                  value={form.state}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Pincode">
                <input
                  name="pincode"
                  value={form.pincode}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Area">
                <input
                  name="area"
                  value={form.area}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Country">
                <input
                  name="country"
                  value={form.country}
                  onChange={onChange}
                  className="rounded-lg border px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label="Address">
              <textarea
                name="address"
                rows={2}
                value={form.address}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* SALES INFO */}
          <h3 className="text-sm font-semibold text-slate-700">
            Sales Details
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Sales Person">
              <input
                name="salesPerson"
                value={form.salesPerson}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Owner TL (Assigned By)">
              <input
                value={form.assignedByTLName}
                disabled
                className="rounded-lg border bg-slate-100 px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Total Amount">
              <input
                name="totalAmount"
                value={form.totalAmount}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Purchase Date">
              <input
                type="date"
                name="purchaseDate"
                value={
                  form.purchaseDate
                    ? new Date(form.purchaseDate).toISOString().slice(0, 10)
                    : ""
                }
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Product">
              <input
                name="product"
                value={form.product}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Product Category">
              <input
                name="category"
                value={form.category}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Group">
              <input
                name="group"
                value={form.group}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Seller Company Name">
              <input
                name="sellerCompanyName"
                value={form.sellerCompanyName}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Sales Type">
              <input
                name="salesType"
                value={form.salesType}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>

            <Field label="Source">
              <input
                name="source"
                value={form.source}
                onChange={onChange}
                className="rounded-lg border px-3 py-2 text-sm"
              />
            </Field>
          </div>

          {/* REMARKS */}
          <Field label="Remarks / Notes">
            <textarea
              name="remarks"
              rows={3}
              value={form.remarks}
              onChange={onChange}
              className="rounded-lg border px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}
