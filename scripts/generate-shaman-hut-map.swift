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
  static let wallDark = cgColor(42, 24, 12)
  static let wallMid = cgColor(84, 51, 25)
  static let wallLight = cgColor(120, 77, 40)
  static let floorDust = cgColor(149, 105, 53)
  static let floorShadow = cgColor(77, 49, 27)
  static let bone = cgColor(219, 205, 163)
  static let ember = cgColor(255, 137, 56)
  static let fire = cgColor(255, 211, 97)
  static let rune = cgColor(88, 233, 94)
  static let cloth = cgColor(118, 154, 58)
  static let clothShadow = cgColor(67, 96, 36)
  static let stone = cgColor(86, 84, 83)
  static let stoneLight = cgColor(121, 119, 116)
  static let bedHide = cgColor(182, 137, 70)
  static let bedSheet = cgColor(221, 209, 176)
  static let desk = cgColor(113, 74, 34)
  static let deskDark = cgColor(72, 43, 21)
  static let potion = cgColor(82, 180, 189)
  static let greenGlow = cgColor(88, 255, 139, alpha: 0.35)
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

func drawSkull(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x + 2, y + 2, 8, 7, Palette.bone)
  fillRect(context, x + 3, y + 9, 6, 3, Palette.bone)
  fillRect(context, x + 4, y + 12, 1, 2, Palette.bone)
  fillRect(context, x + 7, y + 12, 1, 2, Palette.bone)
  fillRect(context, x + 4, y + 5, 1, 1, Palette.wallDark)
  fillRect(context, x + 7, y + 5, 1, 1, Palette.wallDark)
  fillRect(context, x + 5, y + 7, 2, 2, Palette.wallDark)
}

func drawTorch(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x + 6, y + 6, 4, 10, Palette.deskDark)
  fillRect(context, x + 5, y + 3, 6, 4, Palette.ember)
  fillRect(context, x + 6, y + 1, 4, 4, Palette.fire)
}

func drawBanner(_ context: CGContext, x: Int, y: Int, flip: Bool = false) {
  for column in 0..<6 {
    let offset = flip ? (5 - column) : column
    fillRect(context, x + column * 4, y + offset, 4, 20 - offset, Palette.cloth)
    fillRect(context, x + column * 4, y + offset + 2, 4, 2, Palette.clothShadow)
  }
}

func drawCauldron(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x + 6, y + 23, 28, 5, Palette.ember)
  fillRect(context, x + 10, y + 20, 5, 5, Palette.fire)
  fillRect(context, x + 17, y + 18, 5, 7, Palette.fire)
  fillRect(context, x + 25, y + 20, 5, 5, Palette.fire)
  fillRect(context, x + 4, y + 8, 32, 18, Palette.stone)
  fillRect(context, x + 6, y + 4, 28, 6, Palette.stoneLight)
  fillRect(context, x + 8, y + 1, 24, 5, Palette.wallDark)
  fillRect(context, x + 10, y + 7, 20, 6, Palette.greenGlow)
  strokeRect(context, x + 4, y + 4, 32, 22, Palette.wallDark)
}

func drawAltar(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x, y + 10, 56, 18, Palette.stone)
  fillRect(context, x + 4, y + 4, 48, 10, Palette.stoneLight)
  fillRect(context, x + 25, y - 6, 6, 18, Palette.rune)
  fillRect(context, x + 18, y + 1, 20, 8, Palette.greenGlow)
  drawTorch(context, x: x - 14, y: y)
  drawTorch(context, x: x + 54, y: y)
  drawSkull(context, x: x + 4, y: y + 20)
  drawSkull(context, x: x + 40, y: y + 20)
  strokeRect(context, x, y + 10, 56, 18, Palette.wallDark)
}

func drawDesk(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x + 6, y + 2, 44, 6, Palette.deskDark)
  fillRect(context, x, y + 8, 56, 14, Palette.desk)
  fillRect(context, x + 6, y + 22, 6, 18, Palette.deskDark)
  fillRect(context, x + 44, y + 22, 6, 18, Palette.deskDark)
  fillRect(context, x + 8, y + 12, 18, 10, Palette.bedSheet)
  fillRect(context, x + 10, y + 14, 14, 1, Palette.wallDark)
  fillRect(context, x + 30, y + 12, 6, 6, Palette.potion)
  fillRect(context, x + 38, y + 10, 6, 8, Palette.bone)
  fillRect(context, x + 24, y + 26, 8, 10, Palette.stone)
  strokeRect(context, x, y + 8, 56, 14, Palette.wallDark)
}

func drawBed(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x + 2, y + 2, 44, 16, Palette.bedSheet)
  fillRect(context, x + 4, y + 18, 40, 26, Palette.bedHide)
  fillRect(context, x, y + 18, 48, 28, Palette.bedHide)
  fillRect(context, x + 6, y + 22, 32, 18, cgColor(140, 95, 43))
  fillRect(context, x + 8, y + 24, 28, 12, cgColor(163, 114, 58))
  fillRect(context, x + 38, y + 30, 10, 8, Palette.bedSheet)
  strokeRect(context, x, y + 2, 48, 44, Palette.wallDark)
}

func drawChest(_ context: CGContext, x: Int, y: Int) {
  fillRect(context, x + 2, y + 6, 28, 20, Palette.deskDark)
  fillRect(context, x + 4, y + 8, 24, 16, Palette.desk)
  fillRect(context, x + 12, y + 13, 8, 4, Palette.fire)
  strokeRect(context, x + 2, y + 6, 28, 20, Palette.wallDark)
}

