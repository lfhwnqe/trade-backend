import { BadRequestException } from '@nestjs/common';

export function notification(body: unknown): {
  payload: Record<string, unknown>;
  eventId?: string;
} {
  const payload = typeof body === 'string' ? { message: body } : body;
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !Object.keys(payload).length ||
    (typeof body === 'string' && !body.trim()) ||
    Buffer.byteLength(JSON.stringify(payload)) > 8192
  ) {
    throw new BadRequestException(
      'Notification must be a non-empty JSON object or text, at most 8 KiB',
    );
  }
  const eventId = (payload as any).event_id;
  if (
    eventId !== undefined &&
    (typeof eventId !== 'string' || !eventId.trim() || eventId.length > 120)
  ) {
    throw new BadRequestException(
      'event_id must be a non-empty string, at most 120 characters',
    );
  }
  return { payload: payload as Record<string, unknown>, eventId };
}

// Object property ordering must not turn a retried event into a conflict.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + canonical(value[key]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export function taskId(value: string): string {
  if (!/^[a-f0-9]{64}$/.test(value || ''))
    throw new BadRequestException('Invalid taskId');
  return value;
}
