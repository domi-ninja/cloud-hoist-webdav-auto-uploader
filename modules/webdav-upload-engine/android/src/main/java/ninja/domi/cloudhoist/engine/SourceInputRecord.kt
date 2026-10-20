package ninja.domi.cloudhoist.engine

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

  @Field
  val collisionPolicy: String = CollisionPolicy.REPLACE.value
}