func drawRitualCircle(_ context: CGContext, x: Int, y: Int, diameter: Int) {
  let rect = CGRect(x: x, y: y, width: diameter, height: diameter)
  context.saveGState()
  context.setStrokeColor(Palette.rune)
  context.setLineWidth(4)
  context.strokeEllipse(in: rect)
  context.setStrokeColor(Palette.greenGlow)
  context.setLineWidth(10)
  context.strokeEllipse(in: rect.insetBy(dx: 8, dy: 8))
  context.restoreGState()

  let center = CGPoint(x: x + diameter / 2, y: y + diameter / 2)
  let radius = CGFloat(diameter / 2 - 10)
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
      color: Palette.rune,
      width: 4
    )
  }

  for index in 0..<12 {
    let angle = Double(index) * (Double.pi * 2.0 / 12.0)
    let px = Int(center.x + CGFloat(cos(angle)) * CGFloat(diameter / 2 + 6)) - 4
    let py = Int(center.y + CGFloat(sin(angle)) * CGFloat(diameter / 2 + 6)) - 4
    drawSkull(context, x: px, y: py)
  }
}

func drawFloorLayer(_ context: CGContext, floorTile: CGImage) {
  fillRect(context, 0, 0, width, height, Palette.wallDark)

  for row in 1..<(rows - 1) {
    for col in 1..<(cols - 1) {
      let x = col * tileSize
      let y = row * tileSize
      drawImage(context, floorTile, x: x, y: y)
      if (row + col) % 3 == 0 {
        fillRect(context, x + 2, y + 10, 4, 1, Palette.floorDust)
      }
      if (row * 7 + col * 3) % 11 == 0 {
        fillRect(context, x + 9, y + 4, 2, 2, Palette.floorShadow)
      }
    }
  }

  fillRect(context, 0, 0, width, tileSize, Palette.wallDark)
  fillRect(context, 0, height - tileSize, width, tileSize, Palette.wallDark)
  fillRect(context, 0, 0, tileSize, height, Palette.wallDark)
  fillRect(context, width - tileSize, 0, tileSize, height, Palette.wallDark)
  fillRect(context, width / 2 - 24, height - tileSize, 48, tileSize, Palette.floorDust)

  drawRitualCircle(context, x: 176, y: 120, diameter: 96)
}

func drawBackLayer(_ context: CGContext, chestStrip: CGImage) {
  for row in 0..<3 {
    for col in 0..<cols {
      let shade: CGColor = row == 0 ? Palette.wallLight : (row == 1 ? Palette.wallMid : Palette.wallDark)
      fillRect(context, col * tileSize, row * tileSize, tileSize, tileSize, shade)
      fillRect(context, col * tileSize, row * tileSize + 13, tileSize, 2, Palette.wallDark)
    }
  }

  drawImage(context, chestStrip, x: 64, y: 36)
  drawImage(context, chestStrip, x: 320, y: 36)
  drawTorch(context, x: 60, y: 44)
  drawTorch(context, x: 420, y: 42)
  drawSkull(context, x: 186, y: 26)
  drawSkull(context, x: 280, y: 26)
}

func drawGameplayLayer(_ context: CGContext, door: CGImage) {
  fillRect(context, width / 2 - 28, height - tileSize * 2, 56, 16, Palette.floorShadow)
  drawImage(context, door, x: width / 2 - 16, y: height - tileSize)

  drawCauldron(context, x: 44, y: 54)
  drawAltar(context, x: 206, y: 46)
  drawDesk(context, x: 34, y: 222)
  drawBed(context, x: 366, y: 146)
  drawChest(context, x: 404, y: 292)

  fillRect(context, 98, 72, 34, 8, Palette.bone)
  fillRect(context, 102, 80, 26, 8, Palette.stone)
  fillRect(context, 134, 74, 18, 10, Palette.desk)
  fillRect(context, 102, 86, 5, 8, Palette.potion)
  fillRect(context, 118, 86, 5, 8, Palette.potion)
  drawSkull(context, x: 134, y: 84)
}

func drawOverlayLayer(_ context: CGContext) {
  drawBanner(context, x: 18, y: 10)
  drawBanner(context, x: width - 42, y: 10, flip: true)

  for candleX in stride(from: 172, through: 340, by: 42) {
    fillRect(context, candleX, 104, 4, 12, Palette.bedSheet)
    fillRect(context, candleX - 1, 98, 6, 8, Palette.fire)
  }

  drawTorch(context, x: 462, y: 92)
  drawTorch(context, x: 40, y: 210)
}

try FileManager.default.createDirectory(at: outputRoot, withIntermediateDirectories: true)

let woodenFloor = try loadImage(assetsRoot.appendingPathComponent("tilesets/floors/wooden.png"))
let woodenDoor = try loadImage(assetsRoot.appendingPathComponent("tilesets/walls/wooden_door.png"))
let chestStrip = try loadImage(assetsRoot.appendingPathComponent("objects/chest_02.png"))

let layer0 = makeContext()
let layer1 = makeContext()
let layer2 = makeContext()
let layer3 = makeContext()

drawFloorLayer(layer0, floorTile: woodenFloor)
drawBackLayer(layer1, chestStrip: chestStrip)
drawGameplayLayer(layer2, door: woodenDoor)
drawOverlayLayer(layer3)

try saveContext(layer0, to: outputRoot.appendingPathComponent("shaman_hut.png"))
try saveContext(layer1, to: outputRoot.appendingPathComponent("shaman_hut_layer1.png"))
try saveContext(layer2, to: outputRoot.appendingPathComponent("shaman_hut_layer2.png"))
try saveContext(layer3, to: outputRoot.appendingPathComponent("shaman_hut_layer3.png"))

print("Generated shaman hut map layers in \(outputRoot.path)")
