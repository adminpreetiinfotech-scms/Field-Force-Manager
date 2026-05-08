import { motion, useScroll, useTransform } from "framer-motion";
import { 
  MapPin, 
  UserCheck, 
  WifiOff, 
  Users, 
  Map, 
  FileSpreadsheet, 
  MessageSquare, 
  Building2, 
  CheckCircle2,
  PhoneCall,
  Mail,
  ArrowRight,
  Menu,
  X,
  Star,
  Quote,
  Activity,
  ClipboardList,
  ScanFace,
  BookOpen,
  BadgeCheck,
  ChevronRight,
  Navigation,
  Timer,
  Route,
  Satellite,
  Radio,
  Gauge,
  FileText,
  Download,
  BookMarked
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import heroImage from "../assets/hero-dashboard.png";
import mobileOfflineImage from "../assets/mobile-offline.png";
import selfieAttendanceImage from "../assets/selfie-attendance.png";

const WHATSAPP_NUMBER = "+919876543210";
const EMAIL_ADDRESS = "hello@scms.in";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  }
};

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-18">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl">
              <img src="/marketing-site/logo.png" alt="Preeti Infotech Logo" className="h-8 w-auto" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="flex items-baseline gap-2">
                <div className="text-xl font-extrabold text-primary tracking-wide">SCMS</div>
                <div className="text-xs text-gray-500 font-medium">(Skill Center Management System)</div>
              </div>
              <div className="text-xs text-accent font-bold tracking-widest uppercase">By Preeti Infotech</div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            <a href="#features" className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:border-primary hover:text-primary font-semibold text-sm transition-all hover:bg-primary/5" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:border-primary hover:text-primary font-semibold text-sm transition-all hover:bg-primary/5" data-testid="link-how-it-works">How it works</a>
            <a href="#pricing" className="px-4 py-2 rounded-full border border-gray-300 text-gray-700 hover:border-primary hover:text-primary font-semibold text-sm transition-all hover:bg-primary/5" data-testid="link-pricing">Pricing</a>
            <Button asChild className="bg-accent hover:bg-accent/90 text-white font-bold px-6 py-5 rounded-xl shadow-md transition-all hover:scale-105">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-nav-whatsapp">
                <PhoneCall className="w-4 h-4 mr-2" />
                Book Demo
              </a>
            </Button>
          </div>

          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="text-gray-700 p-2"
              data-testid="button-mobile-menu"
            >
              {isOpen ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-white border-b border-gray-200 px-4 pt-2 pb-6 space-y-1 shadow-lg"
        >
          <a href="#features" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-base font-semibold text-gray-700 hover:text-primary hover:bg-primary/5">Features</a>
          <a href="#how-it-works" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-base font-semibold text-gray-700 hover:text-primary hover:bg-primary/5">How it works</a>
          <a href="#pricing" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-base font-semibold text-gray-700 hover:text-primary hover:bg-primary/5">Pricing</a>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} onClick={() => setIsOpen(false)} className="flex items-center justify-center px-4 py-4 mt-2 rounded-xl text-base font-bold text-white bg-accent shadow-md">
            <PhoneCall className="w-4 h-4 mr-2" />
            Book Demo
          </a>
        </motion.div>
      )}
    </nav>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <section ref={ref} className="pt-28 pb-16 md:pt-40 md:pb-24 overflow-hidden relative min-h-[90dvh] flex items-center bg-gradient-to-br from-blue-50 via-white to-orange-50">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-[45vw] h-[45vw] bg-primary/8 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[50vw] h-[50vw] bg-accent/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] bg-secondary/6 rounded-full blur-[80px]" />
      </div>
      
      <motion.div style={{ y, opacity }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm font-bold bg-primary/10 border border-primary/20 text-primary mb-8"
          >
            <span className="flex w-2.5 h-2.5 rounded-full bg-secondary mr-3 animate-pulse"></span>
            #1 Platform for JSDMS, DDU-GKY & All State Skill Projects
          </motion.div>
          
          <motion.h1 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-gray-900 mb-6 leading-[1.1]"
          >
            <motion.span variants={itemVariants} className="block">Excel sheets se azaadi.</motion.span>
            <motion.span variants={itemVariants} className="block gradient-text-primary pb-2">Proxy attendance ab itihaas hai.</motion.span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-gray-600 mb-10 leading-relaxed max-w-3xl"
          >
            Stop chasing field staff and compiling manual reports. SCMS is the complete field operations platform that tracks GPS attendance, face-verifies staff, and works even without internet.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 w-full justify-center"
          >
            <Button size="lg" className="text-lg font-bold px-10 py-7 rounded-xl bg-accent text-white hover:bg-accent/90 shadow-lg transition-all hover:scale-105" asChild>
              <a href="/super-admin/register" data-testid="button-hero-register">
                Register Karein — Free <ArrowRight className="ml-2 w-5 h-5" />
              </a>
            </Button>
            <Button size="lg" className="text-lg font-bold px-10 py-7 rounded-xl bg-primary text-white hover:bg-primary/90 shadow-md transition-all hover:scale-105" asChild>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-hero-demo">
                Book Free Demo
              </a>
            </Button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 flex items-center justify-center text-sm font-medium text-gray-500 bg-white px-6 py-2.5 rounded-full border border-gray-200 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-secondary mr-2" />
            1 Month Free Trial · No Credit Card Required
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function Stats() {
  const stats = [
    { value: "500+", label: "Staff Tracked Daily" },
    { value: "50+", label: "Training Centers" },
    { value: "10L+", label: "Attendance Records" },
    { value: "99.9%", label: "Uptime" }
  ];

  return (
    <section className="py-10 bg-primary relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-white/20">
          {stats.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center px-6 py-4"
            >
              <div className="text-3xl md:text-4xl font-black text-white mb-1">{stat.value}</div>
              <div className="text-xs md:text-sm font-semibold text-blue-200 uppercase tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Candidate Section ────────────────────────────────────────────────────────

function CandidateSection() {
  const steps = [
    {
      icon: <ClipboardList className="w-7 h-7" />,
      step: "01",
      title: "Field mein digital form",
      desc: "Mobilizer candidate ke ghar jaata hai — mobile app par naam, pita ka naam, DOB, jati, address, Aadhaar, bank details sab directly bharta hai. Koi paper nahi.",
      color: "from-violet-500 to-purple-700",
      border: "border-violet-200",
      badge: "bg-violet-50 text-violet-700"
    },
    {
      icon: <ScanFace className="w-7 h-7" />,
      step: "02",
      title: "7 documents camera se capture",
      desc: "Passport photo, Aadhaar front+back, Jati praman patra, Shaikshanik praman patra, Bank passbook, Hastakshar — sab live camera se. Gallery upload band.",
      color: "from-blue-500 to-indigo-600",
      border: "border-blue-200",
      badge: "bg-blue-50 text-blue-700"
    },
    {
      icon: <BookOpen className="w-7 h-7" />,
      step: "03",
      title: "Batch & course allotment",
      desc: "Admin panel se candidate ko batch assign karo, course select karo. Attendance automatically us candidate ke naam se track hone lagti hai.",
      color: "from-emerald-500 to-teal-600",
      border: "border-emerald-200",
      badge: "bg-emerald-50 text-emerald-700"
    },
    {
      icon: <BadgeCheck className="w-7 h-7" />,
      step: "04",
      title: "PDF auto-generate & print",
      desc: "Registration form aur Swaghost Patra (स्व-घोषणा पत्र) — dono ek click mein auto-fill hokar PDF ban jaate hain. WhatsApp se share ya seedha print.",
      color: "from-orange-500 to-amber-600",
      border: "border-orange-200",
      badge: "bg-orange-50 text-orange-700"
    }
  ];

  const docs = [
    { label: "Passport Photo", sub: "Live camera only", color: "bg-violet-50 text-violet-700 border-violet-200" },
    { label: "Aadhaar Card", sub: "Front + Back", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { label: "Jati Praman Patra", sub: "Caste certificate", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { label: "Shaikshanik Praman Patra", sub: "Education certificate", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { label: "Bank Passbook", sub: "Account verification", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    { label: "Hastakshar", sub: "Candidate signature", color: "bg-pink-50 text-pink-700 border-pink-200" },
  ];

  return (
    <section id="candidate-registration" className="py-24 bg-white relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-violet-50 rounded-full blur-[80px] pointer-events-none opacity-60"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-violet-100 text-violet-700 border border-violet-200 mb-6 uppercase tracking-widest"
          >
            <Users className="w-3.5 h-3.5" /> Mukhya Feature
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight"
          >
            Candidate Registration —{" "}
            <span className="gradient-text-primary">field se directly digital.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-lg text-gray-600 leading-relaxed"
          >
            Koi printout nahi. Koi re-entry nahi. Mobilizer seedha field se candidate register karta hai —
            real time mein admin panel par dikh jaata hai.
          </motion.p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative group"
            >
              {i < steps.length - 1 && (
                <div className="hidden lg:flex absolute top-8 -right-3 z-20 text-gray-300">
                  <ChevronRight className="w-5 h-5" />
                </div>
              )}
              <div className={`bg-white rounded-2xl p-6 h-full border ${step.border} shadow-sm hover:shadow-md transition-all duration-300`}>
                <div className="flex items-start justify-between mb-5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${step.color} text-white shadow-sm`}>
                    {step.icon}
                  </div>
                  <span className={`text-xs font-black px-2 py-1 rounded-lg ${step.badge}`}>{step.step}</span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2 leading-tight">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Document grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <p className="text-center text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Documents collected during registration</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {docs.map((doc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`rounded-xl border px-3 py-3 text-center ${doc.color}`}
              >
                <div className="text-sm font-bold leading-tight mb-0.5">{doc.label}</div>
                <div className="text-xs opacity-70">{doc.sub}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* PDF cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid md:grid-cols-2 gap-5 mb-10"
        >
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-7">
            <div className="w-11 h-11 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 mb-4">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Registration Form PDF</h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Submit hote hi system automatically ek complete registration form PDF banata hai — JSDMS / DDU-GKY format mein, candidate ki photo aur saare details ke saath.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Auto-generated", "WhatsApp share", "Direct print", "Audit-ready"].map((tag) => (
                <span key={tag} className="text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-3 py-1">{tag}</span>
              ))}
            </div>
          </div>

          <div className="bg-violet-50 border border-violet-200 rounded-2xl p-7">
            <div className="w-11 h-11 rounded-xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 mb-4">
              <BadgeCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-black text-gray-900 mb-2">Swaghost Patra — <span className="text-violet-700">स्व-घोषणा पत्र</span></h3>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              Candidate ka self-declaration form ek click mein auto-fill hokar PDF ban jaata hai — naam, Aadhaar, jati, course, BPL status sab pre-filled. Print karke sign karwao.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Auto-fill from data", "Hindi + English", "Signature area", "Print & share"].map((tag) => (
                <span key={tag} className="text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200 rounded-full px-3 py-1">{tag}</span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Stats callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-primary rounded-2xl p-8 md:p-12"
        >
          <div className="grid md:grid-cols-3 gap-8 text-center md:text-left">
            {[
              { number: "5 min", label: "ek candidate register karne mein", sub: "Pehle 2 din lagte the" },
              { number: "Zero", label: "duplicate registrations", sub: "Aadhaar-based deduplication" },
              { number: "2 PDFs", label: "auto-generate hoti hain", sub: "Registration Form + Swaghost Patra" }
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }}>
                <div className="text-4xl md:text-5xl font-black text-white mb-1">{stat.number}</div>
                <div className="text-blue-100 font-semibold text-base mb-0.5">{stat.label}</div>
                <div className="text-blue-300 text-sm">{stat.sub}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────

const features = [
  {
    icon: <MapPin className="w-8 h-8" />,
    title: "GPS Attendance",
    description: "Live location-based check-in. Staff cannot mark attendance from outside the designated area.",
    color: "from-blue-500 to-indigo-600"
  },
  {
    icon: <UserCheck className="w-8 h-8" />,
    title: "AI Face Verification",
    description: "Live selfie match on every punch. If the face doesn't match, attendance is rejected instantly.",
    color: "from-violet-500 to-purple-600"
  },
  {
    icon: <FileSpreadsheet className="w-8 h-8" />,
    title: "Excel & PDF Reports",
    description: "One-click attendance exports, salary reports, and candidate PDFs — no manual compilation ever.",
    color: "from-emerald-500 to-teal-600"
  },
  {
    icon: <WifiOff className="w-8 h-8" />,
    title: "Offline-First App",
    description: "Works without internet. All data queues locally and syncs automatically when network returns.",
    color: "from-orange-500 to-amber-600"
  },
  {
    icon: <MessageSquare className="w-8 h-8" />,
    title: "SMS & Push Alerts",
    description: "Instant notifications to staff and management — leave approval, notices, training reminders.",
    color: "from-pink-500 to-rose-600"
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Candidate Management",
    description: "End-to-end candidate lifecycle — registration, document collection, audit trail, PDF generation.",
    color: "from-cyan-500 to-blue-600"
  },
  {
    icon: <Map className="w-8 h-8" />,
    title: "Live Staff Map",
    description: "See where every mobilizer is, in real time, on an interactive map — from the admin dashboard.",
    color: "from-teal-500 to-emerald-600"
  },
  {
    icon: <Building2 className="w-8 h-8" />,
    title: "Multi-Center",
    description: "Ek dashboard, sab centers. Manage your entire state operation centrally.",
    color: "from-indigo-500 to-purple-600"
  }
];

function Features() {
  return (
    <section id="features" className="py-24 bg-gray-50 relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-5 uppercase tracking-widest"
          >
            Platform Features
          </motion.div>
          <motion.h2 
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-black text-gray-900 mb-4"
          >
            Features that <span className="gradient-text-primary">command respect.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-600"
          >
            Built specifically for Indian skill development field realities. No fluff — just tools that work.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: index * 0.07 }}
              className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden"
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color} opacity-70 group-hover:opacity-100 transition-opacity`}></div>
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-5 bg-gradient-to-br ${feature.color} text-white shadow-sm`}>
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-500 leading-relaxed text-sm">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── DeepDive1: Attendance Verification ───────────────────────────────────────

function DeepDive1() {
  return (
    <section className="py-24 bg-white relative overflow-hidden" id="how-it-works">
      <div className="absolute top-1/2 right-0 w-72 h-72 bg-primary/5 rounded-full blur-[80px] pointer-events-none translate-x-1/2 -translate-y-1/2"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="order-2 lg:order-1 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-violet-400/20 rounded-[2.5rem] blur-2xl opacity-50"></div>
            <img 
              src={selfieAttendanceImage} 
              alt="Face Verification App" 
              className="relative z-10 w-full max-w-sm mx-auto rounded-[2rem] border-4 border-gray-200 shadow-2xl"
            />
            <motion.div 
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity }}
              className="absolute top-16 -right-4 bg-white border border-gray-200 shadow-xl p-4 rounded-2xl hidden md:flex items-center gap-3 z-20"
            >
              <div className="w-10 h-10 rounded-full bg-secondary/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-secondary" />
              </div>
              <div>
                <div className="text-gray-900 font-bold text-sm">Face Match: 99.8%</div>
                <div className="text-xs text-secondary font-semibold">Verified Live</div>
              </div>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="order-1 lg:order-2"
          >
            <div className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-6 uppercase tracking-widest">
              Foolproof Verification
            </div>
            <h2 className="text-3xl md:text-5xl font-black mb-6 leading-tight text-gray-900">
              Attendance mein koi <span className="gradient-text-primary">jugaad</span> nahi.
            </h2>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Staff can't mark attendance from their beds. They must be at the designated mobilization area or training center — verified by GPS and face match.
            </p>
            
            <ul className="space-y-4">
              {[
                { title: "Geo-fenced check-ins", desc: "Cannot punch in if outside the assigned 100-meter radius." },
                { title: "AI Face Match", desc: "Verifies the person checking in is actually your staff member." },
                { title: "Time-stamped photos", desc: "Every punch-in/out captures a live photo — gallery upload not allowed." }
              ].map((item, i) => (
                <motion.li 
                  key={i} 
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex bg-gray-50 border border-gray-200 p-5 rounded-xl"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mr-4">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── DeepDive2: Offline First ─────────────────────────────────────────────────

function DeepDive2() {
  return (
    <section className="py-24 bg-gray-50 relative overflow-hidden border-t border-gray-100">
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-accent/8 rounded-full blur-[80px] pointer-events-none -translate-x-1/3 translate-y-1/3"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold bg-accent/10 text-accent border border-accent/20 mb-6 uppercase tracking-widest">
              Rural Ready Technology
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-6 leading-tight">
              Network nahi hai? <br />
              <span className="gradient-text-accent">Koi baat nahi.</span>
            </h2>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              We know mobilization happens in remote villages. Our app is built entirely Offline-First.
            </p>
            
            <div className="grid gap-4">
              {[
                { title: "Local Storage", desc: "Data saves directly to phone when offline." },
                { title: "Background Sync", desc: "Auto-syncs the moment 4G/WiFi connects." },
                { title: "Zero Data Loss", desc: "Data is safe even if the app is closed mid-entry." }
              ].map((item, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center bg-white border border-gray-200 p-4 rounded-xl shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent mr-4 flex-shrink-0">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-gray-900">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, type: "spring" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-orange-300/20 rounded-[2.5rem] blur-2xl opacity-60"></div>
            <img 
              src={mobileOfflineImage} 
              alt="Offline App Sync" 
              className="relative z-10 w-full max-w-sm mx-auto rounded-[2rem] shadow-2xl border-4 border-gray-200"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Tracking Section ─────────────────────────────────────────────────────────

function TrackingSection() {
  const features = [
    {
      icon: <Navigation className="w-5 h-5" />,
      title: "GPS Check-in / Check-out",
      desc: "Staff jab field mein check-in karta hai, uski exact GPS coordinates save hoti hain — latitude, longitude, timestamp ke saath.",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconBg: "bg-emerald-100 text-emerald-700"
    },
    {
      icon: <Timer className="w-5 h-5" />,
      title: "Live Shift Timer",
      desc: "Check-in hote hi live timer shuru ho jaata hai. Admin panel par dikhhta hai kaun kitne ghante field mein hai — real time mein.",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      iconBg: "bg-blue-100 text-blue-700"
    },
    {
      icon: <Gauge className="w-5 h-5" />,
      title: "KM Tracking",
      desc: "Staff ne din mein kitna safar kiya — kilometers mein track hota hai. Petrol reimbursement ke liye accurate data.",
      color: "bg-violet-50 text-violet-700 border-violet-200",
      iconBg: "bg-violet-100 text-violet-700"
    },
    {
      icon: <Map className="w-5 h-5" />,
      title: "Live Staff Map (Admin)",
      desc: "Admin panel mein ek live interactive map — har staff member ki current location ek hi screen par. Kaun kahan hai ek nazar mein.",
      color: "bg-amber-50 text-amber-700 border-amber-200",
      iconBg: "bg-amber-100 text-amber-700"
    },
    {
      icon: <Route className="w-5 h-5" />,
      title: "Location History",
      desc: "Har staff member ka poora din ka location trail — kab kahan gaya, kitni der ruka. Audit ke waqt solid digital proof.",
      color: "bg-pink-50 text-pink-700 border-pink-200",
      iconBg: "bg-pink-100 text-pink-700"
    },
    {
      icon: <Radio className="w-5 h-5" />,
      title: "Offline Sync",
      desc: "Internet nahi hai toh bhi tracking band nahi hoti. Data locally save hota hai aur jab network milta hai, sync ho jaata hai.",
      color: "bg-cyan-50 text-cyan-700 border-cyan-200",
      iconBg: "bg-cyan-100 text-cyan-700"
    },
  ];

  return (
    <section id="tracking" className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-50 rounded-full blur-[80px] pointer-events-none opacity-80"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 mb-5 uppercase tracking-widest"
          >
            <Satellite className="w-3.5 h-3.5" /> Real-Time Field Tracking
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight"
          >
            Har staff member —{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">live map par.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-lg text-gray-600 leading-relaxed"
          >
            "Kahan ho?" ka zamaana gaya. Admin ek screen par dekh sakta hai kaun kahan hai,
            kab se field mein hai, aur kitna safar kiya.
          </motion.p>
        </div>

        {/* Map mockup + features */}
        <div className="grid lg:grid-cols-2 gap-12 items-start mb-12">

          {/* Map card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-lg">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-gray-800 text-sm font-bold">Live Staff Map</span>
                </div>
                <span className="text-gray-400 text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-600 px-2.5 py-1 rounded-full">12 staff online</span>
              </div>
              {/* Map area */}
              <div className="relative h-64 bg-[#e8f4f0] overflow-hidden">
                <div className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: "linear-gradient(#b2d8cc 1px, transparent 1px), linear-gradient(90deg, #b2d8cc 1px, transparent 1px)", backgroundSize: "36px 36px" }}
                ></div>
                <div className="absolute top-1/2 left-0 right-0 h-px bg-teal-300/60"></div>
                <div className="absolute top-0 bottom-0 left-1/3 w-px bg-teal-300/50"></div>
                <div className="absolute top-0 bottom-0 left-2/3 w-px bg-teal-300/40"></div>
                <div className="absolute top-1/3 left-0 right-0 h-px bg-teal-300/40"></div>

                {[
                  { top: "18%", left: "15%", name: "Raju S.", km: "4.2 km", active: true },
                  { top: "52%", left: "40%", name: "Priya M.", km: "2.8 km", active: true },
                  { top: "28%", left: "66%", name: "Amit K.", km: "6.1 km", active: true },
                  { top: "68%", left: "72%", name: "Sunita D.", km: "1.5 km", active: false },
                  { top: "62%", left: "22%", name: "Vijay R.", km: "3.9 km", active: true },
                ].map((pin, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12, type: "spring" }}
                    className="absolute group"
                    style={{ top: pin.top, left: pin.left }}
                  >
                    <div className="relative cursor-pointer">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 ${pin.active ? "bg-emerald-500 border-white" : "bg-gray-400 border-white"}`}>
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      {pin.active && <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-ping"></div>}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs whitespace-nowrap shadow-lg pointer-events-none">
                        <div className="font-bold text-gray-800">{pin.name}</div>
                        <div className="text-emerald-600 font-medium">{pin.km} today</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="px-4 py-3 flex gap-2.5 overflow-x-auto bg-white">
                {["Raju S. • 4.2km", "Priya M. • 2.8km", "Amit K. • 6.1km"].map((s, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-gray-600 font-medium">{s}</span>
                  </div>
                ))}
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity }}
              className="absolute -bottom-4 -right-4 bg-white border border-gray-200 rounded-2xl p-3.5 shadow-lg hidden md:flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <div className="text-gray-900 text-sm font-bold">Check-in Recorded</div>
                <div className="text-emerald-600 text-xs font-medium">28.6139° N, 77.2090° E</div>
              </div>
            </motion.div>
          </motion.div>

          {/* Feature list */}
          <div className="grid sm:grid-cols-2 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`rounded-xl border p-5 ${f.color}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${f.iconBg}`}>
                  {f.icon}
                </div>
                <h4 className="font-bold text-gray-900 text-sm mb-1.5 leading-tight">{f.title}</h4>
                <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-emerald-700 rounded-2xl p-8 md:p-10"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { number: "GPS", label: "accurate check-in", sub: "Lat + Long saved" },
              { number: "Live", label: "interactive staff map", sub: "Leaflet.js powered" },
              { number: "KM", label: "daily travel tracked", sub: "Reimbursement ready" },
              { number: "Offline", label: "sync on reconnect", sub: "Field mein bhi kaam" },
            ].map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="text-3xl font-black text-white mb-1">{s.number}</div>
                <div className="text-emerald-100 font-semibold text-sm mb-0.5">{s.label}</div>
                <div className="text-emerald-300 text-xs">{s.sub}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const testimonials = [
  {
    quote: "Pehle hum manually Excel mein attendance bharte the. Ab sab phone se hota hai aur report seedha download ho jaati hai.",
    author: "Ramesh Gupta",
    role: "Center Director",
    org: "Jeevan Kaushal Kendra, Lucknow"
  },
  {
    quote: "Candidate registration mein fraud band ho gaya. Aadhaar verification aur live photo ne sab kuch change kar diya.",
    author: "Sunita Sharma",
    role: "State Coordinator",
    org: "DDU-GKY MP Operations"
  },
  {
    quote: "Internet nahi hone ke bawajood mobilizers kaam karte hain. Data baad mein automatically sync ho jaata hai. Kamaal ki cheez hai.",
    author: "Vikram Singh",
    role: "Field Manager",
    org: "Kushal Bharat Society, Patna"
  }
];

function Testimonials() {
  return (
    <section className="py-24 bg-gray-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-accent/10 text-accent border border-accent/20 mb-5 uppercase tracking-widest"
          >
            <Star className="w-3.5 h-3.5 fill-current" /> Customer Stories
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-3">Trusted by <span className="gradient-text-primary">Directors</span></h2>
          <p className="text-lg text-gray-600">Hear from people managing hundreds of field staff daily.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className="bg-white p-7 rounded-2xl border border-gray-200 shadow-sm relative"
            >
              <Quote className="w-10 h-10 text-primary/10 absolute top-5 right-5" />
              <div className="flex text-accent mb-5">
                {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 fill-current" />)}
              </div>
              <p className="text-gray-700 font-medium mb-6 leading-relaxed text-sm italic">"{t.quote}"</p>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-base mr-3 shadow-sm">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{t.author}</div>
                  <div className="text-xs text-primary font-semibold">{t.role}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{t.org}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white relative border-t border-gray-100">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-primary/5 blur-[80px] pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-primary/10 text-primary border border-primary/20 mb-5 uppercase tracking-widest"
          >
            Pricing
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4">
            Simple pricing. <span className="gradient-text-primary">Massive ROI.</span>
          </h2>
          <p className="text-lg text-gray-600">
            Stop losing money on fake attendance. Every plan includes a 1-month free trial.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-center">
          {/* Basic */}
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white rounded-2xl p-8 flex flex-col border border-gray-200 shadow-sm"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-1">Basic</h3>
            <div className="flex items-baseline mb-5">
              <span className="text-4xl font-black text-gray-900">₹1,999</span>
              <span className="text-gray-400 ml-1.5 text-sm">/mo</span>
            </div>
            <p className="text-gray-500 text-sm mb-6 pb-6 border-b border-gray-100">Perfect for single centers starting out.</p>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center text-gray-700 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mr-3 flex-shrink-0" /> Up to 10 staff</li>
              <li className="flex items-center text-gray-700 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mr-3 flex-shrink-0" /> GPS Attendance</li>
              <li className="flex items-center text-gray-700 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mr-3 flex-shrink-0" /> Basic Reporting</li>
            </ul>
            <Button className="w-full py-5 font-bold rounded-xl bg-primary text-white hover:bg-primary/90" asChild>
              <a href="/super-admin/register" data-testid="button-pricing-basic">Start Free Trial →</a>
            </Button>
          </motion.div>

          {/* Standard */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08, type: "spring" }}
            className="bg-primary rounded-2xl p-8 flex flex-col relative border border-primary shadow-xl transform md:-translate-y-3 z-10"
          >
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-white px-5 py-1.5 rounded-full text-xs font-black shadow-md uppercase tracking-widest">
              Most Popular
            </div>
            <h3 className="text-2xl font-black text-white mb-1">Standard</h3>
            <div className="flex items-baseline mb-5">
              <span className="text-5xl font-black text-white">₹4,999</span>
              <span className="text-blue-200 ml-1.5 text-sm">/mo</span>
            </div>
            <p className="text-blue-200 text-sm mb-6 pb-6 border-b border-white/20">For growing regional operations.</p>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center text-white text-sm font-medium"><CheckCircle2 className="w-4 h-4 text-secondary mr-3 flex-shrink-0" /> Up to 50 staff</li>
              <li className="flex items-center text-white text-sm font-medium"><CheckCircle2 className="w-4 h-4 text-secondary mr-3 flex-shrink-0" /> AI Face Verification</li>
              <li className="flex items-center text-white text-sm font-medium"><CheckCircle2 className="w-4 h-4 text-secondary mr-3 flex-shrink-0" /> Offline Mobile App</li>
              <li className="flex items-center text-white text-sm font-medium"><CheckCircle2 className="w-4 h-4 text-secondary mr-3 flex-shrink-0" /> Custom Excel Exports</li>
            </ul>
            <Button className="w-full py-6 text-base font-black rounded-xl bg-white text-primary hover:bg-gray-100 shadow-md hover:scale-[1.02] transition-transform" asChild>
              <a href="/super-admin/register" data-testid="button-pricing-standard">Start Free Trial →</a>
            </Button>
          </motion.div>

          {/* Premium */}
          <motion.div 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-2xl p-8 flex flex-col border border-gray-200 shadow-sm"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-1">Premium</h3>
            <div className="flex items-baseline mb-5">
              <span className="text-4xl font-black text-gray-900">₹9,999</span>
              <span className="text-gray-400 ml-1.5 text-sm">/mo</span>
            </div>
            <p className="text-gray-500 text-sm mb-6 pb-6 border-b border-gray-100">For large-scale state deployments.</p>
            <ul className="space-y-3 mb-8 flex-1">
              <li className="flex items-center text-gray-700 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mr-3 flex-shrink-0" /> Unlimited staff</li>
              <li className="flex items-center text-gray-700 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mr-3 flex-shrink-0" /> Multi-Center Support</li>
              <li className="flex items-center text-gray-700 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mr-3 flex-shrink-0" /> Priority Support</li>
              <li className="flex items-center text-gray-700 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mr-3 flex-shrink-0" /> Dedicated Account Mgr</li>
            </ul>
            <Button className="w-full py-5 font-bold rounded-xl bg-primary text-white hover:bg-primary/90" asChild>
              <a href="/super-admin/register" data-testid="button-pricing-premium">Start Free Trial →</a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <section className="py-24 relative overflow-hidden bg-primary">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-800 to-indigo-900"></div>
      <motion.div 
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/10 rounded-full blur-[80px] pointer-events-none"
      />
      <motion.div 
        animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 7, repeat: Infinity, delay: 1 }}
        className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-[100px] pointer-events-none"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight"
        >
          Ready to professionalize your operations?
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-lg text-blue-200 mb-10 font-medium"
        >
          Join dozens of training centers who have moved away from WhatsApp groups and Excel sheets.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row justify-center items-center gap-4"
        >
          <Button size="lg" className="bg-accent hover:bg-accent/90 text-white text-lg font-black px-10 py-7 rounded-xl w-full sm:w-auto shadow-lg hover:scale-105 transition-all" asChild>
            <a href="/super-admin/register" data-testid="button-cta-register">
              <ArrowRight className="w-6 h-6 mr-3" />
              Register Karein — Free
            </a>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20 text-lg font-bold px-10 py-7 rounded-xl w-full sm:w-auto transition-all hover:scale-105" asChild>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-cta-whatsapp">
              <PhoneCall className="w-5 h-5 mr-3" /> Chat on WhatsApp
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="bg-primary py-12 border-t border-white/10 text-center relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-4 mb-6">
          <div className="bg-white/10 p-3 rounded-xl">
            <img src="/marketing-site/logo.png" alt="Preeti Infotech" className="h-10 w-auto brightness-0 invert" />
          </div>
          <div>
            <div className="text-xl font-black text-white tracking-wide">SCMS</div>
            <div className="text-xs font-bold text-accent tracking-widest uppercase">By Preeti Infotech</div>
          </div>
        </div>
        <p className="text-blue-300 text-sm mb-6 max-w-md mx-auto">
          Empowering DDU-GKY & PMKVY training centers with technology built for Indian ground realities.
        </p>
        <div className="flex justify-center gap-6 text-sm font-medium text-blue-300 mb-6">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          <a href={`mailto:${EMAIL_ADDRESS}`} className="hover:text-white transition-colors">Contact</a>
        </div>
        <div className="text-blue-400 text-xs">
          © {new Date().getFullYear()} Preeti Infotech. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

// ─── User Guides ──────────────────────────────────────────────────────────────

function UserGuides() {
  const guides = [
    {
      icon: <BookMarked className="w-7 h-7" />,
      title: "Company Registration Guide",
      desc: "Naya company account kaise banayein, subscription kaise activate karein, aur pehla admin kaise setup karein — step-by-step guide.",
      badge: "For Owners",
      badgeColor: "bg-violet-100 text-violet-700 border-violet-200",
      cardBorder: "border-violet-200",
      iconBg: "bg-violet-100 text-violet-700",
      pdfUrl: "/marketing-site/guides/company-registration-guide.pdf"
    },
    {
      icon: <FileSpreadsheet className="w-7 h-7" />,
      title: "Admin User Guide",
      desc: "Staff management, attendance reports download, leave approval, notices broadcast, live map — admin panel ka poora walkthrough.",
      badge: "For Admins",
      badgeColor: "bg-blue-100 text-blue-700 border-blue-200",
      cardBorder: "border-blue-200",
      iconBg: "bg-blue-100 text-blue-700",
      pdfUrl: "/marketing-site/guides/admin-user-guide.pdf"
    },
    {
      icon: <Building2 className="w-7 h-7" />,
      title: "Center Staff User Guide",
      desc: "MPIN login, check-in/check-out, leave apply, notice dekhna — center ke andar kaam karne wale staff ke liye complete guide.",
      badge: "For Center Staff",
      badgeColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
      cardBorder: "border-emerald-200",
      iconBg: "bg-emerald-100 text-emerald-700",
      pdfUrl: "/marketing-site/guides/center-staff-user-guide.pdf"
    },
    {
      icon: <MapPin className="w-7 h-7" />,
      title: "Field Staff User Guide",
      desc: "GPS check-in, selfie verification, candidate registration, document capture, KM tracking — mobilizers ke liye field app guide.",
      badge: "For Field Staff",
      badgeColor: "bg-orange-100 text-orange-700 border-orange-200",
      cardBorder: "border-orange-200",
      iconBg: "bg-orange-100 text-orange-700",
      pdfUrl: "/marketing-site/guides/field-staff-user-guide.pdf"
    }
  ];

  return (
    <section id="user-guides" className="py-24 bg-primary relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-900 to-indigo-900"></div>
      <motion.div animate={{ scale: [1,1.2,1], opacity:[0.15,0.3,0.15] }} transition={{ duration:8, repeat:Infinity }} className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
      <motion.div animate={{ scale: [1,1.3,1], opacity:[0.1,0.2,0.1] }} transition={{ duration:10, repeat:Infinity, delay:2 }} className="absolute bottom-0 left-0 w-[35vw] h-[35vw] bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold bg-white/10 text-white border border-white/20 mb-5 uppercase tracking-widest backdrop-blur-sm"
          >
            <FileText className="w-3.5 h-3.5" /> Free User Guides — PDF
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black text-white mb-4"
          >
            Har role ke liye <span className="text-accent">alag guide.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="text-lg text-blue-200"
          >
            Owner se lekar field mobilizer tak — sabke liye dedicated PDF guide bilkul free mein.
            Ek click mein download karo.
          </motion.p>
        </div>

        {/* Guide cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {guides.map((guide, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-6 flex flex-col hover:bg-white/15 hover:-translate-y-1 transition-all duration-300 group"
            >
              {/* Top row */}
              <div className="flex items-start justify-between mb-5">
                <div className={`w-13 h-13 w-12 h-12 rounded-xl flex items-center justify-center ${guide.iconBg} shadow-lg`}>
                  {guide.icon}
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${guide.badgeColor}`}>
                  {guide.badge}
                </span>
              </div>

              {/* PDF visual */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4 flex items-center gap-3">
                <div className="w-9 h-11 bg-red-500/80 rounded-md flex items-center justify-center flex-shrink-0 shadow">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white text-xs font-bold leading-tight">{guide.title.split(' ').slice(0,2).join(' ')}</div>
                  <div className="text-blue-300 text-xs">PDF • Free Download</div>
                </div>
              </div>

              <h3 className="text-base font-bold text-white mb-2 leading-tight">{guide.title}</h3>
              <p className="text-blue-200 text-sm leading-relaxed mb-6 flex-1">{guide.desc}</p>

              <a
                href={guide.pdfUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-white text-primary font-black text-sm transition-all hover:scale-[1.03] shadow-lg group-hover:bg-accent group-hover:text-white"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            </motion.div>
          ))}
        </div>

        {/* Bottom support bar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white/10 border border-white/20 backdrop-blur-sm rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent flex-shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white text-base">Aur help chahiye?</div>
              <div className="text-blue-200 text-sm">Hamare team se seedha WhatsApp par baat karo — live support available hai.</div>
            </div>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I need help with SCMS platform.")}`}
            target="_blank"
            rel="noreferrer"
            className="flex-shrink-0 flex items-center gap-2 bg-accent text-white font-bold px-6 py-3 rounded-xl hover:bg-accent/90 transition-all hover:scale-105 shadow-lg text-sm"
          >
            <PhoneCall className="w-4 h-4" />
            WhatsApp Support
          </a>
        </motion.div>

      </div>
    </section>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <Navbar />
      <Hero />
      <Stats />
      <CandidateSection />
      <Features />
      <DeepDive1 />
      <DeepDive2 />
      <TrackingSection />
      <Testimonials />
      <UserGuides />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
