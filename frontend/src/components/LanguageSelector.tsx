import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLanguages } from "@/lib/api";

interface Props {
  value: string | null;
  detectedValue: string | null;
  isLowConfidence: boolean;
  onSelect: (lang: string) => void;
  onClear: () => void;
}

const PINNED = [
  "English", "French", "German", "Spanish", "Italian", "Portuguese",
  "Dutch", "Russian", "Arabic", "Greek", "Latin", "Ancient Greek",
  "Japanese", "Chinese", "Korean", "Hindi", "Turkish", "Swedish",
  "Norwegian", "Danish", "Polish", "Czech", "Romanian", "Hungarian",
  "Finnish", "Hebrew", "Persian",
];

export function LanguageSelector({ value, detectedValue, isLowConfidence, onSelect, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [languages, setLanguages] = useState<string[]>(PINNED);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !loaded) {
      fetchLanguages().then((langs) => {
        const pinned = PINNED.filter((l) => langs.includes(l));
        const rest = langs.filter((l) => !PINNED.includes(l));
        setLanguages([...pinned, ...rest]);
        setLoaded(true);
      });
    }
  }, [open, loaded]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setFilter("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => { if (!containerRef.current?.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  const handleSelect = useCallback((lang: string) => { onSelect(lang); setOpen(false); }, [onSelect]);
  const handleClear = useCallback(() => { onClear(); setOpen(false); }, [onClear]);

  const displayLang = value ?? detectedValue;
  const filtered = filter ? languages.filter((l) => l.toLowerCase().includes(filter.toLowerCase())) : languages;

  const triggerStyle = !displayLang
    ? "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
    : isLowConfidence
      ? "border-amber-500/30 text-amber-400 bg-amber-500/8 hover:bg-amber-500/15"
      : value
        ? "border-sky-500/30 text-sky-400 bg-sky-500/8 hover:bg-sky-500/15"
        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground";

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`h-8 px-3 text-xs rounded-lg border inline-flex items-center gap-1.5 transition-all cursor-pointer select-none whitespace-nowrap ${triggerStyle}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
          <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        {displayLang ?? "Language"}{isLowConfidence && " ?"}
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[240px] rounded-xl border border-border bg-popover shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150">
          <div className="p-2 pb-0">
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 h-8">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input ref={inputRef} type="text" value={filter} onChange={(e) => setFilter(e.target.value)}
                placeholder="Search languages..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
            </div>
          </div>

          <div className="max-h-[280px] overflow-y-auto p-1.5">
            {displayLang && !filter && (
              <>
                <button type="button" onClick={handleClear}
                  className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                  Clear — use auto-detect
                </button>
                <div className="mx-2 my-1 h-px bg-border/50" />
              </>
            )}

            {!filtered.length && <div className="px-3 py-6 text-center text-xs text-muted-foreground">No languages found</div>}

            {filtered.slice(0, 100).map((lang) => (
              <button key={lang} type="button" onClick={() => handleSelect(lang)}
                className={`w-full rounded-lg px-3 py-1.5 text-left text-sm transition-colors flex items-center justify-between ${lang === displayLang ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent/50 hover:text-foreground"}`}>
                {lang}
                {lang === displayLang && (
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-400">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
