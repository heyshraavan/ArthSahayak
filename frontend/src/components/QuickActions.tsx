import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  Mic,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Tag,
  User,
  Utensils,
  X,
} from 'lucide-react';
import { getCategoryInfo, TRANSACTION_CATEGORIES } from '../lib/categories';
import { BackendExtractionProvider } from '../services/extraction';
import { BackendTranscriptionProvider } from '../services/transcription';
import type {
  Transaction,
  TransactionCategory,
  TransactionType,
  VoiceUIState,
} from '../types';

interface QuickActionsProps {
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => void;
  language: 'en' | 'hi';
}

const transcriptionProvider = new BackendTranscriptionProvider();
const extractionProvider = new BackendExtractionProvider();

export const QuickActions: React.FC<QuickActionsProps> = ({ onAddTransaction, language }) => {
  const [activeModal, setActiveModal] = useState<'voice' | 'scan' | 'manual' | null>(null);

  // Manual & Voice entry two-step state
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [txType, setTxType] = useState<TransactionType>('credit');
  const [category, setCategory] = useState<TransactionCategory>('sales');
  const [formError, setFormError] = useState<string | null>(null);

  // Voice-specific state machine: idle | recording | processing | extracted | error
  const [voiceState, setVoiceState] = useState<VoiceUIState>('idle');
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Clean up audio tracks & timers when unmounting or switching modals
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const resetManualForm = () => {
    // Stop any active audio recording
    stopAudioRecording(false);
    setStep('input');
    setDate(new Date().toISOString().split('T')[0]);
    setPartyName('');
    setItem('');
    setAmount('');
    setTxType('credit');
    setCategory('sales');
    setFormError(null);
    setVoiceState('idle');
    setTranscriptText('');
    setVoiceError(null);
    setRecordingSeconds(0);
    setActiveModal(null);
  };

  const handleStartVoiceModal = () => {
    resetManualForm();
    setActiveModal('voice');
    setVoiceState('idle');
  };

  const startAudioRecording = async () => {
    setVoiceError(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceState('error');
      setVoiceError(
        language === 'hi'
          ? 'इस ब्राउज़र में माइक्रोफ़ोन समर्थित नहीं है। कृपया नीचे दिए गए उदाहरणों का उपयोग करें।'
          : 'Microphone is not supported in this browser. Please use the sample prompts below.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await handleProcessAudio(audioBlob);
        }
      };

      mediaRecorder.start();
      setVoiceState('recording');
      setRecordingSeconds(0);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      setVoiceState('error');
      const msg = err instanceof Error ? err.message : 'Permission denied';
      setVoiceError(
        language === 'hi'
          ? `माइक्रोफ़ोन अनुमति नहीं मिली (${msg})। कृपया अनुमति दें या नीचे दिए गए उदाहरण चुनें।`
          : `Microphone permission denied (${msg}). Please allow access or try a sample transaction below.`
      );
    }
  };

  const stopAudioRecording = (process = true) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      if (!process) {
        // Discard chunks if cancelling
        audioChunksRef.current = [];
      }
      mediaRecorderRef.current.stop();
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleProcessAudio = async (audioBlob: Blob) => {
    setVoiceState('processing');
    setVoiceError(null);

    try {
      // 1. Transcribe via provider abstraction
      const transcript = await transcriptionProvider.transcribe(audioBlob);
      setTranscriptText(transcript);

      // 2. Extract structured suggestion via provider abstraction
      const extractionResult = await extractionProvider.extract(transcript);
      populateExtractedFields(extractionResult.suggested_transaction);
      setVoiceState('extracted');
    } catch (err: unknown) {
      setVoiceState('error');
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      setVoiceError(msg);
    }
  };

  const handleProcessSampleTranscript = async (sampleText: string) => {
    setVoiceState('processing');
    setVoiceError(null);
    setTranscriptText(sampleText);

    try {
      const extractionResult = await extractionProvider.extract(sampleText);
      populateExtractedFields(extractionResult.suggested_transaction);
      setVoiceState('extracted');
    } catch (err: unknown) {
      setVoiceState('error');
      const msg = err instanceof Error ? err.message : 'Extraction failed';
      setVoiceError(msg);
    }
  };

  const populateExtractedFields = (tx: {
    date: string;
    party_name: string;
    item: string;
    amount: number;
    tx_type: TransactionType;
    category?: string | null;
  }) => {
    setDate(tx.date || new Date().toISOString().split('T')[0]);
    setPartyName(tx.party_name || '');
    setItem(tx.item || '');
    setAmount(String(tx.amount || ''));
    setTxType(tx.tx_type || 'credit');
    setCategory((tx.category as TransactionCategory) || (tx.tx_type === 'debit' ? 'raw_material' : 'sales'));
    setStep('input');
  };

  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const numAmount = parseFloat(amount);
    if (!partyName.trim()) {
      setFormError(language === 'hi' ? 'कृपया पार्टी / ग्राहक का नाम दर्ज करें' : 'Party name is required.');
      return;
    }
    if (!item.trim()) {
      setFormError(language === 'hi' ? 'कृपया सामान या कार्य का विवरण दर्ज करें' : 'Item description is required.');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError(language === 'hi' ? 'कृपया मान्य राशि (> 0) दर्ज करें' : 'Please enter a valid positive amount.');
      return;
    }
    if (!date) {
      setFormError(language === 'hi' ? 'कृपया मान्य तारीख चुनें' : 'Please select a valid date.');
      return;
    }

    setStep('review');
  };

  const handleConfirmAndAdd = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;

    // Guaranteed Human Confirmation: Only explicit user click invokes onAddTransaction
    onAddTransaction({
      date: date.trim(),
      party_name: partyName.trim(),
      item: item.trim(),
      amount: numAmount,
      tx_type: txType,
      category: category,
    });

    resetManualForm();
  };

  const selectedCategoryInfo = getCategoryInfo(category);
  const isCredit = txType === 'credit';
  const numAmount = parseFloat(amount) || 0;

  // Formatting seconds into MM:SS
  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remaining = sec % 60;
    return `${mins}:${remaining < 10 ? '0' : ''}${remaining}`;
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
          onClick={handleStartVoiceModal}
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
          onClick={() => {
            resetManualForm();
            setStep('input');
            setActiveModal('manual');
          }}
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
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto"
        >
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {((activeModal === 'manual' && step === 'review') || (activeModal === 'voice' && step === 'review')) && (
                  <button
                    type="button"
                    onClick={() => setStep('input')}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    aria-label="Back to edit form"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <h3 className="text-base font-bold text-slate-900">
                  {activeModal === 'voice' && step === 'input' && voiceState !== 'extracted' && (
                    language === 'hi' ? 'आवाज से लेनदेन दर्ज करें' : 'Voice Transaction Input'
                  )}
                  {activeModal === 'voice' && step === 'input' && voiceState === 'extracted' && (
                    language === 'hi' ? 'AI प्रविष्टि की समीक्षा करें' : 'Review AI Suggestion'
                  )}
                  {activeModal === 'voice' && step === 'review' && (
                    language === 'hi' ? 'लेनदेन की पुष्टि करें (Confirm)' : 'Final Review & Confirm'
                  )}
                  {activeModal === 'scan' && (
                    language === 'hi' ? 'पर्ची / बही-खाता स्कैन करें' : 'Scan Physical Chit / Ledger'
                  )}
                  {activeModal === 'manual' && step === 'input' && (
                    language === 'hi' ? 'नया लेनदेन दर्ज करें' : 'New Transaction Entry'
                  )}
                  {activeModal === 'manual' && step === 'review' && (
                    language === 'hi' ? 'प्रविष्टि की पुष्टि करें (Review)' : 'Review & Confirm Entry'
                  )}
                </h3>
              </div>
              <button
                type="button"
                onClick={resetManualForm}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Voice Recording & Processing State Machine */}
            {activeModal === 'voice' && step === 'input' && voiceState !== 'extracted' && (
              <div className="space-y-4 py-2">
                {/* State 1: Idle (Ready to record or choose sample) */}
                {voiceState === 'idle' && (
                  <div className="space-y-4 text-center">
                    <button
                      type="button"
                      onClick={startAudioRecording}
                      className="w-20 h-20 rounded-full bg-blue-900 hover:bg-blue-800 text-white flex flex-col items-center justify-center mx-auto shadow-lg active:scale-95 transition-transform cursor-pointer focus:outline-none focus:ring-4 focus:ring-blue-300"
                      aria-label="Start recording audio"
                    >
                      <Mic className="w-8 h-8 text-blue-100" />
                    </button>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        {language === 'hi' ? 'बोलने के लिए माइक दबाएं' : 'Tap to Start Speaking'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {language === 'hi'
                          ? 'अपनी भाषा में ग्राहक, सामान, राशि और विवरण बोलें'
                          : 'Speak naturally: customer, goods, amount, and payment'}
                      </p>
                    </div>

                    {/* Quick Sample Chips for Testing & Verification */}
                    <div className="pt-2 border-t border-slate-100 text-left space-y-2">
                      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        {language === 'hi' ? 'या तुरंत परीक्षण के लिए उदाहरण चुनें:' : 'Or tap a sample to test extraction:'}
                      </p>
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => handleProcessSampleTranscript('Received Rs 14000 from Anil Babu for 2 desks')}
                          className="w-full text-left p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-xs text-slate-800 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-blue-900">[Sales]</span> "Received Rs 14000 from Anil Babu for 2 desks"
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProcessSampleTranscript('Paid Rs 7500 to Maa Tara Timber Depot for timber planks')}
                          className="w-full text-left p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-xs text-slate-800 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-amber-900">[Raw Material]</span> "Paid Rs 7500 to Maa Tara Timber Depot for timber planks"
                        </button>
                        <button
                          type="button"
                          onClick={() => handleProcessSampleTranscript('Paid Rs 5000 to Biren Da for weekly wages')}
                          className="w-full text-left p-2 rounded-lg border border-slate-200 bg-slate-50 hover:bg-orange-50 hover:border-orange-300 text-xs text-slate-800 transition-colors cursor-pointer"
                        >
                          <span className="font-semibold text-orange-900">[OpEx]</span> "Paid Rs 5000 to Biren Da for weekly wages"
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* State 2: Recording Audio */}
                {voiceState === 'recording' && (
                  <div className="space-y-4 text-center py-4">
                    <div className="relative w-20 h-20 rounded-full bg-rose-100 flex items-center justify-center mx-auto">
                      <span className="absolute w-full h-full rounded-full bg-rose-400 opacity-75 animate-ping" />
                      <Mic className="w-9 h-9 text-rose-600 relative z-10" />
                    </div>
                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                        <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                        {language === 'hi' ? 'रिकॉर्डिंग चालू है...' : 'Recording in progress...'} ({formatSeconds(recordingSeconds)})
                      </div>
                      <p className="text-xs text-slate-500">
                        {language === 'hi' ? 'बोलने के बाद लाल बटन दबाएं' : 'Click stop when finished speaking'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => stopAudioRecording(true)}
                      className="min-h-[48px] px-6 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow-md hover:bg-rose-700 transition-colors inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      {language === 'hi' ? 'रिकॉर्डिंग रोकें (Finish)' : 'Stop Recording'}
                    </button>
                  </div>
                )}

                {/* State 3: Processing (Transcription & Extraction) */}
                {voiceState === 'processing' && (
                  <div className="space-y-3 text-center py-8">
                    <div className="w-12 h-12 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900">
                        {language === 'hi' ? 'ऑडियो का विश्लेषण हो रहा है...' : 'Processing Speech Audio...'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {language === 'hi'
                          ? 'आवाज को पाठ में बदलकर वित्तीय विवरण निकाला जा रहा है'
                          : 'Transcribing speech & extracting transaction candidate'}
                      </p>
                    </div>
                  </div>
                )}

                {/* State 4: Error State */}
                {voiceState === 'error' && (
                  <div className="space-y-4 py-2">
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-800">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">{language === 'hi' ? 'आवाज प्रविष्टि त्रुटि' : 'Voice Extraction Error'}</p>
                        <p className="mt-0.5">{voiceError || 'Failed to process voice input.'}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setVoiceState('idle')}
                        className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <RotateCcw className="w-4 h-4" />
                        {language === 'hi' ? 'पुनः प्रयास करें' : 'Try Again'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModal('manual');
                          setStep('input');
                        }}
                        className="flex-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        {language === 'hi' ? 'हाथ से लिखें' : 'Use Manual Form'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal Body: Step 1 Form Entry (used for Manual OR Voice in Extracted state) */}
            {((activeModal === 'manual' && step === 'input') || (activeModal === 'voice' && step === 'input' && voiceState === 'extracted')) && (
              <form onSubmit={handleProceedToReview} className="space-y-3">
                {/* Prominent Banner when Voice Extracted */}
                {activeModal === 'voice' && voiceState === 'extracted' && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                      <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                      <span>{language === 'hi' ? 'AI द्वारा निकाला गया — कृपया जांचें' : 'AI-extracted — Please verify'}</span>
                    </div>
                    {transcriptText && (
                      <p className="text-[11px] text-amber-800 italic bg-white/70 p-1.5 rounded border border-amber-200">
                        "{transcriptText}"
                      </p>
                    )}
                    <p className="text-[10px] text-amber-700">
                      {language === 'hi'
                        ? 'सभी फ़ील्ड और सुझाई गई श्रेणी संपादन योग्य हैं। कृपया पुष्टि करने से पहले विवरण जांच लें।'
                        : 'All fields & category are suggestions. You can edit any field before confirming.'}
                    </p>
                  </div>
                )}

                {formError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                    {formError}
                  </div>
                )}

                {/* 1. Transaction Type (Credit vs Debit) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? '1. लेनदेन का प्रकार (Type)' : '1. Transaction Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTxType('credit')}
                      className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        txType === 'credit'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                      {language === 'hi' ? 'आवक (Credit / जमा)' : 'Credit (Inflow)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('debit')}
                      className={`min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                        txType === 'debit'
                          ? 'bg-rose-50 border-rose-600 text-rose-800 ring-2 ring-rose-600'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <ArrowDownRight className="w-4 h-4 text-rose-600" />
                      {language === 'hi' ? 'खर्च (Debit / निकासी)' : 'Debit (Outflow)'}
                    </button>
                  </div>
                </div>

                {/* 2. Transaction Category (Explicit User Selection / Editable AI Suggestion) */}
                <div>
                  <label htmlFor="tx-category" className="block text-xs font-bold text-slate-700 mb-1">
                    {activeModal === 'voice' && voiceState === 'extracted' ? (
                      <span className="flex items-center gap-1 text-amber-900">
                        <Tag className="w-3.5 h-3.5" />
                        {language === 'hi' ? '2. सुझाई गई श्रेणी (सत्यापित करें या बदलें)' : '2. Suggested Category (Verify or Change)'}
                      </span>
                    ) : (
                      language === 'hi' ? '2. लेनदेन श्रेणी (Category)' : '2. Transaction Category'
                    )}
                  </label>
                  <select
                    id="tx-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TransactionCategory)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    {TRANSACTION_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {language === 'hi' ? cat.labelHi : `${cat.labelEn} (${cat.value})`}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {language === 'hi'
                      ? 'स्पष्ट श्रेणी चयन: बिक्री को टर्नओवर में गिना जाएगा, ऋण या आहरण को अलग रखा जाएगा।'
                      : 'Explicit accounting category used for deterministic turnover & operating surplus calculations.'}
                  </p>
                </div>

                {/* 3. Amount */}
                <div>
                  <label htmlFor="tx-amount" className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? '3. राशि (Amount in ₹)' : '3. Amount (INR)'}
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
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* 4. Date */}
                <div>
                  <label htmlFor="tx-date" className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? '4. तारीख (Date)' : '4. Date'}
                  </label>
                  <input
                    id="tx-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {/* 5. Party Name */}
                <div>
                  <label htmlFor="party-name" className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? '5. ग्राहक / पार्टी का नाम' : '5. Customer / Party Name'}
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

                {/* 6. Item / Description */}
                <div>
                  <label htmlFor="item-desc" className="block text-xs font-bold text-slate-700 mb-1">
                    {language === 'hi' ? '6. सामान या काम का विवरण' : '6. Item / Work Description'}
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

                <div className="pt-2 flex gap-2">
                  {activeModal === 'voice' && voiceState === 'extracted' && (
                    <button
                      type="button"
                      onClick={() => setVoiceState('idle')}
                      className="min-h-[48px] py-3 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {language === 'hi' ? 'पुनः बोलें' : 'Re-speak'}
                    </button>
                  )}
                  <button
                    type="submit"
                    className="flex-1 min-h-[48px] py-3 px-4 rounded-xl bg-blue-900 text-white font-bold text-sm shadow-md hover:bg-blue-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600"
                  >
                    {language === 'hi' ? 'समीक्षा और पुष्टि करें →' : 'Review & Confirm →'}
                  </button>
                </div>
              </form>
            )}

            {/* Modal Body: Step 2 - Review & Confirm Step (Unified for Manual & Voice) */}
            {((activeModal === 'manual' || activeModal === 'voice') && step === 'review') && (
              <div className="space-y-4">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  {/* Type and Amount Header Banner */}
                  <div
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isCredit ? 'bg-emerald-100/90 text-emerald-900' : 'bg-rose-100/90 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isCredit ? (
                        <ArrowUpRight className="w-5 h-5 text-emerald-700" />
                      ) : (
                        <ArrowDownRight className="w-5 h-5 text-rose-700" />
                      )}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block">
                          {isCredit
                            ? language === 'hi' ? 'आवक (Credit / Inflow)' : 'Inflow (Credit)'
                            : language === 'hi' ? 'खर्च (Debit / Outflow)' : 'Outflow (Debit)'}
                        </span>
                        <span className="text-xs font-semibold">
                          {language === 'hi'
                            ? isCredit ? 'खाते में जमा' : 'खाते से खर्च'
                            : isCredit ? 'Cash Inflow' : 'Cash Outflow'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black tracking-tight">
                        {isCredit ? '+' : '-'}₹{numAmount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* 6 Fields Detailed Breakdown */}
                  <div className="grid grid-cols-1 gap-2 pt-1 text-xs">
                    <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" />
                        {language === 'hi' ? 'श्रेणी (Category)' : 'Category'}
                      </span>
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-full border text-[11px] ${
                          selectedCategoryInfo?.badgeClass ?? 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {selectedCategoryInfo
                          ? language === 'hi'
                            ? selectedCategoryInfo.labelHi
                            : selectedCategoryInfo.labelEn
                          : category}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {language === 'hi' ? 'तारीख (Date)' : 'Date'}
                      </span>
                      <span className="font-semibold text-slate-900">{date}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {language === 'hi' ? 'ग्राहक / पार्टी' : 'Party / Customer'}
                      </span>
                      <span className="font-semibold text-slate-900">{partyName}</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Utensils className="w-3.5 h-3.5" />
                        {language === 'hi' ? 'सामान / कार्य' : 'Item / Description'}
                      </span>
                      <span className="font-semibold text-slate-900">{item}</span>
                    </div>
                  </div>
                </div>

                {/* Accounting Assurance Note */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <p>
                    {language === 'hi'
                      ? 'पुष्टि करने पर यह लेनदेन सीधे अर्थसहायक के वित्तीय इंजन में दर्ज होगा और टर्नओवर व बैंक साख का तुरंत पुनर्गणन होगा।'
                      : 'Upon confirmation, this entry will be sent to the FastAPI finance engine to deterministically recalculate turnover, working capital, and loan eligibility.'}
                  </p>
                </div>

                {/* Two Action Buttons: Edit Details vs Confirm & Save */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setStep('input')}
                    className="min-h-[46px] py-2.5 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    {language === 'hi' ? '← विवरण सुधारें' : '← Edit Details'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAndAdd}
                    className="min-h-[46px] py-2.5 px-3 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md hover:bg-emerald-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600"
                  >
                    {language === 'hi' ? 'पुष्टि करें और जोड़ें ✓' : 'Confirm & Save ✓'}
                  </button>
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
                <button
                  type="button"
                  onClick={resetManualForm}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 font-semibold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {language === 'hi' ? 'बंद करें' : 'Close'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
