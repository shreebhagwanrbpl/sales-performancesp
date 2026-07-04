import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export default function ProductOfTheMonth() {
  const [products, setProducts] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);

  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const q = query(
      collection(db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(startOfMonth)),
    );

    const unsub = onSnapshot(q, (snap) => {
      const productMap = {};
      snap.docs.forEach((doc) => {
        const data = doc.data();
        data.sales?.forEach((s) => {
          if (!s.products) return;
          const amount = Number(s.amount || 0);
          s.products.split(",").forEach((p) => {
            const product = p.trim();
            if (!product) return;
            productMap[product] = (productMap[product] || 0) + amount;
          });
        });
      });

      const sorted = Object.entries(productMap)
        .map(([name, amount]) => ({
          name,
          amount,
        }))
        .sort((a, b) => b.amount - a.amount);

      setProducts(sorted);
    });
    return () => unsub();
  }, []);

  if (products.length === 0) return null;

  // export for product of the month
  const exportProducts = () => {
    if (!products?.length) {
      alert("No products available to export");
      return;
    }

    const exportData = products.map((p, index) => ({
      Rank: index + 1, // ✅ ab 1st product bhi include hoga
      "Product Name": p.name,
      "Sale Amount (₹)": p.amount,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Ranking");

    const fileName = `Product_Ranking_${new Date()
      .toLocaleDateString()
      .replaceAll("/", "-")}.xlsx`;

    const excelBuffer = XLSX.write(wb, {
      bookType: "xlsx",
      type: "array",
    });

    saveAs(new Blob([excelBuffer]), fileName);
  };

  return (
    <div className="w-fit">
      {/* {products[0] && (
    <div
      className="lg:col-span-2 p-5 rounded-xl
                 bg-gradient-to-r from-yellow-50 to-orange-50
                 border border-yellow-300
                 shadow-lg flex justify-between items-center"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-yellow-700 font-semibold">
          🏆 #1 Product of the Month
        </p>

        <h4 className="text-xl font-bold text-gray-900 mt-1">
          {products[0].name}
        </h4>

        <p className="text-sm text-gray-600 mt-1">
          Highest selling product this month
        </p>
      </div>

      <div className="text-right">
        <p className="text-2xl font-bold text-green-600">
          ₹{products[0].amount.toLocaleString()}
        </p>
      </div>
    </div>
  )} */}
      {products[0] && (
        <button
          onClick={() => setShowProductModal(true)}
          className="
        w-[200px]             
        h-[107px]  
        flex items-center gap-4
        px-5 py-3 rounded-xl
        bg-white
        border border-gray-200
        shadow-md
        hover:shadow-md
        transition
      "
        >
          {/* left accent */}
          <span className="w-1.5 h-20 rounded-full bg-yellow-400" />

          {/* icon */}
          <span
            className="
    w-12 h-12
    flex items-center justify-center
    rounded-full
    bg-yellow-100
    text-yellow-700
    text-2xl
    shadow-inner"
          >
            🏆
          </span>

          {/* text */}
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">
              #1 Product of the Month
            </p>
            <p className="text-xs text-gray-500">Top selling product</p>
          </div>
        </button>
      )}

      {/* RIGHT – 2nd Product */}
      {/* <div className="space-y-3">
    {products.slice(1, 2).map((p, i) => (
      <div
        key={i}
        className="flex justify-between items-center
                   bg-white border shadow-sm
                   px-4 py-4 rounded-xl"
      >
        <p className="font-medium text-gray-800">
          {i + 2}. {p.name}
        </p>

        <p className="font-semibold text-green-600">
          ₹{p.amount.toLocaleString()}
        </p>
      </div>
    ))}
  </div> */}
      <div />

      {showProductModal && products[0] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 relative animate-scaleIn">
            {/* ❌ Close */}
            <button
              onClick={() => setShowProductModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-lg"
            >
              ✕
            </button>

            {/* ===== #1 PRODUCT ===== */}
            <p className="text-xs uppercase tracking-wide text-yellow-700 font-semibold">
              🏆 #1 Product of the Month
            </p>

            <h3 className="text-2xl font-bold text-gray-900 mt-2">
              {products[0].name}
            </h3>

            <p className="text-sm text-gray-600 mt-1">
              Highest selling product this month
            </p>

            <div className="mt-5 flex justify-between items-center">
              <p className="text-3xl font-extrabold text-green-600">
                ₹{products[0].amount.toLocaleString()}
              </p>
              <span className="px-3 py-1 rounded-full text-xs bg-green-100 text-green-700 font-semibold">
                Top Seller
              </span>
            </div>
            {/* ===== 2nd PRODUCT ===== */}
            {products.length > 1 && (
              <div className="mt-6 border-t pt-4">
                {/* <p className="text-sm font-semibold text-gray-500 mb-3">
                  🥈 Best Selling Product
                </p> */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-gray-600">
                    🥈 Best Selling Product
                  </h3>

                  <button
                    onClick={exportProducts}
                    className="text-xs px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
                  >
                    Export
                  </button>
                </div>
                {/* {products.slice(1, 2).map((p, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center
                             bg-gray-50 border
                             px-4 py-3 rounded-lg"
                  >
                    <p className="font-medium text-gray-800">{p.name}</p>

                    <p className="font-semibold text-green-600">
                      ₹{p.amount.toLocaleString()}
                    </p>
                  </div>
                ))} */}
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
                  {products.slice(1).map((p, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center
                              bg-gray-50 border
                              px-4 py-3 rounded-lg"
                    >
                      <p className="font-medium text-gray-800">{p.name}</p>

                      <p className="font-semibold text-green-600">
                        ₹{p.amount.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
