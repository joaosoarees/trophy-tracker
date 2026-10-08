import { type ComponentType, lazy, type LazyExoticComponent } from 'react';

type Lazy<T> = {
  [K in keyof T]: T[K] extends ComponentType<infer P>
    ? LazyExoticComponent<ComponentType<P>>
    : never;
};

/**
 * `React.lazy` for modules with named exports: the code of a screen is only
 * loaded when it is first shown.
 *
 *   const { Onboarding } = namedLazyLoad(() => import('./screens/Onboarding'));
 */
export function namedLazyLoad<T extends object>(
  loader: () => Promise<T>,
): Lazy<T> {
  return new Proxy({} as Lazy<T>, {
    get: (_target, name) =>
      lazy(() =>
        loader().then((module) => ({
          default: module[name as keyof T] as ComponentType<unknown>,
        })),
      ),
  });
}
