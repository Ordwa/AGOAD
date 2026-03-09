import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let repoRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let assetsRoot = repoRoot.appendingPathComponent("src/assets/mystic_woods_free_2.2/sprites")
let outputRoot = repoRoot.appendingPathComponent("src/maps/shaman_hut", isDirectory: true)

let tileSize = 16
let cols = 32
let rows = 24
let width = cols * tileSize
let height = rows * tileSize

struct Palette {
  static let voidBlack = cgColor(4, 3, 4)
  static let beamShadow = cgColor(19, 10, 6)
  static let woodDark = cgColor(54, 31, 18)
  static let woodMid = cgColor(88, 53, 29)
  static let woodLight = cgColor(123, 80, 45)
  static let earthDark = cgColor(67, 43, 22)
  static let earthMid = cgColor(105, 72, 38)
  static let earthLight = cgColor(148, 109, 62)
  static let earthDust = cgColor(176, 136, 85)
  static let straw = cgColor(171, 139, 79)
  static let strawLight = cgColor(215, 187, 120)
  static let cloth = cgColor(105, 140, 54)
  static let clothShadow = cgColor(63, 92, 34)
  static let hide = cgColor(154, 109, 58)
  static let hideShadow = cgColor(107, 72, 34)
  static let hideLight = cgColor(209, 182, 131)
  static let bone = cgColor(220, 205, 167)
  static let boneShadow = cgColor(157, 139, 107)
  static let stoneDark = cgColor(58, 57, 55)
  static let stoneMid = cgColor(93, 91, 88)
  static let stoneLight = cgColor(132, 129, 124)
  static let wax = cgColor(240, 226, 190)
  static let ember = cgColor(255, 140, 63)
  static let fire = cgColor(255, 212, 98)
  static let smoke = cgColor(201, 220, 173, alpha: 0.18)
  static let shadowSoft = cgColor(13, 8, 4, alpha: 0.18)
  static let shadowMid = cgColor(10, 6, 3, alpha: 0.34)
  static let shadowHeavy = cgColor(7, 4, 2, alpha: 0.5)
  static let glowGreen = cgColor(78, 243, 105)
  static let glowGreenSoft = cgColor(88, 255, 133, alpha: 0.28)
  static let glowWarm = cgColor(255, 191, 103, alpha: 0.18)
  static let potionBlue = cgColor(88, 186, 205)
  static let potionGreen = cgColor(96, 197, 123)
  static let ink = cgColor(33, 25, 18)
}

func cgColor(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, alpha: CGFloat = 1.0) -> CGColor {
  CGColor(red: r / 255.0, green: g / 255.0, blue: b / 255.0, alpha: alpha)
}

func loadImage(_ url: URL) throws -> CGImage {
  guard
    let source = CGImageSourceCreateWithURL(url as CFURL, nil),
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)
  else {
    throw NSError(domain: "generate-shaman-hut-map", code: 1, userInfo: [
      NSLocalizedDescriptionKey: "Impossibile caricare \(url.path)",
    ])
  }
  return image
}

func cropImage(_ image: CGImage, x: Int, y: Int, width: Int, height: Int) -> CGImage {
  guard let cropped = image.cropping(to: CGRect(x: x, y: y, width: width, height: height)) else {
    fatalError("Crop fuori range")
  }
  return cropped
}

func makeContext() -> CGContext {
  let colorSpace = CGColorSpaceCreateDeviceRGB()
  let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
  let context = CGContext(
    data: nil,
    width: width,
    height: height,
    bitsPerComponent: 8,
    bytesPerRow: width * 4,
    space: colorSpace,
    bitmapInfo: bitmapInfo
  )!
  context.interpolationQuality = .none
  context.setShouldAntialias(false)
  context.translateBy(x: 0, y: CGFloat(height))
  context.scaleBy(x: 1, y: -1)
  return context
}

