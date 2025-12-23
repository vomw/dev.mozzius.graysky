/* eslint-disable @typescript-eslint/unbound-method */

import "fast-text-encoding";
import "react-native-url-polyfill/auto";

import Graphemer from "graphemer";

export {};

// Polyfill Symbol.dispose and Symbol.asyncDispose for @atproto/oauth-client-expo
// @ts-expect-error polyfilling Symbol
Symbol.dispose ??= Symbol("Symbol.dispose");
// @ts-expect-error polyfilling Symbol
Symbol.asyncDispose ??= Symbol("Symbol.asyncDispose");

// Minimal DisposableStack polyfill for @atproto/oauth-client-expo
if (typeof globalThis.DisposableStack === "undefined") {
  // @ts-expect-error polyfilling DisposableStack
  globalThis.DisposableStack = class DisposableStack {
    #disposed = false;
    #stack: Array<() => void> = [];

    get disposed() {
      return this.#disposed;
    }

    dispose() {
      if (this.#disposed) return;
      this.#disposed = true;
      const errors: unknown[] = [];
      while (this.#stack.length > 0) {
        const fn = this.#stack.pop()!;
        try {
          fn();
        } catch (e) {
          errors.push(e);
        }
      }
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) {
        throw new AggregateError(errors, "Multiple errors during disposal");
      }
    }

    use<T>(value: T): T {
      if (value != null) {
        const dispose = (value as { [Symbol.dispose]?: () => void })[
          Symbol.dispose as unknown as keyof typeof value
        ];
        if (typeof dispose === "function") {
          this.#stack.push(() => dispose.call(value));
        }
      }
      return value;
    }

    adopt<T>(value: T, onDispose: (value: T) => void): T {
      this.#stack.push(() => onDispose(value));
      return value;
    }

    defer(onDispose: () => void) {
      this.#stack.push(onDispose);
    }

    move(): DisposableStack {
      if (this.#disposed) throw new ReferenceError("DisposableStack already disposed");
      const newStack = new DisposableStack();
      // @ts-expect-error accessing private field
      newStack.#stack = this.#stack;
      this.#stack = [];
      this.#disposed = true;
      return newStack;
    }

    [Symbol.dispose]() {
      this.dispose();
    }
  };
}

// SuppressedError polyfill
if (typeof globalThis.SuppressedError === "undefined") {
  // @ts-expect-error polyfilling SuppressedError
  globalThis.SuppressedError = class SuppressedError extends Error {
    error: unknown;
    suppressed: unknown;
    constructor(error: unknown, suppressed: unknown, message?: string) {
      super(message ?? "An error was suppressed during disposal");
      this.name = "SuppressedError";
      this.error = error;
      this.suppressed = suppressed;
    }
  };
}

const splitter = new Graphemer();
globalThis.Intl = globalThis.Intl || {};

// @ts-expect-error we're polyfilling -prf
globalThis.Intl.Segmenter =
  globalThis.Intl.Segmenter ||
  class Segmenter {
    constructor() {}
    // NOTE
    // this is not a precisely correct polyfill but it's sufficient for our needs
    // -prf
    segment = splitter.iterateGraphemes;
  };
