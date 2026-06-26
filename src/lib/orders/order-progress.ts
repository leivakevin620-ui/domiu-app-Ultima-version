const STATUS_PROGRESS: Record<string, number> = {
  assigned: 10,
  accepted: 30,
  picked_up: 55,
  in_transit: 80,
  delivered: 100,
};

const STATUS_ACTIONS: Record<string, { label: string; nextStatus: string } | null> = {
  assigned: { label: 'Marcar como Recogido', nextStatus: 'picked_up' },
  accepted: { label: 'Marcar como Recogido', nextStatus: 'picked_up' },
  picked_up: { label: 'En Camino', nextStatus: 'in_transit' },
  in_transit: { label: 'Marcar como Entregado', nextStatus: 'delivered' },
  delivered: null,
};

const VALID_TRANSITIONS: Record<string, string[]> = {
  assigned: ['picked_up'],
  accepted: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
};

export function getCourierMissionStep(order: { status: string; delivery_status?: string }): string {
  return order.delivery_status ?? order.status;
}

export function getCourierMissionProgress(order: { status: string; delivery_status?: string }): number {
  const status = getCourierMissionStep(order);
  return STATUS_PROGRESS[status] ?? 0;
}

export function getNextCourierAction(order: { status: string; delivery_status?: string }): { label: string; nextStatus: string } | null {
  const status = getCourierMissionStep(order);
  return STATUS_ACTIONS[status] ?? null;
}

export function canCourierTransition(order: { status: string; delivery_status?: string }, action: string): boolean {
  const status = getCourierMissionStep(order);
  const allowed = VALID_TRANSITIONS[status];
  if (!allowed) return false;
  return allowed.includes(action);
}

export function getMissionSteps() {
  return [
    { key: 'assigned', label: 'Asignado', progress: 10 },
    { key: 'picked_up', label: 'Recogido', progress: 55 },
    { key: 'in_transit', label: 'En camino', progress: 80 },
    { key: 'delivered', label: 'Entregado', progress: 100 },
  ];
}
