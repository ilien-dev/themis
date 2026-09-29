export function createComment(body) {
  return { status: 201, body: { text: body.text, postId: body.postId } };
}
