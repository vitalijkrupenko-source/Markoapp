import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f766e' }}>
        <div style={{ width: 110, height: 96, background: '#fff', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 26, background: '#99e2d8' }} />
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 22, height: 40, borderRight: '9px solid #0f766e', borderBottom: '9px solid #0f766e', transform: 'rotate(45deg)', marginTop: -10 }} />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
