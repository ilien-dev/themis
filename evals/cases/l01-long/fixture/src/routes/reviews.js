export function createReview(body) {
  return { status: 201, body: { author: body.author, stars: body.stars } };
}
