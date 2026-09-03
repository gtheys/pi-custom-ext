# Good and Bad Tests

## Good Tests

**Behavior-first**: test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: Tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Characteristics:

- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test

## Bad Tests

### Implementation-coupled

Coupled to internal structure instead of observable behavior.

```typescript
// BAD: Tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order instead of outcomes
- Test breaks when refactoring without any behavior change
- Test name describes HOW, not WHAT
- Verifying through a side channel instead of the interface

```typescript
// BAD: Bypasses the interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: Verifies through the interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

Also watch for implementation-coupled tests on the *state* side, not just the call side:

```typescript
// BAD: Tests internal state
expect(component.state.count).toBe(5)

// GOOD: Tests what users actually see
expect(screen.getByText('Count: 5')).toBeInTheDocument()
```

### Tautological

The expected value restates the implementation, so the test passes by construction and can never disagree with the code.

```typescript
// BAD: Expected value is recomputed the way the code computes it
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: Expected value is an independent, known literal
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

The same problem shows up as a snapshot computed by hand with the same logic as the code, or a constant asserted equal to itself. Whenever you write an "expected" value, ask where it came from — if the answer is "the same formula as the code under test," it isn't a real check.

### Horizontal slicing

Not a single test, but a pattern across a whole feature: writing every test up front, then implementing everything after. It produces tests that describe imagined behavior rather than behavior the implementation actually needed to satisfy, and it commits to test structure before the implementation has taught you anything. The fix is the vertical-slice loop described in the main SKILL.md — one seam, one test, one minimal implementation, repeat.

### Other common mistakes

**Brittle selectors** (E2E/UI):

```typescript
// BAD: Breaks easily
await page.click('.css-class-xyz')

// GOOD: Resilient to structural changes
await page.click('button:has-text("Submit")')
await page.click('[data-testid="submit-button"]')
```

**No test isolation**:

```typescript
// BAD: Tests depend on each other
test('creates user', () => { /* ... */ })
test('updates same user', () => { /* depends on the previous test's data */ })

// GOOD: Each test sets up its own data
test('creates user', () => {
  const user = createTestUser()
  // Test logic
})

test('updates user', () => {
  const user = createTestUser()
  // Update logic
})
```
