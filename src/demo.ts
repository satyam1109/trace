export const samples = [
  {
    label: 'UPI payment',
    sender: 'VM-HDFCBK',
    message:
      'Your A/c XX4821 is debited by INR 240.00 through UPI to Blue Tokai. Ref 612345678901.',
    name: 'Blue Tokai',
    amount: 24000,
  },
  {
    label: 'Card purchase',
    sender: 'AD-ICICIB',
    message:
      'INR 1,280.00 spent on ICICI Bank card ending 9164 at Amazon on 19-Oct-2026. Ref 612345678902.',
    name: 'Amazon',
    amount: 128000,
  },
  {
    label: 'Bank debit',
    sender: 'JD-SBIUPI',
    message:
      'Your A/c XX7032 debited by Rs. 799.00 to Airtel via UPI. Ref 612345678903.',
    name: 'Airtel',
    amount: 79900,
  },
  {
    label: 'OTP (ignored)',
    sender: 'VM-HDFCBK',
    message:
      '918273 is your OTP for a purchase of INR 2,500.00. Do not share this OTP with anyone.',
    name: '',
    amount: 0,
  },
  {
    label: 'Failed payment (ignored)',
    sender: 'VM-HDFCBK',
    message:
      'Your payment of INR 500.00 failed. Your account was not debited. Ref 612345678904.',
    name: '',
    amount: 0,
  },
];

export const starterPayments = [
  samples[0],
  samples[1],
  samples[2],
  {
    label: 'UPI payment',
    sender: 'VM-HDFCBK',
    message:
      'Your A/c XX4821 debited by INR 189.00 to Zomato via UPI. Ref 612345678905.',
    name: 'Zomato',
    amount: 18900,
  },
  {
    label: 'Card purchase',
    sender: 'AD-ICICIB',
    message:
      'INR 1,250.00 spent on ICICI Bank card ending 9164 at Uniqlo on 18-Oct-2026. Ref 612345678906.',
    name: 'Uniqlo',
    amount: 125000,
  },
  {
    label: 'UPI payment',
    sender: 'JD-SBIUPI',
    message:
      'Your A/c XX7032 debited by Rs. 310.00 to Uber via UPI. Ref 612345678907.',
    name: 'Uber',
    amount: 31000,
  },
  {
    label: 'UPI payment',
    sender: 'VM-HDFCBK',
    message:
      'Your A/c XX4821 debited by INR 89.00 to The Local Store via UPI. Ref 612345678908.',
    name: 'The Local Store',
    amount: 8900,
  },
];