func saveContext(_ context: CGContext, to url: URL) throws {
  guard let image = context.makeImage() else {
    throw NSError(domain: "generate-shaman-hut-map", code: 2, userInfo: [
      NSLocalizedDescriptionKey: "Impossibile finalizzare \(url.path)",
    ])
  }

  guard
    let destination = CGImageDestinationCreateWithURL(
      url as CFURL,
      UTType.png.identifier as CFString,
      1,
      nil
    )
  else {
    throw NSError(domain: "generate-shaman-hut-map", code: 3, userInfo: [
      NSLocalizedDescriptionKey: "Impossibile creare il file \(url.path)",
    ])
  }

  CGImageDestinationAddImage(destination, image, nil)
  if !CGImageDestinationFinalize(destination) {
    throw NSError(domain: "generate-shaman-hut-map", code: 4, userInfo: [
      NSLocalizedDescriptionKey: "Impossibile salvare \(url.path)",
    ])
  }
}

func fillRect(_ context: CGContext, _ x: Int, _ y: Int, _ w: Int, _ h: Int, _ color: CGColor) {
  context.setFillColor(color)
  context.fill(CGRect(x: x, y: y, width: w, height: h))
}

func strokeRect(_ context: CGContext, _ x: Int, _ y: Int, _ w: Int, _ h: Int, _ color: CGColor, lineWidth: Int = 1) {
  context.setStrokeColor(color)
  context.setLineWidth(CGFloat(lineWidth))
  context.stroke(CGRect(x: x, y: y, width: w, height: h))
}

func fillEllipse(_ context: CGContext, _ x: Int, _ y: Int, _ w: Int, _ h: Int, _ color: CGColor) {
  context.setFillColor(color)
  context.fillEllipse(in: CGRect(x: x, y: y, width: w, height: h))
}

func strokeEllipse(_ context: CGContext, _ x: Int, _ y: Int, _ w: Int, _ h: Int, _ color: CGColor, lineWidth: Int = 1) {
  context.setStrokeColor(color)
  context.setLineWidth(CGFloat(lineWidth))
  context.strokeEllipse(in: CGRect(x: x, y: y, width: w, height: h))
}

func drawImage(_ context: CGContext, _ image: CGImage, x: Int, y: Int, width: Int? = nil, height: Int? = nil, alpha: CGFloat = 1.0) {
  let drawWidth = width ?? image.width
  let drawHeight = height ?? image.height
  context.saveGState()
  context.setAlpha(alpha)
  context.draw(image, in: CGRect(x: x, y: y, width: drawWidth, height: drawHeight))
  context.restoreGState()
}

func drawLine(_ context: CGContext, from start: CGPoint, to end: CGPoint, color: CGColor, width: Int = 1) {
  context.saveGState()
  context.setStrokeColor(color)
  context.setLineWidth(CGFloat(width))
  context.move(to: start)
  context.addLine(to: end)
  context.strokePath()
  context.restoreGState()
}

func drawFloorShadow(_ context: CGContext, x: Int, y: Int, width: Int, height: Int) {
  fillEllipse(context, x - 10, y + 6, width + 20, height, Palette.shadowSoft)
  fillEllipse(context, x, y + 8, width, height - 2, Palette.shadowMid)
}

func drawCandle(_ context: CGContext, x: Int, y: Int, height: Int = 14, glow: Bool = false) {
  if glow {
    fillEllipse(context, x - 10, y - 12, 28, 26, Palette.glowWarm)
  }
  fillRect(context, x + 3, y + 4, 6, height, Palette.wax)
  fillRect(context, x + 4, y + 2, 4, 3, Palette.ember)
  fillRect(context, x + 3, y, 6, 4, Palette.fire)
  fillRect(context, x + 2, y + height + 2, 8, 2, Palette.boneShadow)
}

