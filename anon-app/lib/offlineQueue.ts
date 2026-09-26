const QUEUE_KEY = "anon_offline_queue";

export type QueuedMessage = {
  id: string;
  content: string;
  createdAt: number;
};

function read(): QueuedMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedMessage[]) : [];
  } catch {
    return [];
  }
}
function write(arr: QueuedMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(arr));
  } catch {}
}

export function enqueue(content: string): QueuedMessage {
  const msg: QueuedMessage = {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    content,
    createdAt: Date.now(),
  };
  const q = read();
  q.push(msg);
  write(q);
  return msg;
}
export function list(): QueuedMessage[] {
  return read();
}
export function remove(id: string) {
  write(read().filter((m) => m.id !== id));
}
export function clear() {
  write([]);
}