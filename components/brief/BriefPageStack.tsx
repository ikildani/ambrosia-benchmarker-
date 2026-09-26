import Image from 'next/image';

/**
 * Hero for /brief: three real pages of an example Deal Intelligence Brief,
 * rendered from the PDF the product produces (scripts/generate-brief-v3.ts
 * on current main, pages 3–5 at 2x via PyMuPDF into public/brief/). Page
 * three sits in front; the scored call and the term sheet peek out behind.
 * Figures are illustrative; the layout is the real thing.
 */

const W = 1190;
const H = 1684;

export function BriefPageStack() {
  return (
    <figure className="relative mx-auto w-full max-w-[520px]">
      <div className="relative aspect-[1190/1684]">
        <div className="absolute inset-0 translate-x-8 -translate-y-3 rotate-[3deg] overflow-hidden rounded-md border border-slate-700/60 bg-white opacity-70 shadow-2xl shadow-black/50">
          <Image src="/brief/page-05.png" alt="Indicative term sheet page of an example Deal Intelligence Brief" width={W} height={H} className="h-auto w-full" />
        </div>
        <div className="absolute inset-0 translate-x-4 -translate-y-1.5 rotate-[1.5deg] overflow-hidden rounded-md border border-slate-700/60 bg-white opacity-85 shadow-2xl shadow-black/50">
          <Image src="/brief/page-04.png" alt="This call is scored: the page after the decision in an example Deal Intelligence Brief" width={W} height={H} className="h-auto w-full" />
        </div>
        <div className="absolute inset-0 overflow-hidden rounded-md border border-slate-600/60 bg-white shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)]">
          <Image src="/brief/page-03.png" alt="The decision: page three of an example Deal Intelligence Brief" width={W} height={H} priority className="h-auto w-full" />
        </div>
        <div className="absolute -top-3 right-2 rounded-full border border-teal-400/40 bg-[#0b1220] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300">
          Registered · scored
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs text-slate-500">
        Pages 3, 4 and 5 of an example brief for a preclinical Alzheimer&rsquo;s antibody, rendered from the PDF the product delivers. Figures are illustrative.
      </figcaption>
    </figure>
  );
}
