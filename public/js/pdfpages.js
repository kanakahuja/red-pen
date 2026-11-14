// Extra A4 pages for the evaluated PDF, drawn from the canonical result: the cover (and, for UPSC, parameter-wise marks and the
// overall feedback) in front of the copy, and one consolidated feedback section after it. Every feedback line carries the same
// number and colour as its highlight on the copy. Pages are canvases, so any script the browser can draw (e.g. Hindi) works.
import { COLORS } from "./config.js";

const PW = 1240, PH = 1754, M = 90; // A4 at ~150 dpi
const INK = "#1B2124", SUB = "#5C6670", RED = "#BF2734", LINE = "#D9DCE1";
const num = (v) => (v == null || v === "" ? "–" : String(Math.round(v * 100) / 100));

class Writer {
  constructor(title, startAt) { this.pages = []; this.title = title; this.startAt = startAt || 0; this.next(); }
  next() {
    const c = document.createElement("canvas"); c.width = PW; c.height = PH;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, PW, PH); x.textBaseline = "alphabetic";
    this.c = c; this.x = x; this.y = M; this.pages.push(c);
    x.fillStyle = SUB; x.font = "500 22px 'Reddit Sans',sans-serif"; x.textAlign = "left"; x.fillText(this.title, M, 56);
    x.textAlign = "right"; x.fillText("Page " + (this.startAt + this.pages.length), PW - M, 56); x.textAlign = "left";
    x.strokeStyle = LINE; x.lineWidth = 2; x.beginPath(); x.moveTo(M, 72); x.lineTo(PW - M, 72); x.stroke(); this.y = 120;
  }
  need(h) { if (this.y + h > PH - M) this.next(); }
  lines(text, font, maxW) {
    const x = this.x; x.font = font; const out = [];
    String(text == null ? "" : text).split("\n").forEach((par) => {
      if (!par.trim()) { out.push(""); return; }
      let cur = ""; par.split(/\s+/).forEach((w) => { const t = cur ? cur + " " + w : w; if (x.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }); out.push(cur);
    });
    return out;
  }
  text(text, { font = "400 26px 'Reddit Sans',sans-serif", color = INK, lh = 36, left = M, maxW = PW - 2 * M, gap = 8 } = {}) {
    const ls = this.lines(text, font, maxW);
    ls.forEach((l) => { this.need(lh); this.x.font = font; this.x.fillStyle = color; this.x.fillText(l, left, this.y + lh * 0.75); this.y += lh; });
    this.y += gap;
  }
  head(t, size = 34) { this.need(size + 30); this.text(t, { font: `700 ${size}px 'Reddit Sans',sans-serif`, lh: size + 12, gap: 10 }); }
}

function table(w, cols, rows, opt = {}) {
  // cols: [{label, w (fraction), align, font, color}]; rows: array of arrays of strings
  const total = PW - 2 * M, f0 = "400 24px 'Reddit Sans',sans-serif";
  const widths = cols.map((c) => c.w * total);
  const drawRow = (cells, head) => {
    const fonts = cells.map((_, i) => head ? "600 22px 'Reddit Sans',sans-serif" : (cols[i].font || f0));
    const ls = cells.map((cell, i) => w.lines(cell, fonts[i], widths[i] - 24));
    const h = Math.max(...ls.map((l) => l.length)) * 34 + 18;
    w.need(h);
    const x = w.x; let cx = M; const y0 = w.y;
    x.fillStyle = head ? "#F4F5F7" : "#fff"; x.fillRect(M, y0, total, h);
    cells.forEach((_, i) => {
      x.strokeStyle = LINE; x.lineWidth = 1.5; x.strokeRect(cx, y0, widths[i], h);
      x.font = fonts[i]; x.fillStyle = head ? SUB : (cols[i].color || INK); x.textAlign = cols[i].align === "center" ? "center" : "left";
      ls[i].forEach((l, k) => x.fillText(l, cols[i].align === "center" ? cx + widths[i] / 2 : cx + 12, y0 + 34 + k * 34 - 6));
      cx += widths[i];
    });
    x.textAlign = "left"; w.y += h;
  };
  drawRow(cols.map((c) => c.label), true);
  rows.forEach((r) => drawRow(r, false));
  w.y += 20;
}

