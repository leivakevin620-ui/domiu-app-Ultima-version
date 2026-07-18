import { formatCOPCompact } from '@/lib/formatters/currency';

export type SettlementExportRow = {
  date: string;
  orderNumber: string;
  concept: string;
  direction: string;
  amount: number;
  status: string;
};

export type SettlementExportData = {
  title: string;
  participantName: string;
  participantType: 'business' | 'courier';
  periodStart: string;
  periodEnd: string;
  openedAt?: string | null;
  closedAt?: string | null;
  onlineSeconds?: number;
  ordersCount: number;
  deliveryFees: number;
  productSales?: number;
  serviceFees?: number;
  courierEarnings: number;
  companyOwesParticipant: number;
  participantOwesCompany: number;
  netBalance: number;
  rows: SettlementExportRow[];
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function xml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function dateLabel(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hoursLabel(seconds = 0) {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60));
  return `${Math.floor(totalMinutes / 60)} h ${totalMinutes % 60} min`;
}

export function downloadSettlementExcel(data: SettlementExportData) {
  const summaryRows = [
    ['Participante', data.participantName],
    ['Perfil', data.participantType === 'courier' ? 'Repartidor' : 'Comercio'],
    ['Periodo desde', dateLabel(data.periodStart)],
    ['Periodo hasta', dateLabel(data.periodEnd)],
    ['Apertura de jornada', dateLabel(data.openedAt)],
    ['Cierre de jornada', dateLabel(data.closedAt)],
    ['Tiempo en línea', hoursLabel(data.onlineSeconds)],
    ['Pedidos realizados', data.ordersCount],
    ['Ventas de productos', data.productSales ?? 0],
    ['Valor total domicilios', data.deliveryFees],
    ['Tarifas de servicio', data.serviceFees ?? 0],
    ['Ganancia neta repartidor', data.courierEarnings],
    ['DomiU debe al participante', data.companyOwesParticipant],
    ['Participante debe a DomiU', data.participantOwesCompany],
    ['Saldo neto', data.netBalance],
  ];

  const summaryXml = summaryRows.map(([label, value]) => {
    const numeric = typeof value === 'number';
    return `<Row><Cell><Data ss:Type="String">${xml(label)}</Data></Cell><Cell ss:StyleID="${numeric ? 'Money' : 'Text'}"><Data ss:Type="${numeric ? 'Number' : 'String'}">${xml(value)}</Data></Cell></Row>`;
  }).join('');

  const detailXml = data.rows.map((row) => `<Row><Cell><Data ss:Type="String">${xml(dateLabel(row.date))}</Data></Cell><Cell><Data ss:Type="String">${xml(row.orderNumber)}</Data></Cell><Cell><Data ss:Type="String">${xml(row.concept)}</Data></Cell><Cell><Data ss:Type="String">${xml(row.direction)}</Data></Cell><Cell ss:StyleID="Money"><Data ss:Type="Number">${row.amount}</Data></Cell><Cell><Data ss:Type="String">${xml(row.status)}</Data></Cell></Row>`).join('');

  const workbook = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Bottom"/><Font ss:FontName="Arial" ss:Size="10"/></Style><Style ss:ID="Title"><Font ss:FontName="Arial" ss:Size="16" ss:Bold="1"/></Style><Style ss:ID="Header"><Font ss:Bold="1"/><Interior ss:Color="#FFD400" ss:Pattern="Solid"/></Style><Style ss:ID="Money"><NumberFormat ss:Format="#,##0"/></Style><Style ss:ID="Text"/></Styles>
<Worksheet ss:Name="Resumen"><Table><Column ss:Width="180"/><Column ss:Width="220"/><Row><Cell ss:MergeAcross="1" ss:StyleID="Title"><Data ss:Type="String">${xml(data.title)}</Data></Cell></Row>${summaryXml}</Table></Worksheet>
<Worksheet ss:Name="Movimientos"><Table><Column ss:Width="120"/><Column ss:Width="130"/><Column ss:Width="240"/><Column ss:Width="180"/><Column ss:Width="100"/><Column ss:Width="90"/><Row>${['Fecha','Pedido','Concepto','Dirección','Valor COP','Estado'].map((label) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${label}</Data></Cell>`).join('')}</Row>${detailXml}</Table></Worksheet>
</Workbook>`;

  downloadBlob(
    new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }),
    `${safeFileName(data.title)}-${safeFileName(data.participantName)}.xls`,
  );
}

function ascii(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function pdfEscape(value: string) {
  return ascii(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(value: string, width = 88) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > width && current) {
      lines.push(current);
      current = word;
    } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

function buildPdf(lines: string[]) {
  const pageLines = 48;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageLines) pages.push(lines.slice(index, index + pageLines));
  if (!pages.length) pages.push(['Sin movimientos']);

  const objects = new Map<number, string>();
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  const pageIds: number[] = [];
  const contentIds: number[] = [];

  pages.forEach((page, index) => {
    const pageId = 4 + index * 2;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    contentIds.push(contentId);
    const stream = `BT\n/F1 10 Tf\n45 750 Td\n14 TL\n${page.map((line) => `(${pdfEscape(line)}) Tj\nT*`).join('\n')}\nET`;
    objects.set(contentId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    objects.set(pageId, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });

  objects.set(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  objects.set(pagesId, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const maxId = Math.max(...objects.keys());
  let pdf = '%PDF-1.4\n';
  const offsets = new Array(maxId + 1).fill(0);
  for (let id = 1; id <= maxId; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id += 1) pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export function downloadSettlementPdf(data: SettlementExportData) {
  const lines = [
    'DOMIU MAGDALENA',
    data.title.toUpperCase(),
    '',
    `Participante: ${data.participantName}`,
    `Perfil: ${data.participantType === 'courier' ? 'Repartidor' : 'Comercio'}`,
    `Periodo: ${dateLabel(data.periodStart)} - ${dateLabel(data.periodEnd)}`,
    `Apertura: ${dateLabel(data.openedAt)}`,
    `Cierre: ${dateLabel(data.closedAt)}`,
    `Tiempo en linea: ${hoursLabel(data.onlineSeconds)}`,
    `Pedidos: ${data.ordersCount}`,
    `Ventas de productos: ${formatCOPCompact(data.productSales ?? 0)} COP`,
    `Valor domicilios: ${formatCOPCompact(data.deliveryFees)} COP`,
    `Tarifas de servicio: ${formatCOPCompact(data.serviceFees ?? 0)} COP`,
    `Ganancia neta repartidor: ${formatCOPCompact(data.courierEarnings)} COP`,
    `DomiU debe al participante: ${formatCOPCompact(data.companyOwesParticipant)} COP`,
    `Participante debe a DomiU: ${formatCOPCompact(data.participantOwesCompany)} COP`,
    `Saldo neto: ${formatCOPCompact(data.netBalance)} COP`,
    '',
    'DETALLE DE MOVIMIENTOS',
    ...data.rows.flatMap((row) => wrapText(`${dateLabel(row.date)} | ${row.orderNumber} | ${row.concept} | ${row.direction} | ${formatCOPCompact(row.amount)} COP | ${row.status}`)),
    '',
    'Documento generado por DomiU Magdalena. Los valores provienen del libro financiero del pedido.',
  ];
  const pdf = buildPdf(lines);
  downloadBlob(new Blob([pdf], { type: 'application/pdf' }), `${safeFileName(data.title)}-${safeFileName(data.participantName)}.pdf`);
}
