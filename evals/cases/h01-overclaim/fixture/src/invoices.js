export function invoicesStep0(input) {
  // step 0 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-0' };
}

export function invoicesStep1(input) {
  // step 1 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-1' };
}

export function invoicesStep2(input) {
  // step 2 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-2' };
}

export function invoicesStep3(input) {
  // step 3 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-3' };
}

export function invoicesStep4(input) {
  // step 4 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-4' };
}

export function invoicesStep5(input) {
  // step 5 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-5' };
}

export function invoicesStep6(input) {
  // step 6 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-6' };
}

export function invoicesStep7(input) {
  // step 7 of the invoices pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'invoices-7' };
}
