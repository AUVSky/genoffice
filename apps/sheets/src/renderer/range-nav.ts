/**
 * Sheet/range navigation shared by Find & Replace and the spelling dialog:
 * switch to the owning sheet, load a streamed range so the jump lands on data
 * rather than an empty grid, then select and scroll to the range.
 */
import type { RangeBounds } from '@genoffice/xlsx-gateway/domain/cell-address'
import { ensureLazyRangeLoaded } from './univer-sync'
import type { LazyWorkbookState, UniverRuntime } from './univer-state'

export interface RangeNavContext {
  readonly univerRef: { readonly current: UniverRuntime | null }
  readonly lazyWorkbookRef: { readonly current: LazyWorkbookState | null }
}

export async function navigateToRange(
  ctx: RangeNavContext,
  sheetId: string | undefined,
  bounds: RangeBounds,
  setMessage: (message: string) => void,
): Promise<{ ok: true; sheetName: string } | { ok: false; error: string }> {
  const runtime = ctx.univerRef.current
  const workbook = runtime?.univerAPI.getActiveWorkbook()
  if (!runtime || !workbook) return { ok: false, error: 'No workbook is currently open.' }
  const worksheet = sheetId ? workbook.getSheetBySheetId(sheetId) : workbook.getActiveSheet()
  if (!worksheet) return { ok: false, error: `Unknown sheet: ${sheetId}` }
  try {
    if (worksheet.getSheetId() !== workbook.getActiveSheet()?.getSheetId()) {
      workbook.setActiveSheet(worksheet)
    }
    if (ctx.lazyWorkbookRef.current) {
      // Best-effort: selection works on not-yet-streamed cells too, but
      // loading the range means the user sees data, not an empty grid
      await ensureLazyRangeLoaded(
        runtime,
        ctx.lazyWorkbookRef,
        worksheet,
        { ...bounds },
        setMessage,
      )
    }
    worksheet
      .getRange(
        bounds.startRow,
        bounds.startColumn,
        bounds.endRow - bounds.startRow + 1,
        bounds.endColumn - bounds.startColumn + 1,
      )
      .activate()
    worksheet.scrollToCell(bounds.startRow, bounds.startColumn)
    return { ok: true, sheetName: worksheet.getSheetName() }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Selection failed',
    }
  }
}
