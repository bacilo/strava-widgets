/**
 * Type declarations for PNG image imports
 * Enables TypeScript compilation of Vite-bundled image assets
 */
declare module '*.png' {
  const value: string;
  export default value;
}