// Cover, then (UPSC only) parameter-wise marks and overall feedback.
export function frontPages(R) {
  const w = new Writer((R.test.name || R.test.code || "Result") + " · " + (R.student.name || ""));
  const x = w.x, c = R.cover;
  w.head(R.student.name || "Student", 44);
  c.fields.filter((f) => f.label !== "Student name").forEach((f) => w.text(f.label + ": " + f.value, { color: SUB, lh: 32, gap: 2 }));
  // circled marks, handwritten red
  const cx = PW - M - 150, cy = 230;
  x.save(); x.translate(cx, cy); x.rotate(-0.1); x.strokeStyle = RED; x.lineWidth = 6; x.beginPath(); x.ellipse(0, 0, 130, 78, 0, 0, Math.PI * 2); x.stroke();
  x.fillStyle = RED; x.textAlign = "center"; x.font = "700 60px Kalam,cursive"; x.fillText(num(c.marks_obtained) + "/" + num(c.total_marks), 0, 20); x.restore();
  x.fillStyle = RED; x.font = "700 34px Kalam,cursive"; x.textAlign = "center"; x.fillText(c.remark.text, cx, cy + 124); x.textAlign = "left";
  w.y = Math.max(w.y, 400);
  w.text("Question-wise Performance", { font: "600 28px 'Reddit Sans',sans-serif", lh: 40, gap: 14 });
  table(w, [{ label: "Ques no.", w: 0.3, align: "center" }, { label: "Max marks", w: 0.35, align: "center" }, { label: "Marks obtained", w: 0.35, align: "center", font: "700 30px Kalam,cursive", color: RED }],
    R.questions.map((q) => [String(q.number), num(q.max_marks), q.attempted ? num(q.marks_obtained) : "0"]));
  if (R.parameters) {
    w.next(); w.head("Summary — parameter-wise marks", 34);
    R.questions.filter((q) => q.attempted && q.parameters).forEach((q) => {
      w.text("Q" + q.number + "   " + num(q.marks_obtained) + " / " + num(q.max_marks), { font: "600 26px 'Reddit Sans',sans-serif", lh: 38, gap: 6 });
      table(w, [{ label: "Parameter", w: 0.2 }, { label: "Marks", w: 0.12, align: "center", font: "700 26px Kalam,cursive", color: RED }, { label: "Feedback", w: 0.68, font: "400 25px Kalam,cursive", color: RED }],
        q.parameters.map((p) => [p.name, num(p.marks) + "/" + p.max_marks, p.feedback]));
    });
    w.next(); w.head("Overall Feedback", 34);
    const o = R.overall;
    w.text(o.summary || "No overall feedback was written.", { font: "400 28px Kalam,cursive", color: RED, lh: 40 });
    [["Strengths", o.strengths], ["Improvements", o.improvements]].forEach(([t, a]) => { if (a && a.length) { w.text(t, { font: "600 26px 'Reddit Sans',sans-serif", lh: 38 }); a.forEach((s) => w.text("• " + s, { font: "400 26px Kalam,cursive", color: RED, lh: 38, gap: 4 })); } });
  }
  return w.pages;
}

// One consolidated section after the copy. Numbers and colours match the highlights on the pages.
export function feedbackPages(R, startAt) {
  const w = new Writer((R.test.name || R.test.code || "Result") + " · " + (R.student.name || "") + " · Feedback", startAt);
  w.head("Feedback on your answer", 38);
  w.text("Each number and colour matches the highlight on your copy.", { color: SUB, lh: 32, gap: 14 });
  if (!R.feedback.length) w.text("There are no highlights with feedback on this copy.", { color: SUB });
  R.feedback.forEach((f) => {
    const col = COLORS[f.color] || COLORS.red;
    const ls = w.lines(f.text, "400 27px Kalam,cursive", PW - 2 * M - 110);
    const h = Math.max(70, ls.length * 38 + 62);
    w.need(h + 14);
    const y0 = w.y, x = w.x;
    x.fillStyle = col.hex; x.beginPath(); x.roundRect ? x.roundRect(M, y0 + 4, 64, 44, 10) : x.rect(M, y0 + 4, 64, 44); x.fill();
    x.fillStyle = "#fff"; x.font = "700 26px 'Reddit Sans',sans-serif"; x.textAlign = "center"; x.fillText(f.label, M + 32, y0 + 36); x.textAlign = "left";
    x.fillStyle = SUB; x.font = "500 22px 'Reddit Sans',sans-serif"; x.fillText("Q" + f.question + " · Page " + f.page + " · " + col.label + (f.parameter ? " · " + f.parameter : ""), M + 86, y0 + 34);
    x.fillStyle = col.hex; x.fillRect(M + 86, y0 + 46, 4, ls.length * 38 + 6);
    x.font = "400 27px Kalam,cursive"; x.fillStyle = f.color === "green" ? "#067647" : f.color === "yellow" ? "#A15C07" : "#D92D20";
    ls.forEach((l, k) => x.fillText(l, M + 104, y0 + 82 + k * 38));
    w.y = y0 + h + 14;
  });
  return w.pages;
}
