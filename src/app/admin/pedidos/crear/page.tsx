import { ManualOrderForm } from '@/components/admin/manual-order/ManualOrderForm';
import { Package } from 'lucide-react';

export const metadata = {
  title: 'Crear Pedido Manual - DomiU Admin',
  description: 'Crear pedidos manualmente desde WhatsApp o datos del cliente',
};

export default function CrearPedidoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Crear Pedido</h1>
          <p className="text-sm text-muted-foreground">
            Crea pedidos manualmente desde WhatsApp o ingresa los datos del cliente
          </p>
        </div>
      </div>

      <ManualOrderForm />
    </div>
  );
}
