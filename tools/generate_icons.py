"""Genera los iconos PNG de Hábitat (sin dependencias externas)."""
import struct, zlib, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'icons')

C_TOP = (124, 108, 240)      # #7c6cf0
C_BOTTOM = (160, 108, 240)   # #a06cf0
C_CHECK = (106, 88, 230)     # #6a58e6
WHITE = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def in_rrect(px, py, x0, y0, x1, y1, r):
    if px < x0 or px > x1 or py < y0 or py > y1:
        return False
    cx = x0 + r if px < x0 + r else (x1 - r if px > x1 - r else px)
    cy = y0 + r if py < y0 + r else (y1 - r if py > y1 - r else py)
    return (px - cx) ** 2 + (py - cy) ** 2 <= r * r


def fill_rrect_gradient(buf, W, H, x0, y0, x1, y1, r):
    for y in range(int(y0), int(y1) + 1):
        t = (y - y0) / max(1, (y1 - y0))
        col = lerp(C_TOP, C_BOTTOM, t)
        row = y * W * 3
        for x in range(int(x0), int(x1) + 1):
            if in_rrect(x + 0.5, y + 0.5, x0, y0, x1, y1, r):
                i = row + x * 3
                buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]


def fill_rrect(buf, W, H, x0, y0, x1, y1, r, col):
    for y in range(int(y0), int(y1) + 1):
        row = y * W * 3
        for x in range(int(x0), int(x1) + 1):
            if in_rrect(x + 0.5, y + 0.5, x0, y0, x1, y1, r):
                i = row + x * 3
                buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]


def fill_circle(buf, W, H, cx, cy, rad, col):
    x0 = max(0, int(cx - rad)); x1 = min(W - 1, int(cx + rad))
    y0 = max(0, int(cy - rad)); y1 = min(H - 1, int(cy + rad))
    for y in range(y0, y1 + 1):
        row = y * W * 3
        for x in range(x0, x1 + 1):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad:
                i = row + x * 3
                buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]


def stamp_segment(buf, W, H, p0, p1, thickness, col):
    """Dibuja un trazo grueso (círculos) entre dos puntos."""
    dx = p1[0] - p0[0]; dy = p1[1] - p0[1]
    dist = (dx * dx + dy * dy) ** 0.5
    steps = max(1, int(dist / (thickness * 0.35)))
    for s in range(steps + 1):
        t = s / steps
        fill_circle(buf, W, H, p0[0] + dx * t, p0[1] + dy * t, thickness / 2, col)


def render(size, scale=3):
    W = H = size * scale
    buf = bytearray(W * H * 3)

    # Fondo: cuadrado redondeado con degradado
    m = 0.0
    fill_rrect_gradient(buf, W, H, m * W, m * H, W - 1 - m * W, H - 1 - m * H, 0.20 * W)

    # Calendario blanco
    cx0, cy0, cx1, cy1 = 0.19 * W, 0.26 * H, 0.81 * W, 0.78 * H
    fill_rrect(buf, W, H, cx0, cy0, cx1, cy1, 0.07 * W, WHITE)

    # Anillas superiores del calendario
    hole_r = 0.028 * W
    fill_circle(buf, W, H, 0.385 * W, 0.385 * H, hole_r, C_TOP)
    fill_circle(buf, W, H, 0.615 * W, 0.385 * H, hole_r, C_TOP)

    # Check (marca de verificación)
    th = 0.055 * W
    p1 = (0.375 * W, 0.565 * H)
    p2 = (0.465 * W, 0.655 * H)
    p3 = (0.635 * W, 0.455 * H)
    stamp_segment(buf, W, H, p1, p2, th, C_CHECK)
    stamp_segment(buf, W, H, p2, p3, th, C_CHECK)

    # Downsample (promedio por bloques)
    out = bytearray(size * size * 3)
    for y in range(size):
        for x in range(size):
            rs = gs = bs = 0
            for dy in range(scale):
                row = ((y * scale + dy) * W + x * scale) * 3
                for dx in range(scale):
                    i = row + dx * 3
                    rs += buf[i]; gs += buf[i + 1]; bs += buf[i + 2]
            n = scale * scale
            o = (y * size + x) * 3
            out[o] = rs // n; out[o + 1] = gs // n; out[o + 2] = bs // n
    return bytes(out), size, size


def write_png(path, rgb, w, h):
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        c += struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
        return c
    raw = b''.join(b'\x00' + rgb[y * w * 3:(y + 1) * w * 3] for y in range(h))
    ihdr = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (512, 192, 180, 32):
        rgb, w, h = render(size, scale=3)
        name = f'icon-{size}.png' if size in (512, 192, 180) else 'favicon-32.png'
        write_png(os.path.join(OUT, name), rgb, w, h)
        print(f'OK {name} ({w}x{h})')


if __name__ == '__main__':
    main()
