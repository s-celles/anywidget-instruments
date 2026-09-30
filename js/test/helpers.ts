// An in-memory anywidget model (AFM interface), as a host without a Python
// kernel builds it from a plain dictionary of traits.
import type { AnyModel, Traits } from "../src/core/model.js";

export type FakeModel = AnyModel<Traits> & { emit: (ev: string, ...args: unknown[]) => void; saved: Traits[] };

export function fakeModel(state: Traits): FakeModel {
  const handlers: Record<string, Array<(...a: any[]) => void>> = {};
  const saved: Traits[] = [];
  const emit = (ev: string, ...args: unknown[]) => (handlers[ev] || []).slice().forEach((h) => h(...args));
  return {
    saved,
    emit,
    get: (k: string) => state[k],
    set: (k: string, v: unknown) => {
      state[k] = v;
      emit(`change:${k}`);
    },
    save_changes: () => {
      saved.push({ ...state });
    },
    on: (ev: string, cb: (...a: any[]) => void) => {
      (handlers[ev] ||= []).push(cb);
    },
    off: (ev?: string | null, cb?: ((...a: any[]) => void) | null) => {
      if (ev) handlers[ev] = (handlers[ev] || []).filter((h) => h !== cb);
    },
    send: () => {},
  } as unknown as FakeModel;
}
