/**
 * INVOX - Calculations & Financial Engine
 * Currency management, tax/GST computation, line item calculations, and amount in words.
 */

const CURRENCIES = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', decimal: 2, unit: 'Rupees', prefix: 'Indian Rupees', subUnit: 'Paise' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', decimal: 2, unit: 'Dollars', prefix: 'US Dollars', subUnit: 'Cents' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', decimal: 2, unit: 'Euros', prefix: 'Euros', subUnit: 'Cents' },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', decimal: 2, unit: 'Pounds', prefix: 'British Pounds', subUnit: 'Pence' },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', locale: 'en-AE', decimal: 2, unit: 'Dirhams', prefix: 'UAE Dirhams', subUnit: 'Fils' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', decimal: 2, unit: 'Dollars', prefix: 'Canadian Dollars', subUnit: 'Cents' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', decimal: 2, unit: 'Dollars', prefix: 'Australian Dollars', subUnit: 'Cents' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', decimal: 2, unit: 'Dollars', prefix: 'Singapore Dollars', subUnit: 'Cents' },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', decimal: 0, unit: 'Yen', prefix: 'Japanese Yen', subUnit: '' }
};

/**
 * Format a number into currency representation
 */
function formatCurrency(amount, currencyCode = 'INR') {
  const curr = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const num = Number(amount) || 0;
  
  try {
    return new Intl.NumberFormat(curr.locale, {
      style: 'currency',
      currency: curr.code,
      minimumFractionDigits: curr.decimal,
      maximumFractionDigits: curr.decimal
    }).format(num);
  } catch (e) {
    return `${curr.symbol} ${num.toFixed(curr.decimal)}`;
  }
}

/**
 * Format plain number with commas
 */
function formatNumber(amount, currencyCode = 'INR') {
  const curr = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(curr.locale, {
      minimumFractionDigits: curr.decimal,
      maximumFractionDigits: curr.decimal
    }).format(num);
  } catch (e) {
    return num.toFixed(curr.decimal);
  }
}

/**
 * Calculate totals for a single line item
 */
function calculateLineItem(item) {
  const qty = Math.max(0, parseFloat(item.quantity) || 0);
  const rate = Math.max(0, parseFloat(item.rate) || 0);
  const rawBase = qty * rate;

  let discountAmount = 0;
  const discountVal = parseFloat(item.discountValue) || 0;
  if (item.discountType === '%') {
    discountAmount = (rawBase * Math.min(100, Math.max(0, discountVal))) / 100;
  } else {
    discountAmount = Math.min(rawBase, Math.max(0, discountVal));
  }

  const taxableAmount = Math.max(0, rawBase - discountAmount);
  const taxRate = Math.max(0, parseFloat(item.taxRate) || 0);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const total = taxableAmount + taxAmount;

  return {
    rawBase,
    discountAmount,
    taxableAmount,
    taxRate,
    taxAmount,
    total
  };
}

/**
 * Calculate complete invoice totals
 */
