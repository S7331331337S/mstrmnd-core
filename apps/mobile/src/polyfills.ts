import { Platform } from 'react-native';
import structuredCloneShim from '@ungap/structured-clone';

/**
 * The Vercel AI SDK's streaming pipeline expects `structuredClone` and
 * `TextEncoderStream`/`TextDecoderStream`, which the Hermes runtime does
 * not provide on native. Web already has all three.
 * https://ai-sdk.dev/docs/getting-started/expo#polyfills
 */
if (Platform.OS !== 'web') {
  void (async () => {
    const { polyfillGlobal } = await import(
      'react-native/Libraries/Utilities/PolyfillFunctions'
    );
    const { TextEncoderStream, TextDecoderStream } = await import(
      '@stardazed/streams-text-encoding'
    );

    if (!('structuredClone' in globalThis)) {
      polyfillGlobal('structuredClone', () => structuredCloneShim);
    }

    polyfillGlobal('TextEncoderStream', () => TextEncoderStream);
    polyfillGlobal('TextDecoderStream', () => TextDecoderStream);
  })();
}

export {};
