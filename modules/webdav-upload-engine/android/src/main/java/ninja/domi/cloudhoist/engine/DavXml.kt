package ninja.domi.cloudhoist.engine

import java.io.StringReader
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Document
import org.xml.sax.InputSource

/** Parses trusted-size DAV responses without allowing document type or external entity expansion. */
internal fun parseDavXml(xml: String): Document {
  if (xml.contains("<!DOCTYPE", ignoreCase = true)) {
    throw AccountUnsupportedResponseException()
  }
  return try {
    val factory = DocumentBuilderFactory.newInstance().apply {
      isNamespaceAware = true
      runCatching { setFeature("http://apache.org/xml/features/disallow-doctype-decl", true) }
      runCatching { setFeature("http://xml.org/sax/features/external-general-entities", false) }
      runCatching { setFeature("http://xml.org/sax/features/external-parameter-entities", false) }
      runCatching { isExpandEntityReferences = false }
    }
    factory.newDocumentBuilder().parse(InputSource(StringReader(xml)))
  } catch (_: Exception) {
    throw AccountUnsupportedResponseException()
  }
}
