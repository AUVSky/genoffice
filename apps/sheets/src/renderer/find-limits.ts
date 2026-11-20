/**
 * Shared bounds for workbook-wide search: the app's own Find, Error Checking,
 * and the sidecar-paged find path all read the same cells in the same batches.
 */

/** Every error value Excel can display (ECMA-376 ST_CellType plus the modern
    data-type errors): Error Checking and the sidecar find path share this
    taxonomy so no evaluation error is silently skipped. */
export const ERROR_VALUE_RE =
  /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!|FIELD!|CONNECT!|BLOCKED!|UNKNOWN!|GETTING_DATA)$/

/** Total cells (by scanned extent) one range-paged find call may cover. */
export const MAX_SCAN_CELLS = 400_000

/** Row batches sized to stay under the sidecar's per-read cell budget. */
export const FILE_READ_BATCH_CELLS = 18_000
