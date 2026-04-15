import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const CURRENCIES = ["AUD","USD","GBP","EUR","NZD","CAD"];
const GENDERS = ["Any","Male","Female","Non-Binary","Other"];
const ETHNICITIES = ["Any / Open","Aboriginal or Torres Strait Islander","Asian","Black / African","East Asian","Hispanic / Latino","Indigenous","Mediterranean","Middle Eastern","Mixed / Multiracial","Pacific Islander","South Asian","South-East Asian","White / Caucasian","Other"];
const RATE_TYPES = ["Flat Rate","Hourly","Daily","Weekly"];
const PROFICIENCY = ["Beginner","Developing","Intermediate","Advanced","Expert"];
const ACTOR_ROLE_TYPES = ["Lead","Supporting","Day Player","Background/Extra","Featured Extra","Stunt","Cameo"];
const CREW_JOB_TITLES = [
  "Director","Producer","Line Producer","1st AD","2nd AD","DOP / Cinematographer","Camera Operator",
  "Focus Puller","Clapper Loader","Gaffer","Best Boy Electric","Grip","Key Grip","Sound Mixer",
  "Boom Operator","Production Designer","Art Director","Set Decorator","Props Master","Costume Designer",
  "Wardrobe Supervisor","Makeup Artist","Hair Stylist","SFX Makeup","Editor","Colorist","VFX Artist",
  "Composer","Sound Designer","Location Manager","Casting Director","Script Supervisor","Stunt Coordinator",
  "Production Manager","Accountant","Other"
];

function IndieWarning() {
  return (
    <div className="rounded-xl border p-4 mt-3"
      style={{ borderColor: "hsl(14 100% 60% / 0.35)", background: "hsl(14 100% 60% / 0.07)" }}>
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#FF5C35" }} />
        <div>
          <p className="text-xs font-semibold mb-1" style={{ color: "#FF5C35" }}>Deferred or Unpaid? Indie Mode Activated.</p>
          <p className="text-xs leading-relaxed" style={{ color: "hsl(14 100% 60% / 0.75)" }}>
            We get it. Every filmmaker's done it… not all of them did it legally.
            Laws around deferred and unpaid work vary by country, state, and region, so do your homework.
            Exposure, credit, meals, and "great networking" don't magically replace pay.
            Be upfront. Be honest. Be clear. If there's no money, call it what it is: unpaid.
            Don't sugarcoat it. That's where things get murky.
          </p>
        </div>
      </div>
    </div>
  );
}

