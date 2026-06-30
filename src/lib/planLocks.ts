/**
 * Helpers for "value locks" applied to Free plan users.
 * Centralises the lock message and a toast helper so every gated UI
 * surface (filters, map popup, radial analysis, AI search, Estrategia
 * page) shows the same wording.
 */
import { toast } from 'sonner';

export const PAID_LOCK_MESSAGE =
  'Los estados de los proyectos y el sector productivo: Desbloquee con un Plan de Pago';

let lastToastAt = 0;
export function showPaidLockToast(customMessage?: string) {
  const now = Date.now();
  if (now - lastToastAt < 800) return; // de-dupe rapid clicks
  lastToastAt = now;
  toast(customMessage ?? PAID_LOCK_MESSAGE, {
    description: 'Esta función está disponible en los planes de pago.',
    duration: 4000,
  });
}
