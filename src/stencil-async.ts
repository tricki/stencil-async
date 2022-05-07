import { forceUpdate, getRenderingRef } from '@stencil/core';
import type { Observable, Subscription } from 'rxjs';

export function async<T>(obj: Observable<T> | Promise<T>): T | undefined {
  return getAsyncValue(obj);
}

interface ComponentInterface {
  connectedCallback?: () => void;
  disconnectedCallback?: () => void;
  render?: () => unknown;
};

/**
 * A Map of all components that are currently registered with stencil-async.
 *
 * @internal
 */
const componentRegistrations = new Map<ComponentInterface, ComponentRegistration>();

function init(component: ComponentInterface) {
  if (componentRegistrations.has(component)) {
    // component already initialized
    return;
  }

  const compReg: ComponentRegistration = {
    promises: new Map(),
    observables: new Map(),
    recentlyUsedObservables: [],
    origMethods: {
      connectedCallback: component.connectedCallback,
      disconnectedCallback: component.disconnectedCallback,
      render: component.render,
    },
  };

  componentRegistrations.set(component, compReg);

  component.connectedCallback = function () {
    init(component);

    if (compReg.origMethods.connectedCallback) {
      compReg.origMethods.connectedCallback.call(component);
    }
  };

  component.disconnectedCallback = function () {
    destroy(component);

    if (compReg.origMethods.disconnectedCallback) {
      compReg.origMethods.disconnectedCallback.call(component);
    }
  };

  component.render = function () {
    if (!compReg.origMethods.render) {
      return;
    }

    compReg.recentlyUsedObservables = [];
    const renderResult = compReg.origMethods.render.call(component);
    // unsubscribe observables that are not used in `render()` anymore
    [...compReg.observables.keys()]
      .filter(obs => !compReg.recentlyUsedObservables.includes(obs))
      .forEach(unusedObs => unregisterObservable(component, unusedObs));

    if (
      compReg.recentlyUsedObservables.length === 0
      && compReg.promises.size === 0
    ) {
      // completely remove stencil-async from the component
      destroy(component);
    }

    return renderResult;
  }
}

function destroy(component: ComponentInterface) {
  if (!componentRegistrations.has(component)) {
    return;
  }

  const compReg = componentRegistrations.get(component) as ComponentRegistration;
  // unsubscribe all component observables
  compReg.observables.forEach(obsReg => obsReg.subscription.unsubscribe());
  componentRegistrations.delete(component);
  // reset the methods
  component.connectedCallback = compReg.origMethods.connectedCallback;
  component.disconnectedCallback = compReg.origMethods.disconnectedCallback;
  component.render = compReg.origMethods.render;
}

function unregisterObservable(component: ComponentInterface, observable: Observable<unknown>) {
  if (!componentRegistrations.has(component)) {
    return;
  }

  const compReg = componentRegistrations.get(component) as ComponentRegistration;
  const observableRegistration = compReg.observables.get(observable);
  observableRegistration?.subscription.unsubscribe();
  compReg.observables.delete(observable);
}

function getComponentRegistration(component: ComponentInterface): ComponentRegistration {
  if (!componentRegistrations.has(component)) {
    // add registration if it doesn't exist
    init(component);
  }

  return componentRegistrations.get(component)!;
}

function getAsyncValue<T>(obj: Observable<T> | Promise<T>): T | undefined {
  if (isPromise(obj)) {
    return getPromiseValue(obj as Promise<T>);
  }

  if (isSubscribable(obj)) {
    return getObservableValue(obj as Observable<T>);
  }

  console.error('Invalid value: ', typeof obj, obj);
}

function getPromiseValue<T>(promise: Promise<T>): T | undefined {
  const component = getRenderingRef();
  const compReg = getComponentRegistration(component);

  if (!compReg.promises.has(promise)) {
    compReg.promises.set(promise, null);
    promise.then((...res) => {
      compReg.promises.set(promise, res);
      forceUpdate(component);
    });
  }

  const value = compReg.promises.get(promise);

  return value;
}

function getObservableValue<T>(obs$: Observable<T>): T | undefined {
  // This function is not really exported by @stencil/core.
  // Taken from @stencil/store.
  // @source https://github.com/ionic-team/stencil-store/blob/master/src/subscriptions/stencil.ts#L35
  const component = getRenderingRef();

  const compReg = getComponentRegistration(component);

  compReg.recentlyUsedObservables.push(obs$);

  if (!compReg.observables.has(obs$)) {
    // subscribe
    // We need to create an empty object first
    // because the observable might fire immediately.
    const observableReg: Partial<ObservableRegistration<T>> = {};
    observableReg.subscription = obs$.subscribe(result => {
      observableReg.result = result;
      forceUpdate(component);
    });
    compReg.observables.set(obs$, observableReg as ObservableRegistration<T>);
  }

  return compReg.observables.get(obs$)?.result;
}

export interface ComponentRegistration<T = any> {
  promises: PromiseMap;
  observables: Map<Observable<unknown>, ObservableRegistration<T>>;
  /**
   * An array of all observables that
   * were used in the last render.
   */
  recentlyUsedObservables: Observable<unknown>[];
  origMethods: {
    connectedCallback?: () => unknown,
    disconnectedCallback?: () => unknown,
    render?: () => unknown,
  }
}

export interface ObservableRegistration<T> {
  subscription: Subscription,
  result?: T | undefined;
}

export type PromiseMap<T = any> = Map<Promise<T>, T | undefined>;

export function isPromise(obj: any) {
  return !!obj && typeof obj.then === 'function';
}

export function isSubscribable(obj: any) {
  return !!obj && typeof obj.subscribe === 'function'
}
