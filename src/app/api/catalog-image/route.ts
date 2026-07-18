import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const PALETTES: Record<string, { start: string; end: string; accent: string; label: string }> = {
  wings: { start: '#3B160C', end: '#A83A19', accent: '#FFB33B', label: 'ALITAS' },
  burger: { start: '#2D1907', end: '#9B4A08', accent: '#FFD15C', label: 'HAMBURGUESA' },
  pizza: { start: '#3D110D', end: '#B42D1E', accent: '#FFD36E', label: 'PIZZA' },
  pasta: { start: '#382008', end: '#9A5A12', accent: '#FFE08A', label: 'PASTA' },
  beverage: { start: '#062D3F', end: '#087EA4', accent: '#7BE7FF', label: 'BEBIDA' },
  bakery: { start: '#3A210F', end: '#A76B2C', accent: '#FFE0A0', label: 'PANADERÍA' },
  pharmacy: { start: '#052F2C', end: '#07886E', accent: '#8FFFD8', label: 'CUIDADO' },
  grocery: { start: '#173512', end: '#559C2D', accent: '#D9FF8B', label: 'MERCADO' },
  liquor: { start: '#21113D', end: '#7040A4', accent: '#E2BEFF', label: 'LICORES' },
  chicken: { start: '#3B160C', end: '#A83A19', accent: '#FFB33B', label: 'POLLO' },
  dessert: { start: '#39142D', end: '#A53A80', accent: '#FFB8E6', label: 'POSTRE' },
  default: { start: '#17191F', end: '#3A414B', accent: '#FFD400', label: 'PRODUCTO' },
};

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapName(name: string, max = 25) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function productArt(type: string, accent: string) {
  switch (type) {
    case 'wings':
    case 'chicken':
      return `<g transform="translate(400 320)"><ellipse cx="-72" cy="10" rx="118" ry="72" transform="rotate(-24)" fill="#D9682B"/><ellipse cx="72" cy="10" rx="118" ry="72" transform="rotate(24)" fill="#ED8740"/><path d="M-138 7c45-34 86-41 126-18M138 7c-45-34-86-41-126-18" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/><circle cx="0" cy="76" r="52" fill="#F6B35D"/><path d="M-20 110h40" stroke="#FFF4D6" stroke-width="15" stroke-linecap="round"/></g>`;
    case 'burger':
      return `<g transform="translate(400 310)"><path d="M245 0H-245C-225-108-130-154 0-154S225-108 245 0Z" fill="#E7A540"/><rect x="-242" y="4" width="484" height="54" rx="25" fill="#58A63B"/><path d="M-220 62h440l-35 60h-370Z" fill="#F4C344"/><rect x="-225" y="118" width="450" height="76" rx="32" fill="#6B2E18"/><path d="M-235 191h470c-18 92-110 123-235 123s-217-31-235-123Z" fill="#D99637"/><g fill="#FFF0B5"><circle cx="-95" cy="-80" r="7"/><circle cx="0" cy="-104" r="7"/><circle cx="96" cy="-76" r="7"/></g></g>`;
    case 'pizza':
      return `<g transform="translate(400 310)"><path d="M0-190 235 205H-235Z" fill="#F2C65A"/><path d="M0-190 235 205H-235Z" fill="none" stroke="#C9812E" stroke-width="30" stroke-linejoin="round"/><circle cx="-72" cy="10" r="42" fill="#C93C2E"/><circle cx="78" cy="58" r="42" fill="#C93C2E"/><circle cx="8" cy="120" r="39" fill="#C93C2E"/><path d="M-103-12c38-34 75-24 97 3" stroke="#FFF3B2" stroke-width="14" stroke-linecap="round"/></g>`;
    case 'pasta':
      return `<g transform="translate(400 320)"><ellipse cx="0" cy="122" rx="220" ry="75" fill="#F3EFE4"/><ellipse cx="0" cy="90" rx="190" ry="96" fill="#DFAE42"/><path d="M-145 60c80-95 195-86 285-15M-150 95c88-78 210-72 300-10M-115 125c75-52 160-52 230-8" fill="none" stroke="#FFE08A" stroke-width="21" stroke-linecap="round"/><circle cx="0" cy="38" r="54" fill="#B43A27"/><path d="M-30 20c28-20 54-18 75 5" stroke="#F58A4D" stroke-width="12" stroke-linecap="round"/></g>`;
    case 'beverage':
      return `<g transform="translate(400 310)"><rect x="-105" y="-175" width="210" height="360" rx="50" fill="#D8F7FF" opacity=".92"/><rect x="-76" y="-238" width="152" height="78" rx="24" fill="${accent}"/><path d="M-55-60h110M-55 5h110M-55 70h110" stroke="#27A6C9" stroke-width="18" stroke-linecap="round"/><path d="M90-210c95 85 100 160 45 225" fill="none" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round" opacity=".65"/></g>`;
    case 'bakery':
      return `<g transform="translate(400 330)"><path d="M-240 92C-225-65-120-165 0-165S225-65 240 92C175 145 83 170 0 170S-175 145-240 92Z" fill="#D79B52"/><path d="M-120-88c36 32 48 72 45 116M0-137c25 53 27 104 10 155M120-88c-36 32-48 72-45 116" fill="none" stroke="#FFE0A0" stroke-width="24" stroke-linecap="round"/></g>`;
    case 'pharmacy':
      return `<g transform="translate(400 315)"><rect x="-150" y="-175" width="300" height="370" rx="58" fill="#F4FFFC"/><rect x="-95" y="-240" width="190" height="85" rx="26" fill="${accent}"/><rect x="-28" y="-90" width="56" height="190" rx="16" fill="#08A986"/><rect x="-95" y="-23" width="190" height="56" rx="16" fill="#08A986"/><path d="M-98 145h196" stroke="#B7EBDD" stroke-width="18" stroke-linecap="round"/></g>`;
    case 'grocery':
      return `<g transform="translate(400 325)"><path d="M-235-65h470l-38 255h-394Z" fill="#F2E6C4"/><path d="M-170-70c0-95 75-145 170-145S170-165 170-70" fill="none" stroke="${accent}" stroke-width="28" stroke-linecap="round"/><circle cx="-125" cy="5" r="70" fill="#E95B3F"/><ellipse cx="8" cy="30" rx="85" ry="62" fill="#79B64B"/><path d="M70-80c80 15 125 70 115 160" fill="none" stroke="#F2C84A" stroke-width="46" stroke-linecap="round"/></g>`;
    case 'liquor':
      return `<g transform="translate(400 310)"><rect x="-105" y="-185" width="210" height="390" rx="48" fill="#6A3A22"/><rect x="-62" y="-270" width="124" height="105" rx="20" fill="#E7C57A"/><rect x="-82" y="-35" width="164" height="135" rx="22" fill="#F2E5C4"/><circle cx="0" cy="30" r="38" fill="#6D3E91"/><path d="M-50 130h100" stroke="#D8B871" stroke-width="16" stroke-linecap="round"/></g>`;
    case 'dessert':
      return `<g transform="translate(400 330)"><path d="M-190 105h380l-45 115h-290Z" fill="#F2D4C7"/><path d="M-175 105c15-120 88-195 175-195s160 75 175 195" fill="#FFB8E6"/><circle cx="0" cy="-115" r="46" fill="#D93D65"/><path d="M-100 20c65-55 135-55 200 0" fill="none" stroke="#FFF2FA" stroke-width="20" stroke-linecap="round"/></g>`;
    default:
      return `<g transform="translate(400 320)"><rect x="-205" y="-180" width="410" height="360" rx="70" fill="#FFFFFF" opacity=".94"/><circle cx="0" cy="-20" r="110" fill="${accent}" opacity=".92"/><path d="M-52-20h104M0-72V32" stroke="#17191F" stroke-width="25" stroke-linecap="round"/><path d="M-105 125h210" stroke="#BFC4CC" stroke-width="18" stroke-linecap="round"/></g>`;
  }
}

