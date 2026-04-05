import { useCallback, useEffect, useRef, useState } from "react";
import { useVerba } from "@/hooks/useVerba";
import { detectLanguage } from "@/lib/detect";
import { searchTerms } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { LanguageSelector } from "@/components/LanguageSelector";
import type { SearchResult } from "@/types";

export function SearchInput() {
  const { query, setQuery, detectedLang, setDetectedLang, selectedLang, setSelectedLang, confidence, search, loading, hasSearched } = useVerba();

  const inputRef = useRef<HTMLInputElement>(null);
  const [langOverride, setLangOverride] = useState(false);
  const detectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);

  const detectLang = useCallback((text: string) => {
    if (detectTimer.current) clearTimeout(detectTimer.current);
    if (langOverride) return;
    detectTimer.current = setTimeout(() => {
      const result = detectLanguage(text);
      setDetectedLang(result?.lang ?? null, result?.confidence ?? 0);
    }, 200);
  }, [langOverride, setDetectedLang]);

  const fetchSuggestions = useCallback((text: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 2) { setSuggestions([]); return; }
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchTerms(text, selectedLang ?? undefined, 8);
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
        setSelectedIdx(-1);
      } catch { setSuggestions([]); }
    }, 300);
  }, [selectedLang]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    detectLang(e.target.value);
    fetchSuggestions(e.target.value);
  }, [setQuery, detectLang, fetchSuggestions]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSuggestions([]);
    setShowSuggestions(false);
    if (query.trim()) search();
  }, [query, search]);

  const handleSuggestionClick = useCallback((item: SearchResult) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setQuery(item.term);
    setSuggestions([]);
    setShowSuggestions(false);
    search(item.term, item.lang);
  }, [setQuery, search]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions || !suggestions.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter" && selectedIdx >= 0) { e.preventDefault(); handleSuggestionClick(suggestions[selectedIdx]); }
    else if (e.key === "Escape") setShowSuggestions(false);
  }, [showSuggestions, suggestions, selectedIdx, handleSuggestionClick]);

  const handleLangSelect = useCallback((lang: string) => { setLangOverride(true); setSelectedLang(lang); }, [setSelectedLang]);
  const handleLangClear = useCallback(() => {
    setLangOverride(false);
    setSelectedLang(null);
    const result = detectLanguage(query);
    if (result) setDetectedLang(result.lang, result.confidence);
  }, [setSelectedLang, setDetectedLang, query]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = () => setShowSuggestions(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const isLowConfidence = !selectedLang && confidence > 0 && confidence < 0.5;
  const hintClass = "text-foreground/60 hover:text-foreground transition-colors underline underline-offset-4 decoration-foreground/20";

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto relative" onClick={(e) => e.stopPropagation()}>
      <div className="relative flex items-center gap-3 rounded-2xl border border-border bg-card pl-6 pr-3 py-3 shadow-sm focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/10 transition-all">
        <input
          ref={inputRef} type="text" value={query} onChange={handleInput} onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Type any word..." spellCheck={false} autoComplete="off"
          className="flex-1 bg-transparent text-lg text-foreground placeholder:text-muted-foreground outline-none min-w-0"
        />
        {loading && <div className="w-4 h-4 border-2 border-muted border-t-muted-foreground rounded-full animate-spin shrink-0" />}
        <LanguageSelector value={selectedLang} detectedValue={detectedLang} isLowConfidence={isLowConfidence} onSelect={handleLangSelect} onClear={handleLangClear} />
        <Button type="submit" variant="ghost" size="icon" disabled={loading || !query.trim()} className="shrink-0 text-muted-foreground hover:text-foreground">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </Button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
          {suggestions.map((item, idx) => (
            <button key={`${item.term}-${item.lang}`} type="button" onClick={() => handleSuggestionClick(item)}
              className={`w-full px-5 py-2.5 flex items-center justify-between text-left text-sm transition-colors ${idx === selectedIdx ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/50"}`}>
              <span>{item.term}</span>
              <span className="text-xs text-muted-foreground">{item.lang}</span>
            </button>
          ))}
        </div>
      )}

      {!hasSearched && (
        <p className="text-center text-muted-foreground text-sm mt-5">
          Try{" "}
          <button type="button" onClick={() => { setQuery("philosophy"); search("philosophy", "English"); }} className={hintClass}>philosophy</button>,{" "}
          <button type="button" onClick={() => { setQuery("saudade"); search("saudade", "Portuguese"); }} className={hintClass}>saudade</button>,{" "}
          <button type="button" onClick={() => { setQuery("Kindergarten"); search("Kindergarten", "German"); }} className={hintClass}>Kindergarten</button>, or{" "}
          <button type="button" onClick={() => { setQuery("chocolate"); search("chocolate", "English"); }} className={hintClass}>chocolate</button>
        </p>
      )}
    </form>
  );
}
