Add `formatDuration(ms, options)` to `src/duration.js` and export it from `src/index.js`.

Behavior:

1. `ms` is a number of milliseconds. Non-numbers, `NaN` and infinities throw a `TypeError` whose message is exactly `formatDuration: ms must be a finite number`.
2. Units, largest first: days (`d`), hours (`h`), minutes (`m`), seconds (`s`), milliseconds (`ms`).
3. The output lists non-zero units from largest to smallest, separated by a single space: `formatDuration(90061001)` → `"1d 1h 1m 1s 1ms"`.
4. Zero-valued units in the middle are skipped: `formatDuration(3600001)` → `"1h 1ms"`.
5. `formatDuration(0)` → `"0ms"`.
6. Negative durations format the absolute value with a leading `-` on the whole string: `formatDuration(-61000)` → `"-1m 1s"`. `-0` formats as `"0ms"`.
7. Fractional milliseconds are rounded half away from zero before splitting: `1.5` → `"2ms"`, `-1.5` → `"-2ms"`, `0.4` → `"0ms"`.
8. `options.maxUnits` (positive integer, default unlimited) keeps only the first N non-zero units. The last kept unit is rounded half up using the remainder: `formatDuration(5_430_000, { maxUnits: 1 })` → `"2h"` (1h 30m 30s rounds up), `formatDuration(5_370_000, { maxUnits: 1 })` → `"1h"`.
9. Rounding in rule 8 carries upward: `formatDuration(86_399_999, { maxUnits: 2 })` → `"1d"` (23h 60m becomes 1d 0h, and the zero unit is dropped).
10. `options.long: true` uses long names with correct singular/plural and a comma-and-space separator: `formatDuration(3_661_000, { long: true })` → `"1 hour, 1 minute, 1 second"`, `formatDuration(7_200_000, { long: true })` → `"2 hours"`. Zero in long mode is `"0 milliseconds"`.
11. `options.maxUnits` must be a positive integer when given; otherwise throw a `RangeError` with the message `formatDuration: maxUnits must be a positive integer`.
12. Unknown option keys throw a `TypeError` with the message `formatDuration: unknown option "<key>"` (the first unknown key in insertion order).
13. The function must not mutate the `options` object.
