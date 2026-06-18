/**
 * Joins class names, filtering falsy values.
 */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
