// Thin DOM helpers over the XML inside OOXML packages (PPTX and DOCX are zips
// of XML). Spec §14 F-06. Everything here works on @xmldom/xmldom documents,
// so it runs the same in a route handler and in `npm run check:deck`.

import { DOMParser, XMLSerializer, type Document, type Element, type Node } from "@xmldom/xmldom"

export const NS = {
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  p: "http://schemas.openxmlformats.org/presentationml/2006/main",
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  w: "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  rels: "http://schemas.openxmlformats.org/package/2006/relationships",
  ct: "http://schemas.openxmlformats.org/package/2006/content-types",
} as const

export type { Document, Element }

export function parseXml(xml: string): Document {
  return new DOMParser().parseFromString(xml, "text/xml")
}

export function serializeXml(doc: Document): string {
  return new XMLSerializer().serializeToString(doc)
}

/** Element children of `el` with the given namespace and local name. Direct children only. */
export function children(el: Element | Document, ns: string, local: string): Element[] {
  const out: Element[] = []
  for (let n: Node | null = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as Element).namespaceURI === ns && (n as Element).localName === local) {
      out.push(n as Element)
    }
  }
  return out
}

export function child(el: Element | Document, ns: string, local: string): Element | null {
  return children(el, ns, local)[0] ?? null
}

/** All descendants with the given namespace and local name, in document order. */
export function descendants(el: Element | Document, ns: string, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(ns, local)) as Element[]
}
