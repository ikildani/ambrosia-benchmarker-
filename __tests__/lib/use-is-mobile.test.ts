/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '@/lib/hooks/useIsMobile';

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: originalInnerWidth,
    });
  });

  it('returns false when window.innerWidth > 640 (default breakpoint)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true when window.innerWidth < 640', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 480 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('returns false when window.innerWidth === 640 (not less than)', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 640 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('responds to resize events', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 480 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('respects a custom breakpoint', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 900 });
    const { result } = renderHook(() => useIsMobile(1024));
    expect(result.current).toBe(true);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { writable: true, value: 1200 });
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current).toBe(false);
  });

  it('cleans up the event listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    Object.defineProperty(window, 'innerWidth', { writable: true, value: 800 });
    const { unmount } = renderHook(() => useIsMobile());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