func drawSkull(_ context: CGContext, x: Int, y: Int, scale: Int = 1) {
  let s = scale
  fillRect(context, x + 2 * s, y + 1 * s, 8 * s, 7 * s, Palette.bone)
  fillRect(context, x + 3 * s, y + 7 * s, 6 * s, 4 * s, Palette.bone)
  fillRect(context, x + 4 * s, y + 11 * s, 1 * s, 2 * s, Palette.bone)
  fillRect(context, x + 7 * s, y + 11 * s, 1 * s, 2 * s, Palette.bone)
  fillRect(context, x + 3 * s, y + 3 * s, 2 * s, 2 * s, Palette.ink)
  fillRect(context, x + 7 * s, y + 3 * s, 2 * s, 2 * s, Palette.ink)
  fillRect(context, x + 5 * s, y + 6 * s, 2 * s, 2 * s, Palette.ink)
  fillRect(context, x + 2 * s, y + 1 * s, 8 * s, 1 * s, Palette.hideLight)
}

func drawBone(_ context: CGContext, x: Int, y: Int, length: Int, angle: Int = 0) {
  let horizontal = angle == 0
  let mainLength = horizontal ? length : 4
  let sideLength = horizontal ? 4 : length
  fillRect(context, x, y + (horizontal ? 2 : 0), mainLength, sideLength, Palette.bone)
  if horizontal {
    fillRect(context, x - 2, y, 4, 4, Palette.bone)
    fillRect(context, x - 2, y + 4, 4, 4, Palette.bone)
    fillRect(context, x + length - 2, y, 4, 4, Palette.bone)
    fillRect(context, x + length - 2, y + 4, 4, 4, Palette.bone)
  } else {
    fillRect(context, x, y - 2, 4, 4, Palette.bone)
    fillRect(context, x + 4, y - 2, 4, 4, Palette.bone)
    fillRect(context, x, y + length - 2, 4, 4, Palette.bone)
    fillRect(context, x + 4, y + length - 2, 4, 4, Palette.bone)
  }
}

func drawBonePile(_ context: CGContext, x: Int, y: Int, width: Int, height: Int) {
  fillEllipse(context, x, y + height / 4, width, height / 2, Palette.shadowSoft)
  drawBone(context, x: x + 8, y: y + 10, length: 18)
  drawBone(context, x: x + 18, y: y + 6, length: 14, angle: 90)
  drawBone(context, x: x + 28, y: y + 12, length: 16)
  drawSkull(context, x: x + width / 2 - 6, y: y)
}

func drawBottle(_ context: CGContext, x: Int, y: Int, color: CGColor) {
  fillRect(context, x + 2, y + 2, 4, 4, Palette.hideLight)
  fillRect(context, x + 1, y + 6, 6, 10, color)
  fillRect(context, x + 2, y + 16, 4, 2, Palette.ink)
}

func drawBook(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x, y, 14, 10, Palette.hideLight)
  fillRect(context, x + 14, y, 14, 10, Palette.wax)
  fillRect(context, x + 12, y, 2, 10, Palette.hideShadow)
  fillRect(context, x + 4, y + 3, 8, 1, Palette.ink)
  fillRect(context, x + 18, y + 3, 8, 1, Palette.ink)
  fillRect(context, x + 4, y + 6, 8, 1, Palette.ink)
  fillRect(context, x + 18, y + 6, 8, 1, Palette.ink)
}

