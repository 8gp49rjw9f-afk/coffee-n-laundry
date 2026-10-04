/*
 * Currencies, as a country and a code. "Canada — CAD" answers the
 * question a traveller actually has — which money do I need here —
 * where a bare code asks them to know it already.
 *
 * Not every currency in the world: the ones a laundromat or a café is
 * likely to price in. The list is sorted by name so the picker reads
 * alphabetically, and every code is ISO 4217 with three letters,
 * because that is the width the price table stores.
 */

export interface Currency {
  country: string;
  code: string;
  name: string;
}

export const CURRENCIES: Currency[] = [
  { country: "Argentina", code: "ARS", name: "Argentine peso" },
  { country: "Australia", code: "AUD", name: "Australian dollar" },
  { country: "Bahrain", code: "BHD", name: "Bahraini dinar" },
  { country: "Bangladesh", code: "BDT", name: "Bangladeshi taka" },
  { country: "Brazil", code: "BRL", name: "Brazilian real" },
  { country: "Bulgaria", code: "BGN", name: "Bulgarian lev" },
  { country: "Cambodia", code: "KHR", name: "Cambodian riel" },
  { country: "Canada", code: "CAD", name: "Canadian dollar" },
  { country: "Chile", code: "CLP", name: "Chilean peso" },
  { country: "China", code: "CNY", name: "Chinese yuan" },
  { country: "Colombia", code: "COP", name: "Colombian peso" },
  { country: "Costa Rica", code: "CRC", name: "Costa Rican colón" },
  { country: "Czechia", code: "CZK", name: "Czech koruna" },
  { country: "Denmark", code: "DKK", name: "Danish krone" },
  { country: "Egypt", code: "EGP", name: "Egyptian pound" },
  { country: "Eurozone", code: "EUR", name: "Euro" },
  { country: "Georgia", code: "GEL", name: "Georgian lari" },
  { country: "Guatemala", code: "GTQ", name: "Guatemalan quetzal" },
  { country: "Hong Kong", code: "HKD", name: "Hong Kong dollar" },
  { country: "Hungary", code: "HUF", name: "Hungarian forint" },
  { country: "Iceland", code: "ISK", name: "Icelandic króna" },
  { country: "India", code: "INR", name: "Indian rupee" },
  { country: "Indonesia", code: "IDR", name: "Indonesian rupiah" },
  { country: "Israel", code: "ILS", name: "Israeli shekel" },
  { country: "Japan", code: "JPY", name: "Japanese yen" },
  { country: "Jordan", code: "JOD", name: "Jordanian dinar" },
  { country: "Kenya", code: "KES", name: "Kenyan shilling" },
  { country: "Kuwait", code: "KWD", name: "Kuwaiti dinar" },
  { country: "Laos", code: "LAK", name: "Lao kip" },
  { country: "Malaysia", code: "MYR", name: "Malaysian ringgit" },
  { country: "Mexico", code: "MXN", name: "Mexican peso" },
  { country: "Morocco", code: "MAD", name: "Moroccan dirham" },
  { country: "Nepal", code: "NPR", name: "Nepalese rupee" },
  { country: "New Zealand", code: "NZD", name: "New Zealand dollar" },
  { country: "Nigeria", code: "NGN", name: "Nigerian naira" },
  { country: "Norway", code: "NOK", name: "Norwegian krone" },
  { country: "Pakistan", code: "PKR", name: "Pakistani rupee" },
  { country: "Panama", code: "PAB", name: "Panamanian balboa" },
  { country: "Paraguay", code: "PYG", name: "Paraguayan guaraní" },
  { country: "Peru", code: "PEN", name: "Peruvian sol" },
  { country: "Philippines", code: "PHP", name: "Philippine peso" },
  { country: "Poland", code: "PLN", name: "Polish złoty" },
  { country: "Qatar", code: "QAR", name: "Qatari riyal" },
  { country: "Romania", code: "RON", name: "Romanian leu" },
  { country: "Saudi Arabia", code: "SAR", name: "Saudi riyal" },
  { country: "Serbia", code: "RSD", name: "Serbian dinar" },
  { country: "Singapore", code: "SGD", name: "Singapore dollar" },
  { country: "South Africa", code: "ZAR", name: "South African rand" },
  { country: "South Korea", code: "KRW", name: "South Korean won" },
  { country: "Sri Lanka", code: "LKR", name: "Sri Lankan rupee" },
  { country: "Sweden", code: "SEK", name: "Swedish krona" },
  { country: "Switzerland", code: "CHF", name: "Swiss franc" },
  { country: "Taiwan", code: "TWD", name: "New Taiwan dollar" },
  { country: "Thailand", code: "THB", name: "Thai baht" },
  { country: "Tunisia", code: "TND", name: "Tunisian dinar" },
  { country: "Turkey", code: "TRY", name: "Turkish lira" },
  { country: "United Arab Emirates", code: "AED", name: "UAE dirham" },
  { country: "United Kingdom", code: "GBP", name: "Pound sterling" },
  { country: "United States", code: "USD", name: "US dollar" },
  { country: "Uruguay", code: "UYU", name: "Uruguayan peso" },
  { country: "Vietnam", code: "VND", name: "Vietnamese đồng" },
];

export const CURRENCY_CODES: string[] = CURRENCIES.map((c) => c.code);

export function currencyLabel(code: string): string {
  const found = CURRENCIES.find((c) => c.code === code);

  return found ? `${found.country} — ${found.code}` : code;
}
