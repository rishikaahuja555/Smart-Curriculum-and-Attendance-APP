const buckets = new Map();

export function rateLimit({ key, maxRequests = 30, windowMs = 60_000 }) {
  const record = () => {
    const now = Date.now();
    const entry = buckets.get(key) || [];
    const recent = entry.filter((timestamp) => now - timestamp < windowMs);
    recent.push(now);
    buckets.set(key, recent);
    return recent.length <= maxRequests;
  };

  return {
    check() {
      return record();
    }
  };
}
