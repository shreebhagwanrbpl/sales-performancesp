// 🔹 helpers YAHI define karo
const normalizeName = (name = "") => {
  return name
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/mr |mrs |ms /g, "")
    .trim();
};

const getFirstName = (name = "") => {
  return normalizeName(name).split(" ")[0];
};

// 🔹 main function
export const calcExcelTotals = (rows = []) => {
  const map = new Map();

  rows.forEach((r) => {
    const firstName = getFirstName(r.salesPerson || "Not Defined");
    const amt = Number(r.amount || 0);

    if (!firstName || !amt) return;

    map.set(firstName, (map.get(firstName) || 0) + amt);
  });

  return map;
};
