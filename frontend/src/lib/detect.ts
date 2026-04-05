import { francAll } from "franc-min";

const ISO_TO_LANG: Record<string, string> = {
  eng: "English", deu: "German", fra: "French", spa: "Spanish",
  ita: "Italian", por: "Portuguese", nld: "Dutch", rus: "Russian",
  ara: "Arabic", zho: "Chinese", jpn: "Japanese", kor: "Korean",
  hin: "Hindi", tur: "Turkish", pol: "Polish", swe: "Swedish",
  nor: "Norwegian", dan: "Danish", fin: "Finnish", ell: "Greek",
  ces: "Czech", ron: "Romanian", hun: "Hungarian", ukr: "Ukrainian",
  cat: "Catalan", hrv: "Croatian", slk: "Slovak", slv: "Slovenian",
  bul: "Bulgarian", lit: "Lithuanian", lav: "Latvian", est: "Estonian",
  heb: "Hebrew", fas: "Persian", urd: "Urdu", ben: "Bengali",
  tam: "Tamil", tel: "Telugu", mal: "Malayalam", tha: "Thai",
  vie: "Vietnamese", ind: "Indonesian", msa: "Malay", tgl: "Tagalog",
  lat: "Latin", gle: "Irish", cym: "Welsh", eus: "Basque",
  kat: "Georgian", hye: "Armenian", isl: "Icelandic", afr: "Afrikaans",
  swa: "Swahili",
};

const SCRIPT_PATTERNS: [RegExp, string, string, number][] = [
  [/[\u0600-\u06FF]/, "Arabic", "ara", 0.7],
  [/[\u0400-\u04FF]/, "Russian", "rus", 0.5],
  [/[\u3040-\u309F\u30A0-\u30FF]/, "Japanese", "jpn", 0.8],
  [/[\uAC00-\uD7AF]/, "Korean", "kor", 0.8],
  [/[\u4E00-\u9FFF]/, "Chinese", "zho", 0.6],
  [/[\u0370-\u03FF]/, "Greek", "ell", 0.7],
  [/[\u0590-\u05FF]/, "Hebrew", "heb", 0.7],
  [/[\u10A0-\u10FF]/, "Georgian", "kat", 0.8],
  [/[\u0530-\u058F]/, "Armenian", "hye", 0.8],
  [/[\u0E00-\u0E7F]/, "Thai", "tha", 0.8],
  [/[\u0900-\u097F]/, "Hindi", "hin", 0.6],
];

export interface DetectionResult {
  lang: string;
  isoCode: string;
  confidence: number;
}

export function detectLanguage(text: string): DetectionResult | null {
  if (!text || text.trim().length < 2) return null;

  const clean = text.trim();
  for (const [pattern, lang, iso, conf] of SCRIPT_PATTERNS) {
    if (pattern.test(clean)) return { lang, isoCode: iso, confidence: conf };
  }

  const results = francAll(text, { minLength: 2 });
  if (!results.length || results[0][0] === "und") return null;

  const [isoCode, score] = results[0];
  const lang = ISO_TO_LANG[isoCode];
  if (!lang) return null;

  return { lang, isoCode, confidence: Math.min(1, Math.max(0, score)) };
}
