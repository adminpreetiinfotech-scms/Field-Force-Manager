import { motion } from "framer-motion";
import { Link } from "wouter";
import { 
  MapPin, 
  UserCheck, 
  WifiOff, 
  Users, 
  Map, 
  FileSpreadsheet, 
  MessageSquare, 
  Building2, 
  CalendarOff, 
  CreditCard,
  CheckCircle2,
  PhoneCall,
  Mail,
  ArrowRight,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
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
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] }
  }
};

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-3">
            <img src="/marketing-site/logo.png" alt="Preeti Infotech Logo" className="h-10 w-auto" />
            <div className="leading-tight">
              <div className="text-lg font-bold text-gray-900">Preeti Infotech</div>
              <div className="text-xs text-primary font-medium tracking-wide">SCMS Platform</div>
            </div>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 hover:text-primary font-medium" data-testid="link-features">Features</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-primary font-medium" data-testid="link-how-it-works">How it works</a>
            <a href="#pricing" className="text-gray-600 hover:text-primary font-medium" data-testid="link-pricing">Pricing</a>
            <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/5">
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-nav-whatsapp">
                <PhoneCall className="w-4 h-4 mr-2" />
                Book Demo
              </a>
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setIsOpen(!isOpen)} 
              className="text-gray-600 hover:text-primary"
              data-testid="button-mobile-menu"
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden bg-white border-b border-gray-200 px-4 pt-2 pb-4 space-y-1">
          <a href="#features" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50">Features</a>
          <a href="#how-it-works" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50">How it works</a>
          <a href="#pricing" onClick={() => setIsOpen(false)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-primary hover:bg-gray-50">Pricing</a>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  return (
    <section className="pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden relative">
      <div className="absolute top-0 right-0 -z-10 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <motion.div 
            initial="hidden"
            animate="visible"
            variants={containerVariants}
            className="max-w-2xl"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary/10 text-primary mb-6">
              <span className="flex w-2 h-2 rounded-full bg-primary mr-2"></span>
              Built for DDU-GKY & PMKVY Centers
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
              Excel sheets se azaadi.<br />
              <span className="text-primary">Proxy attendance band.</span>
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-lg md:text-xl text-gray-600 mb-8 leading-relaxed">
              Stop chasing field staff and compiling manual reports. SCMS is the complete field operations platform that tracks GPS attendance, face-verifies staff, and works even without internet.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-lg px-8 py-6 rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all" asChild>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-hero-demo">
                  Get a Free Demo <ArrowRight className="ml-2 w-5 h-5" />
                </a>
              </Button>
              <div className="flex items-center text-sm text-gray-500 font-medium px-4">
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                1 Month Free Trial
              </div>
            </motion.div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-2xl transform rotate-3 scale-[1.02] -z-10"></div>
            <img 
              src={heroImage} 
              alt="SCMS Dashboard Preview" 
              className="rounded-2xl shadow-2xl border border-gray-200/50 w-full object-cover"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function TrustLogos() {
  return (
    <section className="py-10 border-y border-gray-100 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-sm font-semibold text-gray-500 tracking-wide uppercase mb-6">Trusted by training centers executing</p>
        <div className="flex justify-center items-center gap-8 md:gap-16 flex-wrap opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          <div className="text-xl md:text-2xl font-bold font-serif text-gray-800">DDU-GKY</div>
          <div className="text-xl md:text-2xl font-bold font-serif text-gray-800">PMKVY</div>
          <div className="text-xl md:text-2xl font-bold font-serif text-gray-800">State Skill Missions</div>
          <div className="text-xl md:text-2xl font-bold font-serif text-gray-800">CSR Initiatives</div>
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: <MapPin className="w-6 h-6" />,
    title: "GPS & Selfie Attendance",
    description: "Location-tagged check-ins with real-time photos. Proxy attendance impossible."
  },
  {
    icon: <UserCheck className="w-6 h-6" />,
    title: "Face Match AI",
    description: "System verifies every selfie against the staff's reference photo automatically."
  },
  {
    icon: <WifiOff className="w-6 h-6" />,
    title: "Offline-First Mobile App",
    description: "Staff in rural areas can mark attendance without internet. Syncs when back online."
  },
  {
    icon: <Users className="w-6 h-6" />,
    title: "Candidate Management",
    description: "Register candidates, capture documents, and track mobilization targets."
  },
  {
    icon: <Map className="w-6 h-6" />,
    title: "Real-Time Field Map",
    description: "See exactly where your mobilizers and trainers are on a live dashboard map."
  },
  {
    icon: <FileSpreadsheet className="w-6 h-6" />,
    title: "1-Click Govt Reports",
    description: "Export perfect attendance and KM reports in Excel formats required by the Govt."
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Instant Broadcasts",
    description: "Send push notifications and urgent notices to all center staff instantly."
  },
  {
    icon: <Building2 className="w-6 h-6" />,
    title: "Multi-Center Dashboard",
    description: "Manage 5 or 50 training centers from a single master super-admin account."
  }
];

function Features() {
  return (
    <section id="features" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything your training center needs. <span className="text-primary">Nothing it doesn't.</span>
          </h2>
          <p className="text-lg text-gray-600">
            Designed specifically for the ground realities of Indian skill development projects.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow hover:border-primary/20 group"
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary mb-5 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeepDive1() {
  return (
    <section className="py-24 bg-gray-900 text-white overflow-hidden" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1 relative"
          >
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"></div>
            <img 
              src={selfieAttendanceImage} 
              alt="Face Verification App" 
              className="relative z-10 w-full max-w-sm mx-auto rounded-[2.5rem] shadow-2xl border-4 border-gray-800"
            />
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary/20 text-primary-400 mb-6">
              Foolproof Verification
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Attendance mein koi <span className="text-primary">jugaad</span> nahi.
            </h2>
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              Staff can't mark attendance from their beds. They must be at the designated mobilization area or training center.
            </p>
            
            <ul className="space-y-6">
              {[
                { title: "Geo-fenced check-ins", desc: "Cannot punch in if outside the assigned 100-meter radius." },
                { title: "AI Face Match", desc: "Verifies the person checking in is actually your staff member." },
                { title: "Time-stamped photos", desc: "Every punch-in/out captures a live photo that cannot be uploaded from gallery." }
              ].map((item, i) => (
                <li key={i} className="flex">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary mt-1 mr-4">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold">{item.title}</h4>
                    <p className="text-gray-400">{item.desc}</p>
                  </div>
                </li>
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
    <section className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-orange-100 text-orange-700 mb-6">
              Rural Ready
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Network nahi hai? <br />
              <span className="text-orange-600">Koi baat nahi.</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              We know mobilization happens in remote villages. Our app is built Offline-First.
            </p>
            
            <ul className="space-y-6">
              {[
                { title: "Local Storage", desc: "Attendance and candidate data saves directly to the phone when offline." },
                { title: "Background Sync", desc: "The moment staff gets 4G/WiFi, the app silently syncs all pending data to the server." },
                { title: "No Data Loss", desc: "Even if the phone battery dies, offline data remains secure and waiting to sync." }
              ].map((item, i) => (
                <li key={i} className="flex">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mt-1 mr-4">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-gray-900">{item.title}</h4>
                    <p className="text-gray-600">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-orange-200 blur-3xl rounded-full opacity-50"></div>
            <img 
              src={mobileOfflineImage} 
              alt="Offline App Sync" 
              className="relative z-10 w-full max-w-sm mx-auto rounded-[2.5rem] shadow-2xl border-4 border-white"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple, transparent pricing.
          </h2>
          <p className="text-lg text-gray-600">
            Pay for the scale of your operations. Every plan includes a 1-month free trial.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Basic */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">Basic</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-4xl font-extrabold text-gray-900">₹2,000</span>
              <span className="text-gray-500 ml-2">/month</span>
            </div>
            <p className="text-gray-600 mb-6 pb-6 border-b border-gray-100">Perfect for single centers starting out.</p>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center text-gray-700"><CheckCircle2 className="w-5 h-5 text-primary mr-3" /> Up to 10 staff</li>
              <li className="flex items-center text-gray-700"><CheckCircle2 className="w-5 h-5 text-primary mr-3" /> GPS Attendance</li>
              <li className="flex items-center text-gray-700"><CheckCircle2 className="w-5 h-5 text-primary mr-3" /> Basic Reporting</li>
            </ul>
            <Button variant="outline" className="w-full" asChild>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-pricing-basic">Start Free Trial</a>
            </Button>
          </motion.div>

          {/* Standard */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-primary border border-primary rounded-3xl p-8 shadow-xl flex flex-col relative transform md:-translate-y-4"
          >
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-orange-400 to-orange-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-sm uppercase tracking-wide">
              Most Popular
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Standard</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-4xl font-extrabold text-white">₹5,000</span>
              <span className="text-primary-100 ml-2">/month</span>
            </div>
            <p className="text-primary-100 mb-6 pb-6 border-b border-primary-400/50">For growing regional operations.</p>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center text-white"><CheckCircle2 className="w-5 h-5 text-white mr-3" /> Up to 50 staff</li>
              <li className="flex items-center text-white"><CheckCircle2 className="w-5 h-5 text-white mr-3" /> AI Face Verification</li>
              <li className="flex items-center text-white"><CheckCircle2 className="w-5 h-5 text-white mr-3" /> Offline Mobile App</li>
              <li className="flex items-center text-white"><CheckCircle2 className="w-5 h-5 text-white mr-3" /> Custom Excel Exports</li>
            </ul>
            <Button className="w-full bg-white text-primary hover:bg-gray-50" asChild>
              <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-pricing-standard">Start Free Trial</a>
            </Button>
          </motion.div>

          {/* Premium */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-white border border-gray-200 rounded-3xl p-8 shadow-sm flex flex-col"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-2">Premium</h3>
            <div className="flex items-baseline mb-6">
              <span className="text-4xl font-extrabold text-gray-900">₹10,000</span>
              <span className="text-gray-500 ml-2">/month</span>
            </div>
            <p className="text-gray-600 mb-6 pb-6 border-b border-gray-100">For large-scale state deployments.</p>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center text-gray-700"><CheckCircle2 className="w-5 h-5 text-primary mr-3" /> Unlimited staff</li>
              <li className="flex items-center text-gray-700"><CheckCircle2 className="w-5 h-5 text-primary mr-3" /> Multi-Center Support</li>
              <li className="flex items-center text-gray-700"><CheckCircle2 className="w-5 h-5 text-primary mr-3" /> Priority Support</li>
              <li className="flex items-center text-gray-700"><CheckCircle2 className="w-5 h-5 text-primary mr-3" /> Dedicated Account Mgr</li>
            </ul>
            <Button variant="outline" className="w-full" asChild>
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
    <section className="py-20 relative overflow-hidden">
      <div className="absolute inset-0 bg-primary"></div>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
          Ready to professionalize your operations?
        </h2>
        <p className="text-xl text-primary-100 mb-10 max-w-2xl mx-auto">
          Join dozens of training centers who have moved away from WhatsApp groups and Excel sheets.
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          <Button size="lg" className="bg-white text-primary hover:bg-gray-100 text-lg px-8 py-6 w-full sm:w-auto" asChild>
            <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer" data-testid="button-cta-whatsapp">
              <PhoneCall className="w-5 h-5 mr-2" /> Chat on WhatsApp
            </a>
          </Button>
          <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10 text-lg px-8 py-6 w-full sm:w-auto" asChild>
            <a href={`mailto:${EMAIL_ADDRESS}`} data-testid="button-cta-email">
              <Mail className="w-5 h-5 mr-2" /> Email Us
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 py-12 border-t border-gray-800 text-center">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <img src="/marketing-site/logo.png" alt="Preeti Infotech" className="h-10 w-auto brightness-0 invert" />
          <div className="text-left">
            <div className="text-xl font-bold text-white">Preeti Infotech</div>
            <div className="text-xs text-primary-foreground/60 font-medium tracking-wide">SCMS Platform</div>
          </div>
        </div>
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          Skill Center Management System.<br />
          Built for the ground realities of India.
        </p>
        <div className="flex justify-center space-x-6 text-gray-400 mb-8">
          <a href={`https://wa.me/${WHATSAPP_NUMBER}`} className="hover:text-white" data-testid="footer-link-whatsapp">
            WhatsApp
          </a>
          <a href={`mailto:${EMAIL_ADDRESS}`} className="hover:text-white" data-testid="footer-link-email">
            Support
          </a>
        </div>
        <p className="text-sm text-gray-500">
          © {new Date().getFullYear()} Preeti Infotech. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Hero />
        <TrustLogos />
        <Features />
        <DeepDive1 />
        <DeepDive2 />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
