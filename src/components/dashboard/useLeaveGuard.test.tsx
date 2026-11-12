import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useLeaveGuard } from './useLeaveGuard';

const push = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// A click the guard lets through reaches the document, where jsdom would try
// to navigate; the tests only ask whether the guard held it.
const stayOnThePage = (event: MouseEvent) => event.preventDefault();

beforeEach(() => {
  push.mockClear();
  document.addEventListener('click', stayOnThePage);
});

afterEach(() => document.removeEventListener('click', stayOnThePage));

function links() {
  render(
    <nav>
      <a href="/dashboard/emma?tab=share#link">Elsewhere</a>
      <a href="#milestones">Same page</a>
      <a href="/dashboard" target="_blank" rel="noreferrer">
        New tab
      </a>
      <a href="https://example.com/">Another site</a>
    </nav>
  );
  return (name: string) => screen.getByRole('link', { name });
}

test('a clean form lets a link through', () => {
  const link = links();
  const { result } = renderHook(() => useLeaveGuard(false));

  fireEvent.click(link('Elsewhere'));

  expect(result.current.target).toBe(null);
});

test('a dirty form holds a link to another page until the answer', () => {
  const link = links();
  const { result } = renderHook(() => useLeaveGuard(true));
  const reachedThePage = vi.fn();
  document.body.addEventListener('click', reachedThePage);

  fireEvent.click(link('Elsewhere'));
  expect(result.current.target).toBe('/dashboard/emma?tab=share#link');
  expect(reachedThePage).not.toHaveBeenCalled();

  act(() => result.current.stay());
  expect(result.current.target).toBe(null);
  expect(push).not.toHaveBeenCalled();

  fireEvent.click(link('Elsewhere'));
  act(() => result.current.leave());
  expect(push).toHaveBeenCalledExactlyOnceWith('/dashboard/emma?tab=share#link');
  expect(result.current.target).toBe(null);

  document.body.removeEventListener('click', reachedThePage);
});

test('a dirty form lets through what does not leave the page', () => {
  const link = links();
  const { result } = renderHook(() => useLeaveGuard(true));

  for (const name of ['Same page', 'New tab', 'Another site']) {
    fireEvent.click(link(name));
    expect(result.current.target, name).toBe(null);
  }
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey']) {
    fireEvent.click(link('Elsewhere'), { [modifier]: true });
    expect(result.current.target, modifier).toBe(null);
  }
  fireEvent.click(link('Elsewhere'), { button: 1 });
  expect(result.current.target).toBe(null);
});

test('leaving with nothing held goes nowhere', () => {
  const { result } = renderHook(() => useLeaveGuard(true));

  act(() => result.current.leave());

  expect(push).not.toHaveBeenCalled();
});

test('the browser asks before closing the tab only while the form is dirty', () => {
  const { rerender } = renderHook(({ dirty }) => useLeaveGuard(dirty), { initialProps: { dirty: true } });
  const closing = () => {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  };

  expect(closing()).toBe(true);

  rerender({ dirty: false });
  expect(closing()).toBe(false);
});
