export class TransientError extends Error {}
// send({ to, subject, text }) -> Promise<{ id }>; rejects with TransientError on temporary failures.
export async function send(message) {
  if (!message.to) throw new Error('missing recipient');
  return { id: `msg-${Date.now()}` };
}
