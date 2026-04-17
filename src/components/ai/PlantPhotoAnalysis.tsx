import { useRef, useState } from "react";
import { Camera, Upload, Loader2, Sparkles, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface PhotoAnalysisFinding {
  category: "nutrient_deficiency" | "pest" | "disease" | "light_stress" | "heat_stress" | "healthy" | "other";
  severity: "low" | "moderate" | "high";
  finding: string;
  action: string;
}

export interface PhotoAnalysisResult {
  diagnosis: string;
  confidence: "low" | "medium" | "high";
  findings: PhotoAnalysisFinding[];
  recommended_actions: string[];
  overall_health: "good" | "fair" | "poor";
}

/**
 * Send a plant photo to the ask-cody edge function with a structured prompt,
 * parse the response into typed findings. Falls back to a narrative-only
 * display if the model doesn't return strict JSON.
 */
export default function PlantPhotoAnalysis({
  onAnalyzed,
  contextPlantId,
}: {
  onAnalyzed?: (result: PhotoAnalysisResult, file: File) => void;
  contextPlantId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<PhotoAnalysisResult | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPickFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setNarrative(null);
  };

  const fileToBase64 = (f: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(f);
  });

  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const base64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("ask-cody", {
        body: {
          product_key: "grow",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analyze this cannabis plant photo for signs of:
- Nutrient deficiencies (N, P, K, Ca, Mg, Fe, etc.)
- Pest indicators (mites, thrips, aphids, fungus gnats)
- Disease (powdery mildew, botrytis, root rot, mosaic virus)
- Light stress (burn, bleach, too-far / too-close)
- Heat stress (taco leaves, curl, wilt)

Return a JSON response with this exact shape (no markdown, just raw JSON):
{
  "diagnosis": "one-line summary",
  "confidence": "low|medium|high",
  "overall_health": "good|fair|poor",
  "findings": [
    { "category": "nutrient_deficiency|pest|disease|light_stress|heat_stress|healthy|other", "severity": "low|moderate|high", "finding": "what you see", "action": "what to do" }
  ],
  "recommended_actions": ["action 1", "action 2"]
}${contextPlantId ? `\n\nPlant ID context: ${contextPlantId}` : ""}`,
                },
                { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } },
              ],
            },
          ],
        },
      });
      if (error) throw error;
      const text = (data as any)?.content?.[0]?.text ?? (data as any)?.text ?? "";
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { setNarrative(text); return; }
        const parsed: PhotoAnalysisResult = JSON.parse(jsonMatch[0]);
        setResult(parsed);
        onAnalyzed?.(parsed, file);
      } catch {
        setNarrative(text);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Analysis failed — is the ask-cody function deployed?");
    } finally { setAnalyzing(false); }
  };

  const severityColor = (s: PhotoAnalysisFinding["severity"]) =>
    s === "high" ? "text-destructive" : s === "moderate" ? "text-amber-500" : "text-muted-foreground";
  const severityIcon = (s: PhotoAnalysisFinding["severity"]) =>
    s === "high" ? AlertTriangle : s === "moderate" ? AlertTriangle : Info;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-[13px] font-semibold">AI Photo Analysis</h3>
      </div>

      {!preview ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="rounded-xl border-2 border-dashed border-border bg-background hover:border-primary/50 transition-colors p-6 flex flex-col items-center justify-center gap-2"
          >
            <Upload className="w-6 h-6 text-muted-foreground" />
            <span className="text-[12px] font-medium">Upload photo</span>
          </button>
          <label className="rounded-xl border-2 border-dashed border-border bg-background hover:border-primary/50 transition-colors p-6 flex flex-col items-center justify-center gap-2 cursor-pointer">
            <Camera className="w-6 h-6 text-muted-foreground" />
            <span className="text-[12px] font-medium">Take photo</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }} />
          </label>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); }} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-border">
            <img src={preview} alt="" className="w-full max-h-[320px] object-contain bg-muted" />
          </div>
          {!result && !narrative && (
            <div className="flex items-center gap-2">
              <Button onClick={analyze} disabled={analyzing} className="gap-1.5 flex-1">
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {analyzing ? "Analyzing…" : "Analyze with Cody"}
              </Button>
              <Button variant="ghost" onClick={() => { setFile(null); setPreview(null); }}>Clear</Button>
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className={cn("rounded-lg border p-3",
            result.overall_health === "good" ? "border-emerald-500/30 bg-emerald-500/5" :
            result.overall_health === "fair" ? "border-amber-500/30 bg-amber-500/5" :
            "border-destructive/30 bg-destructive/5")}>
            <div className="flex items-start gap-2">
              {result.overall_health === "good" ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                : result.overall_health === "fair" ? <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                : <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />}
              <div className="flex-1">
                <div className="text-[13px] font-semibold">{result.diagnosis}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{result.confidence} confidence · {result.overall_health} overall</div>
              </div>
            </div>
          </div>

          {result.findings.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Findings</h4>
              {result.findings.map((f, i) => {
                const SevIcon = severityIcon(f.severity);
                return (
                  <div key={i} className="rounded-lg border border-border bg-background/50 p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <SevIcon className={cn("w-3.5 h-3.5", severityColor(f.severity))} />
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider", severityColor(f.severity))}>{f.severity}</span>
                      <span className="text-[10px] text-muted-foreground capitalize">· {f.category.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-[12px]">{f.finding}</div>
                    <div className="text-[11px] text-muted-foreground">→ {f.action}</div>
                  </div>
                );
              })}
            </div>
          )}

          {result.recommended_actions.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recommended actions</h4>
              <ul className="space-y-1 pl-4 list-disc text-[12px]">
                {result.recommended_actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          )}

          <Button variant="outline" onClick={() => { setFile(null); setPreview(null); setResult(null); }} className="w-full">Analyze another photo</Button>
        </div>
      )}

      {narrative && !result && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Analysis (narrative)</h4>
          <p className="text-[12px] whitespace-pre-wrap">{narrative}</p>
        </div>
      )}
    </div>
  );
}
