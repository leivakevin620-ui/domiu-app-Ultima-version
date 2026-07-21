import { ManualOrderWorkspace } from '@/components/manual-orders/ManualOrderWorkspace';
import { PackagePlus } from 'lucide-react';

export const metadata = {
  title: 'Crear pedido manual - DomiU Admin',
  description: 'Registrar pedidos externos con productos, cliente invitado, entrega, pago y auditoría',
};

export default function CrearPedidoManualAdminPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
          <PackagePlus className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Crear pedido manual</h1>
          <p className="text-sm text-muted-foreground">
            Registra pedidos recibidos por WhatsApp, llamada, atención presencial o redes sociales.
          </p>
        </div>
      </div>

      <ManualOrderWorkspace panel="admin" />
    </div>
  );
}
