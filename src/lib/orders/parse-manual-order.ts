export interface ParsedOrderText {
  customerName: string;
  customerPhone: string;
  address: string;
  neighborhood: string;
  addressNotes: string;
  rawText: string;
  confidence: {
    customerName: number;
    customerPhone: number;
    address: number;
    neighborhood: number;
  };
  warnings: string[];
}

const KNOWN_NEIGHBORHOODS = [
  'villa marbella', 'mirador de la sierra', 'centro', 'rodadero', 'gaira',
  'mamatoco', 'norte', 'sur', 'bastidas', 'pescaito', 'maria eugenia',
  'ciudad equidad', 'once de noviembre', 'timayui', 'bonda', 'taganga',
  'santa marta', 'bello horizonte', 'los almendros', 'el prado',
  'altos de villa marbella', 'la castellana', 'betel', 'troncal del caribe',
];

function cleanLine(line: string): string {
  return line
    .replace(/^[\s\*\-•·▪▸→⇒]+/, '')
    .replace(/[\s\*\-•·▪▸→⇒]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .trim();
}

function extractPhone(text: string): string | null {
  const phoneRegex = /\b3\d{9}\b/;
  const match = text.match(phoneRegex);
  return match ? match[0] : null;
}

function extractParenthesizedNotes(line: string): { clean: string; notes: string } {
  const parenMatch = line.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const notes = parenMatch[1].trim();
    const clean = line.replace(/\([^)]+\)/, '').trim();
    return { clean, notes };
  }
  return { clean: line, notes: '' };
}

function detectNeighborhood(text: string): string | null {
  const lower = text.toLowerCase();
  for (const hood of KNOWN_NEIGHBORHOODS) {
    if (lower.includes(hood)) {
      return hood.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  return null;
}

export function parseManualOrderText(rawText: string): ParsedOrderText {
  const warnings: string[] = [];
  const trimmed = rawText.trim();

  if (!trimmed) {
    return {
      customerName: '',
      customerPhone: '',
      address: '',
      neighborhood: '',
      addressNotes: '',
      rawText: '',
      confidence: { customerName: 0, customerPhone: 0, address: 0, neighborhood: 0 },
      warnings: ['El texto está vacío'],
    };
  }

  if (trimmed.length < 10) {
    warnings.push('El texto es muy corto, puede faltar información');
  }

  const lines = trimmed.split('\n').map(cleanLine).filter(Boolean);

  let customerName = '';
  let customerPhone = '';
  let address = '';
  let addressNotes = '';
  let phoneLineIndex = -1;

  phoneLineIndex = lines.findIndex(l => extractPhone(l) !== null);

  if (phoneLineIndex === -1) {
    warnings.push('No se detectó un número de teléfono válido. Verifica manualmente.');
    customerPhone = '';
  } else {
    customerPhone = extractPhone(lines[phoneLineIndex]) || '';
  }

  if (phoneLineIndex > 0) {
    customerName = lines[phoneLineIndex - 1];
  } else if (phoneLineIndex === -1 && lines.length > 0) {
    customerName = lines[0];
    warnings.push('No se pudo identificar el nombre automáticamente');
  } else if (phoneLineIndex === 0) {
    if (lines.length > 1) {
      customerName = lines[1];
    }
    warnings.push('El teléfono está en la primera línea. Verifica el nombre.');
  }

  if (phoneLineIndex >= 0 && phoneLineIndex + 1 < lines.length) {
    const rawAddressLine = lines[phoneLineIndex + 1];
    const { clean: addrClean, notes } = extractParenthesizedNotes(rawAddressLine);
    address = addrClean;
    addressNotes = notes;

    if (phoneLineIndex + 2 < lines.length) {
      const extraNotes = lines.slice(phoneLineIndex + 2).join('; ');
      if (addressNotes) {
        addressNotes += '; ' + extraNotes;
      } else {
        addressNotes = extraNotes;
      }
    }
  } else if (phoneLineIndex === -1 && lines.length >= 2) {
    address = lines[lines.length - 1];
  }

  if (!customerName) {
    warnings.push('No se pudo detectar el nombre del cliente');
  }
  if (!address) {
    warnings.push('No se pudo detectar la dirección');
  }

  const allText = lines.join(' ');
  const detectedNeighborhood = detectNeighborhood(allText);
  let neighborhoodConfidence = 0;
  if (detectedNeighborhood) {
    const fullMatch = allText.toLowerCase().includes(detectedNeighborhood.toLowerCase());
    neighborhoodConfidence = fullMatch ? 0.9 : 0.5;
  }

  return {
    customerName,
    customerPhone,
    address,
    neighborhood: detectedNeighborhood || '',
    addressNotes,
    rawText: trimmed,
    confidence: {
      customerName: customerName ? (phoneLineIndex > 0 ? 0.9 : 0.5) : 0,
      customerPhone: customerPhone ? 0.95 : 0,
      address: address ? 0.8 : 0,
      neighborhood: neighborhoodConfidence,
    },
    warnings,
  };
}
