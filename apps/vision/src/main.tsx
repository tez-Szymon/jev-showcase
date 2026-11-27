import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, Check, Code2, Copy, Crop, Crosshair, Eye, FileImage, LoaderCircle, Maximize, RotateCcw, ScanLine, Sparkles, Upload, X } from 'lucide-react';
import type { AnswerType, Evaluation, Photo } from './types';
import { ImagePreview } from './ImagePreview';
import './styles.css';

const modes: { id: AnswerType; title: string; detail: string; icon: typeof Crop; prompt: string }[] = [
  { id: 'box', title: 'Box', detail: 'Znajdź na obrazie', icon: Crop, prompt: 'Wskaż górną filiżankę kawy na zdjęciu.' },
  { id: 'noul', title: 'Noul', detail: 'Tak czy nie', icon: Check, prompt: 'Czy na zdjęciu jest filiżanka kawy?' },
  { id: 'choice', title: 'Choice', detail: 'Wybierz opcję', icon: ScanLine, prompt: 'Jaki napój widać na zdjęciu?' },
  { id: 'score', title: 'Score', detail: 'Oceń w skali', icon: Sparkles, prompt: 'Jak dobrze oświetlone jest zdjęcie?' },
];
// One click loads the picture and a matching question. The drawn pictures live in public/samples.
type Sample = { label: string; thumb: string; file: string; name: string; mode: AnswerType; prompt: string; criteria?: string };
const samples: Sample[] = [
  { label: 'Kawa', thumb: '/sample-coffee.jpg', file: '/sample-coffee.jpg', name: 'coffee-moment.jpg', mode: 'box', prompt: 'Wskaż górną filiżankę kawy na zdjęciu.' },
  { label: 'Ulica: parking', thumb: '/samples/street-signs.jpg', file: '/samples/street-signs.jpg', name: 'street-signs.jpg', mode: 'box', prompt: 'Wskaż niebieski znak parkingu z literą P.' },
  { label: 'Ulica: zakaz wjazdu?', thumb: '/samples/street-signs.jpg', file: '/samples/street-signs.jpg', name: 'street-signs.jpg', mode: 'noul', prompt: 'Czy na zdjęciu jest znak zakazu wjazdu (czerwone koło z białym poziomym pasem)?' },
  { label: 'Jaki to znak?', thumb: '/samples/yield-sign.jpg', file: '/samples/yield-sign.jpg', name: 'yield-sign.jpg', mode: 'choice', prompt: 'Jaki znak drogowy widać na zdjęciu?', criteria: 'Stop\nUstąp pierwszeństwa\nZakaz wjazdu\nParking\nBrak znaku drogowego' },
  { label: 'Bateria', thumb: '/samples/phone-battery.jpg', file: '/samples/phone-battery.jpg', name: 'phone-battery.jpg', mode: 'score', prompt: 'Na ile naładowana jest bateria pokazana na ekranie telefonu?', criteria: 'Pusta, brak kresek\nJedna kreska z czterech\nDwie kreski z czterech\nTrzy kreski z czterech\nPełna, cztery kreski' },
];
const defaultCriteria = { choice: 'Kawa\nHerbata\nInny napój\nBrak napoju', score: 'Bardzo ciemne, szczegóły niewidoczne\nCzęściowo oświetlone, część szczegółów niewidoczna\nDobrze oświetlone, wszystkie szczegóły widoczne' };

async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Nie udało się wykonać zapytania.');
  return data;
}

