import { type ComponentType, createElement } from 'react';
import { prerender } from 'react-dom/static';
import { describe, expect, it, vi } from 'vitest';

import { namedLazyLoad } from './namedLazyLoad';

/** A module with two screens, and a loader that counts how often it was asked. */
function setup() {
  const module = {
    Onboarding: () => 'the onboarding',
    Update: () => 'the update screen',
  };
  const loaderMock = vi.fn(() => Promise.resolve(module));
  const sut = namedLazyLoad(loaderMock);
  return { sut, loaderMock };
}

/** What React draws of a component once everything it waits for has loaded. */
async function drawn(component: ComponentType): Promise<string> {
  const { prelude } = await prerender(createElement(component));
  return new Response(prelude).text();
}

describe('namedLazyLoad', () => {
  it('should answer the same component when a name is read again', () => {
    const { sut } = setup();
    const first = sut.Onboarding;

    const second = sut.Onboarding;

    expect(second).toBe(first);
  });

  it('should answer one component per name when two names are read', () => {
    const { sut } = setup();
    const onboarding = sut.Onboarding;

    const update = sut.Update;

    expect(update).not.toBe(onboarding);
  });

  it('should draw the export of that name when the module has several', async () => {
    const { sut } = setup();

    const html = await drawn(sut.Update);

    expect(html).toBe('the update screen');
  });

  it('should not load the module when a component is only read', () => {
    const { sut, loaderMock } = setup();

    const component = sut.Onboarding;

    expect(component).toBeDefined();
    expect(loaderMock).not.toHaveBeenCalled();
  });
});
