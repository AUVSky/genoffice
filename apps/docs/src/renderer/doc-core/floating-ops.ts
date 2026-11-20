import type { JSONContent } from '@tiptap/core'
import type { ImageWrap, NewImage } from '@genoffice/docx-engine'
import { emuToPx, parseEmu } from './lengths'

/**
 * Picture-node construction shared by the insert-picture flow and its save
 * tests. The AI tool wrappers that used to live beside this helper are gone
 * in this fork; the node shape is still the contract with the docx engine.
 */

const LENGTH_DESC = '"2.54cm", "1in", "72pt", "96px" or a bare number of points'

const WRAP_TO_IMAGE: Record<FloatSpec['wrap'], ImageWrap> = {
  square: 'square-left',
  tight: 'tight-left',
  topAndBottom: 'topBottom',
  behind: 'behind',
  inFront: 'front',
}

export interface FloatSpec {
  anchor: 'paragraph' | 'page' | 'margin'
  xEmu: number
  yEmu: number
  wrap: 'square' | 'tight' | 'topAndBottom' | 'behind' | 'inFront'
}

export interface PictureInput {
  base64: string
  mime: NewImage['mime']
  naturalWidth: number
  naturalHeight: number
  width?: unknown
  height?: unknown
  altText?: string
  label?: string
  float?: FloatSpec
}

export function pictureNode(
  input: PictureInput,
): { node: JSONContent; widthPx: number; heightPx: number } | { error: string } {
  const wEmu = input.width === undefined ? undefined : parseEmu(input.width, 'pt')
  const hEmu = input.height === undefined ? undefined : parseEmu(input.height, 'pt')
  if ((input.width !== undefined && !wEmu) || (input.height !== undefined && !hEmu))
    return { error: `width and height must be ${LENGTH_DESC}` }
  const ratio = input.naturalWidth / Math.max(1, input.naturalHeight)
  let widthPx: number
  let heightPx: number
  if (wEmu && hEmu) {
    widthPx = emuToPx(wEmu)
    heightPx = emuToPx(hEmu)
  } else if (wEmu) {
    widthPx = emuToPx(wEmu)
    heightPx = Math.round(widthPx / ratio)
  } else if (hEmu) {
    heightPx = emuToPx(hEmu)
    widthPx = Math.round(heightPx * ratio)
  } else {
    const scale = Math.min(1, 480 / input.naturalWidth)
    widthPx = Math.round(input.naturalWidth * scale)
    heightPx = Math.round(input.naturalHeight * scale)
  }
  widthPx = Math.max(1, widthPx)
  heightPx = Math.max(1, heightPx)
  const genImage: NewImage = {
    base64: input.base64,
    mime: input.mime,
    widthPx,
    heightPx,
    ...(input.altText ? { altText: input.altText } : {}),
  }
  const attrs: Record<string, unknown> = {
    docxIndex: null,
    blockType: 'image',
    label: input.label ?? 'Picture',
    imageDataUrl: `data:${input.mime};base64,${input.base64}`,
    imageWidthPx: widthPx,
    imageHeightPx: heightPx,
  }
  if (input.float) {
    const { anchor, xEmu, yEmu, wrap } = input.float
    genImage.wrap = WRAP_TO_IMAGE[wrap]
    genImage.posOffsetEmu = {
      x: xEmu,
      y: yEmu,
      ...(anchor === 'paragraph' ? {} : { relativeTo: anchor }),
    }
    attrs.imageWrap = genImage.wrap
    attrs.imageOffsetXEmu = xEmu
    attrs.imageOffsetYEmu = yEmu
    if (anchor !== 'paragraph') attrs.imageRelV = anchor
  }
  attrs.genImage = genImage
  return { node: { type: 'docProtected', attrs }, widthPx, heightPx }
}
