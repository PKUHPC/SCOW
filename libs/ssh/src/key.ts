import fs from "fs";

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export function getKeyPair(privateKeyPath: string, publicKeyPath: string): KeyPair {
  return {
    privateKey: fs.readFileSync(privateKeyPath, "utf-8").trim(),
    publicKey: fs.readFileSync(publicKeyPath, "utf-8").trim(),
  };
}
