package ninja.domi.webdavautoupload.engine

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class AndroidAccountRepository(context: Context) : AccountRepository {
  private val metadata = context.getSharedPreferences(METADATA_PREFERENCES, Context.MODE_PRIVATE)
  private val secrets = context.getSharedPreferences(SECRET_PREFERENCES, Context.MODE_PRIVATE)

  @Synchronized
  override fun currentAccount(): StoredAccount? {
    val id = metadata.getString("id", null) ?: return null
    val serverUrl = metadata.getString("serverUrl", null) ?: return null
    val loginName = metadata.getString("loginName", null) ?: return null
    val davUserId = metadata.getString("davUserId", null) ?: return null
    val displayName = metadata.getString("displayName", null) ?: return null
    val checkedAt = metadata.getString("checkedAt", null) ?: return null
    val serverVersion = metadata.getString("serverVersion", null) ?: return null
    val maxChunkSize = metadata.getLong("maxChunkSize", -1L).takeIf { it > 0L }

    return StoredAccount(
      id = id,
      serverUrl = serverUrl,
      loginName = loginName,
      davUserId = davUserId,
      displayName = displayName,
      checkedAt = checkedAt,
      capabilities = AccountCapabilities(
        serverVersion = serverVersion,
        chunkingSupported = metadata.getBoolean("chunkingSupported", false),
        maxChunkSize = maxChunkSize,
      ),
    )
  }

  @Synchronized
  override fun credential(): StoredAccountCredential? {
    val account = currentAccount() ?: return null
    val encodedIv = secrets.getString("iv", null) ?: throw AccountStorageException()
    val encodedCiphertext = secrets.getString("ciphertext", null) ?: throw AccountStorageException()

    return try {
      val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
      cipher.init(
        Cipher.DECRYPT_MODE,
        encryptionKey(),
        GCMParameterSpec(GCM_TAG_LENGTH_BITS, Base64.decode(encodedIv, Base64.NO_WRAP)),
      )
      val plaintext = cipher.doFinal(Base64.decode(encodedCiphertext, Base64.NO_WRAP))
      StoredAccountCredential(account, plaintext.toString(Charsets.UTF_8))
    } catch (_: Exception) {
      throw AccountStorageException()
    }
  }

  @Synchronized
  override fun save(credential: StoredAccountCredential) {
    val encrypted = try {
      val cipher = Cipher.getInstance(CIPHER_TRANSFORMATION)
      cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
      val ciphertext = cipher.doFinal(credential.appPassword.toByteArray(Charsets.UTF_8))
      Base64.encodeToString(cipher.iv, Base64.NO_WRAP) to
        Base64.encodeToString(ciphertext, Base64.NO_WRAP)
    } catch (_: Exception) {
      throw AccountStorageException()
    }

    val secretSaved = secrets.edit()
      .putString("iv", encrypted.first)
      .putString("ciphertext", encrypted.second)
      .commit()
    if (!secretSaved) {
      throw AccountStorageException()
    }

    val account = credential.account
    val metadataSaved = metadata.edit()
      .putString("id", account.id)
      .putString("serverUrl", account.serverUrl)
      .putString("loginName", account.loginName)
      .putString("davUserId", account.davUserId)
      .putString("displayName", account.displayName)
      .putString("checkedAt", account.checkedAt)
      .putString("serverVersion", account.capabilities.serverVersion)
      .putBoolean("chunkingSupported", account.capabilities.chunkingSupported)
      .putLong("maxChunkSize", account.capabilities.maxChunkSize ?: -1L)
      .commit()
    if (!metadataSaved) {
      secrets.edit().clear().commit()
      throw AccountStorageException()
    }
  }

  private fun encryptionKey(): SecretKey {
    val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE).apply { load(null) }
    (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

    return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE).run {
      init(
        KeyGenParameterSpec.Builder(
          KEY_ALIAS,
          KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
        )
          .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
          .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
          .setKeySize(256)
          .setRandomizedEncryptionRequired(true)
          .setUserAuthenticationRequired(false)
          .build(),
      )
      generateKey()
    }
  }

  private companion object {
    const val METADATA_PREFERENCES = "webdav_account_metadata"
    const val SECRET_PREFERENCES = "webdav_account_secret"
    const val ANDROID_KEYSTORE = "AndroidKeyStore"
    const val KEY_ALIAS = "webdav_auto_upload_account_v1"
    const val CIPHER_TRANSFORMATION = "AES/GCM/NoPadding"
    const val GCM_TAG_LENGTH_BITS = 128
  }
}
