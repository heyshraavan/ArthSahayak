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
  Trash2,
  Upload,
  User,
  Utensils,
  X,
} from 'lucide-react';
import { getCategoryInfo, TRANSACTION_CATEGORIES } from '../lib/categories';
import { extractOcrTransactions } from '../services/api';
import { BackendExtractionProvider } from '../services/extraction';
import { BackendTranscriptionProvider } from '../services/transcription';
import type {
  OcrUIState,
  Transaction,
  TransactionCategory,
  TransactionType,
  VoiceUIState,
} from '../types';

interface QuickActionsProps {
  onAddTransaction: (tx: Omit<Transaction, 'id'>) => Promise<void> | void;
  onAddTransactions?: (txs: Omit<Transaction, 'id'>[]) => Promise<void> | void;
  language: 'en' | 'hi';
}

export interface EditableOcrTransaction {
  id: string;
  date: string;
  party_name: string;
  item: string;
  amount: string;
  tx_type: TransactionType;
  category: TransactionCategory;
  error?: string | null;
}

const transcriptionProvider = new BackendTranscriptionProvider();
const extractionProvider = new BackendExtractionProvider();

export const QuickActions: React.FC<QuickActionsProps> = ({
  onAddTransaction,
  onAddTransactions,
  language,
}) => {
  const [activeModal, setActiveModal] = useState<'voice' | 'scan' | 'manual' | null>(null);

  // Submission / saving lock to avoid duplicate transactions
  const [isSaving, setIsSaving] = useState<boolean>(false);

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

  // OCR-specific state machine: idle | image_selected | processing | extracted | error
  const [ocrState, setOcrState] = useState<OcrUIState>('idle');
  const [ocrImageFile, setOcrImageFile] = useState<File | null>(null);
  const [ocrImagePreview, setOcrImagePreview] = useState<string | null>(null);
  const [ocrImageBase64, setOcrImageBase64] = useState<string | null>(null);
  const [ocrImageMime, setOcrImageMime] = useState<string>('image/jpeg');
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrRawText, setOcrRawText] = useState<string | null>(null);
  const [ocrTransactions, setOcrTransactions] = useState<EditableOcrTransaction[]>([]);

  // Input refs for camera capture & file selection
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setIsSaving(false);
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
    // OCR reset
    setOcrState('idle');
    setOcrImageFile(null);
    setOcrImagePreview(null);
    setOcrImageBase64(null);
    setOcrError(null);
    setOcrRawText(null);
    setOcrTransactions([]);
    setActiveModal(null);
  };

  const handleStartVoiceModal = () => {
    resetManualForm();
    setActiveModal('voice');
    setVoiceState('idle');
  };

  const handleStartScanModal = () => {
    resetManualForm();
    setActiveModal('scan');
    setOcrState('idle');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setOcrImageFile(file);
    setOcrError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setOcrImagePreview(dataUrl);
      const base64Data = dataUrl.split(',')[1] || '';
      setOcrImageBase64(base64Data);
      setOcrImageMime(file.type || 'image/jpeg');
      setOcrState('image_selected');
    };
    reader.onerror = () => {
      setOcrError(language === 'hi' ? 'फ़ाइल पढ़ने में त्रुटि हुई।' : 'Failed to read the selected file.');
      setOcrState('error');
    };
    reader.readAsDataURL(file);
  };

  const handleExecuteOcrScan = async () => {
    if (!ocrImageBase64) return;
    setOcrState('processing');
    setOcrError(null);

    try {
      const response = await extractOcrTransactions(ocrImageBase64, ocrImageMime);
      setOcrRawText(response.raw_text || null);

      const items: EditableOcrTransaction[] = (response.suggested_transactions || []).map((tx, idx) => ({
        id: `ocr-tx-${Date.now()}-${idx}`,
        date: tx.date || new Date().toISOString().split('T')[0],
        party_name: tx.party_name || '',
        item: tx.item || '',
        amount: tx.amount ? String(tx.amount) : '',
        tx_type: tx.tx_type || 'debit',
        category: (tx.category as TransactionCategory) || (tx.tx_type === 'credit' ? 'sales' : 'raw_material'),
        error: null,
      }));

      if (items.length === 0) {
        setOcrError(
          language === 'hi'
            ? 'इस दस्तावेज में कोई स्पष्ट लेनदेन नहीं मिला। कृपया तस्वीर दोबारा लें या विवरण हाथ से दर्ज करें।'
            : 'No distinct business transactions could be identified in this image. Please take a clearer photo or enter manually.'
        );
        setOcrState('error');
        return;
      }

      setOcrTransactions(items);
      setOcrState('extracted');
    } catch (err: unknown) {
      setOcrState('error');
      const msg = err instanceof Error ? err.message : 'OCR extraction failed';
      setOcrError(msg);
    }
  };

  const handleUpdateOcrTxField = (
    id: string,
    field: keyof EditableOcrTransaction,
    value: any
  ) => {
    setOcrTransactions((prev) =>
      prev.map((tx) => (tx.id === id ? { ...tx, [field]: value, error: null } : tx))
    );
  };

  const handleRemoveOcrTx = (id: string) => {
    const remaining = ocrTransactions.filter((tx) => tx.id !== id);
    if (remaining.length === 0) {
      setOcrState('idle');
      setOcrImageFile(null);
      setOcrImagePreview(null);
      setOcrImageBase64(null);
    }
    setOcrTransactions(remaining);
  };

  const handleConfirmAllOcrTransactions = async () => {
    if (ocrTransactions.length === 0) return;
    if (isSaving) return;

    setFormError(null);
    let hasError = false;

    const updatedList = ocrTransactions.map((tx) => {
      const numAmount = parseFloat(tx.amount);
      let error: string | null = null;
      if (isNaN(numAmount) || numAmount <= 0) {
        error = language === 'hi' ? 'मान्य राशि (> 0) दर्ज करें' : 'Valid positive amount required.';
        hasError = true;
      } else if (!tx.party_name.trim()) {
        error = language === 'hi' ? 'पार्टी का नाम आवश्यक है' : 'Party name is required.';
        hasError = true;
      } else if (!tx.item.trim()) {
        error = language === 'hi' ? 'सामान का विवरण आवश्यक है' : 'Item description is required.';
        hasError = true;
      } else if (!tx.date) {
        error = language === 'hi' ? 'तारीख आवश्यक है' : 'Date is required.';
        hasError = true;
      }
      return { ...tx, error };
    });

    if (hasError) {
      setOcrTransactions(updatedList);
      setFormError(
        language === 'hi'
          ? 'कृपया चिह्नित त्रुटियों को सुधारें।'
          : 'Please fix the highlighted errors before confirming.'
      );
      return;
    }

    setIsSaving(true);

    try {
      const confirmedTxs = ocrTransactions.map((tx) => ({
        date: tx.date.trim(),
        party_name: tx.party_name.trim(),
        item: tx.item.trim(),
        amount: parseFloat(tx.amount),
        tx_type: tx.tx_type,
        category: tx.category,
      }));

      // Atomic batch addition: write to IndexedDB in one transaction and update state once
      if (onAddTransactions) {
        await onAddTransactions(confirmedTxs);
      } else {
        for (const tx of confirmedTxs) {
          await onAddTransaction(tx);
        }
      }

      resetManualForm();
    } catch (err: unknown) {
      console.error('Failed to save OCR batch:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save confirmed transactions';
      setFormError(language === 'hi' ? `सहेजने में त्रुटि: ${msg}` : `Failed to save transactions: ${msg}`);
    } finally {
      setIsSaving(false);
    }
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

  const handleConfirmAndAdd = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return;
    if (isSaving) return;

    setIsSaving(true);
    setFormError(null);

    try {
      // Guaranteed Human Confirmation: Only explicit user click invokes onAddTransaction
      await onAddTransaction({
        date: date.trim(),
        party_name: partyName.trim(),
        item: item.trim(),
        amount: numAmount,
        tx_type: txType,
        category: category,
      });

      resetManualForm();
    } catch (err: unknown) {
      console.error('Failed to add transaction:', err);
      const msg = err instanceof Error ? err.message : 'Failed to save transaction';
      setFormError(language === 'hi' ? `सहेजने में त्रुटि: ${msg}` : `Failed to save transaction: ${msg}`);
    } finally {
      setIsSaving(false);
    }
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
          onClick={handleStartScanModal}
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
          <div className={`bg-white rounded-2xl w-full ${activeModal === 'scan' && ocrState === 'extracted' ? 'max-w-lg' : 'max-w-md'} p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 my-auto`}>
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
                {activeModal === 'scan' && (ocrState === 'image_selected' || ocrState === 'extracted' || ocrState === 'error') && (
                  <button
                    type="button"
                    onClick={() => {
                      setOcrState('idle');
                      setOcrImageFile(null);
                      setOcrImagePreview(null);
                      setOcrImageBase64(null);
                      setOcrError(null);
                      setOcrTransactions([]);
                    }}
                    className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
                    aria-label="Back to camera picker"
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
                  {activeModal === 'scan' && ocrState === 'idle' && (
                    language === 'hi' ? 'पर्ची / बही-खाता स्कैन करें' : 'Scan Physical Chit / Ledger'
                  )}
                  {activeModal === 'scan' && ocrState === 'image_selected' && (
                    language === 'hi' ? 'तस्वीर की समीक्षा करें' : 'Preview Document Photo'
                  )}
                  {activeModal === 'scan' && ocrState === 'processing' && (
                    language === 'hi' ? 'AI स्कैनिंग जारी है...' : 'AI Scanning Document...'
                  )}
                  {activeModal === 'scan' && ocrState === 'extracted' && (
                    language === 'hi' ? `पहचाने गए लेनदेन (${ocrTransactions.length})` : `Extracted Entries (${ocrTransactions.length})`
                  )}
                  {activeModal === 'scan' && ocrState === 'error' && (
                    language === 'hi' ? 'स्कैनिंग त्रुटि' : 'OCR Scan Error'
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
                  {selectedCategoryInfo?.helperEn && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      {language === 'hi' ? selectedCategoryInfo.helperHi : selectedCategoryInfo.helperEn}
                    </p>
                  )}
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
                    disabled={isSaving}
                    onClick={() => setStep('input')}
                    className={`min-h-[46px] py-2.5 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs transition-colors ${
                      isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    {language === 'hi' ? '← विवरण सुधारें' : '← Edit Details'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleConfirmAndAdd}
                    className={`min-h-[46px] py-2.5 px-3 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 ${
                      isSaving ? 'opacity-60 cursor-not-allowed bg-emerald-800' : 'hover:bg-emerald-800 cursor-pointer'
                    }`}
                  >
                    {isSaving
                      ? (language === 'hi' ? 'सहेजा जा रहा है...' : 'Saving...')
                      : (language === 'hi' ? 'पुष्टि करें और जोड़ें ✓' : 'Confirm & Save ✓')}
                  </button>
                </div>
              </div>
            )}

            {/* Modal Body: Scan Chit Document OCR Pipeline */}
            {activeModal === 'scan' && (
              <div className="space-y-4">
                {/* Hidden inputs for Camera Capture & Gallery Selection */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="ocr-camera-input"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="ocr-gallery-input"
                />

                {/* State 1: IDLE - Camera or File Upload Picker */}
                {ocrState === 'idle' && (
                  <div className="space-y-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 text-emerald-800 flex items-center justify-center mx-auto">
                      <Camera className="w-8 h-8 text-emerald-700" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900">
                        {language === 'hi' ? 'हाथ से लिखे पर्चे या बही-खाते की फोटो लें' : 'Photograph Handwritten Paper Chit or Ledger'}
                      </p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">
                        {language === 'hi'
                          ? 'दुकानदार या कारीगर की कच्ची पर्ची, उधारी नोट, या बही-खाता पन्ना'
                          : 'Take a clear photo of torn paper chits, raw receipts, or bahi-khata ledger pages'}
                      </p>
                    </div>

                    {/* Safety & Domain Guidance Banner */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 text-left space-y-1.5">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                        <Sparkles className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>{language === 'hi' ? 'व्यावसायिक दस्तावेज स्कैनिंग:' : 'Business Document Scanning:'}</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        {language === 'hi'
                          ? 'यह सुविधा केवल व्यावसायिक पर्चियों, बिलों व बही-खातों के लिए है। कृपया आधार, पैन या व्यक्तिगत पहचान पत्र अपलोड न करें।'
                          : 'Designed strictly for business chits, receipts, and bahi-khata ledgers. Please do NOT upload Aadhaar, PAN, or personal identity documents.'}
                      </p>
                    </div>

                    {/* 2 Large Touch Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="min-h-[52px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md hover:bg-emerald-800 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Camera className="w-4 h-4" />
                        <span>{language === 'hi' ? 'कैमरा चालू करें' : 'Take Photo'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-h-[52px] flex items-center justify-center gap-2 py-3 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Upload className="w-4 h-4 text-slate-600" />
                        <span>{language === 'hi' ? 'गैलरी से चुनें' : 'Upload File'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* State 2: IMAGE SELECTED - Preview Before Upload */}
                {ocrState === 'image_selected' && ocrImagePreview && (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-60 flex items-center justify-center">
                      <img
                        src={ocrImagePreview}
                        alt="Selected paper slip preview"
                        className="max-h-60 w-full object-contain"
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                      <span className="font-medium truncate max-w-[200px]">
                        {ocrImageFile?.name || 'document_photo.jpg'}
                      </span>
                      <span className="text-slate-400">
                        {ocrImageFile ? `${Math.round(ocrImageFile.size / 1024)} KB` : ''}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 text-center">
                      {language === 'hi'
                        ? 'जेमिनी विज़न एआई इस पर्चे से सभी वित्तीय लेनदेन को पढ़ेगा।'
                        : 'Gemini Vision AI will extract transaction line items from this document.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOcrState('idle');
                          setOcrImageFile(null);
                          setOcrImagePreview(null);
                          setOcrImageBase64(null);
                        }}
                        className="min-h-[46px] py-2.5 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {language === 'hi' ? '← फोटो बदलें' : '← Retake Photo'}
                      </button>
                      <button
                        type="button"
                        onClick={handleExecuteOcrScan}
                        className="min-h-[46px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md hover:bg-emerald-800 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>{language === 'hi' ? 'AI से स्कैन करें ✨' : 'Scan with AI ✨'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* State 3: PROCESSING - Scanning Animation */}
                {ocrState === 'processing' && (
                  <div className="py-8 text-center space-y-4">
                    <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-50" />
                      <div className="relative w-16 h-16 rounded-full bg-emerald-700 text-white flex items-center justify-center shadow-lg">
                        <Sparkles className="w-8 h-8 animate-pulse text-emerald-200" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900">
                        {language === 'hi' ? 'पर्चे की स्कैनिंग जारी है...' : 'Scanning document with Gemini Vision...'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {language === 'hi'
                          ? 'AI हस्तलिखित प्रविष्टियों और राशियों की पहचान कर रहा है...'
                          : 'AI is extracting handwritten ledger line items, parties, and amounts...'}
                      </p>
                    </div>
                  </div>
                )}

                {/* State 4: ERROR */}
                {ocrState === 'error' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-900">
                      <div className="flex items-center gap-2 font-bold text-sm text-rose-950">
                        <AlertCircle className="w-5 h-5 text-rose-700 shrink-0" />
                        <span>{language === 'hi' ? 'स्कैनिंग में समस्या' : 'OCR Scan Failed'}</span>
                      </div>
                      <p className="text-xs text-rose-800 leading-relaxed">
                        {ocrError || (language === 'hi' ? 'तस्वीर को पढ़ा नहीं जा सका। कृपया पुनः प्रयास करें।' : 'Could not read image.')}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setOcrState('idle');
                          setOcrImageFile(null);
                          setOcrImagePreview(null);
                          setOcrImageBase64(null);
                          setOcrError(null);
                        }}
                        className="min-h-[46px] py-2.5 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {language === 'hi' ? '↺ दूसरी फोटो लें' : '↺ Try Another Photo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          resetManualForm();
                          setActiveModal('manual');
                        }}
                        className="min-h-[46px] py-2.5 px-3 rounded-xl bg-blue-900 text-white font-bold text-xs shadow-md hover:bg-blue-800 transition-colors cursor-pointer"
                      >
                        {language === 'hi' ? 'हाथ से लिखें →' : 'Enter Manually →'}
                      </button>
                    </div>
                  </div>
                )}

                {/* State 5: EXTRACTED - Multi-Transaction Review & Confirm */}
                {ocrState === 'extracted' && (
                  <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-0.5">
                    {/* Banner with Count & Instructions */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-700" />
                          {language === 'hi'
                            ? `AI द्वारा पहचाने गए लेनदेन (${ocrTransactions.length})`
                            : `AI Extracted Transactions (${ocrTransactions.length})`}
                        </span>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                          {language === 'hi' ? 'सत्यापन आवश्यक' : 'Review Needed'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800">
                        {language === 'hi'
                          ? 'कृपया प्रत्येक लेनदेन की राशि, पार्टी और श्रेणी की पुष्टि करें।'
                          : 'Please verify amounts, party names, and categories before adding to the ledger.'}
                      </p>
                    </div>

                    {/* Optional raw text toggle/display */}
                    {ocrRawText && (
                      <details className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <summary className="font-medium cursor-pointer text-slate-700">
                          {language === 'hi' ? 'पहचाना गया मूल टेक्स्ट देखें' : 'View Detected Raw Text'}
                        </summary>
                        <p className="mt-2 text-[11px] font-mono text-slate-600 whitespace-pre-wrap">{ocrRawText}</p>
                      </details>
                    )}

                    {/* List of Editable Transaction Cards */}
                    <div className="space-y-3">
                      {ocrTransactions.map((tx, idx) => {
                        const isCredit = tx.tx_type === 'credit';

                        return (
                          <div
                            key={tx.id}
                            className="bg-white border border-slate-200 rounded-xl p-3 space-y-3 shadow-2xs hover:border-slate-300 transition-colors"
                          >
                            {/* Card Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-800">
                                  {language === 'hi' ? `प्रविष्टि #${idx + 1}` : `Entry #${idx + 1}`}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                                  AI Suggestion
                                </span>
                              </div>
                              {ocrTransactions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOcrTx(tx.id)}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title={language === 'hi' ? 'यह प्रविष्टि हटाएं' : 'Remove this entry'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Credit / Debit Toggle */}
                            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
                              <button
                                type="button"
                                onClick={() => handleUpdateOcrTxField(tx.id, 'tx_type', 'credit')}
                                className={`py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  isCredit
                                    ? 'bg-emerald-700 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                <span>{language === 'hi' ? 'आवक (जमा)' : 'Inflow (Credit)'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateOcrTxField(tx.id, 'tx_type', 'debit')}
                                className={`py-1.5 px-2 rounded-md font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer ${
                                  !isCredit
                                    ? 'bg-rose-700 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <ArrowDownRight className="w-3.5 h-3.5" />
                                <span>{language === 'hi' ? 'खर्च (नामे)' : 'Outflow (Debit)'}</span>
                              </button>
                            </div>

                            {/* Amount and Category Grid */}
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  {language === 'hi' ? 'राशि (Amount)' : 'Amount (₹)'}
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                                    ₹
                                  </span>
                                  <input
                                    type="number"
                                    step="any"
                                    value={tx.amount}
                                    onChange={(e) => handleUpdateOcrTxField(tx.id, 'amount', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                  {language === 'hi' ? 'श्रेणी (Category)' : 'Category'}
                                </label>
                                <select
                                  value={tx.category}
                                  onChange={(e) => handleUpdateOcrTxField(tx.id, 'category', e.target.value as TransactionCategory)}
                                  className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-300 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-emerald-600"
                                >
                                  {TRANSACTION_CATEGORIES.map((cat) => (
                                    <option key={cat.value} value={cat.value}>
                                      {language === 'hi' ? cat.labelHi : cat.labelEn}
                                    </option>
                                  ))}
                                </select>
                                {getCategoryInfo(tx.category)?.helperEn && (
                                  <p className="text-[10px] text-slate-500 mt-0.5">
                                    {language === 'hi' ? getCategoryInfo(tx.category)?.helperHi : getCategoryInfo(tx.category)?.helperEn}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Date */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                {language === 'hi' ? 'तारीख (Date)' : 'Date'}
                              </label>
                              <input
                                type="date"
                                value={tx.date}
                                onChange={(e) => handleUpdateOcrTxField(tx.id, 'date', e.target.value)}
                                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                              />
                            </div>

                            {/* Party Name */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                {language === 'hi' ? 'ग्राहक / पार्टी' : 'Party / Customer'}
                              </label>
                              <input
                                type="text"
                                value={tx.party_name}
                                onChange={(e) => handleUpdateOcrTxField(tx.id, 'party_name', e.target.value)}
                                placeholder={language === 'hi' ? 'पार्टी का नाम' : 'Party name'}
                                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                              />
                            </div>

                            {/* Item Description */}
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                                {language === 'hi' ? 'सामान / कार्य विवरण' : 'Item / Description'}
                              </label>
                              <input
                                type="text"
                                value={tx.item}
                                onChange={(e) => handleUpdateOcrTxField(tx.id, 'item', e.target.value)}
                                placeholder={language === 'hi' ? 'सामान का विवरण' : 'Item description'}
                                className="w-full py-1.5 px-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                              />
                            </div>

                            {/* Card Error if any */}
                            {tx.error && (
                              <p className="text-[11px] text-rose-600 font-semibold">{tx.error}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Global OCR form error if validation fails */}
                    {formError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                        {formError}
                      </div>
                    )}

                    {/* Accounting Assurance Note */}
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                      <p className="text-[11px]">
                        {language === 'hi'
                          ? 'पुष्टि करने पर ये सभी लेनदेन बही-खाते में जुड़ेंगे और वित्तीय इंजन तुरंत टर्नओवर व बैंक साख का पुनर्गणन करेगा।'
                          : 'Upon confirmation, all entries will be saved to your ledger and the FastAPI engine will recalculate financial metrics.'}
                      </p>
                    </div>

                    {/* Confirmation Actions */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          setOcrState('idle');
                          setOcrImageFile(null);
                          setOcrImagePreview(null);
                          setOcrImageBase64(null);
                          setOcrTransactions([]);
                        }}
                        className={`min-h-[46px] py-2.5 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs transition-colors ${
                          isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:bg-slate-50 cursor-pointer'
                        }`}
                      >
                        {language === 'hi' ? '← नई तस्वीर लें' : '← Retake Photo'}
                      </button>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleConfirmAllOcrTransactions}
                        className={`min-h-[46px] py-2.5 px-3 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-600 ${
                          isSaving ? 'opacity-60 cursor-not-allowed bg-emerald-800' : 'hover:bg-emerald-800 cursor-pointer'
                        }`}
                      >
                        {isSaving
                          ? (language === 'hi' ? 'लेनदेन सहेजे जा रहे हैं...' : 'Saving transactions...')
                          : (language === 'hi'
                              ? `पुष्टि करें (${ocrTransactions.length}) ✓`
                              : `Confirm All (${ocrTransactions.length}) ✓`)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
