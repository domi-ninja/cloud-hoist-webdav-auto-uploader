package ninja.domi.cloudhoist.engine

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class TransferConstraintsRecord : Record {
  @Field
  val unmeteredOnly: Boolean = true

  @Field
  val batteryNotLow: Boolean = true

  @Field
  val requiresCharging: Boolean = false

  fun toConstraints() = TransferConstraints(
    unmeteredOnly = unmeteredOnly,
    batteryNotLow = batteryNotLow,
    requiresCharging = requiresCharging,
  )
}
