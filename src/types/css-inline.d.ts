/**
 * Type declarations for Vite CSS inline imports
 * ?inline suffix imports CSS as a string instead of injecting into document.head
 */
declare module '*.css?inline' {
  const css: string;
  export default css;
}
