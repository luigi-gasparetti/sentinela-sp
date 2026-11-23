import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Os testes de banco compartilham as mesmas tabelas; em paralelo, um apagaria os dados do outro.
    fileParallelism: false,
  },
});
