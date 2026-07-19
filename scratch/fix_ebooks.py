from PIL import Image
import os

def make_background_transparent(img_path, output_path):
    print(f"Processing {img_path}...")
    if not os.path.exists(img_path):
        print(f"Error: {img_path} does not exist.")
        return
        
    img = Image.open(img_path)
    img = img.convert("RGBA")
    datas = img.getdata()
    
    newData = []
    # threshold for what we consider "white" background
    # since it's a book cover, we want to be careful not to make the book content itself transparent if it has white.
    # Typically, the background of such covers is solid white (255, 255, 255).
    # Let's inspect if the background is solid white or has a gradient.
    # Usually a flood-fill from the corners is safer than a global color replacement,
    # because the book cover itself might contain white text or white graphics.
    # Let's do a flood-fill from the top-left (0,0) corner or check if we can just do color keying with tolerance.
    # Let's try flood fill or checking if pixel is near the border.
    # Let's start with a simpler check: if it's near-white, and close to the edges, or just global replace first.
    # Wait, we can do a flood fill transparency using PIL!
    # Let's implement a simple flood fill algorithm.
    
    width, height = img.size
    visited = set()
    to_visit = [(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)]
    
    # We want to find all pixels connected to the corners that are "near-white".
    # Near-white threshold: R > 230, G > 230, B > 230
    pixels = img.load()
    
    transparent_pixels = set()
    
    def is_near_white(color):
        r, g, b, *a = color
        return r > 220 and g > 220 and b > 220
        
    while to_visit:
        x, y = to_visit.pop()
        if (x, y) in visited:
            continue
        visited.add((x, y))
        
        # Check boundary
        if x < 0 or x >= width or y < 0 or y >= height:
            continue
            
        color = pixels[x, y]
        if is_near_white(color):
            transparent_pixels.add((x, y))
            # add neighbors
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    to_visit.append((nx, ny))
                    
    # Also check if we should just do a small gradient at the edges
    # Let's create the new image
    for y in range(height):
        for x in range(width):
            if (x, y) in transparent_pixels:
                # set transparent
                pixels[x, y] = (0, 0, 0, 0)
                
    img.save(output_path, "PNG")
    print(f"Saved transparent image to {output_path}")

# Run for both ebooks
make_background_transparent("grafiki/mix_master_ebook.png", "grafiki/mix_master_ebook_transparent.png")
make_background_transparent("grafiki/acoustics_ebook.png", "grafiki/acoustics_ebook_transparent.png")
