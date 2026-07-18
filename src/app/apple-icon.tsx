import { ImageResponse } from 'next/og';
import { DOMIU_OFFICIAL_LOGO_DATA_URI } from '@/lib/brand-assets';

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
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(145deg, #FFFDF0 0%, #FFE55C 100%)',
          borderRadius: 38,
          padding: 12,
        }}
      >
        <img
          src={DOMIU_OFFICIAL_LOGO_DATA_URI}
          width="156"
          height="156"
          alt="DomiU Magdalena"
          style={{ width: 156, height: 156, objectFit: 'contain' }}
        />
      </div>
    ),
    size,
  );
}
