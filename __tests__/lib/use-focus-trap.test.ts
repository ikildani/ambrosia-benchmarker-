/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

function createContainer() {
  const div = document.createElement('div');
  div.setAttribute('tabindex', '-1');

  const btn1 = document.createElement('button');
  btn1.textContent = 'First';
  const btn2 = document.createElement('button');
  btn2.textContent = 'Middle';
  const btn3 = document.createElement('button');
  btn3.textContent = 'Last';

  div.appendChild(btn1);
  div.appendChild(btn2);
  div.appendChild(btn3);
  document.body.appendChild(div);

  return { div, btn1, btn2, btn3 };
}

function dispatchKeyDown(key: string, opts: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...opts,
  });
  document.dispatchEvent(event);
}

describe('useFocusTrap', () => {
  let container: ReturnType<typeof createContainer>;
  let ref: { current: HTMLElement };

  beforeEach(() => {
    container = createContainer();
    ref = { current: container.div };
  });

  afterEach(() => {
    document.body.removeChild(container.div);
    jest.useRealTimers();
  });

  it('does not throw when called with isOpen=false', () => {
    expect(() => {
      renderHook(() => useFocusTrap(ref, false));
    }).not.toThrow();
  });

  it('calls onClose when Escape is pressed and isOpen=true', () => {
    const onClose = jest.fn();
    renderHook(() => useFocusTrap(ref, true, onClose));

    act(() => {
      dispatchKeyDown('Escape');
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when Escape is pressed and isOpen=false', () => {
    const onClose = jest.fn();
    renderHook(() => useFocusTrap(ref, false, onClose));

    act(() => {
      dispatchKeyDown('Escape');
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('wraps focus from last element to first on Tab', () => {
    renderHook(() => useFocusTrap(ref, true));

    act(() => {
      container.btn3.focus();
    });
    expect(document.activeElement).toBe(container.btn3);

    act(() => {
      dispatchKeyDown('Tab', { shiftKey: false });
    });

    expect(document.activeElement).toBe(container.btn1);
  });

  it('wraps focus from first element to last on Shift+Tab', () => {
    renderHook(() => useFocusTrap(ref, true));

    act(() => {
      container.btn1.focus();
    });
    expect(document.activeElement).toBe(container.btn1);

    act(() => {
      dispatchKeyDown('Tab', { shiftKey: true });
    });

    expect(document.activeElement).toBe(container.btn3);
  });

  it('focuses ref element when isOpen becomes true', () => {
    jest.useFakeTimers();

    const { rerender } = renderHook(
      ({ isOpen }) => useFocusTrap(ref, isOpen),
      { initialProps: { isOpen: false } }
    );

    rerender({ isOpen: true });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(document.activeElement).toBe(container.div);
  });

  it('restores previous focus when isOpen becomes false', () => {
    jest.useFakeTimers();

    // Focus a button outside the container to act as "previously active element"
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    expect(document.activeElement).toBe(outsideButton);

    const { rerender } = renderHook(
      ({ isOpen }) => useFocusTrap(ref, isOpen),
      { initialProps: { isOpen: false } }
    );

    // Open: hook stores outsideButton as previousActiveElement, then focuses ref
    rerender({ isOpen: true });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(document.activeElement).toBe(container.div);

    // Close: hook restores focus to outsideButton
    rerender({ isOpen: false });

    expect(document.activeElement).toBe(outsideButton);

    document.body.removeChild(outsideButton);
  });
});
