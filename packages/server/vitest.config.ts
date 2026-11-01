import { defineConfig } from "vitest/config";

// Serial files keep the two load-timing tests from competing with other test files for the CPU.
export default defineConfig({ test: { testTimeout: 30000, fileParallelism: false } });