func drawTopBeam(_ context: CGContext) {
  fillRect(context, 0, 0, width, height, Palette.voidBlack)
  fillRect(context, 16, 16, width - 32, 72, Palette.woodDark)
  fillRect(context, 16, 16, width - 32, 10, Palette.woodLight)
  fillRect(context, 16, 26, width - 32, 8, Palette.woodMid)
  fillRect(context, 16, 34, width - 32, 54, Palette.woodDark)
  fillRect(context, 16, 80, width - 32, 8, Palette.beamShadow)

  for offset in stride(from: 18, to: width - 32, by: 22) {
    let plankWidth = 10 + ((offset / 11) % 3) * 2
    fillRect(context, offset, 34, plankWidth, 54, ((offset / 7) % 2 == 0) ? Palette.woodMid : Palette.woodDark)
    fillRect(context, offset + plankWidth - 2, 34, 2, 54, Palette.beamShadow)
    fillRect(context, offset + 1, 42, 1, 2, Palette.hideLight)
  }

  fillRect(context, 16, 16, 16, height - 32, Palette.woodDark)
  fillRect(context, width - 32, 16, 16, height - 32, Palette.woodDark)
  fillRect(context, 18, 16, 4, height - 32, Palette.woodLight)
  fillRect(context, width - 22, 16, 4, height - 32, Palette.woodLight)

  fillRect(context, 16, height - 32, width / 2 - 56, 16, Palette.woodDark)
  fillRect(context, width / 2 + 40, height - 32, width / 2 - 56, 16, Palette.woodDark)
  fillRect(context, width / 2 - 56, height - 32, 16, 16, Palette.woodDark)
  fillRect(context, width / 2 + 40, height - 32, 16, 16, Palette.woodDark)
  fillRect(context, width / 2 - 56, height - 16, 112, 16, Palette.beamShadow)
}

func drawEarthFloor(_ context: CGContext) {
  fillRect(context, 32, 88, width - 64, height - 136, Palette.earthMid)
  for row in 6..<(rows - 2) {
    for col in 2..<(cols - 2) {
      let x = col * tileSize
      let y = row * tileSize
      let variant = (row * 17 + col * 11) % 5
      let baseColor: CGColor
      switch variant {
      case 0: baseColor = Palette.earthDark
      case 1: baseColor = Palette.earthMid
      case 2: baseColor = Palette.earthLight
      case 3: baseColor = Palette.earthMid
      default: baseColor = Palette.earthDust
      }
      fillRect(context, x, y, tileSize, tileSize, baseColor)
      if (row + col) % 2 == 0 {
        fillRect(context, x + 2, y + 10, 5, 2, Palette.straw)
      }
      if (row * 5 + col * 7) % 6 == 0 {
        fillRect(context, x + 10, y + 5, 3, 3, Palette.beamShadow)
      }
      if (row * 3 + col * 2) % 8 == 0 {
        fillRect(context, x + 5, y + 3, 2, 2, Palette.earthLight)
      }
    }
  }

  for inset in 0..<6 {
    let alpha = 0.06 + CGFloat(inset) * 0.03
    fillRect(context, 32 + inset * 6, 88 + inset * 5, width - 64 - inset * 12, 10, cgColor(0, 0, 0, alpha: alpha))
    fillRect(context, 32 + inset * 6, height - 58 - inset * 5, width - 64 - inset * 12, 8, cgColor(0, 0, 0, alpha: alpha))
    fillRect(context, 32 + inset * 5, 88, 10, height - 136, cgColor(0, 0, 0, alpha: alpha))
    fillRect(context, width - 42 - inset * 5, 88, 10, height - 136, cgColor(0, 0, 0, alpha: alpha))
  }
}

func drawStrawPatch(_ context: CGContext, x: Int, y: Int, width: Int, height: Int) {
  fillEllipse(context, x, y, width, height, Palette.straw)
  fillEllipse(context, x + 8, y + 6, width - 16, height - 12, Palette.strawLight)
  for index in 0..<8 {
    let px = x + 10 + index * (width - 24) / 7
    fillRect(context, px, y + 8 + (index % 3) * 4, 8, 1, Palette.hideLight)
    fillRect(context, px + 2, y + 11 + (index % 2) * 3, 6, 1, Palette.straw)
  }
}

