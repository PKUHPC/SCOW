import { Migration20240827164325 } from "./Migration20240827164325";
import { Migration20250718060901 } from "./Migration20250718060901";

export const migrations = [Migration20240827164325, Migration20250718060901].map((x) => ({ name: x.name, class: x }));
