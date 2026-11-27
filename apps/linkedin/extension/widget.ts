import { modeLabel, labelNames } from '../shared/polish.js';
import { assess, type Judgment, type Settings } from '../shared/model.js';
const css = `:host{display:block!important;position:relative!important;width:auto!important;max-width:100%!important;contain:content;font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;color:#23342f!important;margin:12px 0!important;text-align:left!important}*{box-sizing:border-box}button{font:inherit;cursor:pointer}details{border:1px solid #d9e5dd;border-radius:12px;background:#f7faf7;overflow:hidden}summary{display:flex;align-items:center;gap:9px;padding:9px 12px;cursor:pointer;list-style:none;flex-wrap:wrap}summary::-webkit-details-marker{display:none}.dot{height:7px;width:7px;border-radius:50%;background:var(--accent)}.score{font-weight:800;color:var(--accent)}.quip{color:#617269;font-size:11px}.mode{margin-left:auto;font:10px monospace;border:1px solid #cbd9ce;padding:2px 6px;border-radius:4px}.panel{padding:4px 13px 13px;border-top:1px solid #e2eae3}.title{font-weight:700;margin:10px 0}.row{display:flex;justify-content:space-between;gap:8px;margin:7px 0}.track{height:4px;background:#e4ebe5;border-radius:4px;margin-top:-3px;margin-bottom:9px}.fill{height:100%;background:var(--accent);border-radius:4px}.tag{display:inline-block;padding:3px 6px;margin:4px 4px 2px 0;background:#e5ece6;border-radius:4px;font:9px monospace}.note{font-size:10px;color:#6c786f;margin:8px 0 0}summary:focus-visible{outline:2px solid #287c58;outline-offset:-3px}`;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  return n;
}
export function widget(j: Judgment, settings: Settings): HTMLElement {
  const host = document.createElement('linkedin-bs-meter');
  host.dataset.mode = j.mode;
  host.lang = 'pl';
  const shadow = host.attachShadow({ mode: 'open' }),
    style = el('style', css);
  shadow.append(style);
  const result = assess(j, settings.sensitivity);
  host.dataset.score = String(result.bs);
  const detail = el('details');
  detail.style.setProperty(
    '--accent',
    result.bs > 60 ? '#b66c25' : result.bs > 40 ? '#857127' : '#267653',
  );
  const summary = el('summary');
  summary.setAttribute(
    'aria-label',
    `Detektor lania wody: ${result.bs} procent. ${modeLabel(j.mode)}. Pokaż szczegóły`,
  );
  const dot = el('span');
  dot.className = 'dot';
  summary.append(dot);
  const score = el('span', settings.meter ? `Lanie wody: ${result.bs}%` : 'Detektor lania wody');
  score.className = 'score';
  summary.append(score);
  const quip = el('span', result.quip);
  quip.className = 'quip';
  summary.append(quip);
  const mode = el('span', modeLabel(j.mode));
  mode.className = 'mode';
  summary.append(mode);
  detail.append(summary);
  const panel = el('div');
  panel.className = 'panel';
  panel.append(Object.assign(el('div', 'LinkedIn: Detektor lania wody'), { className: 'title' }));
  if (settings.details) {
    for (const [key, label] of Object.entries({
      concreteness: 'Konkretne informacje',
      actionable: 'Praktyczne wskazówki',
      selfPromotion: 'Autopromocja',
      platitudes: 'Banały',
    })) {
      const value = j.scores[key as keyof typeof j.scores];
      const row = el('div');
      row.className = 'row';
      row.append(
        el('span', labelNames[label] || label),
        el(
          'strong',
          `${value.toLocaleString('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} / 5`,
        ),
      );
      panel.append(row);
      const track = el('div');
      track.className = 'track';
      const fill = el('div');
      fill.className = 'fill';
      fill.style.width = `${(value / 5) * 100}%`;
      track.append(fill);
      panel.append(track);
    }
    const answer = j.insight >= 0.65 ? 'TAK' : j.insight <= 0.35 ? 'NIE' : 'NIEPEWNE';
    panel.append(el('div', `Użyteczna myśl: ${answer} · P(TAK) ${Math.round(j.insight * 100)}%`));
    if (Object.values(j.confidence).some((c) => c < 0.6))
      panel.append(el('p', 'Część ocen ma niską pewność. Potraktuj wynik orientacyjnie.'));
  }
  if (settings.labels)
    for (const label of result.labels) {
      const tag = el('span', labelNames[label] || label);
      tag.className = 'tag';
      panel.append(tag);
    }
  const note = el(
    'p',
    'Oceny dostarcza Jev. Wynik oblicza kod.',
  );
  note.className = 'note';
  panel.append(note);
  const scope = el('p', 'Ocena stylu tekstu, nie jego prawdziwości ani autora.');
  scope.className = 'note';
  panel.append(scope);
  detail.append(panel);
  shadow.append(detail);
  return host;
}
