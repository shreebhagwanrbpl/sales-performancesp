import { useState } from "react";
import SalesForm from "../components/SalesForm";
import PerformanceCard from "../components/PerformanceCard";

export default function SalesDashboard() {
  const [negativeCount, setNegativeCount] = useState(0);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Form */}
      <div className="lg:col-span-2">
        <SalesForm />
      </div>

      {/* Performance */}
      <PerformanceCard negative={negativeCount} />
    </div>
  );
}
