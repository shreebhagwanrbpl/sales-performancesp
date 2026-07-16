import { Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import AddSale from "./components/SalesForm";
import Login from "./pages/Login";
import Feedback from "./pages/Feedback";
import AssignRole from "./pages/CreateUser";
import EmployeeDetails from "./pages/EmployeeDetail";
import SelfAssessment from "./pages/SelfAssessment";
import EmployeeAssessment from "./pages/EmployeeAssessment";
import Signup from "./pages/SignUp";
import ProtectedRoute from "./routes/ProtectedRoute";
import AddCTC from "./pages/AddCtc";
import AddExsistingCustomer from "./pages/ExsistingCustomerAdd";
import AdminRoute from "./routes/AdminRoute";
import AdminUsers from "./pages/ApproveUsers";
import AdminAssignTL from "./pages/AdminAssignTL";
import ExcelSalesDetail from "./pages/ExcelSalesDetail";
import PurchaseMargin from "./pages/PurchaseMargin";
import Appraisal from "./pages/Appraisal";
import Inventory from "./pages/Inventory";
import Report from "./pages/ReportPage";
// import HeroWeb from "./pages/Heroweb";
import HomePage from "./pages/Homepage";
import Products from "./pages/ProductWebPage";
import ContactPageWeb from "./pages/ContactPageWeb";
import Leave from "./pages/Leave";
import PurchaseForm from "./pages/PurchaseForm";
import OfficeExpense from "./pages/OfficeExpense";
import RajHome from "./pages/RajbiosisLimited/home";
import RajProducts from "./pages/RajbiosisLimited/products";
import RajServices from "./pages/RajbiosisLimited/services";
import RajContact from "./pages/RajbiosisLimited/contact";
import RajDistrict from "./pages/RajbiosisLimited/district";
import RajQuery from "./pages/RajbiosisLimited/query";
import ProductsApprovel from "./pages/ProductsApprovel";
export default function App() {
  const role = localStorage.getItem("role") || "";
  return (
    <Routes>
      {/* ROOT → LOGIN */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* PUBLIC ROUTES */}
      <Route path="login" element={<Login />} />
      <Route path="sign-up" element={<Signup />} />

      {/* PROTECTED ROUTES */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="add-sale" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="add-sale" element={<AddSale />} />
        <Route path="leave-management" element={<Leave />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="exsisting-customer" element={<AddExsistingCustomer />} />
        <Route path="assign-role" element={<AssignRole />} />
        <Route path="employee-detail" element={<EmployeeDetails />} />
        <Route path="self-assessment" element={<SelfAssessment />} />
        <Route path="/admin/assign-tl" element={<AdminAssignTL />} />
        <Route path="/purchaseform" element={<PurchaseForm />} />
        <Route path="/officeexpense" element={<OfficeExpense />} />

        <Route path="reports" element={<Report />} />
        <Route
          path="/admin/excel-sales-detail"
          element={<ExcelSalesDetail />}
        />
        <Route path="employee-assessment" element={<EmployeeAssessment />} />
        <Route path="purchase-margin" element={<PurchaseMargin />} />
        <Route element={<AdminRoute />}>
          <Route path="approve-users" element={<AdminUsers />} />
          <Route path="add-ctc" element={<AddCTC />} />
          <Route path="/appraisal" element={<Appraisal />} />
          <Route path="/inventory" element={<Inventory />} />
          {/* <Route path="/" element={<HeroWeb />} /> */}
          <Route path="/home" element={<HomePage />} />
          <Route path="/products-web" element={<Products />} />
          <Route path="/contact" element={<ContactPageWeb />} />
          <Route path="/rajbiosis/home" element={<RajHome />} />
          <Route path="/rajbiosis/products" element={<RajProducts />} />
          <Route path="/rajbiosis/services" element={<RajServices />} />
          <Route path="/rajbiosis/contact" element={<RajContact />} />
          <Route path="/rajbiosis/district" element={<RajDistrict />} />
          <Route path="/rajbiosis/query" element={<RajQuery />} />
          <Route
            path="/ProductsApprovel"
            element={<ProductsApprovel />}
          />
        </Route>
      </Route>
      {/* FALLBACK */}
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
