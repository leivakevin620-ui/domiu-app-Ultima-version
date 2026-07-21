import { ManualOrderWizard } from '@/components/manual-orders/ManualOrderWizard';

export const metadata = {
  title: 'Crear pedido manual - DomiU Negocio',
  description: 'Registrar pedidos recibidos fuera de la aplicación del cliente.',
};

export default function MerchantManualOrderPage() {
  return <ManualOrderWizard mode="merchant" />;
}
