import { useState } from "react";
import PerformanceCard from "../components/PerformanceCard";
import FeedbackPanel from "../components/FeedbackPanel";

export default function AdminDashboard() {
  const [negativeCount, setNegativeCount] = useState(0);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <FeedbackPanel onSubmit={setNegativeCount} />
      <PerformanceCard negative={negativeCount} />
    </div>
  );
}
