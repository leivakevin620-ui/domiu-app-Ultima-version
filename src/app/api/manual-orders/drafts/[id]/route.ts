import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteManualOrderDraft } from '@/lib/manual-orders/service';
import {
  ManualOrderError,
  assertSameOrigin,
  consumeManualOrderRateLimit,
  manualOrderResponseHeaders,
  requireManualOrderActor,
} from '@/lib/manual-orders/security';
import { getServiceClient } from '@/lib/db/supabase';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const actor = await requireManualOrderActor();
    await consumeManualOrderRateLimit({
      supabase: getServiceClient(),
      actor,
      action: 'draft',
      limit: 30,
    });
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) {
      throw new ManualOrderError('Borrador no válido.', 400, 'invalid_draft_id');
    }
    await deleteManualOrderDraft(actor, id);
    return NextResponse.json({ success: true, id }, { headers: manualOrderResponseHeaders() });
  } catch (cause) {
    const error = cause instanceof ManualOrderError
      ? cause
      : new ManualOrderError('No se pudo eliminar el borrador.', 500, 'draft_delete_failed');
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: manualOrderResponseHeaders() },
    );
  }
}
