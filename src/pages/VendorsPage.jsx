import React, { useState, useEffect } from "react";
import {
  UserGroupIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  CheckCircleIcon,
  PlusIcon,
  StarIcon,
  TagIcon,
  CurrencyRupeeIcon,
  UserIcon,
  ShoppingBagIcon,
  CalendarIcon,
  FunnelIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { loadInquiriesFromStorage } from "../data/procurementStore";
import { useNavigate } from "react-router-dom";

export default function VendorsPage() {
  const navigate = useNavigate();

  // Load live inquiries & vendor quotes from shared procurement store
  const [inquiries, setInquiries] = useState(() => loadInquiriesFromStorage());

  // View Mode / Filter Tabs: 'ITEM_SEARCH' | 'VENDOR_PURCHASING' | 'EMPLOYEE_GIVING'
  const [viewTab, setViewTab] = useState("ITEM_SEARCH");

  // Search Terms
  const [searchTerm, setSearchTerm] = useState("");

  // Refresh data from storage
  const refreshData = () => {
    setInquiries(loadInquiriesFromStorage());
  };

  // Extract all flat vendor quotes across all inquiries
  const allVendorQuotesList = React.useMemo(() => {
    const list = [];
    inquiries.forEach((inq) => {
      if (inq.vendorQuotes && inq.vendorQuotes.length > 0) {
        inq.vendorQuotes.forEach((quote, qIdx) => {
          list.push({
            inquiryId: inq.id,
            productName: inq.product,
            customerName: inq.customer,
            employeeName: inq.employeeFullName,
            employeeInitials: inq.employee,
            status: inq.status,
            vendorName: quote.vendorName,
            price: Number(quote.price || 0),
            phone: quote.phone || "+91 98290 12345",
            email: quote.email || "sales@vendor.com",
            remarks: quote.remarks || "Dealer quotation",
            date: quote.date || inq.date,
            procurementUser: quote.procurementUser || inq.procurementUser || "Vikram Sharma (Procurement Officer)",
            isAccepted: inq.selectedVendorIndex === qIdx || inq.procurementVendorName === quote.vendorName,
          });
        });
      } else if (inq.procurementVendorName) {
        list.push({
          inquiryId: inq.id,
          productName: inq.product,
          customerName: inq.customer,
          employeeName: inq.employeeFullName,
          employeeInitials: inq.employee,
          status: inq.status,
          vendorName: inq.procurementVendorName,
          price: Number(inq.vendorPrice || 0),
          phone: "+91 98290 12345",
          email: "sales@vendor.com",
          remarks: inq.procurementRemarks || "Vendor entry",
          date: inq.date,
          procurementUser: inq.procurementUser || "Vikram Sharma (Procurement Officer)",
          isAccepted: true,
        });
      }
    });
    return list;
  }, [inquiries]);

  // Aggregate stats by Vendor
  const vendorAggregates = React.useMemo(() => {
    const map = {};
    allVendorQuotesList.forEach((item) => {
      const vName = item.vendorName;
      if (!map[vName]) {
        map[vName] = {
          vendorName: vName,
          phone: item.phone,
          email: item.email,
          totalQuotedAmount: 0,
          totalAcceptedAmount: 0,
          quoteCount: 0,
          items: [],
        };
      }
      map[vName].quoteCount += 1;
      map[vName].totalQuotedAmount += item.price;
      if (item.isAccepted) {
        map[vName].totalAcceptedAmount += item.price;
      }
      map[vName].items.push(item);
    });
    return Object.values(map);
  }, [allVendorQuotesList]);

  // Aggregate stats by Employee
  const employeeAggregates = React.useMemo(() => {
    const map = {};
    inquiries.forEach((inq) => {
      const eName = inq.employeeFullName;
      if (!map[eName]) {
        map[eName] = {
          employeeName: eName,
          initials: inq.employee,
          totalTargetBudget: 0,
          totalVendorCost: 0,
          totalApprovedSellingPrice: 0,
          inquiries: [],
        };
      }
      map[eName].inquiries.push(inq);
      map[eName].totalTargetBudget += Number(inq.targetPrice || 0);
      if (inq.vendorPrice) {
        map[eName].totalVendorCost += Number(inq.vendorPrice);
      }
      if (inq.sellingPrice) {
        map[eName].totalApprovedSellingPrice += Number(inq.sellingPrice);
      }
    });
    return Object.values(map);
  }, [inquiries]);

  // Total Grand Sourced Amount Across All Vendors
  const grandTotalPurchasing = vendorAggregates.reduce(
    (acc, v) => acc + (v.totalAcceptedAmount || v.totalQuotedAmount),
    0
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 pb-16 font-sans text-slate-800">
      {/* TOP HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-600 uppercase tracking-wider mb-1">
            <UserGroupIcon className="w-4 h-4" /> Live Sourcing & Purchasing Directory
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Vendor & Purchasing Management
          </h1>
          <p className="text-xs font-medium text-slate-500 mt-0.5">
            Interlinked live directory with Item Inquiry sourcing, vendor quotes, procurement officers, and date records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
            title="Refresh Linked Data"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => navigate("/procurement/item-inquiry")}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all"
          >
            <PlusIcon className="w-4 h-4 stroke-[3]" />
            <span>Add Sourcing Quote (Item Inquiry)</span>
          </button>
        </div>
      </div>

      {/* MAIN VIEW TAB SELECTOR */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto text-xs font-bold">
          <button
            onClick={() => {
              setViewTab("ITEM_SEARCH");
              setSearchTerm("");
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              viewTab === "ITEM_SEARCH"
                ? "bg-indigo-600 text-white shadow-xs font-extrabold"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            <span>1. Item Sourcing Directory</span>
          </button>

          <button
            onClick={() => {
              setViewTab("VENDOR_PURCHASING");
              setSearchTerm("");
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              viewTab === "VENDOR_PURCHASING"
                ? "bg-indigo-600 text-white shadow-xs font-extrabold"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <ShoppingBagIcon className="w-4 h-4" />
            <span>2. Vendor Wise Purchasing</span>
          </button>

          <button
            onClick={() => {
              setViewTab("EMPLOYEE_GIVING");
              setSearchTerm("");
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 ${
              viewTab === "EMPLOYEE_GIVING"
                ? "bg-indigo-600 text-white shadow-xs font-extrabold"
                : "bg-slate-100 hover:bg-slate-200 text-slate-700"
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>3. Employee Giving Price</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={
              viewTab === "ITEM_SEARCH"
                ? "Search item / product name..."
                : viewTab === "VENDOR_PURCHASING"
                ? "Search vendor name..."
                : "Search employee name..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* MODE 1: ITEM-WISE SOURCING DIRECTORY */}
      {viewTab === "ITEM_SEARCH" && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 flex justify-between items-center">
            <span>
              Search any product item to see all related vendors, pricing, date spoken, and procurement officer.
            </span>
            <span className="font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
              {allVendorQuotesList.length} Quotes Recorded
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {allVendorQuotesList
              .filter(
                (item) =>
                  !searchTerm ||
                  item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  item.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3 hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <span className="text-[10.5px] font-mono font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {item.inquiryId}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1">{item.productName}</h3>
                    </div>

                    {item.isAccepted ? (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        ACCEPTED
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                        QUOTE
                      </span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">Vendor Name:</span>
                      <span className="font-extrabold text-slate-900">{item.vendorName}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-700">Cost Price (₹):</span>
                      <span className="text-base font-extrabold text-amber-900">
                        ₹{Number(item.price).toLocaleString("en-IN")}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-500">
                      <span>Date Spoken/Added:</span>
                      <span className="font-mono font-bold text-slate-700">{item.date}</span>
                    </div>
                  </div>

                  {/* PROCUREMENT OFFICER SPOKEN BADGE */}
                  <div className="bg-amber-50/90 p-2.5 rounded-xl border border-amber-200/90 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 flex items-center gap-1">
                        <UserIcon className="w-3.5 h-3.5 text-amber-600" />
                        Officer Spoken:
                      </span>
                      <span className="font-extrabold text-amber-950">{item.procurementUser}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <PhoneIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <EnvelopeIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="truncate">{item.email}</span>
                    </div>
                    <p className="italic text-slate-500 pt-0.5 line-clamp-1">"{item.remarks}"</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODE 2: VENDOR-WISE PURCHASING */}
      {viewTab === "VENDOR_PURCHASING" && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="text-amber-400 text-xs font-extrabold uppercase tracking-wider block">
                Total Vendor Sourced Purchasing
              </span>
              <h2 className="text-3xl font-black mt-1">
                ₹{grandTotalPurchasing.toLocaleString("en-IN")}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Grand total purchasing & sourcing value across all approved vendor quotes.
              </p>
            </div>

            <div className="bg-slate-800/90 p-3.5 rounded-xl border border-slate-700 text-xs space-y-1 text-right">
              <div className="text-slate-300 font-medium">Total Active Vendors: <strong>{vendorAggregates.length}</strong></div>
              <div className="text-slate-300 font-medium">Total Quotations Sourced: <strong>{allVendorQuotesList.length}</strong></div>
            </div>
          </div>

          <div className="space-y-4">
            {vendorAggregates
              .filter(
                (v) =>
                  !searchTerm ||
                  v.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((vendor, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-black text-sm flex items-center justify-center">
                        {vendor.vendorName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">{vendor.vendorName}</h3>
                        <p className="text-xs text-slate-400 font-medium">
                          Contact: {vendor.phone} • {vendor.email}
                        </p>
                      </div>
                    </div>

                    <div className="text-right bg-amber-50 p-3 rounded-xl border border-amber-200">
                      <span className="text-[10px] font-extrabold text-amber-900 uppercase block">
                        Total Price Taken From This Vendor
                      </span>
                      <span className="text-xl font-black text-amber-900">
                        ₹
                        {(
                          vendor.totalAcceptedAmount || vendor.totalQuotedAmount
                        ).toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>

                  {/* TABLE WITH PROCUREMENT OFFICER COLUMN */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10.5px] font-extrabold text-slate-500 uppercase border-b border-slate-200">
                          <th className="py-2.5 px-3">Ref ID</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Procurement Officer Spoken</th>
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">Date Spoken</th>
                          <th className="py-2.5 px-3 text-right">Unit Price (Cost)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {vendor.items.map((item, itemIdx) => (
                          <tr key={itemIdx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{item.inquiryId}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{item.productName}</td>
                            <td className="py-2.5 px-3 font-semibold text-indigo-900 bg-indigo-50/50 rounded">{item.procurementUser}</td>
                            <td className="py-2.5 px-3">{item.employeeName} ({item.employeeInitials})</td>
                            <td className="py-2.5 px-3 text-slate-500 font-mono font-bold">{item.date}</td>
                            <td className="py-2.5 px-3 text-right font-extrabold text-amber-900">
                              ₹{Number(item.price).toLocaleString("en-IN")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* MODE 3: EMPLOYEE GIVING PRICE (CUSTOMER SECTION REMOVED AS REQUESTED!) */}
      {viewTab === "EMPLOYEE_GIVING" && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 flex justify-between items-center">
            <span>
              Breakdown of total budget & cost prices given/allocated per employee for item inquiries.
            </span>
            <span className="font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
              {employeeAggregates.length} Employees Active
            </span>
          </div>

          <div className="space-y-5">
            {employeeAggregates
              .filter(
                (emp) =>
                  !searchTerm ||
                  emp.employeeName.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((emp, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                        {emp.initials}
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">{emp.employeeName}</h3>
                        <p className="text-xs text-slate-400 font-medium">
                          Inquiries Submitted: {emp.inquiries.length} items
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-200 text-right text-xs">
                        <span className="text-[10px] font-bold text-blue-900 uppercase block">Total Target Budget</span>
                        <span className="font-extrabold text-blue-900 text-sm">
                          ₹{emp.totalTargetBudget.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-right text-xs">
                        <span className="text-[10px] font-bold text-emerald-900 uppercase block">Total Price Given/Allocated</span>
                        <span className="font-black text-emerald-900 text-base">
                          ₹
                          {(
                            emp.totalApprovedSellingPrice || emp.totalVendorCost
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* TABLE WITH PROCUREMENT OFFICER COLUMN */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10.5px] font-extrabold text-slate-500 uppercase border-b border-slate-200">
                          <th className="py-2.5 px-3">Ref ID</th>
                          <th className="py-2.5 px-3">Product Name</th>
                          <th className="py-2.5 px-3">Procurement Officer Spoken</th>
                          <th className="py-2.5 px-3">Target Price</th>
                          <th className="py-2.5 px-3">Vendor Cost</th>
                          <th className="py-2.5 px-3 text-right">Approved Selling Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {emp.inquiries.map((inq, inqIdx) => (
                          <tr key={inqIdx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3 font-mono font-bold text-indigo-600">{inq.id}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">{inq.product}</td>
                            <td className="py-2.5 px-3 font-semibold text-indigo-900 bg-indigo-50/50 rounded">{inq.procurementUser || "Vikram Sharma (Procurement Officer)"}</td>
                            <td className="py-2.5 px-3 text-blue-700 font-bold">₹{Number(inq.targetPrice).toLocaleString("en-IN")}</td>
                            <td className="py-2.5 px-3 text-amber-900 font-bold">
                              {inq.vendorPrice ? `₹${Number(inq.vendorPrice).toLocaleString("en-IN")}` : "N/A"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-700">
                              {inq.sellingPrice ? `₹${Number(inq.sellingPrice).toLocaleString("en-IN")}` : "Pending"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
