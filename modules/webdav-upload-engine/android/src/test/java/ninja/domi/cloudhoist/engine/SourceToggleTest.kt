package ninja.domi.cloudhoist.engine

import java.lang.reflect.Proxy
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import org.junit.Assert.*
import org.junit.Test

class SourceToggleTest {
  @Test fun disablingASourceDoesNotWaitForTheTransferLock() {
    val source = SourceEntity("source", "account", "Photos", "media_store", "mediastore://camera",
      listOf("Photos"), true, 1, null, null)
    val enabled = AtomicBoolean(true)
    val dao = Proxy.newProxyInstance(EngineDao::class.java.classLoader, arrayOf(EngineDao::class.java)) { _, method, args ->
      when (method.name) {
        "source" -> source
        "setting" -> null
        "setSourceEnabled" -> { enabled.set(args!![1] as Boolean); null }
        else -> error("Unexpected DAO call: ${method.name}")
      }
    } as EngineDao
    val input = SourceInputRecord()
    mapOf("id" to "source", "name" to "Photos", "kind" to "media_store", "localUri" to "mediastore://camera",
      "remotePath" to "/Photos", "enabled" to false).forEach { (name, value) ->
      SourceInputRecord::class.java.getDeclaredField(name).apply { isAccessible = true }.set(input, value)
    }
    val executor = Executors.newSingleThreadExecutor()
    EngineOperations.lock.lock()
    try {
      executor.submit { RoomEngineView(dao, {}).addOrUpdateSource(input, "account") }.get(1, TimeUnit.SECONDS)
      assertFalse(enabled.get())
    } finally {
      EngineOperations.lock.unlock()
      executor.shutdownNow()
    }
  }
}
