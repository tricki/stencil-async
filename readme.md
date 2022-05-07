# Stencil Async

Stencil Async is a lightweight async helper function for [StencilJS](https://stenciljs.com/). Use Promises and RXJS Observables directly in the render function with automatic re-render. Inspired by the Angular [AsyncPipe](https://angular.io/api/common/AsyncPipe).

**Highlights:**

- Lightweight
- Zero dependencies
- Simple API
- Re-renders on changes
- Automatically subscribes and unsubscribes to observables

## Installation

```
npm install stencil-async --save-dev
```

## Examples

### Promise

**component.tsx:**

```tsx
import { Component, h, Host } from '@stencil/core';
import { async } from "stencil-async";

@Component({
  tag: 'my-component',
  shadow: true,
})
export class MyComponent {

  promise = new Promise<string>(resolve => {
    setTimeout(() => {
      resolve('Promise resolved');
    }, 2000);
  });

  render() {
    return (
      <Host>
        {async(this.promise) ?? 'Promise not resolved yet'}
      </Host>
    );
  }

}
```

**rxjs-component.tsx:**

```tsx
import { Component, h, Host } from '@stencil/core';
import { Observable, take } from 'rxjs';
import { map, interval } from 'rxjs';
import { async } from 'stencil-async';

@Component({
  tag: 'my-rxjs-component',
  shadow: true,
})
export class MyRxjsComponent {

  observable: Observable<string> = interval(1000).pipe(
    map((val) => 'Observable resolved: ' + (val + 1)),
    take(10),
  );

  render() {
    return (
      <Host>
        {async(this.observable) ?? 'Observable not resolved yet'}
      </Host>
    );
  }

}
```



## API

### `async<T>(obj: Observable<T> | Promise<T>): T | undefined`

Subscribe to a promise or observable and return the result or `undefined` if it is not resolved yet. As soon as the
resolved value changes, the component will automatically re-render.

It will automatically unsubscribe from observables when the component is removed from the dom (after `disconnectedCallback`)
or if the Observable is no longer used in the render method.
