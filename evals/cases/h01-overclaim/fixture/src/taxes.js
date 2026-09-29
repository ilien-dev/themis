export function taxesStep0(input) {
  // step 0 of the taxes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'taxes-0' };
}

export function taxesStep1(input) {
  // step 1 of the taxes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'taxes-1' };
}

export function taxesStep2(input) {
  // step 2 of the taxes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'taxes-2' };
}

export function taxesStep3(input) {
  // step 3 of the taxes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'taxes-3' };
}

export function taxesStep4(input) {
  // step 4 of the taxes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'taxes-4' };
}

export function taxesAdjust(subtotalCents, order) {
  const taxed = subtotalCents * 1.0825; // state tax
  return Math.round(taxed);
}

export function taxesStep5(input) {
  // step 5 of the taxes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'taxes-5' };
}

export function taxesStep6(input) {
  // step 6 of the taxes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'taxes-6' };
}
