const resolveLocalRef = (spec: object, ref: string): unknown => {
  if (!ref.startsWith("#/")) return undefined;

  return ref
    .slice(2)
    .split("/")
    .reduce<unknown>(
      (current, key) =>
        (current as Record<string, unknown> | undefined)?.[key.replaceAll("~1", "/").replaceAll("~0", "~")],
      spec,
    );
};

const resolveNode = (spec: object, node: unknown, seen = new Set<string>()): unknown => {
  if (Array.isArray(node)) return node.map((value) => resolveNode(spec, value, seen));

  if (!node || typeof node !== "object") return node;

  const record = node as Record<string, unknown>;
  const ref = record.$ref;
  if (typeof ref === "string") {
    if (seen.has(ref)) return node;

    const resolved = resolveLocalRef(spec, ref);
    if (resolved) {
      return resolveNode(spec, resolved, new Set([...seen, ref]));
    }
  }

  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, resolveNode(spec, value, seen)]));
};

export const localSpecResolverPlugin = () => ({
  fn: {
    resolveSubtree: async (spec: object, path: string[]) => ({
      errors: [],
      spec: resolveNode(
        spec,
        path.reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], spec),
      ),
    }),
  },
});
