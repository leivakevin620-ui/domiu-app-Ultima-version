import { describe, it, expect } from 'vitest';
import { parseManualOrderText } from '../parse-manual-order';

describe('parseManualOrderText', () => {
  it('debe extraer datos del ejemplo 1 (Marta Maetine)', () => {
    const input = 'Marta Maetine Rojas\n3016837146\nConjunto Mirador de la Sierra, Casa 84 (Bodegas Donado)';
    const result = parseManualOrderText(input);

    expect(result.customerName).toBe('Marta Maetine Rojas');
    expect(result.customerPhone).toBe('3016837146');
    expect(result.address).toBe('Conjunto Mirador de la Sierra, Casa 84');
    expect(result.addressNotes).toContain('Bodegas Donado');
    expect(result.neighborhood.toLowerCase()).toContain('mirador');
    expect(result.confidence.customerName).toBeGreaterThanOrEqual(0.8);
    expect(result.confidence.customerPhone).toBeGreaterThanOrEqual(0.9);
    expect(result.warnings).toHaveLength(0);
  });

  it('debe extraer datos del ejemplo 2 (Ibeth con asteriscos)', () => {
    const input = '* Ibeth Ariadna Daza Cárdenas\n* 3115905192\n* Mz M CS 293 VILLA MARBELLA ( 3cer piso)';
    const result = parseManualOrderText(input);

    expect(result.customerName).toBe('Ibeth Ariadna Daza Cárdenas');
    expect(result.customerPhone).toBe('3115905192');
    expect(result.address).toBe('Mz M CS 293 VILLA MARBELLA');
    expect(result.addressNotes).toContain('3cer piso');
    expect(result.neighborhood.toLowerCase()).toContain('villa marbella');
  });

  it('debe manejar mensaje vacío', () => {
    const result = parseManualOrderText('');
    expect(result.warnings).toContain('El texto está vacío');
    expect(result.confidence.customerName).toBe(0);
    expect(result.confidence.customerPhone).toBe(0);
  });

  it('debe manejar mensaje sin teléfono', () => {
    const result = parseManualOrderText('Cliente sin número\nDirección cualquiera');
    expect(result.warnings.some(w => w.toLowerCase().includes('teléfono'))).toBe(true);
    expect(result.customerPhone).toBe('');
  });

  it('debe limpiar espacios raros', () => {
    const input = '  Juan  Pérez   \n  3001234567  \n  Calle  10 #20-30  ';
    const result = parseManualOrderText(input);
    expect(result.customerName).toBe('Juan Pérez');
    expect(result.customerPhone).toBe('3001234567');
    expect(result.address).toBe('Calle 10 #20-30');
  });

  it('debe detectar barrios conocidos en la dirección', () => {
    const testCases = [
      { input: 'Cliente\n3001112233\nCalle 10 Villa Marbella', expected: 'Villa Marbella' },
      { input: 'Cliente\n3001112233\nCra 5 Mirador de la Sierra', expected: 'Mirador de la Sierra' },
      { input: 'Cliente\n3001112233\nCentro histórico', expected: 'Centro' },
      { input: 'Cliente\n3001112233\nRodadero carrera 1', expected: 'Rodadero' },
    ];

    for (const { input, expected } of testCases) {
      const result = parseManualOrderText(input);
      expect(result.neighborhood.toLowerCase()).toBe(expected.toLowerCase());
    }
  });

  it('debe devolver barrio vacío si no se detecta', () => {
    const result = parseManualOrderText('Cliente\n3001112233\nDirección genérica');
    expect(result.neighborhood).toBe('');
  });

  it('no debe inventar datos cuando faltan', () => {
    const result = parseManualOrderText('Solo un texto corto');
    expect(result.customerName).toBe('Solo un texto corto');
    expect(result.customerPhone).toBe('');
    expect(result.address).toBe('');
  });

  it('debe manejar emojis', () => {
    const input = '😊 María López\n📱 3001234567\n🏠 Calle 10 #20-30 😊';
    const result = parseManualOrderText(input);
    expect(result.customerName).toBe('María López');
    expect(result.customerPhone).toBe('3001234567');
    expect(result.address).toBe('Calle 10 #20-30');
  });

  it('debe manejar teléfono en primera línea', () => {
    const result = parseManualOrderText('3001234567\nJuan Pérez\nDirección de prueba');
    // With phone on line 0, name should try line 1
    expect(result.customerName).toBe('Juan Pérez');
    expect(result.customerPhone).toBe('3001234567');
  });
});
