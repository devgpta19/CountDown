import os
import math
import struct
import zlib

def make_png(width, height, pixel_fn):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    raw = bytearray()
    
    for y in range(height):
        raw.append(0)  # Filter byte: 0 = None
        for x in range(width):
            r, g, b, a = pixel_fn(x, y, width, height)
            raw.extend((r, g, b, a))
            
    idat = chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

def t_minus_pixel(x, y, w, h):
    # Normalized coords from center [-1, 1]
    nx = (x - w / 2) / (w / 2)
    ny = (y - h / 2) / (h / 2)
    dist = math.hypot(nx, ny)
    angle = math.atan2(ny, nx)  # -pi to pi

    # Background: Rounded rectangle or deep forest fill
    # Corner radius ~0.2
    corner_box = max(abs(nx), abs(ny))
    if abs(nx) > 0.65 and abs(ny) > 0.65:
        cx = math.copysign(0.65, nx)
        cy = math.copysign(0.65, ny)
        cdist = math.hypot(nx - cx, ny - cy)
        if cdist > 0.35:
            return (0, 0, 0, 0) # transparent outside rounded squircle

    # Default background: #051F20
    bg = (5, 31, 32, 255)

    # Outer subtle track ring: dist between 0.78 and 0.84
    if 0.78 <= dist <= 0.84:
        return (35, 83, 71, 255) # Forest Sage Accent

    # Progress arc ring: dist between 0.64 and 0.74
    if 0.64 <= dist <= 0.74:
        # 3/4 circle arc (like countdown gauge)
        if angle > -math.pi * 0.75 and angle < math.pi * 0.65:
            return (142, 182, 155, 255) # Mint Sage Primary
        elif angle >= math.pi * 0.65 and angle <= math.pi * 0.85:
            return (255, 59, 48, 255) # Red urgent indicator tip
        else:
            return (11, 43, 38, 255) # Dark track slate

    # Clock center hub & "T-" symbol
    # Center dot
    if dist <= 0.12:
        return (218, 241, 222, 255) # Soft Mint Ivory

    # Hour / Minute countdown hand
    # Hand pointing up-right towards 2 o'clock
    hand_angle = -math.pi / 3  # ~60 deg
    dot_prod = nx * math.cos(hand_angle) + ny * math.sin(hand_angle)
    cross_prod = abs(-nx * math.sin(hand_angle) + ny * math.cos(hand_angle))
    if 0.08 <= dot_prod <= 0.52 and cross_prod <= 0.05:
        return (218, 241, 222, 255)

    # Second hand (thin red urgency pointer) pointing downwards
    red_angle = math.pi * 0.7
    r_dot = nx * math.cos(red_angle) + ny * math.sin(red_angle)
    r_cross = abs(-nx * math.sin(red_angle) + ny * math.cos(red_angle))
    if 0.08 <= r_dot <= 0.58 and r_cross <= 0.025:
        return (255, 59, 48, 255)

    # Stylized T- symbol at top-left quadrant (-0.45, -0.45)
    # T horizontal bar
    if -0.52 <= nx <= -0.18 and -0.48 <= ny <= -0.38:
        return (142, 182, 155, 230)
    # T vertical stem
    if -0.38 <= nx <= -0.32 and -0.48 <= ny <= -0.15:
        return (142, 182, 155, 230)
    # Minus sign
    if -0.12 <= nx <= 0.02 and -0.44 <= ny <= -0.38:
        return (142, 182, 155, 230)

    # Subtle inner dark circular plate: dist <= 0.60
    if dist <= 0.60:
        return (11, 43, 38, 255) # Dark Forest Slate

    return bg

os.makedirs('icons', exist_ok=True)

print("Generating icons/icon-192x192.png...")
png_192 = make_png(192, 192, t_minus_pixel)
with open('icons/icon-192x192.png', 'wb') as f:
    f.write(png_192)

print("Generating icons/icon-512x512.png...")
png_512 = make_png(512, 512, t_minus_pixel)
with open('icons/icon-512x512.png', 'wb') as f:
    f.write(png_512)

# Also generate SVG icon
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="dialGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FF3B30" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#FF3B30" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#163832"/>
      <stop offset="50%" stop-color="#235347"/>
      <stop offset="100%" stop-color="#8EB69B"/>
    </linearGradient>
  </defs>
  <!-- Background squircle -->
  <rect x="16" y="16" width="480" height="480" rx="100" fill="#051F20" stroke="#8EB69B" stroke-width="2" stroke-opacity="0.25"/>
  <!-- Inner sub-surface -->
  <circle cx="256" cy="256" r="190" fill="#0B2B26"/>
  <!-- Outer tick ring -->
  <circle cx="256" cy="256" r="210" fill="none" stroke="#235347" stroke-width="6" stroke-dasharray="4 12"/>
  <!-- Progress track -->
  <circle cx="256" cy="256" r="160" fill="none" stroke="#163832" stroke-width="18"/>
  <!-- Active Arc -->
  <circle cx="256" cy="256" r="160" fill="none" stroke="url(#arcGrad)" stroke-width="18" stroke-linecap="round" stroke-dasharray="1005" stroke-dashoffset="300" transform="rotate(-90 256 256)"/>
  <!-- Urgency tip -->
  <circle cx="395" cy="336" r="14" fill="#FF3B30"/>
  <!-- Center Plate -->
  <circle cx="256" cy="256" r="110" fill="#051F20" stroke="#8EB69B" stroke-width="2" stroke-opacity="0.3"/>
  <!-- Clock hands -->
  <line x1="256" y1="256" x2="330" y2="180" stroke="#DAF1DE" stroke-width="10" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="200" y2="340" stroke="#FF3B30" stroke-width="5" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="18" fill="#DAF1DE"/>
  <circle cx="256" cy="256" r="8" fill="#051F20"/>
  <!-- T-Minus Brand Text -->
  <text x="256" y="140" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#8EB69B" text-anchor="middle" letter-spacing="4">T-MINUS</text>
</svg>'''

with open('icons/icon.svg', 'w') as f:
    f.write(svg_content)

# Generate favicon.ico by copying 192 png as icon or minimal bmp/ico
# Modern browsers accept PNG favicon!
with open('favicon.png', 'wb') as f:
    f.write(png_192)

print("Icon generation completed!")

