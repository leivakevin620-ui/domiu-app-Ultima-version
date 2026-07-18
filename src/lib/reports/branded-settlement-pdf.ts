'use client';

import { DOMIU_OFFICIAL_LOGO_DATA_URI } from '@/lib/brand-assets';

export interface BrandedSettlementPdfMetric {
  label: string;
  value: string;
}

export interface BrandedSettlementPdfData {
  documentNumber: string;
  participantName: string;
  participantType: string;
  periodLabel: string;
  generatedAt: string;
  statusLabel: string;
  metrics: BrandedSettlementPdfMetric[];
  companyOwes: number;
  participantOwes: number;
  netBalance: number;
}

const PAGE_WIDTH = 595;

function ascii(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, (letter) => (letter === 'Ñ' ? 'N' : 'n'))
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

export function pdfCurrency(value: number) {
  return `$ ${Math.round(Number(value || 0)).toLocaleString('es-CO')} COP`;
}

function encode(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(parts: Uint8Array[]) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function base64ToBytes(value: string) {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function logoAsJpeg() {
  const image = new Image();
  image.decoding = 'async';
  image.src = DOMIU_OFFICIAL_LOGO_DATA_URI;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('No se pudo cargar el logo oficial de DomiU'));
  });

  const width = Math.max(256, image.naturalWidth || 256);
  const height = Math.max(164, image.naturalHeight || 164);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El dispositivo no permite preparar el logo para el PDF');
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  return { width, height, bytes: base64ToBytes(dataUrl.split(',')[1] || '') };
}

function text(font: 'F1' | 'F2', size: number, x: number, y: number, value: unknown, color = '0.10 0.11 0.13') {
  return `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm (${ascii(value)}) Tj ET\n`;
}

function filledRect(x: number, y: number, width: number, height: number, color: string) {
  return `${color} rg ${x} ${y} ${width} ${height} re f\n`;
}

function strokedRect(x: number, y: number, width: number, height: number, color: string, lineWidth = 1) {
  return `${color} RG ${lineWidth} w ${x} ${y} ${width} ${height} re S\n`;
}

function metricCard(x: number, y: number, label: string, value: string) {
  return [
    filledRect(x, y, 254, 62, '0.975 0.978 0.982'),
    strokedRect(x, y, 254, 62, '0.88 0.90 0.93'),
    text('F1', 8.5, x + 15, y + 40, label.toUpperCase(), '0.42 0.45 0.50'),
    text('F2', 15, x + 15, y + 17, value),
  ].join('');
}

