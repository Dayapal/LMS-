/**
 * A storage provider failed (network, credentials, outage). The message names
 * the operation and the provider's status only: never keys, URLs or credentials.
 * The error handler turns it into a 503 without details.
 */
export class StorageError extends Error {
  constructor(message, { status, code, cause } = {}) {
    super(message, { cause });
    this.name = 'StorageError';
    this.status = status;
    this.code = code;
  }
}
