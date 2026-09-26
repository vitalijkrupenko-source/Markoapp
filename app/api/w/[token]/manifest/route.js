import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// Per-worker manifest so "Add to home screen" opens the worker's own page.
export async function GET(req, ctx) {
  const { token } = await ctx.params;
  let name = 'Urnik';
  try {
    name = `Urnik – ${(await getSettings(await db())).clinicName}`;
  } catch {}
  return Response.json({
    name,
    short_name: 'Urnik',
    start_url: `/w/${encodeURIComponent(token)}`,
    scope: `/w/${encodeURIComponent(token)}`,
    display: 'standalone',
    background_color: '#f6f7f9',
    theme_color: '#0f766e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }, { headers: { 'Content-Type': 'application/manifest+json' } });
}