function CompensationBlock({ role, onChange }) {
  const showWarning = role.compensation_type === "Deferred" || role.compensation_type === "Unpaid";
  const isPaid = role.compensation_type === "Paid";

  const btnStyle = (opt) => {
    if (role.compensation_type === opt) {
      if (opt === "Paid") return { className: "bg-primary/15 border-primary/50 text-primary" };
      return { style: { background: "hsl(14 100% 60% / 0.1)", borderColor: "hsl(14 100% 60% / 0.4)", color: "#FF5C35" } };
    }
    return { className: "bg-secondary border-border text-muted-foreground hover:text-foreground" };
  };

  return (
    <div className="space-y-3 border-t border-border pt-4 mt-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Compensation</p>
      <div className="grid sm:grid-cols-3 gap-3">
        {["Paid", "Deferred", "Unpaid"].map((opt) => {
          const s = btnStyle(opt);
          return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange("compensation_type", opt)}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${s.className || ""}`}
            style={s.style}
          >{opt}</button>
          );
        })}
      </div>
      {showWarning && <IndieWarning />}
      {isPaid && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Rate Type</Label>
            <Select value={role.rate_type || ""} onValueChange={(v) => onChange("rate_type", v)}>
              <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {RATE_TYPES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Currency</Label>
            <Select value={role.currency || "AUD"} onValueChange={(v) => onChange("currency", v)}>
              <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-border">
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      {isPaid && (
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Pay</Label>
          <div className="flex items-center gap-3 mb-2">
            {["fixed","range"].map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
                <input type="radio" checked={(role.pay_mode || "fixed") === opt} onChange={() => onChange("pay_mode", opt)} className="accent-primary" />
                {opt === "fixed" ? "Fixed amount" : "Pay range"}
              </label>
            ))}
          </div>
          {(role.pay_mode || "fixed") === "fixed" ? (
            <Input type="number" value={role.pay_amount || ""} onChange={(e) => onChange("pay_amount", e.target.value)} placeholder="Amount" className="bg-secondary border-border h-9 text-sm w-40" />
          ) : (
            <div className="flex items-center gap-2">
              <Input type="number" value={role.pay_range_min || ""} onChange={(e) => onChange("pay_range_min", e.target.value)} placeholder="Min" className="bg-secondary border-border h-9 text-sm w-28" />
              <span className="text-muted-foreground text-sm">–</span>
              <Input type="number" value={role.pay_range_max || ""} onChange={(e) => onChange("pay_range_max", e.target.value)} placeholder="Max" className="bg-secondary border-border h-9 text-sm w-28" />
            </div>
          )}
        </div>
      )}
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Expected Hours / Days</Label>
        <Input value={role.expected_hours || ""} onChange={(e) => onChange("expected_hours", e.target.value)} placeholder="e.g. 3 days, 40 hrs" className="bg-secondary border-border h-9 text-sm" />
      </div>
    </div>
  );
}

function ActorFields({ role, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role Name</Label>
          <Input value={role.role_name || ""} onChange={(e) => onChange("role_name", e.target.value)} placeholder="e.g. Detective Harris" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role Type</Label>
          <Select value={role.role_type || ""} onValueChange={(v) => onChange("role_type", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              {ACTOR_ROLE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role Description</Label>
        <Textarea value={role.description || ""} onChange={(e) => onChange("description", e.target.value)} rows={2} placeholder="Describe the character, arc, and what you're looking for..." className="bg-secondary border-border text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Min Age</Label>
          <Input type="number" value={role.age_min || ""} onChange={(e) => onChange("age_min", e.target.value)} placeholder="18" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Max Age</Label>
          <Input type="number" value={role.age_max || ""} onChange={(e) => onChange("age_max", e.target.value)} placeholder="40" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Gender</Label>
          <Select value={role.gender || ""} onValueChange={(v) => onChange("gender", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent className="bg-card border-border">{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Ethnicity</Label>
          <Select value={role.ethnicity || ""} onValueChange={(v) => onChange("ethnicity", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Any / Open" /></SelectTrigger>
            <SelectContent className="bg-card border-border">{ETHNICITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Special Skills</Label>
          <Input value={role.skills || ""} onChange={(e) => onChange("skills", e.target.value)} placeholder="e.g. horse riding, dance" className="bg-secondary border-border h-9 text-sm" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={!!role.nudity} onCheckedChange={(v) => onChange("nudity", v)} />
        <Label className="text-sm text-muted-foreground">This role involves nudity or implied nudity</Label>
      </div>
    </div>
  );
}

function VoiceoverFields({ role, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role Name</Label>
          <Input value={role.role_name || ""} onChange={(e) => onChange("role_name", e.target.value)} placeholder="e.g. Narrator, Character A" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Recording Location</Label>
          <Select value={role.recording_location || ""} onValueChange={(v) => onChange("recording_location", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="In Studio">In Studio</SelectItem>
              <SelectItem value="Home Studio">Home Studio</SelectItem>
              <SelectItem value="Either">Either</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Accent</Label>
          <Input value={role.accent || ""} onChange={(e) => onChange("accent", e.target.value)} placeholder="e.g. Australian, RP" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Language</Label>
          <Input value={role.language || ""} onChange={(e) => onChange("language", e.target.value)} placeholder="e.g. English" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Gender</Label>
          <Select value={role.gender || ""} onValueChange={(v) => onChange("gender", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent className="bg-card border-border">{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Voice Style</Label>
        <Input value={role.voice_style || ""} onChange={(e) => onChange("voice_style", e.target.value)} placeholder="e.g. warm, authoritative, quirky" className="bg-secondary border-border h-9 text-sm" />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role Description</Label>
        <Textarea value={role.description || ""} onChange={(e) => onChange("description", e.target.value)} rows={2} className="bg-secondary border-border text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={!!role.explicit_content} onCheckedChange={(v) => onChange("explicit_content", v)} />
        <Label className="text-sm text-muted-foreground">This role requires explicit content</Label>
      </div>
    </div>
  );
}

function CrewFields({ role, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Job Title / Position</Label>
          <Select value={role.job_title || ""} onValueChange={(v) => onChange("job_title", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Select position" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              {CREW_JOB_TITLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Work Type</Label>
          <Select value={role.crew_type || ""} onValueChange={(v) => onChange("crew_type", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="On Set">On Set (required in person)</SelectItem>
              <SelectItem value="Remote">Remote (post/pre-production)</SelectItem>
              <SelectItem value="Hybrid">Hybrid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Proficiency Level</Label>
        <div className="flex gap-2 flex-wrap">
          {PROFICIENCY.map((p) => (
            <button key={p} type="button" onClick={() => onChange("proficiency", p)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${role.proficiency === p ? "bg-primary/15 border-primary/50 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role Description / Requirements</Label>
        <Textarea value={role.description || ""} onChange={(e) => onChange("description", e.target.value)} rows={2} placeholder="What skills, software, equipment are needed?" className="bg-secondary border-border text-sm" />
      </div>
    </div>
  );
}

function ModelFields({ role, onChange }) {
  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Role Name / Type</Label>
          <Input value={role.role_name || ""} onChange={(e) => onChange("role_name", e.target.value)} placeholder="e.g. Editorial, Commercial" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Gender</Label>
          <Select value={role.gender || ""} onValueChange={(v) => onChange("gender", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Any" /></SelectTrigger>
            <SelectContent className="bg-card border-border">{GENDERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Min Age</Label>
          <Input type="number" value={role.age_min || ""} onChange={(e) => onChange("age_min", e.target.value)} placeholder="18" className="bg-secondary border-border h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Max Age</Label>
          <Input type="number" value={role.age_max || ""} onChange={(e) => onChange("age_max", e.target.value)} placeholder="40" className="bg-secondary border-border h-9 text-sm" />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Ethnicity</Label>
          <Select value={role.ethnicity || ""} onValueChange={(v) => onChange("ethnicity", v)}>
            <SelectTrigger className="bg-secondary border-border h-9 text-sm"><SelectValue placeholder="Any / Open" /></SelectTrigger>
            <SelectContent className="bg-card border-border">{ETHNICITIES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Special Requirements</Label>
          <Input value={role.skills || ""} onChange={(e) => onChange("skills", e.target.value)} placeholder="e.g. tattoos ok, specific look" className="bg-secondary border-border h-9 text-sm" />
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</Label>
        <Textarea value={role.description || ""} onChange={(e) => onChange("description", e.target.value)} rows={2} className="bg-secondary border-border text-sm" />
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={!!role.nudity} onCheckedChange={(v) => onChange("nudity", v)} />
        <Label className="text-sm text-muted-foreground">This role involves nudity or implied nudity</Label>
      </div>
    </div>
  );
}

const CATEGORY_LABELS = {
  Actor: "Actor",
  Voiceover: "Voiceover",
  Crew: "Crew",
  Model: "Model",
};

export default function RoleEditor({ role, index, onChange, onRemove }) {
  const [expanded, setExpanded] = useState(true);

  const update = (key, value) => onChange(index, { ...role, [key]: value });

  const categoryLabel = CATEGORY_LABELS[role.category] || role.category;
  const subtitle = role.job_title || role.role_name || role.category || "New Role";

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-secondary/40 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{categoryLabel}</span>
          <span className="text-sm font-medium text-foreground">{subtitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(index); }}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-4">
          {role.category === "Actor" && <ActorFields role={role} onChange={update} />}
          {role.category === "Voiceover" && <VoiceoverFields role={role} onChange={update} />}
          {role.category === "Crew" && <CrewFields role={role} onChange={update} />}
          {role.category === "Model" && <ModelFields role={role} onChange={update} />}
          <CompensationBlock role={role} onChange={update} />
        </div>
      )}
    </div>
  );
}