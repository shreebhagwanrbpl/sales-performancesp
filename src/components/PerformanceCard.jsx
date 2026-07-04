export default function PerformanceCard({ negative }) {
  const negativePercent = negative * 20;
  const positivePercent = Math.max(100 - negativePercent, 0);

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <h2 className="text-xl font-semibold text-gray-700 mb-4">
        Today’s Performance
      </h2>

      <div className="space-y-2 text-gray-600">
        <p>
          <span className="font-medium text-green-600">
            Positive:
          </span>{" "}
          {positivePercent}%
        </p>
        <p>
          <span className="font-medium text-red-500">
            Negative:
          </span>{" "}
          {negativePercent}%
        </p>
      </div>

      <div className="mt-4 h-3 bg-gray-200 rounded">
        <div
          className="h-3 bg-green-500 rounded"
          style={{ width: `${positivePercent}%` }}
        />
      </div>
    </div>
  );
}
