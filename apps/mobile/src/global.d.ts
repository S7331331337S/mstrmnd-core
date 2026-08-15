declare module '*.css';
declare module 'react-native/Libraries/Utilities/PolyfillFunctions' {
  export function polyfillGlobal(name: string, factory: () => unknown): void;
}
