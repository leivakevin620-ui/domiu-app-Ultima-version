import { type NotificationData } from '@/services/notifications';
import { type ActiveOrderDetail, type DailyEarningPoint } from '@/services/courier-pro';

export const COVERAGE_ZONES = [
  { id: 'centro', name: 'Centro', active: true },
  { id: 'norte', name: 'Norte', active: true },
  { id: 'sur', name: 'Sur', active: true },
  { id: 'rodadero', name: 'Rodadero', active: true },
  { id: 'gaira', name: 'Gaira', active: false },
  { id: 'mamatoco', name: 'Mamatoco', active: false },
];

export const VEHICLE_TYPES: Record<string, string> = {
  motorcycle: 'Motocicleta',
  bike: 'Bicicleta',
  car: 'Carro',
  van: 'Camioneta',
};

export const VEHICLE_BRANDS: Record<string, string[]> = {
  motorcycle: ['Yamaha', 'Honda', 'Suzuki', 'Bajaj', 'AKT', 'Victory', 'Kymco'],
  bike: ['GW', 'Specialized', 'Trek', 'Merida', 'Oxford', 'Mountain Lion'],
  car: ['Renault', 'Chevrolet', 'Mazda', 'Nissan', 'Suzuki', 'Kia', 'Hyundai', 'Toyota'],
  van: ['Renault', 'Chevrolet', 'Toyota', 'Mitsubishi', 'DFSK', 'JAC'],
};

export const DOCUMENT_TYPES = [
  { key: 'id', label: 'Documento de identidad', status: 'verified' as const, icon: 'IdCard' },
  { key: 'license', label: 'Licencia de conducción', status: 'verified' as const, icon: 'FileCheck2' },
  { key: 'soat', label: 'SOAT', status: 'pending' as const, icon: 'Shield' },
  { key: 'tecnomecanica', label: 'Técnico mecánica', status: 'pending' as const, icon: 'Gauge' },
  { key: 'vehicle_photo', label: 'Foto del vehículo', status: 'verified' as const, icon: 'Camera' },
  { key: 'bank_account', label: 'Cuenta bancaria', status: 'pending' as const, icon: 'Wallet' },
];

export function fallbackEarningsHistory(): DailyEarningPoint[] {
  const days: DailyEarningPoint[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const total = 30000 + Math.random() * 60000;
    days.push({
      date,
      base: total * 0.7,
      tips: total * 0.18,
      bonuses: total * 0.12,
      total: Math.round(total),
    });
  }
  return days;
}

export function fallbackNotifications(userId: string): NotificationData[] {
  return [
    {
      id: 'n1', recipient_id: userId, sender_id: null, notification_type: 'assignment',
      title: 'Nuevo pedido asignado', message: 'Pedido #9821 de Restaurante La Esquina',
      description: 'Dirígete al restaurante para recoger el pedido', image_url: null,
      action_url: '/repartidor/pedidos', order_id: null, reference_id: null,
      reference_type: null, is_read: false, read_at: null, created_at: new Date().toISOString(),
    },
    {
      id: 'n2', recipient_id: userId, sender_id: null, notification_type: 'incentive',
      title: 'Incentivo activo', message: 'Gana $15.000 por cada entrega en hora pico (12:00-14:00)',
      description: null, image_url: null, action_url: '/repartidor/ganancias',
      order_id: null, reference_id: null, reference_type: null,
      is_read: false, read_at: null, created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'n3', recipient_id: userId, sender_id: null, notification_type: 'system',
      title: 'Documento próximo a vencer', message: 'Tu SOAT vence en 15 días. Actualízalo para seguir operando.',
      description: null, image_url: null, action_url: '/repartidor/perfil',
      order_id: null, reference_id: null, reference_type: null,
      is_read: true, read_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'n4', recipient_id: userId, sender_id: null, notification_type: 'message',
      title: 'Mensaje del cliente', message: 'Por favor llegar por la puerta principal',
      description: null, image_url: null, action_url: null,
      order_id: null, reference_id: null, reference_type: null,
      is_read: false, read_at: null, created_at: new Date(Date.now() - 7200000).toISOString(),
    },
  ];
}

export function fallbackActiveOrder(): ActiveOrderDetail {
  return {
    id: 'order-mock-1', orderNumber: 'DU-9821', customerName: 'María García',
    customerPhone: '+57 300 123 4567', customerPhoto: null,
    businessName: 'Restaurante La Esquina', businessPhone: '+57 301 987 6543',
    businessAddress: 'Cra 5 #20-30, Centro', businessPhoto: null,
    deliveryAddress: 'Calle 10 #15-25, Norte', specialInstructions: 'Llamar antes de llegar',
    distance: 2.8, estimatedTime: 12, commission: 3500, paymentMethod: 'Tarjeta',
    totalAmount: 42000, tip: 3000,
    items: [{ name: 'Hamburguesa Clásica', quantity: 2, price: 15000 }, { name: 'Papas Fritas', quantity: 1, price: 7000 }, { name: 'Gaseosa', quantity: 2, price: 2500 }],
    status: 'picked_up', businessLat: 11.242, businessLng: -74.198, customerLat: 11.248, customerLng: -74.193,
  };
}

export function fallbackRecentDeliveries() {
  return [
    { id: 'd1', orderNumber: 'DU-9810', businessName: 'Pizza Italia', status: 'delivered' as const, deliveredAt: new Date(Date.now() - 7200000).toISOString(), amount: 6500, rating: 5 },
    { id: 'd2', orderNumber: 'DU-9805', businessName: 'Sushi Bar', status: 'delivered' as const, deliveredAt: new Date(Date.now() - 14400000).toISOString(), amount: 8200, rating: 4 },
    { id: 'd3', orderNumber: 'DU-9798', businessName: 'Asados Don Carlos', status: 'delivered' as const, deliveredAt: new Date(Date.now() - 21600000).toISOString(), amount: 7500, rating: 5 },
    { id: 'd4', orderNumber: 'DU-9782', businessName: 'Comida China Express', status: 'delivered' as const, deliveredAt: new Date(Date.now() - 36000000).toISOString(), amount: 5800, rating: 4 },
    { id: 'd5', orderNumber: 'DU-9770', businessName: 'Café del Parque', status: 'cancelled' as const, deliveredAt: new Date(Date.now() - 46800000).toISOString(), amount: 0, rating: 0 },
  ];
}

export function getDayName(dayIndex: number): string {
  return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][dayIndex] || '';
}

export function getDeliveryStatusColor(status: string): string {
  switch (status) {
    case 'delivered': return 'text-emerald-600 bg-emerald-50';
    case 'cancelled': return 'text-red-600 bg-red-50';
    case 'pending': return 'text-amber-600 bg-amber-50';
    case 'assigned': return 'text-blue-600 bg-blue-50';
    case 'picked_up': return 'text-indigo-600 bg-indigo-50';
    case 'in_transit': return 'text-purple-600 bg-purple-50';
    default: return 'text-slate-600 bg-slate-50';
  }
}

export function getRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Hace ${days}d`;
}

export function getDeliveryStatusLabel(status: string): string {
  switch (status) {
    case 'delivered': return 'Entregado';
    case 'cancelled': return 'Cancelado';
    case 'pending': return 'Pendiente';
    case 'assigned': return 'Asignado';
    case 'picked_up': return 'Recogido';
    case 'in_transit': return 'En camino';
    default: return status;
  }
}
