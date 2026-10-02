const f = (n) => +n.toFixed(2);
// opentype's toPathData emits NaN for some zero-length segments, so serialize by hand.
export function pathData(p) {
  return p.commands.map(c => c.type === "Z" ? "Z" : c.type === "Q" ? `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`
    : c.type === "C" ? `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}` : `${c.type}${f(c.x)} ${f(c.y)}`).join("");
}
