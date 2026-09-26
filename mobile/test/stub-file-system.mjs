// In-memory stand-in for expo-file-system so the real offline-gate.ts can run
// under plain node. Only the surface offline-gate.ts touches.
const files = new Map();

class Directory {
  uri;
  constructor(...uris) {
    this.uri = uris.map(String).join("/");
  }
  get exists() {
    return [...files.keys()].some((k) => k.startsWith(`${this.uri}/`));
  }
  create() {}
}

class File {
  uri;
  constructor(dir, name) {
    this.uri = name ? `${dir.uri}/${name}` : String(dir);
  }
  get exists() {
    return files.has(this.uri);
  }
  textSync() {
    if (!files.has(this.uri)) throw new Error(`ENOENT ${this.uri}`);
    return files.get(this.uri);
  }
  write(content) {
    files.set(this.uri, content);
  }
  delete() {
    files.delete(this.uri);
  }
}

export const Paths = { document: "mem://doc" };
export { Directory, File, files };
