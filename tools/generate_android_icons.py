"""Genera los iconos y splash de Android para Hábitat (sin dependencias externas)."""
import struct, zlib, os

ROOT = os.path.join(os.path.dirname(__file__), '..', 'android', 'app', 'src', 'main', 'res')

C_TOP = (124, 108, 240)      # #7c6cf0
C_BOTTOM = (160, 108, 240)   # #a06cf0
C_CHECK = (106, 88, 230)     # #6a58e6
WHITE = (255, 255, 255)
DARK = (14, 17, 22)          # #0e1116


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


def fill_rrect(buf, W, H, x0, y0, x1, y1, r, col, nch=3):
    for y in range(int(y0), int(y1) + 1):
        row = y * W * nch
        for x in range(int(x0), int(x1) + 1):
            if in_rrect(x + 0.5, y + 0.5, x0, y0, x1, y1, r):
                i = row + x * nch
                buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]
                if nch == 4:
                    buf[i + 3] = col[3] if len(col) > 3 else 255


def fill_circle(buf, W, H, cx, cy, rad, col, nch=3):
    x0 = max(0, int(cx - rad)); x1 = min(W - 1, int(cx + rad))
    y0 = max(0, int(cy - rad)); y1 = min(H - 1, int(cy + rad))
    for y in range(y0, y1 + 1):
        row = y * W * nch
        for x in range(x0, x1 + 1):
            if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= rad * rad:
                i = row + x * nch
                buf[i] = col[0]; buf[i + 1] = col[1]; buf[i + 2] = col[2]
                if nch == 4:
                    buf[i + 3] = col[3] if len(col) > 3 else 255


def stamp_segment(buf, W, H, p0, p1, thickness, col, nch=3):
    dx = p1[0] - p0[0]; dy = p1[1] - p0[1]
    dist = (dx * dx + dy * dy) ** 0.5
    steps = max(1, int(dist / (thickness * 0.35)))
    for s in range(steps + 1):
        t = s / steps
        fill_circle(buf, W, H, p0[0] + dx * t, p0[1] + dy * t, thickness / 2, col, nch)


def draw_logo(buf, W, H, x0, y0, x1, y1, nch=3):
    """Dibuja el calendario (blanco) con anillas y check dentro de la caja."""
    lw = x1 - x0; lh = y1 - y0
    fill_rrect(buf, W, H, x0, y0, x1, y1, 0.11 * lw, WHITE, nch)
    hole_r = 0.045 * lw
    fill_circle(buf, W, H, x0 + 0.30 * lw, y0 + 0.23 * lh, hole_r, C_TOP, nch)
    fill_circle(buf, W, H, x0 + 0.70 * lw, y0 + 0.23 * lh, hole_r, C_TOP, nch)
    th = 0.09 * lw
    p1 = (x0 + 0.30 * lw, y0 + 0.58 * lh)
    p2 = (x0 + 0.44 * lw, y0 + 0.74 * lh)
    p3 = (x0 + 0.72 * lw, y0 + 0.38 * lh)
    stamp_segment(buf, W, H, p1, p2, th, C_CHECK, nch)
    stamp_segment(buf, W, H, p2, p3, th, C_CHECK, nch)


def write_png(path, rgb, w, h, nch=3):
    def chunk(typ, data):
        c = struct.pack('>I', len(data)) + typ + data
        c += struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff)
        return c
    raw = b''.join(b'\x00' + rgb[y * w * nch:(y + 1) * w * nch] for y in range(h))
    color_type = 2 if nch == 3 else 6
    ihdr = struct.pack('>IIBBBBB', w, h, 8, color_type, 0, 0, 0)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def render_launcher(size, scale=3):
    W = H = size * scale
    buf = bytearray(W * H * 3)
    fill_rrect_gradient(buf, W, H, 0, 0, W - 1, H - 1, 0.20 * W)
    draw_logo(buf, W, H, 0.19 * W, 0.26 * H, 0.81 * W, 0.78 * H)
    return downsample(buf, W, H, size, size, 3, scale)


def render_foreground(size, scale=3):
    W = H = size * scale
    buf = bytearray(W * H * 4)  # transparente (alpha 0)
    draw_logo(buf, W, H, 0.29 * W, 0.32 * H, 0.71 * W, 0.68 * H, nch=4)
    return downsample(buf, W, H, size, size, 4, scale)


def render_splash(W, H, scale=2):
    w, h = W * scale, H * scale
    buf = bytearray(w * h * 3)
    # fondo oscuro plano
    for y in range(h):
        row = y * w * 3
        for x in range(w):
            i = row + x * 3
            buf[i] = DARK[0]; buf[i + 1] = DARK[1]; buf[i + 2] = DARK[2]
    s = 0.30 * min(w, h)      # ancho del logo
    lh = s * 0.84             # alto del logo (proporción)
    draw_logo(buf, w, h, 0.5 * w - s / 2, 0.5 * h - lh / 2, 0.5 * w + s / 2, 0.5 * h + lh / 2)
    return downsample(buf, w, h, W, H, 3, scale)


def downsample(buf, W, H, ow, oh, nch, scale):
    out = bytearray(ow * oh * nch)
    for y in range(oh):
        for x in range(ow):
            acc = [0] * nch
            for dy in range(scale):
                row = ((y * scale + dy) * W + x * scale) * nch
                for dx in range(scale):
                    i = row + dx * nch
                    for c in range(nch):
                        acc[c] += buf[i + c]
            n = scale * scale
            o = (y * ow + x) * nch
            for c in range(nch):
                out[o + c] = acc[c] // n
    return out


def main():
    # Mipmap launchers (icono completo)
    mips = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
    for d, size in mips.items():
        d2 = 'mipmap-' + d
        rgb = render_launcher(size)
        write_png(os.path.join(ROOT, d2, 'ic_launcher.png'), rgb, size, size)
        write_png(os.path.join(ROOT, d2, 'ic_launcher_round.png'), rgb, size, size)

    # Foreground adaptativos (logo transparente)
    fgs = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}
    for d, size in fgs.items():
        d2 = 'mipmap-' + d
        rgba = render_foreground(size)
        write_png(os.path.join(ROOT, d2, 'ic_launcher_foreground.png'), rgba, size, size, 4)

    # Splash
    splashes = [
        ('drawable', 'splash.png', 480, 320),
        ('drawable-port-mdpi', 'splash.png', 320, 480),
        ('drawable-port-hdpi', 'splash.png', 480, 800),
        ('drawable-port-xhdpi', 'splash.png', 720, 1280),
        ('drawable-port-xxhdpi', 'splash.png', 960, 1600),
        ('drawable-port-xxxhdpi', 'splash.png', 1280, 1920),
        ('drawable-land-mdpi', 'splash.png', 480, 320),
        ('drawable-land-hdpi', 'splash.png', 800, 480),
        ('drawable-land-xhdpi', 'splash.png', 1280, 720),
        ('drawable-land-xxhdpi', 'splash.png', 1600, 960),
        ('drawable-land-xxxhdpi', 'splash.png', 1920, 1280),
    ]
    for d, name, w, h in splashes:
        rgb = render_splash(w, h)
        write_png(os.path.join(ROOT, d, name), rgb, w, h)

    print('Iconos y splash de Android generados.')


if __name__ == '__main__':
    main()
