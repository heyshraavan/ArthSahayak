import React, { useState } from 'react';
import { Camera, Mic, Plus, X } from 'lucide-react';
import type { Transaction } from '../types';


interface QuickActionsProps {
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  language: 'en' | 'hi';
}

export const QuickActions: React.FC<QuickActionsProps> = ({ onAddTransaction, language }) => {
  const [activeModal, setActiveModal] = useState<'voice' | 'scan' | 'manual' | null>(null);

  // Simple form state for manual entry
  const [partyName, setPartyName] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [txType, setTxType] = useState<'credit' | 'debit'>('credit');

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!partyName.trim() || !item.trim() || isNaN(numAmount) || numAmount <= 0) {
      return;
    }

    onAddTransaction({
      date: new Date().toISOString().split('T')[0],
      party_name: partyName.trim(),
      item: item.trim(),
      amount: numAmount,
      tx_type: txType,
    });

    // Reset and close
    setPartyName('');
    setItem('');
    setAmount('');
    setActiveModal(null);
  };

  return (
    <section className="space-y-2" aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="text-sm font-bold text-slate-900 uppercase tracking-wider">
        {language === 'hi' ? 'त्वरित लेनदेन प्रविष्टि' : 'Quick Transaction Entry'}
      </h2>

      {/* 3 Large Touch Target Buttons */}
      <div className="grid grid-cols-3 gap-2.5">
        {/* Action 1: Speak Transaction */}
        <button
          type="button"
          onClick={() => setActiveModal('voice')}
          className="min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl border border-blue-200 bg-blue-900 text-white shadow-xs hover:bg-blue-800 active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
          aria-label={language === 'hi' ? 'बोलकर लेनदेन जोड़ें' : 'Speak Transaction'}
        >
          <div className="p-1.5 rounded-full bg-blue-800 text-blue-100">
            <Mic className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-xs font-bold mt-1 tracking-tight text-center">
            {language === 'hi' ? 'बोलकर जोड़ें' : 'Speak'}
          </span>
          <span className="text-[10px] text-blue-200">
            {language === 'hi' ? 'आवाज से' : 'Voice Input'}
          </span>
        </button>

        {/* Action 2: Scan Chit */}
        <button
          type="button"
          onClick={() => setActiveModal('scan')}
          className="min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl border border-emerald-300 bg-emerald-700 text-white shadow-xs hover:bg-emerald-800 active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600"
          aria-label={language === 'hi' ? 'बही-खाता या पर्ची स्कैन करें' : 'Scan Chit or Ledger'}
        >
          <div className="p-1.5 rounded-full bg-emerald-800 text-emerald-100">
            <Camera className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-xs font-bold mt-1 tracking-tight text-center">
            {language === 'hi' ? 'पर्ची स्कैन' : 'Scan Chit'}
          </span>
          <span className="text-[10px] text-emerald-100">
            {language === 'hi' ? 'फोटो खींचें' : 'Camera OCR'}
          </span>
        </button>

        {/* Action 3: Manual Entry */}
        <button
          type="button"
          onClick={() => setActiveModal('manual')}
          className="min-h-[76px] flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-600"
          aria-label={language === 'hi' ? 'हाथ से लेनदेन लिखें' : 'Add Manual Transaction'}
        >
          <div className="p-1.5 rounded-full bg-slate-100 text-slate-700">
            <Plus className="w-5 h-5" aria-hidden="true" />
          </div>
          <span className="text-xs font-bold mt-1 tracking-tight text-center">
            {language === 'hi' ? 'लिखकर जोड़ें' : 'Add Manual'}
          </span>
          <span className="text-[10px] text-slate-500">
            {language === 'hi' ? 'फॉर्म भरें' : 'Form Entry'}
          </span>
        </button>
      </div>

      {/* Modal Dialogs */}
      {activeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3"
        >
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {activeModal === 'voice' && (language === 'hi' ? 'आवाज से लेनदेन रिकॉर्ड करें' : 'Voice Transaction Input')}
                {activeModal === 'scan' && (language === 'hi' ? 'पर्ची / बही-खाता स्कैन करें' : 'Scan Physical Chit / Ledger')}
                {activeModal === 'manual' && (language === 'hi' ? 'नया लेनदेन जोड़ें' : 'New Transaction Entry')}
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Voice Action Preview */}
            {activeModal === 'voice' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-blue-50 border-2 border-blue-200 text-blue-900 flex items-center justify-center mx-auto">
                  <Mic className="w-8 h-8 animate-pulse text-blue-900" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">
                    {language === 'hi' ? 'अपनी भाषा में बोलें' : 'Speak naturally in your dialect'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {language === 'hi'
                      ? 'उदाहरण: "रमेश को 500 रुपये की लकड़ी दी" या "स्कूल से 14,000 रुपये मिले"'
                      : 'E.g., "Received Rs. 14,000 from school for 2 desks" or "Paid Rs. 7,500 for timber planks"'}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 text-left">
                  <b>{language === 'hi' ? 'प्रोटोटाइप सूचना:' : 'Prototype Milestone:'}</b>{' '}
                  {language === 'hi'
                    ? 'माइक्रोफ़ोन STT पाइपलाइन (Bhashini/Whisper) आगामी विकास चरण में सीधे कनेक्ट होगी।'
                    : 'The speech-to-text pipeline (Bhashini/Whisper integration) will be hooked directly in the upcoming milestone.'}
                </div>
              </div>
            )}

            {/* Modal Body: Scan Action Preview */}
            {activeModal === 'scan' && (
              <div className="py-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-800 flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8 text-emerald-700" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900">
                    {language === 'hi' ? 'हाथ से लिखे पर्चे की तस्वीर लें' : 'Photograph Handwritten Paper Chit'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    {language === 'hi'
                      ? 'दुकानदार या कारीगर की कच्ची पर्ची, उधारी नोट या बही-खाता पन्ना'
                      : 'Take a clear photo of torn paper chits, raw receipts, or bahi-khata tallies'}
                  </p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 text-left">
                  <b>{language === 'hi' ? 'प्रोटोटाइप सूचना:' : 'Prototype Milestone:'}</b>{' '}
                  {language === 'hi'
                    ? 'कैमरा OCR और विज़न पाइपलाइन आगामी विकास चरण में जोड़ी जाएगी।'
                    : 'The camera OCR document extraction pipeline will be hooked directly in the upcoming milestone.'}
                </div>
              </div>
            )}

            {/* Modal Body: Manual Form Entry */}
            {activeModal === 'manual' && (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'लेनदेन का प्रकार' : 'Transaction Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTxType('credit')}
                      className={`min-h-[44px] rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        txType === 'credit'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-600'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {language === 'hi' ? 'आवक (Credit / बिक्री)' : 'Credit (Inflow / Sale)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('debit')}
                      className={`min-h-[44px] rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                        txType === 'debit'
                          ? 'bg-rose-50 border-rose-600 text-rose-800 ring-2 ring-rose-600'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {language === 'hi' ? 'खर्च (Debit / खरीद)' : 'Debit (Outflow / Expense)'}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="party-name" className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'ग्राहक / विक्रेता का नाम' : 'Party / Customer Name'}
                  </label>
                  <input
                    id="party-name"
                    type="text"
                    required
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    placeholder={language === 'hi' ? 'उदा. सुकुमार बाबु' : 'e.g. Sukumar Roy'}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="item-desc" className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'सामान या काम का विवरण' : 'Item / Work Description'}
                  </label>
                  <input
                    id="item-desc"
                    type="text"
                    required
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder={language === 'hi' ? 'उदा. लकड़ी की मेज' : 'e.g. Wooden Dining Table'}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label htmlFor="tx-amount" className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? 'रुपये (Amount in INR)' : 'Amount (INR)'}
                  </label>
                  <input
                    id="tx-amount"
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="₹ 5000"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-blue-900 text-white font-bold text-sm shadow-md hover:bg-blue-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                  >
                    {language === 'hi' ? 'खाते में सहेजें (Save Entry)' : 'Save to Ledger'}
                  </button>
                </div>
              </form>
            )}

            {/* Modal Footer for Voice & Scan */}
            {activeModal !== 'manual' && (
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
              >
                {language === 'hi' ? 'बंद करें' : 'Close'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
