import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

const SUGGESTIONS = [
  { id: "bio", label: "Improve Bio", description: "Craft a compelling bio" },
  { id: "skills", label: "Suggest Skills", description: "Based on your role & credits" },
  { id: "credits", label: "Suggest Credits", description: "AU industry credits for your role" },
  { id: "dayrate", label: "Day Rate Guide", description: "Market rate for your experience" },
];

export default function AIAssistant({ form, onApply }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeType, setActiveType] = useState(null);

  const run = async (type) => {
    setLoading(true);
    setActiveType(type);
    setResult(null);

    let prompt = "";

    if (type === "bio") {
      prompt = `You are a high-end talent agency writer. Write a compelling, concise 3-sentence professional bio for a ${form.primary_role || "film professional"} based in ${form.city || "Australia"} with ${form.years_of_experience || 0} years of experience and ${form.experience_level || "mid"} level.
Credits include: ${form.credits?.map(c => c.project_title).join(", ") || "various projects"}.
Skills: ${form.special_skills?.join(", ") || "not specified"}.
Union: ${form.union_status?.join(", ") || "not specified"}.
Write in third person, editorial and professional. No fluff. Return only the bio text.`;
    } else if (type === "skills") {
      prompt = `List 8 specific professional skills for a ${form.primary_role || "film professional"} in the Australian film industry with ${form.experience_level || "mid"} experience. Consider their credits: ${form.credits?.map(c => c.project_title).join(", ") || "general projects"}. Return a JSON object: {"skills": ["skill1", "skill2", ...]}`;
    } else if (type === "credits") {
      prompt = `Suggest 5 realistic Australian film industry credits for a ${form.primary_role || "film professional"} at ${form.experience_level || "mid"} level. Include a mix of features, shorts, and TV. Return JSON: {"credits": [{"project_title": "...", "role_on_project": "...", "year": 2022}]}`;
    } else if (type === "dayrate") {
      prompt = `What is the standard Australian day rate for a ${form.primary_role || "film professional"} with ${form.years_of_experience || 0} years experience at ${form.experience_level || "mid"} level? Consider MEAA/IATSE rates and current 2024-2025 market. Return JSON: {"min": 500, "max": 800, "notes": "brief explanation"}`;
    }

    const jsonSchema = type === "bio" ? null : {
      type: "object",
      properties:
        type === "skills" ? { skills: { type: "array", items: { type: "string" } } } :
        type === "credits" ? { credits: { type: "array", items: { type: "object", properties: { project_title: { type: "string" }, role_on_project: { type: "string" }, year: { type: "number" } } } } } :
        { min: { type: "number" }, max: { type: "number" }, notes: { type: "string" } }
    };

    const res = await base44.integrations.Core.InvokeLLM({ prompt, response_json_schema: jsonSchema });
    setResult(res);
    setLoading(false);
  };

  const apply = () => {
    if (!result || !activeType) return;
    if (activeType === "bio" && typeof result === "string") {
      onApply({ bio: result });
    } else if (activeType === "skills" && result.skills) {
      onApply({ special_skills: [...new Set([...form.special_skills, ...result.skills])] });
    } else if (activeType === "credits" && result.credits) {
      onApply({ credits: [...form.credits, ...result.credits] });
    } else if (activeType === "dayrate" && result.min) {
      onApply({ day_rate_min: result.min, day_rate_max: result.max });
    }
    setResult(null);
    setActiveType(null);
  };

  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass-gold text-primary text-sm font-medium w-full justify-between hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          AI Profile Assistant
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 bg-card border border-primary/20 rounded-xl p-5 space-y-4">
              <p className="text-xs text-muted-foreground">
                Australian film industry context. Select what you'd like AI to help with:
              </p>

              <div className="grid grid-cols-2 gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => run(s.id)}
                    disabled={loading}
                    className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                      activeType === s.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/30 text-foreground hover:border-primary/40"
                    }`}
                  >
                    <div className="font-medium">{s.label}</div>
                    <div className="text-muted-foreground mt-0.5">{s.description}</div>
                  </button>
                ))}
              </div>

              {loading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  Generating suggestion...
                </div>
              )}

              {result && !loading && (
                <div className="bg-secondary/40 rounded-lg p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">AI Suggestion</p>

                  {activeType === "bio" && (
                    <p className="text-sm text-foreground leading-relaxed">{result}</p>
                  )}
                  {activeType === "skills" && result.skills && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.skills.map((s) => (
                        <span key={s} className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">{s}</span>
                      ))}
                    </div>
                  )}
                  {activeType === "credits" && result.credits && (
                    <div className="space-y-1.5">
                      {result.credits.map((c, i) => (
                        <div key={i} className="text-xs text-foreground">
                          <span className="font-medium">{c.project_title}</span>
                          <span className="text-muted-foreground"> · {c.role_on_project} · {c.year}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {activeType === "dayrate" && result.min && (
                    <div>
                      <p className="text-sm font-semibold text-primary">${result.min} – ${result.max} / day</p>
                      {result.notes && <p className="text-xs text-muted-foreground mt-1">{result.notes}</p>}
                    </div>
                  )}

                  <Button size="sm" onClick={apply} className="bg-primary text-primary-foreground text-xs">
                    Apply to Profile
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}