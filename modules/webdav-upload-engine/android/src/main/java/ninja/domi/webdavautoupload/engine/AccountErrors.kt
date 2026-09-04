package ninja.domi.webdavautoupload.engine

import expo.modules.kotlin.exception.CodedException

class AccountInvalidServerUrlException :
  CodedException("Enter a complete Nextcloud server URL.")

class AccountInsecureServerUrlException :
  CodedException("The Nextcloud server must use HTTPS.")

class AccountInvalidCredentialsException :
  CodedException("The server rejected the app credentials.")

class AccountMaintenanceException :
  CodedException("The Nextcloud server is in maintenance mode.")

class AccountUnsupportedResponseException :
  CodedException("The server returned an unsupported response.")

class AccountUnexpectedRedirectException :
  CodedException("The server redirected an authenticated request.")

class AccountCertificateException :
  CodedException("Android does not trust the server certificate.")

class AccountNetworkException :
  CodedException("The Nextcloud server could not be reached.")

class AccountDnsException :
  CodedException("Android could not find the Nextcloud server hostname.")

class AccountTimeoutException :
  CodedException("The Nextcloud server took too long to respond.")

class AccountConnectionRefusedException :
  CodedException("The Nextcloud server refused the connection.")

class AccountServerException :
  CodedException("The Nextcloud server could not complete the request.")

class AccountLoginExpiredException :
  CodedException("The browser login expired. Start again.")

class AccountLoginCancelledException :
  CodedException("The browser login is no longer active.")

class AccountAlreadyConfiguredException :
  CodedException("Sign out before connecting a different account.")

class AccountNotConfiguredException :
  CodedException("Connect a Nextcloud account first.")

class AccountStorageException :
  CodedException("The encrypted account credential could not be accessed.")