function App() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [mode, setMode] = useState<AnswerType>('box');
  const [prompt, setPrompt] = useState('');
  const [criteria, setCriteria] = useState(defaultCriteria);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<{ configured: boolean; model: string } | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [showBox, setShowBox] = useState(true);
  const [resultTab, setResultTab] = useState<'result' | 'json'>('result');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedMode = modes.find(item => item.id === mode)!;
  const box = result?.answer.type === 'box' ? result.answer.box : undefined;
  const locked = busy || uploading;

  useEffect(() => {
    fetch('/api/status').then(response => readResponse<typeof status>(response)).then(setStatus).catch(() => setStatusError(true));
  }, []);
  useEffect(() => {
    if (!expanded) return;
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false); };
    document.addEventListener('keydown', handler);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = previous; };
  }, [expanded]);

  function invalidate() { setResult(null); setError(''); setShowBox(true); }

  async function prepare(file: File) {
    if (locked) return;
    setError('');
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setError('Wybierz zdjęcie PNG lub JPEG.'); return; }
    if (file.size > 16 * 1024 * 1024) { setError('Maksymalny rozmiar zdjęcia to 16 MB.'); return; }
    setUploading(true);
    invalidate();
    try {
      const form = new FormData(); form.append('image', file);
      const data = await readResponse<Omit<Photo, 'name'>>(await fetch('/api/image', { method: 'POST', body: form }));
      setPhoto({ ...data, name: file.name });
    } catch (error) { setError(error instanceof Error ? error.message : 'Nie udało się przesłać zdjęcia.'); }
    finally { setUploading(false); }
  }

  async function loadExample(sample?: Sample) {
    if (locked) return;
    try {
      const response = await fetch(sample?.file ?? '/sample-coffee.jpg');
      if (!response.ok) throw new Error('Nie udało się wczytać przykładowego zdjęcia.');
      await prepare(new File([await response.blob()], sample?.name ?? 'coffee-moment.jpg', { type: 'image/jpeg' }));
      if (!sample) { setPrompt(selectedMode.prompt); return; }
      setMode(sample.mode);
      setPrompt(sample.prompt);
      const extra = sample.criteria;
      if (extra && (sample.mode === 'choice' || sample.mode === 'score')) setCriteria(current => ({ ...current, [sample.mode]: extra }));
    } catch (error) { setError(error instanceof Error ? error.message : 'Błąd wczytywania zdjęcia.'); }
  }

  async function evaluate(event: React.FormEvent) {
    event.preventDefault();
    if (!photo || !prompt.trim() || locked) return;
    setBusy(true); setError(''); setResult(null); setResultTab('result');
    try {
      const form = new FormData();
      const blob = await (await fetch(photo.dataUrl)).blob();
      form.append('image', blob, 'photo.jpg'); form.append('type', mode); form.append('prompt', prompt);
      form.append('criteria', JSON.stringify(mode === 'choice' || mode === 'score' ? criteria[mode].split('\n').map(value => value.trim()).filter(Boolean) : []));
      const data = await readResponse<Evaluation>(await fetch('/api/evaluate', { method: 'POST', body: form }));
      setResult(data); setShowBox(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Wystąpił błąd połączenia.'); }
    finally { setBusy(false); }
  }

  async function copyJson() {
    if (!result) return;
    try { await navigator.clipboard.writeText(JSON.stringify(result.raw, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setError('Nie udało się skopiować. Możesz zaznaczyć tekst w zakładce JSON.'); }
  }

  async function download() {
    if (!photo) return;
    try {
      const img = new Image(); img.src = photo.dataUrl; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = photo.width; canvas.height = photo.height;
      const context = canvas.getContext('2d'); if (!context) return;
      context.drawImage(img, 0, 0);
      if (box && showBox) {
        context.strokeStyle = '#b9f269'; context.lineWidth = Math.max(3, photo.width / 250);
        context.strokeRect(box.left * photo.width, box.top * photo.height, (box.right - box.left) * photo.width, (box.bottom - box.top) * photo.height);
      }
      const link = document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download = 'jev-result.png'; link.click();
    } catch { setError('Nie udało się zapisać obrazu.'); }
  }

  const imageView = photo && <ImagePreview photo={photo} box={showBox ? box : undefined} />;

  return <>
    <header className="topbar" inert={expanded}><a className="brand" href="/" aria-label="Jev, strona główna"><span className="brand-mark"><span /><span /><span /><span /></span><span>jev<span className="brand-dot">.</span></span><span className="brand-divider" /><span className="product-name">vision playground</span></a>
      <a className="docs-link" href="https://docs.typesafe.ai/images" target="_blank" rel="noreferrer">Dokumentacja <ArrowUpRight size={15} /></a>
    </header>
    <main inert={expanded}>
      <section className="hero"><div><div className="eyebrow"><span /> OBRAZY × SYSTEM ONE <span className="beta">EXPERIMENTAL</span></div><h1>Obraz. Pytanie.<br /><span>Konkretna odpowiedź.</span></h1></div>
        <div className="hero-description"><p>Sprawdź, co widzi Jev.</p><p>Dodaj zdjęcie, zadaj pytanie i zamień obraz<br className="desktop-break" /> w dane, z których możesz korzystać.</p><div className="model-tag"><span className="pulse-dot" /> {status?.model || 'jev-preview'} <span>vision enabled</span></div></div>
      </section>

      <div className="workspace">
        <section className="panel image-panel" aria-labelledby="image-heading">
          <div className="panel-heading"><h2 id="image-heading"><span className="step">01</span> Twój obraz</h2><span className="muted">PNG, JPG <span className="dot-separator">·</span> do 16 MB</span></div>
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg" aria-label="Prześlij zdjęcie" disabled={locked} onChange={event => { const file = event.target.files?.[0]; if (file) void prepare(file); event.target.value = ''; }} />
          <div className={`image-stage ${photo ? 'has-image' : ''} ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) void prepare(event.dataTransfer.files[0]); }}>
            {photo ? <><div className="stage-top"><span><span className="small-dot" /> {box ? 'Wynik na obrazie' : 'Podgląd obrazu'}</span><button className="icon-button" title="Usuń zdjęcie" aria-label="Usuń zdjęcie" disabled={locked} onClick={() => { setPhoto(null); invalidate(); }}><X size={16} /></button></div><div className="image-wrapper">{imageView}</div><div className="stage-bottom"><span>{photo.width} × {photo.height} px</span><div>{box && <button className={showBox ? 'overlay-toggle active' : 'overlay-toggle'} onClick={() => setShowBox(value => !value)} aria-pressed={showBox}><Eye size={14} /> Zaznaczenie</button>}<button className="icon-button" title="Powiększ obraz" aria-label="Powiększ obraz" onClick={() => setExpanded(true)}><Maximize size={15} /></button></div></div></>
              : <div className="empty-upload"><div className="upload-illustration"><div className="illustration-back" /><div className="illustration-front"><FileImage size={37} strokeWidth={1.2} /><span className="illustration-plus">+</span></div><span className="illustration-spark one">+</span><span className="illustration-spark two">+</span></div><h3>Miejsce na Twój punkt widzenia</h3><p>Przeciągnij zdjęcie tutaj lub wybierz je z dysku.</p><button className="upload-button" disabled={locked} onClick={() => inputRef.current?.click()}>{uploading ? <LoaderCircle size={16} className="spin" /> : <Upload size={16} />} {uploading ? 'Przygotowywanie…' : 'Wybierz zdjęcie'}</button><span className="upload-footnote">Rozmiar automatycznie dopasujemy do Jev.</span></div>}
            {uploading && photo && <div className="stage-loading"><LoaderCircle className="spin" /> Przygotowywanie obrazu…</div>}
          </div>
          <div className="image-bottom">{photo ? <><div className="file-info"><FileImage size={19} /><div><strong>{photo.name}</strong><span>{Math.round(photo.size / 1024)} KB · gotowy do analizy</span></div></div><button className="text-button" disabled={locked} onClick={() => inputRef.current?.click()}><RotateCcw size={14} /> Zmień zdjęcie</button></>
            : <><div className="sample-info"><img src="/sample-coffee.jpg" alt="Przykładowe zdjęcie filiżanki kawy" /><div><strong>Na początek mała kawa?</strong><span>Wypróbuj przykładowe zdjęcie.</span></div></div><button className="text-button" disabled={locked} onClick={() => void loadExample()}>Użyj przykładu <ArrowRight size={15} /></button></>}</div>
          <div className="sample-strip" role="group" aria-label="Przykłady"><span>Przykłady</span>{samples.map(sample => <button type="button" key={sample.label} disabled={locked} onClick={() => void loadExample(sample)} title={sample.prompt}><img src={sample.thumb} alt="" /><span><strong>{sample.label}</strong><small>{modes.find(item => item.id === sample.mode)!.title}</small></span></button>)}</div>
        </section>

        <form className="panel config-panel" onSubmit={evaluate}>
          <div className="panel-heading"><h2><span className="step">02</span> Zapytaj Jev</h2><Sparkles size={17} className="subtle-icon" /></div>
          <div className="config-body"><label className="field-label" id="type-label">Typ odpowiedzi <span>Co chcesz otrzymać?</span></label><div className="mode-grid" role="group" aria-labelledby="type-label">{modes.map(item => <button type="button" key={item.id} className={`mode-card ${mode === item.id ? 'selected' : ''}`} aria-pressed={mode === item.id} disabled={locked} onClick={() => { const previous = selectedMode.prompt; setMode(item.id); if (prompt === previous) setPrompt(item.prompt); invalidate(); }}><item.icon size={18} strokeWidth={1.6} /><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="radio-dot" /></button>)}</div>
            <label className="field-label prompt-label" htmlFor="prompt">Twój prompt <span>{prompt.length}/8000</span></label><textarea id="prompt" placeholder={selectedMode.prompt} maxLength={8000} value={prompt} disabled={locked} onChange={event => { setPrompt(event.target.value); invalidate(); }} />
            <div className="prompt-hint"><span>Spróbuj:</span><button type="button" disabled={locked} onClick={() => { setPrompt(selectedMode.prompt); invalidate(); }}>{mode === 'box' ? 'Wskaż filiżankę kawy' : mode === 'noul' ? 'Czy widać kawę?' : mode === 'choice' ? 'Rozpoznaj napój' : 'Oceń oświetlenie'} <ArrowUpRight size={12} /></button></div>
            {(mode === 'choice' || mode === 'score') && <div className="criteria-field"><label className="field-label" htmlFor="criteria">{mode === 'choice' ? 'Dostępne opcje' : 'Poziomy oceny'}<span>Każdy w osobnej linii</span></label><textarea id="criteria" value={criteria[mode]} disabled={locked} onChange={event => { setCriteria({ ...criteria, [mode]: event.target.value }); invalidate(); }} /><p>{mode === 'choice' ? 'Od 2 do 255 opcji. Dodaj opcję na wypadek braku dopasowania.' : 'Od 2 do 10 poziomów, od najniższego do najwyższego.'}</p></div>}
            <div className="mode-note"><selectedMode.icon size={16} /><p>{mode === 'box' ? 'Jev zwróci współrzędne obszaru i zaznaczy go bezpośrednio na Twoim zdjęciu.' : mode === 'noul' ? 'Jev zwróci prawdopodobieństwo odpowiedzi „tak”, od 0 do 1.' : mode === 'choice' ? 'Jev wybierze jedną z podanych opcji i zwróci rozkład prawdopodobieństw.' : 'Jev zwróci ocenę pomiędzy zdefiniowanymi poziomami, numerowanymi od 0.'}</p></div>
            <button className="analyze-button" type="submit" disabled={!photo || !prompt.trim() || locked || !status?.configured}>{busy ? <LoaderCircle size={17} className="spin" /> : <ScanLine size={17} />}{busy ? 'Jev analizuje obraz…' : 'Analizuj obraz'}{!busy && <ArrowRight size={18} />}</button>
            <div className="submit-note">{!photo ? 'Zacznij od dodania zdjęcia' : !prompt.trim() ? 'Wpisz prompt, aby rozpocząć' : status?.configured ? 'Zdjęcie zostanie wysłane do TypeSafe dopiero po kliknięciu' : 'Analiza wymaga klucza API na serwerze'}</div>
          </div>
        </form>
      </div>

      {error && <div className="error-message" role="alert"><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Zamknij komunikat"><X size={16} /></button></div>}
      {(status && !status.configured || statusError) && <div className="setup-note"><Code2 size={17} /><p>{statusError ? 'Nie udało się połączyć z serwerem. Odśwież stronę po uruchomieniu aplikacji.' : <>Aby uruchomić analizę, dodaj <code>TYPESAFE_API_KEY</code> do pliku <code>.env</code> i uruchom ponownie serwer. Podgląd zdjęć działa bez klucza.</>}</p><a href="https://docs.typesafe.ai/introduction/quickstart" target="_blank" rel="noreferrer">Uzyskaj klucz <ArrowUpRight size={13} /></a></div>}

      <section className="panel result-panel" aria-labelledby="result-heading" aria-live="polite" aria-busy={busy}>
        <div className="panel-heading"><h2 id="result-heading"><span className="step">03</span> Odpowiedź modelu {result && <span className="result-success"><Check size={12} /> Gotowe</span>}</h2><div className="result-actions"><div className="result-tabs"><button className={resultTab === 'result' ? 'active' : ''} onClick={() => setResultTab('result')}>Wynik</button><button className={resultTab === 'json' ? 'active' : ''} onClick={() => setResultTab('json')}><Code2 size={13} /> JSON</button></div>{result && <button className="icon-button" onClick={() => void copyJson()} title="Kopiuj JSON" aria-label="Kopiuj JSON">{copied ? <Check size={15} /> : <Copy size={15} />}</button>}</div></div>
        {!result ? <div className="result-empty"><div className={`result-empty-icon ${busy ? 'working' : ''}`}>{busy ? <LoaderCircle className="spin" size={22} /> : <ScanLine size={22} strokeWidth={1.4} />}</div><div><h3>{busy ? 'Jev przygląda się Twojemu zdjęciu' : 'Tutaj pojawi się odpowiedź'}</h3><p>{busy ? 'Oczekiwanie na odpowiedź modelu…' : 'Jedno zdjęcie, jedno pytanie, ustrukturyzowany wynik.'}</p></div><span className="waiting-label">{busy ? 'ANALIZA W TOKU' : 'GOTOWY, GDY TY JESTEŚ'}</span></div>
          : resultTab === 'json' ? <pre className="json-output">{JSON.stringify(result.raw, null, 2)}</pre>
          : <div className="result-content"><div className="answer-primary"><span className="metric-label">{result.answer.type === 'box' ? 'Zlokalizowany obszar' : result.answer.type === 'noul' ? 'Prawdopodobieństwo „tak”' : result.answer.type === 'choice' ? 'Wybrana opcja' : 'Ocena modelu'}</span><strong>{result.answer.type === 'box' ? <><Crosshair size={24} /> Box <span>zaznaczony na zdjęciu</span></> : result.answer.type === 'noul' ? `${((result.answer.noul ?? 0) * 100).toFixed(1)}%` : result.answer.type === 'choice' ? result.answer.choice : `${result.answer.score?.toFixed(2)} / ${Object.keys(result.answer.legend || {}).length - 1}`}</strong>{box && <div className="coordinates">{Object.entries(box).map(([key, value]) => <span key={key}>{key} <b>{value.toFixed(3)}</b></span>)}</div>}{result.answer.probabilities && <div className="probabilities">{Object.entries(result.answer.probabilities).map(([label, probability]) => <div key={label}><span title={result.answer.legend?.[label] || label}>{result.answer.legend?.[label] || label}</span><div><i style={{ width: `${probability * 100}%` }} /></div><b>{(probability * 100).toFixed(1)}%</b></div>)}</div>}</div><div className="result-metrics"><div><span className="metric-label">Czas odpowiedzi</span><strong>{(result.elapsedMs / 1000).toFixed(2)} <small>s</small></strong></div>{result.answer.type !== 'noul' && <div><span className="metric-label">Pewność modelu</span><strong>{result.answer.confidence == null ? 'Brak danych' : `${(result.answer.confidence * 100).toFixed(1)}%`}</strong></div>}<div><span className="metric-label">Model</span><strong className="model-value">{result.raw.model}</strong></div></div>{box && <div className="box-disclaimer">Box zawsze zwraca obszar, nawet gdy szukanego obiektu nie ma na zdjęciu. Wynik sprawdź wizualnie.</div>}{box && <button className="download-button" onClick={() => void download()}><ArrowDownToLine size={14} /> Pobierz obraz z wynikiem</button>}</div>}
      </section>
      <footer><span><span className="footer-symbol">✳</span> Built with <a href="https://typesafe.ai" target="_blank" rel="noreferrer">TypeSafe</a></span><span>Obrazy i Box są eksperymentalne. Odkrywaj, testuj, sprawdzaj.</span><a href="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085" className="photo-credit" target="_blank" rel="noreferrer">Zdjęcie: Unsplash <ArrowUpRight size={11} /></a></footer>
    </main>
    {expanded && <div className="image-modal" role="dialog" aria-modal="true" aria-label="Powiększony obraz" onKeyDown={event => { if (event.key === 'Tab') event.preventDefault(); }} onClick={() => setExpanded(false)}><button autoFocus className="modal-close" aria-label="Zamknij powiększenie" onClick={() => setExpanded(false)}><X size={24} /></button><div onClick={event => event.stopPropagation()}>{imageView}</div></div>}
  </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