func drawRitualFloor(_ context: CGContext) {
  fillEllipse(context, 156, 98, 200, 188, Palette.shadowSoft)
  fillEllipse(context, 164, 108, 184, 168, cgColor(61, 51, 32))
  fillEllipse(context, 176, 120, 160, 144, cgColor(75, 70, 46))
  strokeEllipse(context, 188, 126, 136, 126, Palette.stoneLight, lineWidth: 4)
  strokeEllipse(context, 196, 134, 120, 110, Palette.stoneDark, lineWidth: 3)
  fillEllipse(context, 204, 142, 104, 94, Palette.glowGreenSoft)
  strokeEllipse(context, 204, 142, 104, 94, Palette.glowGreen, lineWidth: 3)

  let center = CGPoint(x: 256, y: 189)
  let radius = CGFloat(48)
  var points: [CGPoint] = []
  for index in 0..<5 {
    let angle = (-90.0 + Double(index) * 72.0) * Double.pi / 180.0
    points.append(
      CGPoint(
        x: center.x + CGFloat(cos(angle)) * radius,
        y: center.y + CGFloat(sin(angle)) * radius
      )
    )
  }

  let starOrder = [0, 2, 4, 1, 3, 0]
  for index in 0..<(starOrder.count - 1) {
    drawLine(
      context,
      from: points[starOrder[index]],
      to: points[starOrder[index + 1]],
      color: Palette.glowGreen,
      width: 4
    )
  }
  strokeEllipse(context, 214, 151, 84, 76, Palette.glowGreen, lineWidth: 2)

  for index in 0..<12 {
    let angle = Double(index) * (Double.pi * 2.0 / 12.0)
    let px = Int(center.x + CGFloat(cos(angle)) * 74) - 4
    let py = Int(center.y + CGFloat(sin(angle)) * 68) - 4
    fillRect(context, px, py, 8, 8, ((index % 2) == 0) ? Palette.stoneMid : Palette.stoneLight)
  }
}

func drawBackdropProps(_ context: CGContext) {
  fillEllipse(context, 54, 46, 24, 24, cgColor(215, 176, 107, alpha: 0.12))
  strokeEllipse(context, 58, 50, 16, 16, Palette.hideLight, lineWidth: 1)
  drawLine(context, from: CGPoint(x: 66, y: 66), to: CGPoint(x: 66, y: 84), color: Palette.hideShadow, width: 1)
  for index in 0..<3 {
    drawLine(
      context,
      from: CGPoint(x: 66, y: 64),
      to: CGPoint(x: 58 + index * 4, y: 75),
      color: Palette.potionBlue,
      width: 1
    )
  }

  fillRect(context, 108, 60, 118, 8, Palette.woodMid)
  fillRect(context, 114, 68, 4, 18, Palette.woodLight)
  fillRect(context, 214, 68, 4, 18, Palette.woodLight)
  drawSkull(context, x: 146, y: 45)
  drawBottle(context, x: 120, y: 48, color: Palette.potionBlue)
  drawBottle(context, x: 188, y: 46, color: Palette.potionGreen)
  fillRect(context, 130, 71, 12, 13, Palette.hide)
  fillRect(context, 168, 71, 14, 13, Palette.hideShadow)
  fillRect(context, 196, 70, 12, 14, Palette.hideLight)

  fillRect(context, 300, 34, 88, 68, Palette.stoneDark)
  fillRect(context, 308, 42, 72, 52, Palette.stoneMid)
  fillRect(context, 316, 50, 56, 36, Palette.stoneLight)
  drawSkull(context, x: 336, y: 54, scale: 2)
  strokeRect(context, 300, 34, 88, 68, Palette.beamShadow, lineWidth: 2)
  fillRect(context, 392, 38, 20, 44, Palette.cloth)
  fillRect(context, 398, 82, 8, 10, Palette.clothShadow)
  fillRect(context, 426, 54, 8, 8, Palette.bone)
  fillRect(context, 436, 48, 7, 20, Palette.bone)
  fillRect(context, 446, 52, 8, 8, Palette.bone)
  drawLine(context, from: CGPoint(x: 430, y: 50), to: CGPoint(x: 454, y: 72), color: Palette.bone, width: 1)
  drawLine(context, from: CGPoint(x: 454, y: 50), to: CGPoint(x: 430, y: 72), color: Palette.bone, width: 1)
}

