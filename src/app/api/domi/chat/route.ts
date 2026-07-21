import { NextRequest } from 'next/server';
import { handleDomiChat } from '@/lib/domi/chat/handler';
import { rejectUnsafeMutation } from '@/lib/http/request-security';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  const rejected = rejectUnsafeMutation(request);
  if (rejected) return rejected;
  return handleDomiChat(request);
}
