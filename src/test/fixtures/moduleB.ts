/**
 * Module B for circular dependency test.
 */
import { aFunction } from './moduleA';

/**
 * Function in Module B
 */
export function bFunction() {
  aFunction();
}
