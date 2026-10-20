package ninja.domi.cloudhoist.engine

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.junit.Assert.assertEquals
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class EngineRoomDatabaseTest {
  @Test
  fun productionDatabaseIsSharedAcrossConcurrentCallers() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val callers = 4
    val ready = CountDownLatch(callers)
    val start = CountDownLatch(1)
    val instances = Collections.synchronizedList(mutableListOf<EngineRoomDatabase>())
    val executor = Executors.newFixedThreadPool(callers)

    repeat(callers) {
      executor.execute {
        ready.countDown()
        start.await()
        instances += EngineRoomDatabase.open(context)
      }
    }

    ready.await(5, TimeUnit.SECONDS)
    start.countDown()
    executor.shutdown()
    executor.awaitTermination(10, TimeUnit.SECONDS)

    assertEquals(callers, instances.size)
    instances.forEach { assertSame(instances.first(), it) }
  }
}
