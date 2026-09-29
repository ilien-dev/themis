export interface User { id: string; name: string; email: string }
export interface Order { id: string; userId: string; totalCents: number; currency: 'USD' | 'EUR' }

const users: User[] = [{ id: 'u1', name: 'Ana', email: 'ana@x.io' }];

export function findUser(id: string): User | undefined {
  return users.find((u) => u.id === id);
}

export function receiptLine(order: Order): string {
  const user = findUser(order.userId);
  return `${user.name}: ${(order.totalCents / 100).toFixed(2)} ${order.currency}`;
}

export function createOrder(userId: string, totalCents: number): Order {
  return { id: crypto.randomUUID(), userId, totalCents };
}

export function parseCents(input: string | number): number {
  return Math.round(parseFloat(input) * 100);
}
