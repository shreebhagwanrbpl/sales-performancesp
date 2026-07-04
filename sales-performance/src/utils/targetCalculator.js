export const getFYRange = (fyYear) => {
  return {
    start: new Date(fyYear, 3, 1),   // 1 April
    end: new Date(fyYear + 1, 2, 31) // 31 March
  };
};
export const calculateFYTarget = ({ ctc, joiningDate, fyYear }) => {
  if (!ctc) return 0;

  const monthlyTarget = Math.round((ctc / 12) * 55);
  const { start: fyStart, end: fyEnd } = getFYRange(fyYear);
  if (!joiningDate) {
    return monthlyTarget * 12;
  }

  const joinDate = new Date(joiningDate);
  if (joinDate > fyEnd) {
    return 0;
  }

  const effectiveStart = joinDate > fyStart ? joinDate : fyStart;

  let months =
    (fyEnd.getFullYear() - effectiveStart.getFullYear()) * 12 +
    (fyEnd.getMonth() - effectiveStart.getMonth()) +
    1;

  if (months < 0) months = 0;

  return monthlyTarget * months;
};
