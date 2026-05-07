import React, { useState } from 'react';
import { DollarSign } from 'lucide-react';
import { useI18n } from '../i18n';

const FinanceTool = () => {
  const { t } = useI18n();
  const [mode, setMode] = useState<'vat' | 'loan'>('vat');
  const [amount, setAmount] = useState(1000);
  const [vatRate, setVatRate] = useState(10);
  const [discountRate, setDiscountRate] = useState(0);
  const [principal, setPrincipal] = useState(10000);
  const [annualRate, setAnnualRate] = useState(12);
  const [months, setMonths] = useState(12);

  const vatValue = amount * (vatRate / 100);
  const vatTotal = amount + vatValue;
  const discountValue = amount * (discountRate / 100);
  const discountTotal = amount - discountValue;

  const monthlyRate = annualRate / 100 / 12;
  const monthlyPayment =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  const totalPayment = monthlyPayment * months;
  const totalInterest = totalPayment - principal;

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <DollarSign className="text-emerald-400" /> {t('Finance', 'Tài chính')}
      </h2>

      <div className="flex bg-dark-900 p-1 rounded-lg w-fit mb-6">
        {['vat', 'loan'].map((item) => (
          <button
            key={item}
            onClick={() => setMode(item as any)}
            className={`px-4 py-2 rounded-md text-sm font-bold uppercase transition-all ${
              mode === item ? 'bg-emerald-500 text-black' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {item === 'vat' ? t('VAT', 'VAT') : t('Loan', 'Vay')}
          </button>
        ))}
      </div>

      {mode === 'vat' ? (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-sm text-gray-400">
              {t('Amount', 'Số tiền')}
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
              />
            </label>
            <label className="text-sm text-gray-400">
              {t('VAT %', 'VAT %')}
              <input
                type="number"
                value={vatRate}
                onChange={(e) => setVatRate(Number(e.target.value))}
                className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
              />
            </label>
            <label className="text-sm text-gray-400">
              {t('Discount %', 'Giảm giá %')}
              <input
                type="number"
                value={discountRate}
                onChange={(e) => setDiscountRate(Number(e.target.value))}
                className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
              />
            </label>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-3">
              <div className="text-gray-500">{t('VAT Value', 'Giá trị VAT')}</div>
              <div className="text-emerald-300 font-mono">{vatValue.toFixed(2)}</div>
              <div className="text-gray-500 mt-2">{t('Total with VAT', 'Tổng có VAT')}</div>
              <div className="text-emerald-300 font-mono">{vatTotal.toFixed(2)}</div>
            </div>
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-3">
              <div className="text-gray-500">{t('Discount Value', 'Giá trị giảm')}</div>
              <div className="text-emerald-300 font-mono">{discountValue.toFixed(2)}</div>
              <div className="text-gray-500 mt-2">{t('After Discount', 'Sau giảm')}</div>
              <div className="text-emerald-300 font-mono">{discountTotal.toFixed(2)}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <label className="text-sm text-gray-400">
              {t('Principal', 'Gốc')}
              <input
                type="number"
                value={principal}
                onChange={(e) => setPrincipal(Number(e.target.value))}
                className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
              />
            </label>
            <label className="text-sm text-gray-400">
              {t('Annual Rate %', 'Lãi suất năm %')}
              <input
                type="number"
                value={annualRate}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
              />
            </label>
            <label className="text-sm text-gray-400">
              {t('Months', 'Số tháng')}
              <input
                type="number"
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="w-full mt-1 bg-dark-900 border border-dark-700 rounded-lg px-3 py-2 text-gray-200"
              />
            </label>
          </div>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-3">
              <div className="text-gray-500">{t('Monthly Payment', 'Trả hàng tháng')}</div>
              <div className="text-emerald-300 font-mono">{monthlyPayment.toFixed(2)}</div>
            </div>
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-3">
              <div className="text-gray-500">{t('Total Interest', 'Tổng lãi')}</div>
              <div className="text-emerald-300 font-mono">{totalInterest.toFixed(2)}</div>
            </div>
            <div className="bg-dark-900 border border-dark-700 rounded-lg p-3">
              <div className="text-gray-500">{t('Total Payment', 'Tổng phải trả')}</div>
              <div className="text-emerald-300 font-mono">{totalPayment.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceTool;