func drawHangingHerbs(_ context: CGContext, x: Int, y: Int, count: Int, spacing: Int) {
  for index in 0..<count {
    let px = x + index * spacing
    fillRect(context, px + 3, y, 2, 10, Palette.hideLight)
    fillRect(context, px, y + 10, 8, 12, (index % 2 == 0) ? Palette.cloth : Palette.straw)
    fillRect(context, px + 2, y + 14, 4, 10, (index % 2 == 0) ? Palette.clothShadow : Palette.hide)
  }
}

func drawBanner(_ context: CGContext, x: Int, y: Int, flip: Bool = false) {
  for column in 0..<6 {
    let offset = flip ? (5 - column) : column
    fillRect(context, x + column * 6, y + offset, 6, 22 - offset, Palette.cloth)
    fillRect(context, x + column * 6, y + offset + 3, 6, 2, Palette.clothShadow)
  }
}

func drawTorchSconce(_ context: CGContext, x: Int, y: Int, withGlow: Bool = false) {
  if withGlow {
    fillEllipse(context, x - 14, y - 10, 42, 38, Palette.glowWarm)
  }
  fillRect(context, x + 8, y + 8, 4, 18, Palette.woodDark)
  fillRect(context, x + 4, y + 6, 12, 4, Palette.stoneLight)
  fillRect(context, x + 6, y + 2, 8, 8, Palette.ember)
  fillRect(context, x + 7, y, 6, 6, Palette.fire)
}

func drawCauldron(_ context: CGContext, x: Int, y: Int) {
  drawFloorShadow(context, x: x + 2, y: y + 44, width: 72, height: 22)
  fillEllipse(context, x + 12, y + 50, 48, 18, Palette.glowWarm)
  fillRect(context, x + 14, y + 46, 12, 8, Palette.ember)
  fillRect(context, x + 32, y + 42, 12, 12, Palette.fire)
  fillRect(context, x + 50, y + 46, 12, 8, Palette.ember)
  fillRect(context, x + 10, y + 32, 52, 18, Palette.stoneDark)
  fillEllipse(context, x + 6, y + 10, 60, 34, Palette.stoneMid)
  fillEllipse(context, x + 12, y + 4, 48, 14, Palette.stoneDark)
  fillEllipse(context, x + 12, y + 8, 48, 10, Palette.glowGreenSoft)
  fillEllipse(context, x + 18, y + 10, 36, 8, Palette.glowGreen)
  fillRect(context, x + 12, y + 38, 6, 14, Palette.woodDark)
  fillRect(context, x + 54, y + 38, 6, 14, Palette.woodDark)
  strokeEllipse(context, x + 6, y + 10, 60, 34, Palette.ink, lineWidth: 2)
  fillRect(context, x + 26, y + 6, 6, 2, Palette.fire)
  fillRect(context, x + 38, y + 9, 5, 2, Palette.fire)
}

func drawAltar(_ context: CGContext, x: Int, y: Int) {
  drawFloorShadow(context, x: x + 2, y: y + 52, width: 110, height: 24)
  fillRect(context, x, y + 24, 112, 40, Palette.stoneDark)
  fillRect(context, x + 8, y + 16, 96, 16, Palette.stoneMid)
  fillRect(context, x + 16, y + 8, 80, 12, Palette.stoneLight)
  fillRect(context, x + 50, y + 6, 12, 20, Palette.glowGreen)
  fillRect(context, x + 44, y + 14, 24, 12, Palette.glowGreenSoft)
  drawCandle(context, x: x + 10, y: y + 6)
  drawCandle(context, x: x + 88, y: y + 6)
  drawSkull(context, x: x + 6, y: y + 48)
  drawSkull(context, x: x + 88, y: y + 48)
  fillRect(context, x + 28, y + 38, 12, 8, Palette.hide)
  fillRect(context, x + 72, y + 38, 12, 8, Palette.hide)
  strokeRect(context, x, y + 24, 112, 40, Palette.ink, lineWidth: 2)
}

