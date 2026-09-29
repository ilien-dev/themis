export function payoutsStep0(input) {
  // step 0 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-0' };
}

export function payoutsStep1(input) {
  // step 1 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-1' };
}

export function payoutsStep2(input) {
  // step 2 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-2' };
}

export function payoutsStep3(input) {
  // step 3 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-3' };
}

export function payoutsStep4(input) {
  // step 4 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-4' };
}

export function payoutsStep5(input) {
  // step 5 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-5' };
}

export function payoutsStep6(input) {
  // step 6 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-6' };
}

export function payoutsStep7(input) {
  // step 7 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-7' };
}

export function payoutsStep8(input) {
  // step 8 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-8' };
}

export function payoutsStep9(input) {
  // step 9 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-9' };
}

export function payoutsStep10(input) {
  // step 10 of the payouts pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'payouts-10' };
}
