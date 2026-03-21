/**
 * Sample file for testing AST parsing.
 * Contains 2 classes, 3 functions, 2 variables.
 */

import { A } from './moduleA';

export const PI = 3.14159;
export let count = 0;

/**
 * A basic user class.
 */
export class User {
  constructor(public name: string) {}
}

/**
 * Admin class extending User.
 */
export class Admin extends User {
  public role: string = 'admin';
}

/**
 * Adds two numbers.
 * @param a First number
 * @param b Second number
 * @returns The sum
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Multiplies two numbers.
 */
export const multiply = (a: number, b: number): number => {
  return a * b;
};

/**
 * Increments the count variable.
 */
export const incrementCount = function() {
  count++;
};
