import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // Next 16 activa reglas del compilador de React que no estaban en la
    // configuración anterior. Se conserva el mismo contrato de lint mientras
    // esas migraciones de componentes se atienden por separado.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/use-memo': 'off',
    },
  },
  globalIgnores(['.next/**', 'node_modules/**', 'next-env.d.ts']),
]);

export default config;
