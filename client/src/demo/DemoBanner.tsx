import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { IS_DEMO } from './kernel';

/** Thin bar shown only in the static GitHub Pages build. */
const FILL_CSS = '#root{display:flex;flex-direction:column}#root>*:not(.demo-banner):not(section){flex:1 1 0;min-height:0;height:auto}';

/** `fill`: the app is a full-height layout, so it shrinks to make room for the bar. */
export function DemoBanner({ repo, onReset, fill = false }: { repo: string; onReset: () => void; fill?: boolean }) {
  const [hidden, setHidden] = useState(() => { try { return sessionStorage.getItem('demo-banner') === 'hidden'; } catch { return false; } });
  if (!IS_DEMO || hidden) return null;
  return (
    <div className="demo-banner relative flex shrink-0 items-center justify-center gap-x-3 gap-y-1 bg-[#0B0D12] px-10 py-2 text-center text-[12.5px] text-white/85">
      <span><b className="font-semibold text-white">Live demo</b><span className="max-sm:hidden"> · runs entirely in your browser with sample data. Your changes stay on this device.</span></span>
      <button onClick={onReset} className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold text-white underline-offset-2 hover:underline"><RotateCcw className="h-3 w-3" /> Reset demo</button>
      <a href={`https://github.com/mdfayaz25/${repo}`} target="_blank" rel="noreferrer" className="font-semibold text-white underline-offset-2 hover:underline"><span className="max-sm:hidden">Source on </span>GitHub</a>
      <button onClick={() => { setHidden(true); try { sessionStorage.setItem('demo-banner', 'hidden'); } catch { /* ignore */ } }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/60 hover:text-white" aria-label="Hide demo banner"><X className="h-3.5 w-3.5" /></button>
      {fill && <style>{FILL_CSS}</style>}
    </div>
  );
}
