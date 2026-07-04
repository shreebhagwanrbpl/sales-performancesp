import { useState } from "react";

export default function FeedbackPanel({ onSubmit }) {
  const [count, setCount] = useState(0);

  return (
    <div className="bg-gray-800 p-5 rounded-xl shadow">
      <h2 className="text-lg font-semibold mb-4">
        Customer Feedback (Admin)
      </h2>

      <select
        className="w-full p-2 bg-gray-700 rounded mb-4"
        onChange={(e) => setCount(Number(e.target.value))}
      >
        <option value="0">Positive</option>
        <option value="1">1 Negative</option>
        <option value="2">2 Negative</option>
      </select>

      <button
        onClick={() => onSubmit(count)}
        className="w-full bg-red-600 hover:bg-red-700 py-2 rounded"
      >
        Submit Feedback
      </button>
    </div>
  );
}
