# Test-first at a seam

- Test through the public interface the ticket describes (the seam), not internals. One seam is ideal.
- Red before green: write one test, run it, see it fail for the expected reason, then write the minimum code to pass. Repeat per behavior. Do not write all tests first.
- Expected values come from the spec or an independent source, never from running the code under test.
- Mock only at system boundaries (network, clock, filesystem, third-party APIs).
- Refactoring is a separate step after the behavior is green, and only inside the ticket's scope.
- Existing tests that start failing are information: fix the code, or report the conflict. Do not edit them to pass.
