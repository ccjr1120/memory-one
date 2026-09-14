type CacheKey = string;
type CacheValue = { version: string; value: unknown };

export class ContextCache {
  private readonly values = new Map<string, CacheValue>();

  get(identity: string, scope: string | null, limit: number, version: string): unknown | null {
    const item = this.values.get(this.key(identity, scope, limit));
    return item?.version === version ? item.value : null;
  }

  set(identity: string, scope: string | null, limit: number, version: string, value: unknown) {
    this.values.set(this.key(identity, scope, limit), { version, value });
  }

  private key(identity: string, scope: string | null, limit: number) {
    return `${identity}\u0000${scope ?? "global"}\u0000${limit}`;
  }
}