function buildContent(data: BrandedSettlementPdfData) {
  const balanceMessage = data.netBalance > 0
    ? `DomiU debe pagar al participante ${pdfCurrency(data.netBalance)}`
    : data.netBalance < 0
      ? `El participante debe entregar a DomiU ${pdfCurrency(Math.abs(data.netBalance))}`
      : 'Liquidacion conciliada: saldo en cero';
  const fallbackMetrics: BrandedSettlementPdfMetric[] = Array.from({ length: 8 }, (_, index) => ({
    label: `Indicador ${index + 1}`,
    value: '0',
  }));
  const metrics = fallbackMetrics.map((fallback, index) => data.metrics[index] || fallback);
  const positions = [
    [36, 500], [305, 500], [36, 423], [305, 423],
    [36, 346], [305, 346], [36, 269], [305, 269],
  ];

  return [
    filledRect(0, 720, PAGE_WIDTH, 122, '0.075 0.082 0.098'),
    filledRect(0, 714, PAGE_WIDTH, 6, '1 0.83 0'),
    filledRect(34, 744, 116, 70, '1 1 1'),
    'q 104 0 0 60 40 749 cm /Im1 Do Q\n',
    text('F2', 21, 172, 786, 'DomiU Magdalena', '1 1 1'),
    text('F1', 10, 172, 766, 'Centro de liquidaciones y control financiero', '0.78 0.80 0.84'),
    filledRect(432, 775, 126, 28, '1 0.83 0'),
    text('F2', 9, 447, 785, data.statusLabel.toUpperCase(), '0.08 0.09 0.10'),

    text('F2', 25, 36, 674, 'Comprobante de liquidacion'),
    text('F1', 10, 36, 654, `Documento ${data.documentNumber} | Generado ${data.generatedAt}`, '0.42 0.45 0.50'),

    filledRect(36, 586, 523, 48, '1 0.965 0.73'),
    strokedRect(36, 586, 523, 48, '1 0.83 0'),
    text('F1', 8.5, 51, 615, data.participantType.toUpperCase(), '0.40 0.34 0'),
    text('F2', 16, 51, 595, data.participantName),
    text('F1', 9, 340, 605, data.periodLabel, '0.25 0.27 0.31'),

    ...metrics.map((metric, index) => metricCard(positions[index][0], positions[index][1], metric.label, metric.value)),

    filledRect(36, 190, 523, 54, data.netBalance < 0 ? '1 0.91 0.88' : '0.91 0.98 0.94'),
    strokedRect(36, 190, 523, 54, data.netBalance < 0 ? '0.92 0.30 0.22' : '0.10 0.64 0.38'),
    text('F2', 13, 51, 220, 'RESULTADO DE LA LIQUIDACION', data.netBalance < 0 ? '0.68 0.12 0.08' : '0.05 0.42 0.23'),
    text('F2', 12, 51, 201, balanceMessage, data.netBalance < 0 ? '0.68 0.12 0.08' : '0.05 0.42 0.23'),

    text('F2', 10, 36, 144, 'Trazabilidad y validacion'),
    text('F1', 8.5, 36, 127, 'Documento generado por DomiU Magdalena a partir de pedidos, jornadas y movimientos', '0.42 0.45 0.50'),
    text('F1', 8.5, 36, 114, 'del libro financiero. Todos los valores monetarios estan expresados en pesos COP.', '0.42 0.45 0.50'),
    filledRect(36, 75, 523, 1, '0.88 0.90 0.93'),
    text('F2', 8.5, 36, 56, 'DomiU Magdalena', '0.12 0.13 0.15'),
    text('F1', 8, 136, 56, 'Pide facil, recibe rapido | Documento de uso administrativo', '0.45 0.48 0.53'),
  ].join('');
}

function makePdf(data: BrandedSettlementPdfData, image: { width: number; height: number; bytes: Uint8Array }) {
  const contentBytes = encode(buildContent(data));
  const objects: Uint8Array[] = [];
  objects[1] = encode('<< /Type /Catalog /Pages 2 0 R >>');
  objects[2] = encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects[3] = encode('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 4 0 R >>');
  objects[4] = concatBytes([encode(`<< /Length ${contentBytes.length} >>\nstream\n`), contentBytes, encode('\nendstream')]);
  objects[5] = encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects[6] = encode('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  objects[7] = concatBytes([
    encode(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`),
    image.bytes,
    encode('\nendstream'),
  ]);
  objects[8] = encode(`<< /Title (${ascii(`Liquidacion ${data.participantName}`)}) /Author (DomiU Magdalena) /Creator (DomiU Magdalena) >>`);

  const header = concatBytes([encode('%PDF-1.4\n%'), new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]), encode('\n')]);
  const chunks: Uint8Array[] = [header];
  const offsets = [0];
  let currentOffset = header.length;

  for (let index = 1; index <= 8; index += 1) {
    offsets[index] = currentOffset;
    const chunk = concatBytes([encode(`${index} 0 obj\n`), objects[index], encode('\nendobj\n')]);
    chunks.push(chunk);
    currentOffset += chunk.length;
  }

  const xrefOffset = currentOffset;
  const xref = [
    'xref',
    '0 9',
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    '<< /Size 9 /Root 1 0 R /Info 8 0 R >>',
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  chunks.push(encode(xref));
  return concatBytes(chunks);
}

export async function downloadBrandedSettlementPdf(data: BrandedSettlementPdfData, fileName: string) {
  if (typeof window === 'undefined') throw new Error('El PDF solo puede generarse desde el navegador');
  const image = await logoAsJpeg();
  const bytes = makePdf(data, image);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
