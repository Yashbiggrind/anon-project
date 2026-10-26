const QUEUE_KEY = "anon_offline_queue";
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_QUEUE_ITEMS = 100;

export type QueuedMessage = {
  id: string;
  content: string;
  createdAt: number;
};

function isQueuedMessage(value: unknown): value is QueuedMessage {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<QueuedMessage>;
  return typeof item.id === "string" &&
    item.id.length > 0 &&
    typeof item.content === "string" &&
    item.content.length > 0 &&
    typeof item.createdAt === "number" &&
    Number.isFinite(item.createdAt) &&
    item.createdAt > 0;
}

function read(): QueuedMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(QUEUE_KEY);
      return [];
    }

    const cutoff = Date.now() - QUEUE_TTL_MS;
    const valid = parsed
      .filter(isQueuedMessage)
      .filter((item) => item.createdAt >= cutoff && item.createdAt <= Date.now())
      .slice(-MAX_QUEUE_ITEMS);

    // Purge expired and malformed queue entries from persistent browser storage.
    if (valid.length !== parsed.length) write(valid);
    return valid;
  } catch {
    return [];
  }
}

function write(arr: QueuedMessage[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr.slice(-MAX_QUEUE_ITEMS)));
    return true;
  } catch {
    return false;
  }
}

export function enqueue(content: string): QueuedMessage {
  const normalized = String(content || "").trim();
  if (!normalized) throw new Error("Cannot queue an empty message.");
  if (normalized.length > 1000) throw new Error("Message is too long to queue.");

  const queue = read();
  if (queue.length >= MAX_QUEUE_ITEMS) {
    throw new Error("The offline queue is full. Reconnect and send queued messages before adding more.");
  }

  const msg: QueuedMessage = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36),
    content: normalized,
    createdAt: Date.now(),
  };
  queue.push(msg);
  if (!write(queue)) {
    throw new Error("Browser storage is unavailable or full. Connect to send this message without queuing it.");
  }
  return msg;
}

export function list(): QueuedMessage[] {
  return read();
}

export function remove(id: string): void {
  write(read().filter((message) => message.id !== id));
}

export function clear(): void {
  write([]);
}
