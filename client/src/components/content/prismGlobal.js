import { Prism } from 'prism-react-renderer';

// Prism's extra language files (prismjs/components/*) register themselves on a
// global `Prism`. This module must be evaluated before they are imported.
globalThis.Prism = Prism;
