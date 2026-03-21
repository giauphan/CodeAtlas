/**
 * Module A for circular dependency test.
 */
import { bFunction } from './moduleB';

/**
 * Function in Module A
 */
export function aFunction() {
  bFunction();
}
