// Matchers RTL (toBeInTheDocument, etc.) + nettoyage du DOM entre les tests.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
