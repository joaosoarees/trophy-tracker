import { type ComponentType, lazy, type LazyExoticComponent } from 'react';

type Lazy<T> = {
  [K in keyof T]: T[K] extends ComponentType<infer P>
    ? LazyExoticComponent<ComponentType<P>>
    : never;
};

/**
 * `React.lazy` for modules with named exports: the code of a screen is only
 * loaded when it is first shown. Each name is one component however often it
 * is read: a new one on each read would remount what it draws.
 *
 *   const { Onboarding } = namedLazyLoad(() => import('./screens/Onboarding'));
 */
export function namedLazyLoad<T extends object>(
  loader: () => Promise<T>,
): Lazy<T> {
  const components = new Map<
    string | symbol,
    LazyExoticComponent<ComponentType<unknown>>
  >();

  return new Proxy({} as Lazy<T>, {
    get: (_target, name) => {
      let component = components.get(name);
      if (!component) {
        component = lazy(() =>
          loader().then((module) => ({
            default: module[name as keyof T] as ComponentType<unknown>,
          })),
        );
        components.set(name, component);
      }
      return component;
    },
  });
}
