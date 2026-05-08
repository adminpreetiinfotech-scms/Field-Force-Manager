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
  Activity
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

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm">
              <img src="/marketing-site/logo.png" alt="Preeti Infotech Logo" className="h-8 w-auto brightness-0 invert" />
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="text-xl font-extrabold text-white tracking-wide">SCMS</div>
              <div className="text-xs text-primary font-bold tracking-widest uppercase">By Preeti Infotech</div>
            </div>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white font-semibold transition-colors" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white font-semibold transition-colors" data-testid="link-how-it-works">How it works</a>
            <a href="#pricing" className="text-gray-300 hover:text-white font-semibold transition-colors" data-testid="link-pricing">Pricing</a>
            <Button asChild className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-6 rounded-xl shadow-[0_0_20px_hsla(var(--primary)/0.4)] transition-all hover:scale-105">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-nav-whatsapp">
                <PhoneCall className="w-5 h-5 mr-2" />
                Book Demo
              </a>
            </Button>
          </div>

          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="text-white p-2"
              data-testid="button-mobile-menu"
            >
              {isOpen ? <X className="h-8 w-8" /> : <Menu className="h-8 w-8" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden bg-card border-b border-white/10 px-4 pt-2 pb-6 space-y-2 shadow-2xl"
        >
          <a href="#features" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-lg font-bold text-gray-300 hover:text-white hover:bg-white/5">Features</a>
          <a href="#how-it-works" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-lg font-bold text-gray-300 hover:text-white hover:bg-white/5">How it works</a>
          <a href="#pricing" onClick={() => setIsOpen(false)} className="block px-4 py-3 rounded-xl text-lg font-bold text-gray-300 hover:text-white hover:bg-white/5">Pricing</a>
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} onClick={() => setIsOpen(false)} className="flex items-center justify-center px-4 py-4 mt-4 rounded-xl text-lg font-bold text-white bg-primary shadow-lg">
            <PhoneCall className="w-5 h-5 mr-2" />
            Book Demo
          </a>
        </motion.div>
      )}
    </nav>
  );
}

