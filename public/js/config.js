// App-wide settings and constants.

export const CONFIG = {
  name: "Redpen",
  // Optional. If set, "Submit" POSTs the review JSON here (JSON body).
  // Leave empty to download the JSON instead.
  submitUrl: "",
  submitHeaders: {},
};

export const STAMPS = ["Good", "Very Good", "Incomplete", "Irrelevant", "Needs more detail"];

// Teams. The SME picks one for every copy; it decides which fields appear.
export const TEAMS = { foundation: "Foundation", upsc: "UPSC" };
export const BOARDS = ["CBSE", "ICSE"];
export const CLASSES = ["9", "10"];
// Subject dropdown per team. "Others" lets the SME type a subject that is not listed.
export const SUBJECTS = {
  foundation: ["Physics", "Chemistry", "Biology", "SST", "Math"],
  upsc: [
    "Modern History", "Art and Culture, Ancient and Medieval India", "Ancient and Medieval India",
    "World History & Post-Independence", "Geography", "Society", "Polity and constitution", "Governance",
    "International Relation", "Social Justice", "Economics Development", "Science and Technology",
    "Environment", "Disaster Management", "Internal Security", "Ethics",
  ],
};
export const OTHER_SUBJECT = "__other";

// Question types for Foundation. obj = objective (full marks or zero, no stamp). "Others" lets the SME type one.
export const QTYPES = [
  { k: "Diagram" }, { k: "Long Answer" }, { k: "MCQ", obj: true }, { k: "Numerical" }, { k: "Short Answer" },
  { k: "True/False", obj: true }, { k: "Fill in the blank", obj: true }, { k: "One word", obj: true },
  { k: "Matching", obj: true }, { k: "Language" }, { k: "Assertion Reason", obj: true },
];
export const OTHER_TYPE = "__other_type";
// Every UPSC question is subjective.
export const SUBJECTIVE = "Subjective";

// UPSC parameters (five in the sample API response). Each is marked out of PARAM_MAX.
export const PARAM_NAMES = ["Introduction", "Content", "Conclusion", "Language", "Presentation"];
export const PARAM_MAX = 5;

// Special cases from the Foundation edge-case rules (docs/09-FOUNDATION-EVALUATION-RULES.md).
// "ops" = flag the copy for Ops review. These are notes for the data, not blockers.
export const EDGE = [
  { k: "Not legible", ops: false, rule: "Mark what you can read and note “Not legible” for the rest. Do not give zero for the whole answer unless most of it cannot be read." },
  { k: "Written elsewhere (margin or extra sheet)", ops: false, rule: "Find the answer and mark it where it is written, as if it were in the right place." },
  { k: "Crossed out and rewritten", ops: false, rule: "Mark only the final answer that is not crossed out. Ignore the crossed-out part. Do not average the two." },
  { k: "Question read another way", ops: false, rule: "Accept any reasonable reading that stays consistent. Do not cut marks for a valid different reading." },
  { k: "Diagram missing or only described", ops: true, rule: "Give the diagram marks only if the rubric allows words instead of a drawing. If the rubric is silent, give only the text marks and note a rubric gap." },
  { k: "Unit missing or wrong", ops: true, rule: "Follow the rubric’s unit rule. If it is silent, give the full method marks and note a rubric gap." },
  { k: "Question copied as answer", ops: false, rule: "Give zero. There is no answer content." },
  { k: "Handwriting not good", ops: false, rule: "Mark what you can read. Do not cut marks only for handwriting. Note what was hard to read." },
  { k: "Answer incomplete (stopped halfway)", ops: false, rule: "Give marks for the part that is written. Note where the answer stops." },
  { k: "Different question answered", ops: false, rule: "Mark the answer against the question it really answers. Note which question it is." },
  { k: "Another or mixed language", ops: false, rule: "Mark the content. Note the language used." },
  { k: "Photo or scan quality poor", ops: false, rule: "Mark what you can see. Note what is blurred, cut or dark." },
  { k: "Page missing or out of order", ops: true, rule: "Mark what is there. Note the missing or misplaced page. The copy is flagged for Ops review." },
  { k: "Marking scheme unclear", ops: true, rule: "Use your best judgement. Note what is unclear. The copy is flagged for Ops review." },
  { k: "Other", ops: false, rule: "Not in the list? Tick this and describe the special case in the comment." },
];

export const COLORS = {
  red:    { label: "Mistake",     hex: "#F04438", pol: "negative" },
  yellow: { label: "Improve",     hex: "#EAAA2E", pol: "neutral" },
  green:  { label: "Correct",     hex: "#16B364", pol: "positive" },
};

export const RED = "#BF2734";
export const PENC = { red: "#BF2734", green: "#1B7938" };

// Hand-drawn sprites. cq = display width in % of page width.
const sp = (file, w, h, cq) => ({ src: "assets/sprites/" + file, w, h, cq });
export const SPR = {
  "tick":       sp("tick.png", 152, 100, 7.5),
  "cross":      sp("cross.png", 142, 112, 7.1),
  "Very Good":  sp("very-good.png", 162, 132, 9.3),
  "Good":       sp("good.png", 130, 98, 7.5),
  "Incomplete": sp("incomplete.png", 252, 110, 14.5),
  "Irrelevant": sp("irrelevant.png", 220, 106, 12.7),
};
export const SPRIMG = {};
if (typeof Image !== "undefined") {
  Object.keys(SPR).forEach((k) => { const im = new Image(); im.src = SPR[k].src; SPRIMG[k] = im; });
}

export const TOOLS = [
  { id: "select",    ic: "↖", label: "Select",    hint: "Click a mark to edit. Drag to move." },
  { id: "box",       ic: "▭", label: "Highlight", hint: "Drag over the answer to highlight it, then write your feedback." },
  { id: "tick",      ic: `<img src="${SPR.tick.src}" alt="">`,  label: "Tick",  hint: "Click to place a tick." },
  { id: "cross",     ic: `<img src="${SPR.cross.src}" alt="">`, label: "Cross", hint: "Click to place a cross." },
  { id: "underline", ic: "<span class='u'>U</span>", label: "Underline", hint: "Drag along text. Select it to add a comment." },
  { id: "strike",    ic: "<span class='s'>S</span>", label: "Strike",    hint: "Drag across text to strike it." },
  { id: "score",     ic: "⓪", label: "Score",     hint: "Click, then enter the marks." },
  { id: "stamp",     ic: "✎", label: "Stamp",     hint: "Pick a stamp, then click. One per question." },
  { id: "text",      ic: "<span class='aa'>Aa</span>", label: "Write", hint: "Click and type. Enter adds a line." },
  { id: "circle",    ic: "◯", label: "Circle",    hint: "Drag around a word." },
  { id: "pen",       ic: "✒", label: "Pen",       hint: "Draw freely." },
  { id: "eraser",    ic: "🗑", label: "Delete",    hint: "Click a mark to delete it." },
];
