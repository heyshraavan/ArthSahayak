import React from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Database,
  Globe,
  Landmark,
  Mic,
  Moon,
  PenTool,
  Shield,
  ShieldCheck,
  Sun,
  UserCheck,
  WifiOff,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface LandingPageProps {
  language: 'en' | 'hi';
  onLanguageToggle: () => void;
  onOpenApp: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  language,
  onLanguageToggle,
  onOpenApp,
}) => {
  const { resolvedTheme, toggleTheme } = useTheme();

  const themeToggleLabel =
    resolvedTheme === 'dark'
      ? language === 'hi'
        ? 'लाइट मोड पर स्विच करें'
        : 'Switch to light mode'
      : language === 'hi'
      ? 'डार्क मोड पर स्विच करें'
      : 'Switch to dark mode';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-150">
      {/* 1. Minimal Public Utility Header */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors duration-150 shadow-2xs">
        <div className="w-full max-w-5xl lg:max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src="/logo.png"
              alt="ArthSahayak Emblem"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain rounded-md"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
                  Arth
                </span>
                <span className="text-base sm:text-lg font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  Sahayak
                </span>
                <span className="text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  वित्तीय सहायक
                </span>
              </div>
            </div>
          </div>

          {/* Right Tools: Language, Theme & Primary CTA */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px] min-w-[38px] transition-colors cursor-pointer"
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
              )}
            </button>

            {/* Language Selector */}
            <button
              type="button"
              onClick={onLanguageToggle}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[38px] transition-colors cursor-pointer"
              aria-label="Toggle language between English and Hindi"
              title={language === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}
            >
              <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span>{language === 'hi' ? 'ENG' : 'हिंदी'}</span>
            </button>

            {/* Header CTA */}
            <button
              type="button"
              onClick={onOpenApp}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[38px]"
            >
              <span>{language === 'hi' ? 'अर्थसहायक खोलें' : 'Open ArthSahayak'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Full-Bleed Atmospheric Hero Section */}
      <section className="relative overflow-hidden w-full bg-slate-50 dark:bg-slate-950 border-b border-slate-200/70 dark:border-slate-800/80 px-4 sm:px-6 py-10 sm:py-16">
        {/* Layer 1: Atmospheric Background Photograph (Subtle blur, recognizable artisan workshop texture) */}
        <div aria-hidden="true" className="hero-atmospheric-bg" />

        {/* Layer 2: Translucent Surface Overlay (Light slate wash in light mode, dark wash in dark mode) */}
        <div aria-hidden="true" className="hero-overlay-surface hero-overlay-gradient" />

        {/* Layer 3: Subtle Indigo Ambient Brand Glow behind Hero content */}
        <div aria-hidden="true" className="hero-brand-glow" />

        {/* Layer 4: Hero Content Layer (typography remains above all background layers with clear z-index) */}
        <div className="relative z-10 text-center space-y-5 max-w-3xl mx-auto">
          {/* ArthSahayak Logo with 1.2s subtle entrance animation */}
          <div className="flex justify-center">
            <div className="animate-logo-entrance p-2 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-sm inline-block backdrop-blur-xs">
              <img
                src="/logo.png"
                alt="ArthSahayak Brand Logo"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-xl"
              />
            </div>
          </div>

          {/* Public Service Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50/90 dark:bg-indigo-950/90 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-xs font-semibold backdrop-blur-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>
              {language === 'hi'
                ? 'ग्रामीण एवं सूक्ष्म-उद्यमियों हेतु डिजिटल बही-खाता व बैंक साख सहायक'
                : 'Digital Bahi-Khata & Bank Credit Appraisal for Micro-Entrepreneurs'}
            </span>
          </div>

          {/* Simple Direct Copy */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              {language === 'hi'
                ? 'आपके व्यवसाय का सरल वित्तीय सहायक।'
                : 'Your simple financial assistant for your business.'}
            </h1>
            <p className="text-base sm:text-xl font-bold text-indigo-700 dark:text-indigo-400">
              {language === 'hi'
                ? 'बोलें क्या आया, बोलें क्या गया — हिसाब साफ़ रखें।'
                : 'Say what came in. Say what went out. Keep track.'}
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl mx-auto">
            {language === 'hi'
              ? 'बढ़ई, लोहार, बुनकर, खुदरा दुकानदार और ग्रामीण कारीगरों के लिए तैयार — अपनी दैनिक रोकड़ आवक व खर्च को अपनी भाषा में सहजता से दर्ज करें, आरबीआई नायक समिति के मानकों के अनुसार कार्यशील पूंजी का आकलन करें और बैंक-तैयार 2-पृष्ठ का क्रेडिट डॉसियर डाउनलोड करें।'
              : 'Designed for rural artisans, carpenters, street vendors, and small enterprise owners. Record cash inflows and expenses naturally, assess working capital capacity compliant with RBI Nayak Committee formulas, and generate institutional bank appraisal dossiers.'}
          </p>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onOpenApp}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 min-h-[48px]"
            >
              <span>{language === 'hi' ? 'अर्थसहायक खोलें' : 'Open ArthSahayak'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
              {language === 'hi'
                ? 'निःशुल्क • डेटा आपके डिवाइस पर सुरक्षित • बिना इंटरनेट काम करता है'
                : 'Free utility • 100% on-device data • Operates completely offline'}
            </p>
          </div>
        </div>
      </section>

      {/* Main Landing Content Container (Core Actions, Demonstration, Trust, CTA) */}
      <main className="flex-1 w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12 sm:space-y-16">
        {/* 3. Three Core Actions (Speak, Scan Chit, Add Manually) */}
        <section className="space-y-4" aria-labelledby="core-actions-heading">
          <div className="text-center space-y-1">
            <h2 id="core-actions-heading" className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {language === 'hi' ? 'लेनदेन दर्ज करने के तीन आसान तरीके' : 'Three Simple Ways to Record Transactions'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {language === 'hi'
                ? 'जटिल बही-खाता सॉफ्टवेयर की आवश्यकता नहीं — केवल अपनी आदत के अनुसार दर्ज करें'
                : 'No complex accounting jargon — record cash transactions the way you work'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Action 1: Speak */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Mic className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? '1. बोलकर जोड़ें (Speak)' : '1. Speak Naturally'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {language === 'hi'
                    ? 'हिंदी या भारतीय अंग्रेजी में बोलें। AI आपकी बोली समझकर लेन-देन का विवरण तैयार करता है।'
                    : 'Record transactions naturally by speaking in Hindi or Indian English.'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 italic">
                {language === 'hi'
                  ? 'उदा: "राजू से ₹1,500 मिले"'
                  : 'e.g. "Received Rs 1500 from Raju for wooden chair"'}
              </div>
            </div>

            {/* Action 2: Scan Chit */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Camera className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? '2. पर्ची स्कैन करें (Scan Chit)' : '2. Scan Paper Chit'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {language === 'hi'
                    ? 'हाथ से लिखी पर्ची, रसीद, या बही-खाते के पन्ने की तस्वीर लें। विज़न AI हस्तलिखित पंक्तियों की पहचान करता है।'
                    : 'Read handwritten chits, paper receipts, and physical ledger sheets directly with your camera.'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 italic">
                {language === 'hi'
                  ? 'कच्ची रसीद और हस्तलिखित बिल से स्वचालित बहु-पंक्ति पहचान'
                  : 'Multi-line item extraction with mandatory human verification'}
              </div>
            </div>

            {/* Action 3: Add Manually */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center">
                <PenTool className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? '3. लिखकर दर्ज करें (Add Manually)' : '3. Simple Form Entry'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {language === 'hi'
                    ? 'सीधे और स्पष्ट फॉर्म में पार्टी का नाम, सामान और राशि लिखें। आवक या खर्च का चयन करें।'
                    : 'Clean, simple number-pad and form entry when audio or camera is not preferred.'}
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 italic">
                {language === 'hi'
                  ? 'पैसा आया (आवक) या पैसा गया (खर्च) — तुरंत बही-खाते में दर्ज'
                  : 'Fast manual entry with simple number-pad input'}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Concrete Hindi Demonstration: Before and After Confirmation */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5 transition-colors">
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{language === 'hi' ? 'वास्तविक कार्यप्रणाली' : 'Concrete Workflow Demonstration'}</span>
            </div>
            <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              {language === 'hi'
                ? 'पुष्टि से पहले और बाद का व्यावहारिक उदाहरण'
                : 'How Hindi Voice Entry Works: Before & After Confirmation'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'hi'
                ? 'देखें कि आपकी बोली से लेकर अंतिम बही-खाते तक डेटा किस प्रकार मानवीय नियंत्रण में रहता है:'
                : 'See how a Hindi voice entry is transcribed, structured by AI, and only saved after your explicit verification:'}
            </p>
          </div>

          {/* Step Progression Visual */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
            {/* Step 1: Voice Input */}
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-300">
                  <span className="flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    {language === 'hi' ? '1. बोली गई आवाज (Input)' : '1. Spoken Audio'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200">
                    Voice
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-indigo-100 dark:border-indigo-800/60">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    "राजू से ₹1,500 मिले"
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
                    ("Received ₹1,500 from Raju")
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                {language === 'hi'
                  ? 'व्यापारी अपनी स्वाभाविक भाषा में बोलता है।'
                  : 'Entrepreneur speaks naturally without formal accounting terms.'}
              </p>
            </div>

            {/* Step 2: AI Candidate + Human Verification */}
            <div className="p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700/80 bg-amber-50/50 dark:bg-amber-950/30 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-950 dark:text-amber-200">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    {language === 'hi' ? '2. मानवीय सत्यापन (Review)' : '2. Human Verification'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-200/80 dark:bg-amber-900 text-amber-900 dark:text-amber-100">
                    Mandatory
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{language === 'hi' ? 'पार्टी:' : 'Party:'}</span>
                    <strong className="text-slate-900 dark:text-slate-100">Raju (राजू)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{language === 'hi' ? 'प्रकार:' : 'Type:'}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {language === 'hi' ? 'पैसा आया (Money In)' : 'Money In (Credit)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">{language === 'hi' ? 'राशि:' : 'Amount:'}</span>
                    <strong className="text-slate-900 dark:text-slate-100">₹1,500</strong>
                  </div>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-amber-100/70 dark:bg-amber-900/40 text-[11px] font-semibold text-amber-900 dark:text-amber-200 text-center">
                {language === 'hi'
                  ? '✓ आपकी पुष्टि से पहले खाता में कुछ नहीं जुड़ता'
                  : '✓ Saved only after your explicit confirmation'}
              </div>
            </div>

            {/* Step 3: Confirmed Ledger Entry */}
            <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/30 flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  <span className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    {language === 'hi' ? '3. सुरक्षित बही-खाता (Ledger)' : '3. Confirmed Ledger'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-200/80 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100">
                    IndexedDB
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-sm text-slate-900 dark:text-slate-100">राजू (Raju)</strong>
                    <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">+₹1,500</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-700">
                    <span>{language === 'hi' ? 'पैसा आया (बिक्री)' : 'Money In (Sales)'}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ Confirmed</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-tight">
                {language === 'hi'
                  ? 'स्थानीय फोन में सुरक्षित, आरबीआई कार्यशील पूंजी गणना में शामिल।'
                  : 'Stored on-device, calculating Nayak Committee borrowing capacity.'}
              </p>
            </div>
          </div>
        </section>

        {/* 5. Fact-Supported Offline & Privacy Trust Section */}
        <section className="space-y-4" aria-labelledby="trust-heading">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              <span>{language === 'hi' ? 'सत्यापित गोपनीयता एवं सुरक्षा' : 'Architecture-Backed Trust & Privacy'}</span>
            </div>
            <h2 id="trust-heading" className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {language === 'hi'
                ? 'डेटा आपके नियंत्रण में — कोई बनावटी दावा नहीं'
                : 'Your Data Remains Under Your Control'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              {language === 'hi'
                ? 'अर्थसहायक की वास्तुकला सख्त स्थानीय-प्रथम (Local-First) सिद्धांतों पर निर्मित है:'
                : 'Built strictly on local-first engineering principles supported by our verified code:'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fact 1: On-device IndexedDB storage */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Database className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? 'स्थानीय डिवाइस पर सुरक्षित (IndexedDB)' : '100% On-Device Storage (IndexedDB)'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'hi'
                  ? 'आपके सभी लेनदेन सीधे आपके फोन या कंप्यूटर के स्थानीय ब्राउज़र स्टोरेज में रहते हैं। किसी केंद्रीय सर्वर पर बिना आपकी अनुमति के कोई डेटा सिंक नहीं होता।'
                  : 'Your ledger entries and calculations are stored directly in your browser’s native IndexedDB. Nothing is written to remote databases without explicit action.'}
              </p>
            </div>

            {/* Fact 2: Offline Operation & Queued Sync */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <WifiOff className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? 'पूर्णतः ऑफ़लाइन कार्य (Offline First)' : 'Works Fully Without Internet'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'hi'
                  ? 'इंटरनेट न होने पर भी आप लेन-देन लिख सकते हैं, आवाज रिकॉर्ड कर सकते हैं और पर्ची फोटो खींच सकते हैं। इंटरनेट आते ही ऑफ़लाइन कतार स्वतः प्रोसेस होती है।'
                  : 'You can record transactions, record voice memos, and snap chits when offline. Unprocessed media stays preserved on device and queues safely for sync.'}
              </p>
            </div>

            {/* Fact 3: Mandatory Human Confirmation */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <UserCheck className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? 'मानवीय सत्यापन अनिवार्य (Human-in-the-Loop)' : 'Mandatory Human Verification'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'hi'
                  ? 'AI कभी भी चुपचाप आपके बही-खाते में कुछ नहीं जोड़ता। हर आवाज या स्कैन प्रविष्टि की समीक्षा और पुष्टि करना केवल आपके हाथ में है।'
                  : 'AI never commits data to your ledger automatically. Every candidate transaction extracted from audio or camera OCR requires your explicit review and confirmation.'}
              </p>
            </div>

            {/* Fact 4: Privacy-Preserving Scheme Engine */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Landmark className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {language === 'hi' ? 'गोपनीय योजना पात्रता (RBI व सरकारी नियम)' : 'Deterministic Scheme Matching'}
                </h3>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {language === 'hi'
                  ? 'पीएम विश्वकर्मा, मुद्रा, स्टैंड-अप इंडिया और PMEGP की पात्रता गणितीय नियमों से आपके डिवाइस पर जांची जाती है। आपकी जाति या आय किसी बाहरी सर्वर पर नहीं भेजी जाती।'
                  : 'Eligibility for PM Vishwakarma, PMMY Mudra, PMEGP, and Stand-Up India is calculated purely via mathematical rules on your device without transmitting demographic details.'}
              </p>
            </div>
          </div>
        </section>

        {/* 6. Bottom Call to Action */}
        <section className="bg-slate-900 dark:bg-slate-900 text-white rounded-2xl p-6 sm:p-8 text-center space-y-4 border border-slate-800 shadow-sm transition-colors">
          <div className="space-y-1.5 max-w-xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {language === 'hi' ? 'आज ही अपना बही-खाता शुरू करें' : 'Start Your Business Ledger Today'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {language === 'hi'
                ? 'बिना किसी पंजीकरण शुल्क या जटिलता के — बस बोलें या लिखें और अपनी बैंक साख को मजबूत बनाएं।'
                : 'No registration fees or setup overhead. Speak or enter your daily cash receipts and build formal bank credibility.'}
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={onOpenApp}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-base shadow-md transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <span>{language === 'hi' ? 'अर्थसहायक खोलें' : 'Open ArthSahayak'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </main>

      {/* 7. Public Utility Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 px-4 sm:px-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1 transition-colors">
        <p className="font-semibold text-slate-700 dark:text-slate-300">
          ArthSahayak (अर्थसहायक) • Digital Bahi-Khata & Financial Structuring Assistant
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Compliant with RBI Nayak Committee working capital norms & published Ministry guidelines (MSME, MoSJE, MoHUA).
        </p>
      </footer>
    </div>
  );
};
