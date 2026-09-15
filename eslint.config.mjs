import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const compat = new FlatCompat({ baseDirectory: dirname });

export default [...compat.extends("next/core-web-vitals", "next/typescript")];
