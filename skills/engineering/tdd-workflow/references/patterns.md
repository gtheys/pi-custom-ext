# Test Type Patterns

Concrete starting shapes for each test level. These are illustrative — write the actual test for the seam and case at hand, one at a time, per the loop in SKILL.md, rather than copying these wholesale.

## Unit Test Pattern (Jest/Vitest)

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './Button'

describe('Button Component', () => {
  it('renders with correct text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click</Button>)

    fireEvent.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

## API Integration Test Pattern

```typescript
import { NextRequest } from 'next/server'
import { GET } from './route'

describe('GET /api/markets', () => {
  it('returns markets successfully', async () => {
    const request = new NextRequest('http://localhost/api/markets')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(Array.isArray(data.data)).toBe(true)
  })

  it('validates query parameters', async () => {
    const request = new NextRequest('http://localhost/api/markets?limit=invalid')
    const response = await GET(request)

    expect(response.status).toBe(400)
  })

  it('handles database errors gracefully', async () => {
    // Mock database failure at the boundary (see mocking.md)
    const request = new NextRequest('http://localhost/api/markets')
    // Test error handling
  })
})
```

## E2E Test Pattern (Playwright)

```typescript
import { test, expect } from '@playwright/test'

test('user can search and filter markets', async ({ page }) => {
  await page.goto('/')
  await page.click('a[href="/markets"]')

  await expect(page.locator('h1')).toContainText('Markets')

  await page.fill('input[placeholder="Search markets"]', 'election')
  await page.waitForTimeout(600) // debounce

  const results = page.locator('[data-testid="market-card"]')
  await expect(results).toHaveCount(5, { timeout: 5000 })

  const firstResult = results.first()
  await expect(firstResult).toContainText('election', { ignoreCase: true })

  await page.click('button:has-text("Active")')
  await expect(results).toHaveCount(3)
})

test('user can create a new market', async ({ page }) => {
  await page.goto('/creator-dashboard')

  await page.fill('input[name="name"]', 'Test Market')
  await page.fill('textarea[name="description"]', 'Test description')
  await page.fill('input[name="endDate"]', '2025-12-31')

  await page.click('button[type="submit"]')

  await expect(page.locator('text=Market created successfully')).toBeVisible()
  await expect(page).toHaveURL(/\/markets\/test-market/)
})
```
