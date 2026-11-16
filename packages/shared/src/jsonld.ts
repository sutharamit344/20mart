/**
 * Serialise JSON-LD for inlining in a <script type="application/ld+json"> element.
 * `<` is escaped so catalog text (e.g. a product named "</script>...") can never terminate the
 * script element; U+2028/U+2029 are escaped for older JavaScript parsers. Output is valid JSON.
 */
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

export function serializeJsonLd(data: object | object[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').split(LS).join('\\u2028').split(PS).join('\\u2029');
}
