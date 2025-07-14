import { EventEmitter } from 'events';

/** Tiny in-memory event bus used for Server-Sent Events progress streaming */
export const bus = new EventEmitter();