func drawDesk(_ context: CGContext, x: Int, y: Int) {
  drawFloorShadow(context, x: x + 4, y: y + 54, width: 120, height: 24)
  fillRect(context, x + 8, y + 8, 116, 10, Palette.woodLight)
  fillRect(context, x, y + 18, 132, 20, Palette.woodMid)
  fillRect(context, x + 10, y + 38, 8, 34, Palette.woodDark)
  fillRect(context, x + 112, y + 38, 8, 34, Palette.woodDark)
  fillRect(context, x + 16, y + 44, 32, 20, Palette.woodDark)
  fillRect(context, x + 82, y + 44, 24, 18, Palette.stoneDark)
  drawBook(context, x: x + 18, y: y + 20)
  drawBottle(context, x: x + 66, y: y + 16, color: Palette.potionBlue)
  drawBottle(context, x: x + 78, y: y + 18, color: Palette.potionGreen)
  fillRect(context, x + 96, y + 16, 12, 10, Palette.hide)
  fillRect(context, x + 20, y + 50, 18, 12, Palette.stoneMid)
  fillRect(context, x + 84, y + 52, 10, 8, Palette.hide)
  fillRect(context, x + 102, y + 52, 8, 10, Palette.hideLight)
  strokeRect(context, x, y + 18, 132, 20, Palette.ink, lineWidth: 2)
}

func drawBed(_ context: CGContext, x: Int, y: Int) {
  drawFloorShadow(context, x: x + 10, y: y + 82, width: 94, height: 24)
  fillRect(context, x + 8, y + 12, 92, 12, Palette.hideLight)
  fillRect(context, x, y + 24, 112, 68, Palette.hide)
  fillRect(context, x + 8, y + 30, 96, 54, Palette.hideShadow)
  fillRect(context, x + 14, y + 34, 84, 44, Palette.hide)
  fillRect(context, x + 8, y + 14, 34, 18, Palette.wax)
  fillRect(context, x + 44, y + 34, 50, 40, Palette.hideLight)
  fillRect(context, x + 28, y + 42, 70, 34, Palette.hide)
  fillRect(context, x + 16, y + 58, 24, 18, Palette.hideLight)
  fillRect(context, x + 102, y + 20, 8, 78, Palette.woodDark)
  fillRect(context, x + 6, y + 22, 6, 74, Palette.woodDark)
  strokeRect(context, x, y + 24, 112, 68, Palette.ink, lineWidth: 2)
}

func drawChest(_ context: CGContext, x: Int, y: Int) {
  drawFloorShadow(context, x: x + 2, y: y + 22, width: 44, height: 16)
  fillRect(context, x + 4, y + 8, 36, 24, Palette.woodDark)
  fillRect(context, x + 6, y + 10, 32, 20, Palette.woodMid)
  fillRect(context, x + 10, y + 4, 24, 10, Palette.woodLight)
  fillRect(context, x + 18, y + 16, 8, 6, Palette.fire)
  strokeRect(context, x + 4, y + 8, 36, 24, Palette.ink, lineWidth: 2)
}

func drawDoorway(_ context: CGContext, door: CGImage) {
  fillRect(context, width / 2 - 50, height - 30, 100, 14, Palette.woodMid)
  fillRect(context, width / 2 - 42, height - 42, 12, 28, Palette.woodDark)
  fillRect(context, width / 2 + 30, height - 42, 12, 28, Palette.woodDark)
  fillRect(context, width / 2 - 36, height - 58, 72, 18, Palette.beamShadow)
  drawImage(context, door, x: width / 2 - 32, y: height - 50, width: 64, height: 32)
}

