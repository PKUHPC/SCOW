const REGISTRY_LABEL = "[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?";
// Docker 仅将含点号、端口或值为 localhost 的首段识别为显式 registry。
const REGISTRY_HOST = `(?:localhost|${REGISTRY_LABEL}(?:\\.${REGISTRY_LABEL})+)`;
const REGISTRY_PORT = "(?:[1-9]\\d{0,3}|[1-5]\\d{4}|6[0-4]\\d{3}|65[0-4]\\d{2}|655[0-2]\\d|6553[0-5])";
const REGISTRY =
  `(?:(?:${REGISTRY_HOST})(?::${REGISTRY_PORT})?` +
  `|${REGISTRY_LABEL}:${REGISTRY_PORT}` +
  `|\\[[a-fA-F0-9:]+\\](?::${REGISTRY_PORT})?)`;

const REPOSITORY_PART = "[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*";
const REPOSITORY = `${REPOSITORY_PART}(?:\\/${REPOSITORY_PART})*`;
const TAG = "[a-zA-Z0-9_][a-zA-Z0-9._-]{0,127}";
const DIGEST_ALGORITHM = "[a-z0-9]+(?:[+._-][a-z0-9]+)*";
const DIGEST_ENCODED = "[a-zA-Z0-9=_-]+";
const DIGEST = `${DIGEST_ALGORITHM}:${DIGEST_ENCODED}`;

const REGISTERED_DIGEST_ENCODED_PATTERNS = new Map<string, RegExp>([
  ["sha256", /^[a-f0-9]{64}$/],
  ["sha512", /^[a-f0-9]{128}$/],
  ["blake3", /^[a-f0-9]{64}$/],
]);

export const IMAGE_ADDRESS_REGEX = new RegExp(`^${REGISTRY}\\/${REPOSITORY}(?::${TAG})?(?:@${DIGEST})?$`);

const normalizeRegistryAddress = (address: string): string => {
  const addressWithoutProtocol = address.trim().replace(/^[a-z][a-z\d+.-]*:\/\//i, "");
  const pathStart = addressWithoutProtocol.indexOf("/");
  return (pathStart === -1 ? addressWithoutProtocol : addressWithoutProtocol.slice(0, pathStart)).toLowerCase();
};

export const isImageAddressFromRegistry = (imageAddress: string, registryAddress: string): boolean => {
  const repositoryStart = imageAddress.indexOf("/");
  return (
    repositoryStart !== -1 &&
    imageAddress.slice(0, repositoryStart).toLowerCase() === normalizeRegistryAddress(registryAddress)
  );
};

export const isValidImageAddress = (imageAddress: string): boolean => {
  if (!IMAGE_ADDRESS_REGEX.test(imageAddress)) {
    return false;
  }

  const repositoryStart = imageAddress.indexOf("/");
  const registry = imageAddress.slice(0, repositoryStart);
  const digestStart = imageAddress.indexOf("@", repositoryStart);
  const tagStart = imageAddress.indexOf(":", repositoryStart);
  const referenceStart = digestStart === -1 || (tagStart !== -1 && tagStart < digestStart) ? tagStart : digestStart;
  const name = referenceStart === -1 ? imageAddress : imageAddress.slice(0, referenceStart);

  if (name.length > 255) {
    return false;
  }

  if (digestStart !== -1) {
    const digest = imageAddress.slice(digestStart + 1);
    const separator = digest.indexOf(":");
    const algorithm = digest.slice(0, separator);
    const encoded = digest.slice(separator + 1);
    const registeredPattern = REGISTERED_DIGEST_ENCODED_PATTERNS.get(algorithm);

    if (registeredPattern && !registeredPattern.test(encoded)) {
      return false;
    }
  }

  try {
    // URL 解析补充校验 IPv4、IPv6 等无法通过简洁正则完整表达的 host 语义。
    new URL(`http://${registry}`);
    return true;
  } catch {
    return false;
  }
};
