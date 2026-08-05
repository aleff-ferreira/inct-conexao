import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { configDefaults } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    // Sem isto o vitest varre também .claude/worktrees/** — cópias de OUTRAS
    // sessões de trabalho dentro da pasta do repo — e "npm test" passa a
    // reprovar por causa de uma árvore que não é esta.
    exclude: [...configDefaults.exclude, ".claude/**"],
  },
});
