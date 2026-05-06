export function isoNow(now?: () => Date): string {
  return (now ? now() : new Date()).toISOString();
}
