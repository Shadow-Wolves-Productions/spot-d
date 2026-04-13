import { useState } from "react";
import { Mail, MessageSquare, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { motion } from "framer-motion";

const FAQS = [
  {
    question: "What is CineConnect?",
    answer: "CineConnect is a premium directory for film and TV industry professionals. It connects cast, crew, and creative talent — from actors and directors to DPs, editors, and sound designers — in one searchable, verifiable platform.",
  },
  {
    question: "How do I create a profile?",
    answer: "Click 'Get Started' or 'Create Profile' from the navigation. You'll be guided through a 4-step form covering your contact info, professional experience, portfolio links, and credentials. Your CineScore updates automatically as you complete each section.",
  },
  {
    question: "How does the Recommend feature work?",
    answer: "On any profile page, you'll find a 'Recommend' button. Click it to vouch for that person by selecting one of our standardized recommendation types (e.g. 'Reliable on set', 'Great communicator'). Recommendations are public, tied to your account, and help build trust in the industry.",
  },
  {
    question: "How do I get verified?",
    answer: "There are four verification types: Email (via confirmation link), Phone (via SMS code), IMDb (by linking your IMDb profile), and Union (by submitting your union credentials for review). Each verified badge increases your CineScore and builds credibility.",
  },
  {
    question: "What is CineScore?",
    answer: "CineScore is a profile credibility metric scored from 0–100. It's calculated based on profile completeness, verifications, recommendations received, links added, and more. A higher score boosts your visibility in search results.",
  },
  {
    question: "What's the difference between Free and PRO?",
    answer: "Free members can create a profile, appear in search, and receive up to 3 contact reveals per month. PRO members get unlimited contact reveals, a PRO badge, boosted visibility, priority search placement, and access to exclusive features. See our Pricing page for full details.",
  },
  {
    question: "What is a Founding Member?",
    answer: "Founding Members are early adopters who joined CineConnect before our official launch. They receive a permanent 'Founder' badge on their profile and are locked into our lowest PRO pricing for life.",
  },
  {
    question: "How does contact reveal work?",
    answer: "To protect privacy, contact details (email, phone) are hidden by default. Clicking 'Reveal Contact' uses one of your monthly reveals. Free accounts get 3 reveals per month. PRO accounts get unlimited reveals.",
  },
  {
    question: "Can I appear in search without a PRO account?",
    answer: "Yes — all profiles appear in the directory. PRO profiles receive a badge and boosted placement, appearing higher in results and with more visual prominence.",
  },
  {
    question: "How do I report a fake or inappropriate profile?",
    answer: "Use the flag icon on any profile page to report it. Our team reviews all reports within 48 hours. Accounts found to be fake or in violation of our community guidelines are removed.",
  },
];

export default function ContactFAQ() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            Contact &amp; <span className="text-gold-gradient">FAQ</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Have a question or need help? Browse our FAQ or send us a message.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 mb-20">
          {/* Contact Form */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <div className="glass-effect rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold text-foreground">Get in Touch</h2>
                  <p className="text-muted-foreground text-sm">We'll respond within 24 hours</p>
                </div>
              </div>

              {submitted ? (
                <div className="text-center py-10">
                  <MessageSquare className="w-12 h-12 text-primary mx-auto mb-4" />
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">Message Sent!</h3>
                  <p className="text-muted-foreground text-sm">Thanks for reaching out. We'll be in touch soon.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Your Name</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors"
                      placeholder="jane@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Message</label>
                    <textarea
                      required
                      rows={5}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-muted-foreground/50 focus:outline-none focus:border-primary/50 transition-colors resize-none"
                      placeholder="How can we help you?"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    Send Message
                  </Button>
                </form>
              )}
            </div>
          </motion.div>

          {/* Quick info */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }} className="space-y-4">
            {[
              { label: "General Inquiries", value: "hello@cineconnect.io" },
              { label: "Support", value: "support@cineconnect.io" },
              { label: "Partnerships", value: "partners@cineconnect.io" },
            ].map((item) => (
              <div key={item.label} className="bg-card border border-border/60 rounded-xl px-6 py-5 flex items-center justify-between">
                <span className="text-muted-foreground text-sm">{item.label}</span>
                <span className="text-primary text-sm font-medium">{item.value}</span>
              </div>
            ))}
            <div className="bg-card border border-border/60 rounded-xl px-6 py-5">
              <p className="text-muted-foreground text-sm leading-relaxed">
                CineConnect is built by filmmakers, for filmmakers. We're a small team passionate about making industry connections easier and more transparent.
              </p>
            </div>
          </motion.div>
        </div>

        {/* FAQ */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h2 className="font-display text-3xl font-bold text-foreground text-center mb-10">
            Frequently Asked Questions
          </h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`item-${i}`}
                className="bg-card border border-border/60 rounded-xl px-6 overflow-hidden data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:text-primary hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </div>
  );
}