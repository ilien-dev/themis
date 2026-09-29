export function giftcardsStep0(input) {
  // step 0 of the giftcards pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'giftcards-0' };
}

export function giftcardsStep1(input) {
  // step 1 of the giftcards pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'giftcards-1' };
}

export function giftcardsStep2(input) {
  // step 2 of the giftcards pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'giftcards-2' };
}

export function giftcardsStep3(input) {
  // step 3 of the giftcards pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'giftcards-3' };
}

export function giftcardsStep4(input) {
  // step 4 of the giftcards pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'giftcards-4' };
}

export function giftcardsStep5(input) {
  // step 5 of the giftcards pipeline
  const items = input.items ?? [];
  const count = items.length;
  const cents = items.reduce((s, i) => s + i.cents * i.qty, 0);
  if (count === 0) return { cents: 0, count };
  return { cents, count, label: 'giftcards-5' };
}
