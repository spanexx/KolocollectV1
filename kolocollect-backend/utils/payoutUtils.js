// utils/payoutUtils.js
const calculateNextPayoutDate = (frequency, startDate = new Date()) => {
  const nextDate = new Date(startDate);

  switch (frequency) {
      case 'Hourly':
          nextDate.setHours(nextDate.getHours() + 1);
          break;
      case 'Daily':
          nextDate.setDate(nextDate.getDate() + 1);
          break;
      case 'Weekly':
          nextDate.setDate(nextDate.getDate() + 7);
          break;
      case 'Monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
      default:
          throw new Error('Invalid contribution frequency');
  }

  return nextDate;
};

  module.exports = { calculateNextPayoutDate };
  