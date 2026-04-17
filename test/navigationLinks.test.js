import { describe, expect, test } from 'bun:test';
import { buildDirectionsLink } from "../src/features/navigation";

describe('buildDirectionsLink', () => {
  test('builds an Apple Maps link for Apple platforms', () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      label: 'Ada Lovelace',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });

    expect(result).toEqual({
      href: 'https://maps.apple.com/?daddr=42.710119%2C-73.730294&dirflg=w&q=Ada+Lovelace',
      platform: 'apple',
      target: 'self',
    });
  });

  test('includes a source location in Apple Maps links when one is provided', () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      label: 'Ada Lovelace',
      originLatitude: 42.70418,
      originLongitude: -73.73198,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });

    expect(result).toEqual({
      href: 'https://maps.apple.com/?daddr=42.710119%2C-73.730294&dirflg=w&saddr=42.70418%2C-73.73198&q=Ada+Lovelace',
      platform: 'apple',
      target: 'self',
    });
  });

  test('builds a Google Maps directions link for Android', () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      label: 'Ada Lovelace',
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
    });

    expect(result).toEqual({
      href: 'https://www.google.com/maps/dir/?api=1&destination=42.710119%2C-73.730294&travelmode=walking',
      platform: 'android',
      target: 'self',
    });
  });

  test('includes a source location in Google Maps directions links when one is provided', () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      originLatitude: 42.70418,
      originLongitude: -73.73198,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(result).toEqual({
      href: 'https://www.google.com/maps/dir/?api=1&destination=42.710119%2C-73.730294&travelmode=walking&origin=42.70418%2C-73.73198',
      platform: 'web',
      target: '_blank',
    });
  });

  test('falls back to a web directions URL on desktop', () => {
    const result = buildDirectionsLink({
      latitude: 42.710119,
      longitude: -73.730294,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(result).toEqual({
      href: 'https://www.google.com/maps/dir/?api=1&destination=42.710119%2C-73.730294&travelmode=walking',
      platform: 'web',
      target: '_blank',
    });
  });

  test('returns null for invalid coordinates', () => {
    const result = buildDirectionsLink({
      latitude: 120,
      longitude: -73.730294,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(result).toBeNull();
  });
});
