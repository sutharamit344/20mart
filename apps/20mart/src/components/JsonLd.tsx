import { serializeJsonLd } from '@20mart/shared';

/** Server-rendered JSON-LD; see serializeJsonLd for the escaping that makes inlining safe. */
export function JsonLd({ data }: { data: object | object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
