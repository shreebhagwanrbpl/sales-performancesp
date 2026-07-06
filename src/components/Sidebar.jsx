import { Link, useLocation } from "react-router-dom";
import { useState } from "react";
import {
  HomeIcon,
  PlusCircleIcon,
  ChatBubbleLeftRightIcon,
  UserPlusIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  DocumentChartBarIcon,
  CurrencyRupeeIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
} from "@heroicons/react/24/outline";
import logo from "../assets/logo.png";

export default function Sidebar() {
  const { pathname } = useLocation();
  const role = localStorage.getItem("role");
  const [openWebsite, setOpenWebsite] = useState(false);
  const [openAdmin, setOpenAdmin] = useState(false);
  const isActive = (path) =>
    pathname === path
      ? "bg-indigo-50 text-indigo-600"
      : "text-gray-600 hover:bg-gray-100";

  return (
    <aside className="w-64 bg-white border-r min-h-screen">
      {/* LOGO */}
      <div className="h-16 flex items-center px-6 border-b gap-3">
        <img src={logo} alt="Logo" className="h-8" />
        <div>
          <h1 className="font-bold text-sm">RajBiosis</h1>
          <span className="text-xs text-gray-500">Daily Sales Tracker</span>
        </div>
      </div>

      <nav className="p-4 space-y-2">
        {/* ================= COMMON ================= */}
        {(role === "EMPLOYEE" || role === "TL" || role === "ADMIN") && (
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/dashboard",
            )}`}
          >
            <HomeIcon className="w-5 h-5" />
            Dashboard
          </Link>
        )}

        {(role === "EMPLOYEE" || role === "TL" || role === "ADMIN") && (
          <Link
            to="/add-sale"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/add-sale")}`}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Add Sale
          </Link>
        )}

        {(role === "EMPLOYEE" || role === "TL") && (
          <>
            <Link
              to="/employee-detail"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/employee-detail",
              )}`}
            >
              <UserCircleIcon className="w-5 h-5" />
              Add Self Details
            </Link>
            <Link
              to="/self-assessment"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/self-assessment",
              )}`}
            >
              <UserCircleIcon className="w-5 h-5" />
              Self Assessment
            </Link>
          </>
        )}

        {(role === "EMPLOYEE" || role === "ADMIN") && (
          <>
            <Link
              to="/leave-management"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/leave-management",
              )}`}
            >
              <PlusCircleIcon className="w-5 h-5" />
              Leave
            </Link>
          </>
        )}
        {/* ================= TL + ADMIN ================= */}
        {(role === "TL" || role === "ADMIN") && (
          <>
            <div className="mt-6 text-xs uppercase text-gray-400 px-4">
              Team Management
            </div>

            {/* <Link
              to="/employee-assessment"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/employee-assessment"
              )}`} >
              <ClipboardDocumentCheckIcon className="w-5 h-5" />
              Employee Assessment
            </Link> */}

            <Link
              to="/feedback"
              className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
                "/feedback",
              )}`}
            >
              <ChatBubbleLeftRightIcon className="w-5 h-5" />
              Customer Feedback
            </Link>
          </>
        )}
        {/* 
        {role === "ADMIN" && (
          <Link
            to="purchase-margin"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "purchase-margin",
            )}`}
          >
            <CurrencyRupeeIcon className="w-5 h-5" />
            Purchase Margin
          </Link>
        )} */}
        {role === "ADMIN" && (
          <Link
            to="/admin/assign-tl"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/admin/assign-tl",
            )}`}
          >
            <UserPlusIcon className="w-5 h-5" />
            Assign TL
          </Link>
        )}
        {role === "ADMIN" && (
          <Link
            to="/admin/excel-sales-detail"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/admin/excel-sales-detail",
            )}`}
            title="Excel Sales Detail"
          >
            <DocumentChartBarIcon className="w-5 h-5" />
            Excel Sales Detail
          </Link>
        )}

        {(role === "EMPLOYEE" || role === "TL" || role === "ADMIN") && (
          <Link
            to="/exsisting-customer"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/exsisting-customer")}`}
          >
            <ChatBubbleLeftRightIcon className="w-5 h-5" />
            Add Existing Customer
          </Link>
        )}

        {/* ================= ADMIN ONLY ================= */}

        {/* ================= ADMIN CONTROLS ================= */}
        {role === "ADMIN" && (
          <div className="mt-6">
            <div
              onClick={() => setOpenAdmin(!openAdmin)}
              className="flex items-center justify-between px-4 py-2 text-xs uppercase text-gray-400 cursor-pointer"
            >
              <span>Admin Controls</span>
              <span>{openAdmin ? "▲" : "▼"}</span>
            </div>

            {openAdmin && (
              <div className="mt-2 space-y-1">
                <Link
                  to="approve-users"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("approve-users")}`}
                >
                  <UserPlusIcon className="w-5 h-5" />
                  User Approval
                </Link>

                <Link
                  to="/add-ctc"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/add-ctc")}`}
                >
                  <BanknotesIcon className="w-5 h-5" />
                  Add CTC
                </Link>

                <Link
                  to="/appraisal"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/appraisal")}`}
                >
                  <ChartBarIcon className="w-5 h-5" />
                  Appraisal
                </Link>

                <Link
                  to="/inventory"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("/inventory")}`}
                >
                  <ArchiveBoxIcon className="w-5 h-5" />
                  Inventory
                </Link>

                <Link
                  to="reports"
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive("reports")}`}
                >
                  <UserPlusIcon className="w-5 h-5" />
                  Reports
                </Link>
              </div>
            )}
          </div>
        )}
        {/* ================= WEBSITE ================= */}
        {/* <div className="mt-6">
  <div
    onClick={() => setOpenWebsite(!openWebsite)}
    className="flex items-center justify-between px-4 py-2 text-sm cursor-pointer text-gray-600 hover:bg-gray-100 rounded-lg"
  >
    <span>🌐 Website</span>
    <span>{openWebsite ? "▲" : "▼"}</span>
  </div>

  {openWebsite && (
    <div className="ml-4 mt-2 space-y-1">

      <Link
        to="/home"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/home")}`}
      >
        🏠 Home Page
      </Link>

      <Link
        to="/website/hero"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/hero")}`}
      >
        🎯 Hero Section
      </Link>

      <Link
        to="/website/products"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/products")}`}
      >
        📦 Products
      </Link>

      <Link
        to="/website/contact"
        className={`block px-4 py-2 text-sm rounded-lg ${isActive("/website/contact")}`}
      >
        📞 Contact Page
      </Link>

      <a
        href="https://sales.rajbiosis.app/products.html"
        target="_blank"
        className="block px-4 py-2 text-sm rounded-lg text-blue-600 hover:bg-gray-100"
      >
        🌍 View Live Website
      </a>

    </div>
  )}
</div> */}

        {(role === "ADMIN" || role === "PURCHASING") && (
          <Link
            to="/purchaseform"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/purchaseform",
            )}`}
          >
            <PlusCircleIcon className="w-5 h-5" />
            Purchase Entry
          </Link>
        )}

        {(role === "ADMIN" || role === "PURCHASING") && (
          <Link
            to="/officeexpense"
            className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${isActive(
              "/officeexpense",
            )}`}
          >
            <BanknotesIcon className="w-5 h-5" />
            Office Expense
          </Link>
        )}
      </nav>
    </aside>
  );
}