function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0]);

  return (
    <section ref={ref} className="pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden relative min-h-[100dvh] flex items-center">
      {/* Abstract Animated Background Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-primary/20 rounded-full blur-[120px]"
        />
        <motion.div 
          animate={{ 
            scale: [1, 1.5, 1],
            opacity: [0.2, 0.4, 0.2],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-secondary/20 rounded-full blur-[120px]"
        />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
      </div>
      
      <motion.div style={{ y, opacity }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
        <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="inline-flex items-center rounded-full px-4 py-2 text-sm md:text-base font-bold bg-white/5 border border-white/10 text-gray-300 mb-8 backdrop-blur-md"
          >
            <span className="flex w-2.5 h-2.5 rounded-full bg-secondary mr-3 animate-pulse"></span>
            #1 Platform for DDU-GKY & PMKVY Centers
          </motion.div>
          
          <motion.h1 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tight text-white mb-8 leading-[1.1]"
          >
            <motion.span variants={itemVariants} className="block">Excel sheets se azaadi.</motion.span>
            <motion.span variants={itemVariants} className="block gradient-text-primary text-glow-primary pb-2">Proxy attendance ab itihaas hai.</motion.span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl md:text-2xl text-gray-400 mb-12 leading-relaxed max-w-3xl"
          >
            Stop chasing field staff and compiling manual reports. SCMS is the complete field operations platform that tracks GPS attendance, face-verifies staff, and works even without internet.
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-6 w-full justify-center"
          >
            <Button size="lg" className="text-xl font-bold px-10 py-8 rounded-2xl bg-white text-background hover:bg-gray-200 transition-all hover:scale-105" asChild>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-hero-demo">
                See it in Action <ArrowRight className="ml-3 w-6 h-6" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="text-xl font-bold px-10 py-8 rounded-2xl border-white/20 bg-white/5 text-white hover:bg-white/10 backdrop-blur-md transition-all" asChild>
              <a href="#how-it-works" data-testid="button-hero-works">
                How it works
              </a>
            </Button>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 flex items-center justify-center text-sm font-medium text-gray-400 bg-white/5 px-6 py-2 rounded-full border border-white/5"
          >
            <CheckCircle2 className="w-5 h-5 text-secondary mr-2" />
            1 Month Free Trial · No Credit Card Required
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}

function Stats() {
  const stats = [
    { value: "500+", label: "Staff Tracked Daily" },
    { value: "50+", label: "Training Centers" },
    { value: "10L+", label: "Attendance Records" },
    { value: "99.9%", label: "Uptime" }
  ];

  return (
    <section className="py-12 border-y border-white/5 bg-white/5 backdrop-blur-lg relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/10">
          {stats.map((stat, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center px-4"
            >
              <div className="text-3xl md:text-5xl font-black text-white mb-2 tracking-tight">{stat.value}</div>
              <div className="text-sm md:text-base font-bold text-gray-400 uppercase tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: <MapPin className="w-8 h-8" />,
    title: "GPS & Selfie Attendance",
    description: "Kahan hai staff, real time mein pata chale. Location-tagged check-ins with live photos.",
    color: "from-blue-500 to-indigo-600"
  },
  {
    icon: <UserCheck className="w-8 h-8" />,
    title: "Face Match AI",
    description: "Proxy ka koi scope nahi. System verifies every selfie against the reference photo.",
    color: "from-emerald-400 to-teal-600"
  },
  {
    icon: <WifiOff className="w-8 h-8" />,
    title: "Offline-First",
    description: "2G mein bhi kaam kare. Staff can mark attendance without internet, syncs later.",
    color: "from-orange-400 to-red-500"
  },
  {
    icon: <Users className="w-8 h-8" />,
    title: "Candidate Management",
    description: "Registration se enrollment tak, sab track. Digital forms and document capture.",
    color: "from-purple-500 to-pink-600"
  },
  {
    icon: <Map className="w-8 h-8" />,
    title: "Live Staff Map",
    description: "Poori team ek map pe. See exactly where your mobilizers are right now.",
    color: "from-cyan-400 to-blue-500"
  },
  {
    icon: <FileSpreadsheet className="w-8 h-8" />,
    title: "1-Click Govt Reports",
    description: "Government format mein, ek click mein. Export perfect attendance sheets.",
    color: "from-yellow-400 to-orange-500"
  },
  {
    icon: <MessageSquare className="w-8 h-8" />,
    title: "SMS Broadcast",
    description: "Ek message, poori team tak. Send push notifications and notices instantly.",
    color: "from-rose-400 to-red-600"
  },
  {
    icon: <Building2 className="w-8 h-8" />,
    title: "Multi-Center",
    description: "Ek dashboard, sab centers. Manage your entire state operation centrally.",
    color: "from-indigo-400 to-purple-600"
  }
];

function Features() {
  return (
    <section id="features" className="py-32 relative z-10 bg-background">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight"
          >
            Features that <span className="gradient-text-primary text-glow-primary">command respect.</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 font-medium"
          >
            Built specifically for the ground realities of Indian skill development projects. 
            No fluff, just tools that work in the field.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card rounded-3xl p-8 hover:scale-[1.02] transition-transform duration-300 group relative overflow-hidden"
            >
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${feature.color} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${feature.color} text-white shadow-lg`}>
                {feature.icon}
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
              <p className="text-gray-400 leading-relaxed font-medium">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeepDive1() {
  return (
    <section className="py-32 bg-black relative overflow-hidden" id="how-it-works">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, type: "spring" }}
            className="order-2 lg:order-1 relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-purple-600 rounded-[3rem] blur-2xl opacity-40"></div>
            <img 
              src={selfieAttendanceImage} 
              alt="Face Verification App" 
              className="relative z-10 w-full max-w-md mx-auto rounded-[2.5rem] border-8 border-gray-900 shadow-2xl"
            />
            {/* Floating indicator */}
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute top-20 -right-10 bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl shadow-xl hidden md:flex items-center gap-4 z-20"
            >
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <div className="text-white font-bold">Face Match: 99.8%</div>
                <div className="text-sm text-secondary font-medium">Verified Live</div>
              </div>
            </motion.div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="order-1 lg:order-2"
          >
            <div className="inline-flex items-center rounded-full px-4 py-2 text-sm font-bold bg-primary/20 text-primary border border-primary/30 mb-8 uppercase tracking-widest">
              Foolproof Verification
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-8 leading-tight text-white">
              Attendance mein koi <span className="gradient-text-primary text-glow-primary">jugaad</span> nahi.
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 mb-10 leading-relaxed">
              Staff can't mark attendance from their beds. They must be at the designated mobilization area or training center.
            </p>
            
            <ul className="space-y-8">
              {[
                { title: "Geo-fenced check-ins", desc: "Cannot punch in if outside the assigned 100-meter radius." },
                { title: "AI Face Match", desc: "Verifies the person checking in is actually your staff member." },
                { title: "Time-stamped photos", desc: "Every punch-in/out captures a live photo that cannot be uploaded from gallery." }
              ].map((item, i) => (
                <motion.li 
                  key={i} 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="flex bg-white/5 border border-white/5 p-6 rounded-2xl"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mr-6">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-white mb-2">{item.title}</h4>
                    <p className="text-gray-400 leading-relaxed font-medium">{item.desc}</p>
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

function DeepDive2() {
  return (
    <section className="py-32 bg-background relative overflow-hidden border-t border-white/5">
      <div className="absolute bottom-0 right-0 w-[60vw] h-[60vw] bg-accent/10 rounded-full blur-[120px] pointer-events-none translate-x-1/3 translate-y-1/3"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <div className="inline-flex items-center rounded-full px-4 py-2 text-sm font-bold bg-accent/20 text-accent border border-accent/30 mb-8 uppercase tracking-widest">
              Rural Ready Technology
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-white mb-8 leading-tight">
              Network nahi hai? <br />
              <span className="gradient-text-accent text-glow-secondary">Koi baat nahi.</span>
            </h2>
            <p className="text-xl md:text-2xl text-gray-400 mb-10 leading-relaxed">
              We know mobilization happens in remote villages. Our app is built entirely Offline-First.
            </p>
            
            <div className="grid gap-6">
              {[
                { title: "Local Storage", desc: "Data saves directly to phone when offline." },
                { title: "Background Sync", desc: "Auto-syncs the moment 4G/WiFi connects." },
                { title: "Zero Data Loss", desc: "Data is safe even if the app is closed." }
              ].map((item, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center glass-card p-4 rounded-2xl"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent mr-4">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white">{item.title}</h4>
                    <p className="text-sm text-gray-400">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
            whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, type: "spring" }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-accent to-red-500 rounded-[3rem] blur-2xl opacity-40"></div>
            <img 
              src={mobileOfflineImage} 
              alt="Offline App Sync" 
              className="relative z-10 w-full max-w-md mx-auto rounded-[2.5rem] shadow-2xl border-8 border-gray-900"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const testimonials = [
    {
      quote: "Pehle har mahine attendance sheet verify karne mein 3 din lagte the. Ab ek click mein DDU-GKY format mein report ready milti hai. Superb app!",
      author: "Rajesh Kumar",
      role: "State Project Head",
      org: "NavJyoti Skills Foundation"
    },
    {
      quote: "The facial recognition feature is a game changer. Proxy attendance is completely eliminated. Real-time tracking gives us total control over our 40+ mobilizers.",
      author: "Sneha Patel",
      role: "Operations Director",
      org: "Pragati Skill Center"
    },
    {
      quote: "Bina internet ke bhi gaon mein attendance lag jaati hai, yeh best feature hai. Our field staff loves it because they don't have to hunt for network anymore.",
      author: "Vikram Singh",
      role: "Center Coordinator",
      org: "Yuva Vikas Samiti"
    }
  ];

  return (
    <section className="py-32 bg-black relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Trusted by <span className="text-primary text-glow-primary">Directors</span></h2>
          <p className="text-xl text-gray-400">Hear from people managing hundreds of field staff daily.</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((t, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.2 }}
              className="glass-card p-8 rounded-3xl relative"
            >
              <Quote className="w-12 h-12 text-primary/20 absolute top-6 right-6" />
              <div className="flex text-accent mb-6">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-5 h-5 fill-current" />)}
              </div>
              <p className="text-lg text-gray-300 font-medium mb-8 leading-relaxed italic">"{t.quote}"</p>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl mr-4 shadow-lg">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-white">{t.author}</div>
                  <div className="text-sm text-primary font-medium">{t.role}</div>
                  <div className="text-xs text-gray-500 mt-1">{t.org}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-32 bg-background relative border-t border-white/5">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/10 blur-[120px] pointer-events-none"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
            Simple pricing. <span className="gradient-text-primary">Massive ROI.</span>
          </h2>
          <p className="text-xl text-gray-400 font-medium">
            Stop losing money on fake attendance. Every plan includes a 1-month free trial.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
          {/* Basic */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card rounded-3xl p-10 flex flex-col border border-white/10"
          >
            <h3 className="text-2xl font-bold text-white mb-2">Basic</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-5xl font-black text-white">₹2,000</span>
              <span className="text-gray-500 ml-2 font-medium">/mo</span>
            </div>
            <p className="text-gray-400 mb-8 pb-8 border-b border-white/10 font-medium">Perfect for single centers starting out.</p>
            <ul className="space-y-5 mb-10 flex-1">
              <li className="flex items-center text-gray-300 font-medium"><CheckCircle2 className="w-6 h-6 text-primary mr-4" /> Up to 10 staff</li>
              <li className="flex items-center text-gray-300 font-medium"><CheckCircle2 className="w-6 h-6 text-primary mr-4" /> GPS Attendance</li>
              <li className="flex items-center text-gray-300 font-medium"><CheckCircle2 className="w-6 h-6 text-primary mr-4" /> Basic Reporting</li>
            </ul>
            <Button variant="outline" className="w-full py-6 text-lg font-bold rounded-xl border-white/20 hover:bg-white/10" asChild>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-pricing-basic">Start Free Trial</a>
            </Button>
          </motion.div>

          {/* Standard (Most Popular) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1, type: "spring" }}
            className="bg-gradient-to-b from-primary/20 to-primary/5 rounded-[2.5rem] p-10 flex flex-col relative border border-primary/50 box-glow-primary transform md:-translate-y-4 shadow-2xl z-10"
          >
            <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-accent to-red-500 text-white px-6 py-2 rounded-full text-sm font-black shadow-xl uppercase tracking-widest box-glow-accent">
              Most Popular
            </div>
            <h3 className="text-3xl font-black text-white mb-2">Standard</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-6xl font-black text-white">₹5,000</span>
              <span className="text-primary-foreground/70 ml-2 font-medium">/mo</span>
            </div>
            <p className="text-gray-300 mb-8 pb-8 border-b border-white/10 font-medium">For growing regional operations.</p>
            <ul className="space-y-5 mb-10 flex-1">
              <li className="flex items-center text-white font-bold"><CheckCircle2 className="w-6 h-6 text-secondary mr-4" /> Up to 50 staff</li>
              <li className="flex items-center text-white font-bold"><CheckCircle2 className="w-6 h-6 text-secondary mr-4" /> AI Face Verification</li>
              <li className="flex items-center text-white font-bold"><CheckCircle2 className="w-6 h-6 text-secondary mr-4" /> Offline Mobile App</li>
              <li className="flex items-center text-white font-bold"><CheckCircle2 className="w-6 h-6 text-secondary mr-4" /> Custom Excel Exports</li>
            </ul>
            <Button className="w-full py-8 text-xl font-black rounded-xl bg-white text-primary hover:bg-gray-200 shadow-xl hover:scale-[1.02] transition-transform" asChild>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-pricing-standard">Start Free Trial</a>
            </Button>
          </motion.div>

          {/* Premium */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-3xl p-10 flex flex-col border border-white/10"
          >
            <h3 className="text-2xl font-bold text-white mb-2">Premium</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-5xl font-black text-white">₹10,000</span>
              <span className="text-gray-500 ml-2 font-medium">/mo</span>
            </div>
            <p className="text-gray-400 mb-8 pb-8 border-b border-white/10 font-medium">For large-scale state deployments.</p>
            <ul className="space-y-5 mb-10 flex-1">
              <li className="flex items-center text-gray-300 font-medium"><CheckCircle2 className="w-6 h-6 text-primary mr-4" /> Unlimited staff</li>
              <li className="flex items-center text-gray-300 font-medium"><CheckCircle2 className="w-6 h-6 text-primary mr-4" /> Multi-Center Support</li>
              <li className="flex items-center text-gray-300 font-medium"><CheckCircle2 className="w-6 h-6 text-primary mr-4" /> Priority Support</li>
              <li className="flex items-center text-gray-300 font-medium"><CheckCircle2 className="w-6 h-6 text-primary mr-4" /> Dedicated Account Mgr</li>
            </ul>
            <Button variant="outline" className="w-full py-6 text-lg font-bold rounded-xl border-white/20 hover:bg-white/10" asChild>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-pricing-premium">Start Free Trial</a>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 relative overflow-hidden bg-primary border-y border-primary-foreground/10">
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-indigo-600 to-purple-800"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      
      {/* Animated glowing orbs */}
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 4, repeat: Infinity }}
        className="absolute top-1/4 left-1/4 w-64 h-64 bg-white/20 rounded-full blur-[80px]"
      />
      <motion.div 
        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 6, repeat: Infinity, delay: 1 }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/30 rounded-full blur-[100px]"
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tight leading-tight"
        >
          Ready to professionalize your operations?
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-2xl text-primary-foreground/80 mb-12 font-medium"
        >
          Join dozens of training centers who have moved away from WhatsApp groups and Excel sheets.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row justify-center items-center gap-6"
        >
          <Button size="lg" className="bg-secondary hover:bg-secondary/90 text-white text-2xl font-black px-12 py-10 rounded-2xl w-full sm:w-auto shadow-[0_0_40px_hsla(var(--secondary)/0.6)] hover:scale-105 transition-all group" asChild>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-cta-whatsapp">
              <PhoneCall className="w-8 h-8 mr-3 animate-bounce" /> 
              Chat on WhatsApp
            </a>
          </Button>
          <Button size="lg" variant="outline" className="border-white/30 bg-white/5 text-white hover:bg-white/10 backdrop-blur-md text-xl font-bold px-10 py-10 rounded-2xl w-full sm:w-auto transition-all hover:scale-105" asChild>
            <a href={`mailto:${EMAIL_ADDRESS}`} data-testid="button-cta-email">
              <Mail className="w-6 h-6 mr-3" /> Email Us
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-black py-16 border-t border-white/10 text-center relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-6 mb-8">
          <div className="bg-white/10 p-4 rounded-2xl">
            <img src="/marketing-site/logo.png" alt="Preeti Infotech" className="h-12 w-auto brightness-0 invert" />
          </div>
          <div>
            <div className="text-2xl font-black text-white tracking-wide">SCMS</div>
            <div className="text-sm font-bold text-primary tracking-widest uppercase">By Preeti Infotech</div>
          </div>
        </div>
        <p className="text-gray-500 font-medium max-w-md mx-auto mb-8">
          The ultimate field operations management platform for government skill training centers in India.
        </p>
        <div className="text-gray-600 text-sm font-medium pt-8 border-t border-white/10">
          &copy; {new Date().getFullYear()} Preeti Infotech. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden selection:bg-primary/30 selection:text-white">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <DeepDive1 />
      <DeepDive2 />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </div>
  );
}
