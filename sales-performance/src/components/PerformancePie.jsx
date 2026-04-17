import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#22c55e", "#ef4444"]; // green / red

export default function PerformancePie({ positive, negative }) {
  const data = [
    { name: "Positive", value: positive },
    { name: "Negative", value: negative },
  ];

  return (
    <div className="bg-white p-6 rounded-xl shadow">
      <h3 className="text-sm font-medium text-gray-500 mb-3">
        Customer Feedback
      </h3>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={4}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 text-xs mt-2">
        <span className="text-green-600">● Positive</span>
        <span className="text-red-500">● Negative</span>
      </div>
    </div>
  );
}
