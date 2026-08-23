import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

def generate_icons():
    icon_dir = Path(__file__).resolve().parent.parent / 'extension' / 'icons'
    icon_dir.mkdir(parents=True, exist_ok=True)
    
    # Save SVG
    svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4f46e5"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#grad)" filter="url(#shadow)"/>
  <rect x="24" y="24" width="80" height="80" rx="16" fill="#ffffff" fill-opacity="0.15"/>
  <text x="64" y="56" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="1">DOI</text>
  <path d="M44 68 L64 88 L84 68" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    (icon_dir / 'icon.svg').write_text(svg_content, encoding='utf-8')

    # Draw PNGs of different sizes
    sizes = [16, 32, 48, 128]
    for size in sizes:
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        radius = int(size * 0.22)
        draw.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=radius, fill=(79, 70, 229, 255))
        
        if size >= 48:
            margin = int(size * 0.15)
            draw.rounded_rectangle([(margin, margin), (size - 1 - margin, size - 1 - margin)], 
                                   radius=int(radius * 0.6), fill=(255, 255, 255, 45))
            
        if size == 16:
            draw.text((size // 2, size // 2), "D", fill=(255, 255, 255, 255), anchor="mm")
        elif size == 32:
            draw.text((size // 2, size // 2), "DOI", fill=(255, 255, 255, 255), anchor="mm")
        elif size == 48:
            draw.text((size // 2, int(size * 0.42)), "DOI", fill=(255, 255, 255, 255), anchor="mm")
            draw.line([(18, 32), (24, 38), (30, 32)], fill=(255, 255, 255, 255), width=2)
        else: # 128
            try:
                font = ImageFont.truetype("arial.ttf", 36)
            except Exception:
                font = None
            draw.text((64, 48), "DOI", fill=(255, 255, 255, 255), font=font, anchor="mm")
            draw.line([(44, 76), (64, 96), (84, 76)], fill=(255, 255, 255, 255), width=6)
            
        img.save(icon_dir / f'icon{size}.png', 'PNG')
    print("Generated icons successfully in", icon_dir)

if __name__ == '__main__':
    generate_icons()
