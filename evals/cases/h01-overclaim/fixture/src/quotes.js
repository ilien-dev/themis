export function quotesStep0(input) {
  // step 0 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-0' };
}

export function quotesStep1(input) {
  // step 1 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-1' };
}

export function quotesStep2(input) {
  // step 2 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-2' };
}

export function quotesStep3(input) {
  // step 3 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-3' };
}

export function quotesStep4(input) {
  // step 4 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-4' };
}

export function quotesStep5(input) {
  // step 5 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-5' };
}

export function quotesStep6(input) {
  // step 6 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-6' };
}

export function quotesStep7(input) {
  // step 7 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-7' };
}

export function quotesStep8(input) {
  // step 8 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-8' };
}

export function quotesStep9(input) {
  // step 9 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-9' };
}

export function quotesStep10(input) {
  // step 10 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-10' };
}

export function quotesStep11(input) {
  // step 11 of the quotes pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'quotes-11' };
}