function calculateInvoiceTotals(invoiceData) {
  const items = invoiceData.items || [];
  let itemsSubtotal = 0;
  let totalItemDiscounts = 0;
  let totalTaxableBeforeExtra = 0;

  // Breakdown of taxes by rate: { [rate]: { taxable, taxAmount } }
  const taxSlabs = {};

  items.forEach(item => {
    const calc = calculateLineItem(item);
    itemsSubtotal += calc.rawBase;
    totalItemDiscounts += calc.discountAmount;
    totalTaxableBeforeExtra += calc.taxableAmount;

    if (calc.taxRate > 0) {
      if (!taxSlabs[calc.taxRate]) {
        taxSlabs[calc.taxRate] = { rate: calc.taxRate, taxable: 0, taxAmount: 0 };
      }
      taxSlabs[calc.taxRate].taxable += calc.taxableAmount;
      taxSlabs[calc.taxRate].taxAmount += calc.taxAmount;
    }
  });

  // Calculate Extra Overall Discount
  let overallDiscountAmount = 0;
  const overallDiscountVal = parseFloat(invoiceData.extraDiscountValue) || 0;
  if (invoiceData.extraDiscountType === '%') {
    overallDiscountAmount = (totalTaxableBeforeExtra * Math.min(100, Math.max(0, overallDiscountVal))) / 100;
  } else {
    overallDiscountAmount = Math.min(totalTaxableBeforeExtra, Math.max(0, overallDiscountVal));
  }

  // Adjust tax slabs if overall discount exists
  let totalTax = 0;
  const discountRatio = totalTaxableBeforeExtra > 0 ? (totalTaxableBeforeExtra - overallDiscountAmount) / totalTaxableBeforeExtra : 1;

  Object.keys(taxSlabs).forEach(rate => {
    taxSlabs[rate].taxable *= discountRatio;
    taxSlabs[rate].taxAmount = (taxSlabs[rate].taxable * parseFloat(rate)) / 100;
    totalTax += taxSlabs[rate].taxAmount;
  });

  const shipping = Math.max(0, parseFloat(invoiceData.shippingCharges) || 0);
  const preRoundTotal = (totalTaxableBeforeExtra - overallDiscountAmount) + totalTax + shipping;

  let roundOff = 0;
  let grandTotal = preRoundTotal;

  if (invoiceData.autoRoundOff) {
    grandTotal = Math.round(preRoundTotal);
    roundOff = grandTotal - preRoundTotal;
  }

  return {
    itemsSubtotal,
    totalItemDiscounts,
    overallDiscountAmount,
    totalDiscounts: totalItemDiscounts + overallDiscountAmount,
    taxableAmount: totalTaxableBeforeExtra - overallDiscountAmount,
    taxSlabs: Object.values(taxSlabs),
    totalTax,
    shipping,
    roundOff,
    grandTotal: Math.max(0, grandTotal)
  };
}

/**
 * Convert number to words (Supports Indian Numbering for INR and Western for others)
 */
function amountToWords(amount, currencyCode = 'INR') {
  const curr = CURRENCIES[currencyCode] || CURRENCIES.INR;
  const num = Math.abs(parseFloat(amount) || 0);
  
  if (num === 0) return `${curr.prefix || curr.unit} Zero Only`;

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = '';

  if (currencyCode === 'INR') {
    words = convertNumberToIndianWords(integerPart);
  } else {
    words = convertNumberToWesternWords(integerPart);
  }

  let result = `${curr.prefix || curr.unit} ${words}`.trim();

  if (decimalPart > 0 && curr.subUnit) {
    const decWords = currencyCode === 'INR' ? convertNumberToIndianWords(decimalPart) : convertNumberToWesternWords(decimalPart);
    result += ` and ${decWords} ${curr.subUnit}`;
  }

  return `${result} Only`;
}

// Single-digit & teens words
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertUnderThousand(n) {
  let str = '';
  if (n >= 100) {
    str += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    const ten = TENS[Math.floor(n / 10)];
    const unit = ONES[n % 10];
    str += unit ? `${ten}-${unit} ` : `${ten} `;
  } else if (n > 0) {
    str += ONES[n] + ' ';
  }
  return str.trim();
}

/**
 * Indian Numbering System: Crores, Lakhs, Thousands, Hundreds
 */
function convertNumberToIndianWords(num) {
  if (num === 0) return 'Zero';

  let str = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;

  const lakh = Math.floor(num / 100000);
  num %= 100000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const remainder = num;

  if (crore > 0) {
    str += convertUnderThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    str += convertUnderThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    str += convertUnderThousand(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    str += convertUnderThousand(remainder) + ' ';
  }

  return str.trim();
}

/**
 * Western Numbering System: Billions, Millions, Thousands, Hundreds
 */
function convertNumberToWesternWords(num) {
  if (num === 0) return 'Zero';

  let str = '';
  const billion = Math.floor(num / 1000000000);
  num %= 1000000000;

  const million = Math.floor(num / 1000000);
  num %= 1000000;

  const thousand = Math.floor(num / 1000);
  num %= 1000;

  const remainder = num;

  if (billion > 0) {
    str += convertUnderThousand(billion) + ' Billion ';
  }
  if (million > 0) {
    str += convertUnderThousand(million) + ' Million ';
  }
  if (thousand > 0) {
    str += convertUnderThousand(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    str += convertUnderThousand(remainder) + ' ';
  }

  return str.trim();
}

window.InvoxCalc = {
  CURRENCIES,
  formatCurrency,
  formatNumber,
  calculateLineItem,
  calculateInvoiceTotals,
  amountToWords
};
