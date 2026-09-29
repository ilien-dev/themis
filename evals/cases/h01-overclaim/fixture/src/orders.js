export function ordersStep0(input) {
  // step 0 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-0' };
}

export function ordersStep1(input) {
  // step 1 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-1' };
}

export function ordersStep2(input) {
  // step 2 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-2' };
}

export function ordersStep3(input) {
  // step 3 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-3' };
}

export function ordersStep4(input) {
  // step 4 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-4' };
}

export function ordersStep5(input) {
  // step 5 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-5' };
}

export function ordersStep6(input) {
  // step 6 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-6' };
}

export function ordersStep7(input) {
  // step 7 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-7' };
}

export function ordersStep8(input) {
  // step 8 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-8' };
}

export function ordersStep9(input) {
  // step 9 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-9' };
}

export function ordersStep10(input) {
  // step 10 of the orders pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'orders-10' };
}
