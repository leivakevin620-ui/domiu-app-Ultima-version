import { ManualOrderWizard } from '@/components/manual-orders/ManualOrderWizard';

export const metadata = {
  title: 'Crear pedido manual - DomiU Admin',
  description: 'Registrar pedidos externos con productos, inventario y auditoría.',
};

export default function AdminManualOrderPage() {
  return <ManualOrderWizard mode="admin" />;
}
