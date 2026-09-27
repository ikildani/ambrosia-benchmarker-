import 'server-only';
import type { ReactElement } from 'react';

/**
 * Render a static React subtree to an HTML string on the server.
 *
 * Why: in the App Router every server-component element is serialised into
 * the RSC flight payload and parsed by the client runtime at load (the home
 * page's payload grew from 39 KB to 151 KB when its sections became server
 * components, costing ~1.2 s of scripting on a throttled phone). A single HTML
 * string is one flight entry, parsed in microseconds, and needs no hydration.
 * Use only for content with no client interactivity.
 */
export async function renderStatic(el: ReactElement): Promise<string> {
  const mod = await import('react-dom/server');
  return mod.renderToStaticMarkup(el);
}
