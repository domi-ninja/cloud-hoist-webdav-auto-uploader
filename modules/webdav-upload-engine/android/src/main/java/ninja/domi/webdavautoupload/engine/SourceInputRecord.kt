package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class SourceInputRecord : Record {
  @Field
  val id: String? = null

  @Field
  val name: String = ""

  @Field
  val kind: String = ""

  @Field
  val localUri: String = ""

  @Field
  val remotePath: String = ""

  @Field
  val enabled: Boolean = true
}
