/** Required markup fails early with an actionable error instead of a later null access. */
export function element<K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  id: string,
  tag: K,
): HTMLElementTagNameMap[K];
export function element(doc: Document, id: string): HTMLElement;
export function element(doc: Document, id: string, tag?: keyof HTMLElementTagNameMap): HTMLElement {
  const node = doc.getElementById(id);
  if (!node || (tag && node.localName !== tag))
    throw new Error(`Missing ${tag ?? "element"} #${id}`);
  return node;
}
