import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const compat = new FlatCompat({ baseDirectory: dirname });

const eslintConfig = [
  {
    ignores: ['.next/**', 'build/**', 'node_modules/**', 'out/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default eslintConfig;