func drawCircleCandles(_ context: CGContext) {
  let candlePositions = [
    (234, 106), (274, 106),
    (182, 134), (322, 136),
    (170, 188), (330, 188),
    (190, 240), (308, 240),
    (238, 258), (274, 258),
  ]
  for position in candlePositions {
    drawCandle(context, x: position.0, y: position.1)
  }
  drawSkull(context, x: 184, y: 154)
  drawSkull(context, x: 308, y: 154)
}

func drawForegroundDetails(_ context: CGContext) {
  drawBanner(context, x: 34, y: 18)
  drawBanner(context, x: width - 70, y: 18, flip: true)
  drawHangingHerbs(context, x: 136, y: 20, count: 6, spacing: 34)
  drawTorchSconce(context, x: 404, y: 60, withGlow: true)
  drawTorchSconce(context, x: 450, y: 80, withGlow: true)
  drawTorchSconce(context, x: 46, y: 234, withGlow: false)
  fillEllipse(context, 54, 66, 36, 26, Palette.smoke)
  fillEllipse(context, 62, 56, 28, 24, Palette.smoke)
  fillEllipse(context, 70, 42, 24, 20, Palette.smoke)
}

func drawLayer0(_ context: CGContext) {
  drawTopBeam(context)
  drawEarthFloor(context)
  drawStrawPatch(context, x: 188, y: 282, width: 132, height: 54)
  drawStrawPatch(context, x: 398, y: 132, width: 76, height: 36)
  drawRitualFloor(context)
  drawFloorShadow(context, x: 54, y: 116, width: 72, height: 20)
  drawFloorShadow(context, x: 204, y: 108, width: 106, height: 18)
  drawFloorShadow(context, x: 40, y: 292, width: 120, height: 22)
  drawFloorShadow(context, x: 370, y: 250, width: 92, height: 20)
  drawFloorShadow(context, x: 406, y: 324, width: 36, height: 14)
  fillRect(context, width / 2 - 16, height - 22, 32, 6, Palette.earthDark)
}

func drawLayer1(_ context: CGContext) {
  drawBackdropProps(context)
}

func drawLayer2(_ context: CGContext, door: CGImage) {
  drawCauldron(context, x: 44, y: 58)
  drawAltar(context, x: 198, y: 54)
  drawDesk(context, x: 34, y: 214)
  drawBed(context, x: 360, y: 132)
  drawChest(context, x: 402, y: 286)
  drawCircleCandles(context)
  drawBonePile(context, x: 414, y: 292, width: 48, height: 24)
  drawBone(context, x: 228, y: 302, length: 22)
  drawBone(context, x: 272, y: 304, length: 22)
  drawDoorway(context, door: door)
}

func drawLayer3(_ context: CGContext) {
  drawForegroundDetails(context)
}

try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true)

let woodenDoor = try loadImage(assetsRoot.appendingPathComponent("tilesets/walls/wooden_door.png"))
let doorTile = cropImage(woodenDoor, x: 0, y: 0, width: 32, height: 16)

let layer0 = makeContext()
let layer1 = makeContext()
let layer2 = makeContext()
let layer3 = makeContext()

drawLayer0(layer0)
drawLayer1(layer1)
drawLayer2(layer2, door: doorTile)
drawLayer3(layer3)

try saveContext(layer0, to: outputRoot.appendingPathComponent("shaman_hut.png"))
try saveContext(layer1, to: outputRoot.appendingPathComponent("shaman_hut_layer1.png"))
try saveContext(layer2, to: outputRoot.appendingPathComponent("shaman_hut_layer2.png"))
try saveContext(layer3, to: outputRoot.appendingPathComponent("shaman_hut_layer3.png"))

print("Generated shaman hut map layers in \(outputRoot.path)")