export async function GET(request: NextRequest) {
  const typeValue = request.nextUrl.searchParams.get('type')?.toLowerCase().trim() || 'default';
  const type = PALETTES[typeValue] ? typeValue : 'default';
  const name = request.nextUrl.searchParams.get('name')?.trim().slice(0, 120) || 'Producto';
  const palette = PALETTES[type];
  const lines = wrapName(name).map((line, index) => `<text x="400" y="${635 + index * 45}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${linesFontSize(name)}" font-weight="800" fill="#FFFFFF">${escapeXml(line)}</text>`).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800" role="img" aria-label="Ilustración de referencia de ${escapeXml(name)}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette.start}"/><stop offset="1" stop-color="${palette.end}"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".28"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#000000" flood-opacity=".35"/></filter>
    </defs>
    <rect width="800" height="800" rx="64" fill="url(#bg)"/>
    <circle cx="680" cy="90" r="220" fill="url(#glow)"/>
    <circle cx="110" cy="610" r="170" fill="url(#glow)" opacity=".6"/>
    <text x="48" y="70" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="800" letter-spacing="5" fill="${palette.accent}">${palette.label}</text>
    <g filter="url(#shadow)">${productArt(type, palette.accent)}</g>
    ${lines}
    <rect x="48" y="744" width="704" height="2" fill="#FFFFFF" opacity=".22"/>
    <text x="48" y="779" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" fill="#FFFFFF" opacity=".72">IMAGEN ILUSTRATIVA DE REFERENCIA · DOMIU</text>
  </svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function linesFontSize(name: string) {
  if (name.length > 72) return 25;
  if (name.length > 48) return 29;
  return 34;
}
