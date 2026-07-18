import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #FFF000 0%, #FFD900 55%, #FF9D00 100%)',
          borderRadius: 38,
          color: '#111317',
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 900, fontStyle: 'italic', letterSpacing: -8 }}>DU</div>
        <div style={{ marginTop: -8, fontSize: 14, fontWeight: 800, letterSpacing: 4 }}>MAGDALENA</div>
      </div>
    ),
    size,
  );
}
