"""Generate tileable, original PBR textures for First Flight XR.
All output is procedurally generated (no third-party imagery)."""
import numpy as np, os, sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def fnoise(n, beta, seed=None, aniso=(1.0, 1.0)):
    """Tileable fractal noise via spectral synthesis, normalised to 0..1."""
    r = np.random.default_rng(seed) if seed is not None else rng
    white = r.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * aniso[1]
    fx = np.fft.fftfreq(n)[None, :] * aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    spec = np.fft.fft2(white) / (f ** (beta / 2))
    spec[0, 0] = 0
    out = np.real(np.fft.ifft2(spec))
    out -= out.min(); out /= out.max()
    return out


def band(n, lo, hi, seed=None):
    """Band-limited tileable noise between spatial frequency lo..hi (cycles per tile)."""
    r = np.random.default_rng(seed)
    white = r.standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * n
    fx = np.fft.fftfreq(n)[None, :] * n
    f = np.sqrt(fx * fx + fy * fy)
    mask = np.exp(-((np.log((f + 1e-6) / np.sqrt(lo * hi))) ** 2) / (2 * (np.log(hi / lo) / 2) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * mask))
    out -= out.min(); out /= out.max()
    return out


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + nz * nz)
    n = np.stack([-dx / l, dy / l, nz / l], -1)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)


def save_rgb(arr, name, q=88):
    img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    img.save(os.path.join(OUT, name), quality=q, optimize=True)


def save_gray(arr, name, q=88):
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), 'L').save(os.path.join(OUT, name), quality=q, optimize=True)


def save_normal(n, name, q=92):
    Image.fromarray(n).save(os.path.join(OUT, name), quality=q, optimize=True)


def colorize(t, stops):
    """Map scalar 0..1 to colours from stops [(pos,(r,g,b)),...]."""
    t = np.clip(t, 0, 1)
    out = np.zeros(t.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(t, [s[0] for s in stops], [s[1][c] for s in stops])
    return out


def specks(n, density, size, seed):
    r = np.random.default_rng(seed)
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    count = int(n * n * density)
    xs, ys = r.integers(0, n, count), r.integers(0, n, count)
    sz = r.uniform(size[0], size[1], count)
    val = r.integers(90, 255, count)
    for x, y, s, v in zip(xs, ys, sz, val):
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                if 0 <= x + ox + s and x + ox - s < n and 0 <= y + oy + s and y + oy - s < n:
                    d.ellipse([x + ox - s, y + oy - s, x + ox + s, y + oy + s], fill=int(v))
    return np.asarray(img, dtype=np.float32) / 255


# ---------------------------------------------------------------- concrete apron panel
def concrete():
    n = 2048
    big = fnoise(n, 3.2, 1)
    mid = fnoise(n, 2.2, 2)
    grain = fnoise(n, 0.6, 3)
    pores = specks(n, 0.0009, (0.6, 2.2), 4)
    stains = np.clip((fnoise(n, 3.6, 5) - 0.6) * 4, 0, 1)
    oil = np.clip((band(n, 3, 9, 6) - 0.72) * 6, 0, 1) * np.clip((fnoise(n, 3, 7) - 0.4) * 3, 0, 1)
    # tyre scuffs: long soft streaks along one axis
    tyre = np.clip((fnoise(n, 3.0, 8, aniso=(0.08, 1.0)) - 0.62) * 3.5, 0, 1)
    base = 0.60 + (big - 0.5) * 0.09 + (mid - 0.5) * 0.05 + (grain - 0.5) * 0.06
    base -= pores * 0.18 + stains * 0.07 + oil * 0.22 + tyre * 0.06
    col = np.stack([base * 1.0, base * 0.985, base * 0.955], -1)
    # expansion joints at tile borders (tile = one slab)
    j = np.zeros((n, n))
    w = 7
    j[:w // 2 + 1, :] = 1; j[-(w // 2):, :] = 1; j[:, :w // 2 + 1] = 1; j[:, -(w // 2):] = 1
    jb = np.asarray(Image.fromarray((j * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2)), np.float32) / 255
    col *= (1 - jb[..., None] * 0.62)
    # a centre saw-cut for half-slab feel
    save_rgb(col, 'concrete_albedo.jpg')
    rough = 0.86 - oil * 0.35 - stains * 0.06 + (grain - 0.5) * 0.08 + jb * 0.08
    save_gray(rough, 'concrete_rough.jpg')
    h = grain * 0.5 + mid * 0.6 - pores * 0.8 - jb * 1.6
    nm = Image.fromarray(normal_from_height(h, 2.4)).resize((1024, 1024), Image.LANCZOS); nm.save(os.path.join(OUT, 'concrete_normal.jpg'), quality=90)


# ---------------------------------------------------------------- asphalt (runway / taxiway)
def asphalt():
    n = 1024
    grain = fnoise(n, 0.3, 11)
    mid = fnoise(n, 2.4, 12)
    agg = specks(n, 0.012, (0.4, 1.3), 13)
    patches = fnoise(n, 3.4, 14)
    base = 0.20 + (mid - 0.5) * 0.06 + (patches - 0.5) * 0.08 + (grain - 0.5) * 0.08 + agg * 0.16
    col = np.stack([base, base * 1.0, base * 1.03], -1)
    save_rgb(col, 'asphalt_albedo.jpg')
    save_gray(0.9 - agg * 0.15 + (grain - 0.5) * 0.06, 'asphalt_rough.jpg')
    save_normal(normal_from_height(grain * 0.7 + agg * 0.9, 3.0), 'asphalt_normal.jpg')


# ---------------------------------------------------------------- grass
def grass():
    n = 1024
    blades = fnoise(n, 0.9, 21, aniso=(1.0, 0.25))
    blades2 = fnoise(n, 0.9, 22, aniso=(0.3, 1.0))
    patch = fnoise(n, 3.0, 23)
    dry = np.clip((fnoise(n, 3.4, 24) - 0.55) * 3, 0, 1)
    clover = np.clip((band(n, 20, 50, 25) - 0.7) * 5, 0, 1)
    t = blades * 0.5 + blades2 * 0.5
    col = colorize(t, [(0, (0.10, 0.17, 0.05)), (0.45, (0.22, 0.33, 0.10)), (0.75, (0.33, 0.45, 0.16)), (1, (0.47, 0.56, 0.24))])
    col *= (0.85 + patch[..., None] * 0.3)
    dryc = colorize(t, [(0, (0.25, 0.22, 0.10)), (1, (0.62, 0.55, 0.32))])
    col = col * (1 - dry[..., None] * 0.6) + dryc * dry[..., None] * 0.6
    col = col * (1 - clover[..., None] * 0.25) + np.array([0.18, 0.36, 0.12]) * clover[..., None] * 0.25
    save_rgb(col, 'grass_albedo.jpg')
    save_normal(normal_from_height(t, 3.5), 'grass_normal.jpg')


# ---------------------------------------------------------------- rock (stratified)
def rock():
    n = 1024
    warp = fnoise(n, 3.0, 31)
    yy = np.linspace(0, 1, n, endpoint=False)[:, None] * np.ones((1, n))
    strata = 0.5 + 0.5 * np.sin((yy * 9 + warp * 2.2) * 2 * np.pi)
    detail = fnoise(n, 1.4, 32)
    cracks = np.clip(1 - np.abs(band(n, 6, 20, 33) - 0.5) * 18, 0, 1)
    h = strata * 0.45 + detail * 0.55 - cracks * 0.5
    col = colorize(h, [(0, (0.18, 0.17, 0.16)), (0.4, (0.36, 0.35, 0.33)), (0.7, (0.50, 0.48, 0.45)), (1, (0.64, 0.62, 0.58))])
    lich = np.clip((fnoise(n, 2.6, 34) - 0.62) * 4, 0, 1)
    col = col * (1 - lich[..., None] * 0.3) + np.array([0.42, 0.44, 0.30]) * lich[..., None] * 0.3
    save_rgb(col, 'rock_albedo.jpg')
    save_normal(normal_from_height(h, 5.0), 'rock_normal.jpg')


# ---------------------------------------------------------------- water normal map
def water():
    n = 1024
    h = fnoise(n, 3.6, 41, aniso=(1.0, 0.55)) * 0.6 + band(n, 10, 40, 42) * 0.3 + band(n, 30, 90, 43) * 0.12
    save_normal(normal_from_height(h, 9.0), 'water_normal.jpg')


# ---------------------------------------------------------------- cumulus sprites (RGBA)
def clouds():
    n = 512
    for k in range(4):
        r = np.random.default_rng(50 + k)
        img = np.zeros((n, n))
        yy, xx = np.mgrid[0:n, 0:n] / n
        blobs = 9 + k * 2
        for b in range(blobs):
            cx = 0.5 + r.normal(0, 0.12); cx = min(0.74, max(0.26, cx)); cy = r.uniform(0.44, 0.60) - 0.12 * max(0, 1 - abs(cx - 0.5) / 0.22)
            rad = r.uniform(0.12, 0.2) * (1.25 - abs(cx - 0.5) * 1.6)
            d = np.sqrt((xx - cx) ** 2 + ((yy - cy) * 1.15) ** 2) / rad
            img = np.maximum(img, np.clip(1 - d, 0, 1) ** 0.6)
        # flatten bases
        img *= np.clip((0.70 - yy) * 9, 0, 1)
        fbm = fnoise(n, 2.6, 60 + k)
        dens = np.clip(img * 1.35 - (1 - fbm) * 0.38, 0, 1)
        dens = np.asarray(Image.fromarray((dens * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
        # lighting: brighter towards top, grey bases
        shade = np.clip(0.62 + (0.62 - yy) * 1.1 + (fbm - 0.5) * 0.25, 0.48, 1.0)
        rgb = np.stack([shade * 0.99, shade * 0.99, shade * 1.0], -1)
        rgba = np.concatenate([rgb, dens[..., None] ** 1.1], -1)
        Image.fromarray((rgba * 255).astype(np.uint8), 'RGBA').save(os.path.join(OUT, f'cloud{k}.png'), optimize=True)


# ---------------------------------------------------------------- hangar epoxy floor
def epoxy():
    n = 1024
    m = fnoise(n, 3.0, 71)
    flakes = specks(n, 0.004, (0.5, 1.4), 72)
    scratches = np.clip((fnoise(n, 1.0, 73, aniso=(0.04, 1)) - 0.8) * 5, 0, 1)
    base = 0.47 + (m - 0.5) * 0.05 - flakes * 0.06 + scratches * 0.03
    col = np.stack([base * 0.97, base * 1.0, base * 1.02], -1)
    save_rgb(col, 'epoxy_albedo.jpg')
    save_gray(0.22 + (m - 0.5) * 0.12 + scratches * 0.25 + flakes * 0.1, 'epoxy_rough.jpg')


# ---------------------------------------------------------------- seat fabric & carpet
def fabric():
    n = 512
    yy, xx = np.mgrid[0:n, 0:n]
    weave = (np.sin(xx / n * 2 * np.pi * 96) * np.sin(yy / n * 2 * np.pi * 96)) * 0.5 + 0.5
    fib = fnoise(n, 0.5, 81)
    h = weave * 0.6 + fib * 0.4
    col = colorize(h, [(0, (0.06, 0.09, 0.15)), (1, (0.17, 0.23, 0.34))])
    save_rgb(col, 'fabric_albedo.jpg')
    save_normal(normal_from_height(h, 2.0), 'fabric_normal.jpg')
    pat = ((np.floor(xx / 32) + np.floor(yy / 32)) % 2) * 0.5
    dots = (np.sin(xx / n * 2 * np.pi * 16) * np.sin(yy / n * 2 * np.pi * 16) > 0.85).astype(float)
    t = fnoise(n, 0.4, 82) * 0.6 + pat * 0.2 + dots * 0.4
    col = colorize(t, [(0, (0.10, 0.11, 0.14)), (0.6, (0.20, 0.22, 0.28)), (1, (0.42, 0.36, 0.22))])
    save_rgb(col, 'carpet_albedo.jpg')


# ---------------------------------------------------------------- aircraft panel seams / rivets (normal)
def panels():
    n = 1024
    h = np.zeros((n, n))
    img = Image.new('L', (n, n), 128)
    d = ImageDraw.Draw(img)
    # skin panels: 4 x 2 per tile with rivet rows
    for i in range(5):
        x = int(i * n / 4) % n
        d.line([(x, 0), (x, n)], fill=70, width=3)
    for j in range(3):
        y = int(j * n / 2) % n
        d.line([(0, y), (n, y)], fill=70, width=3)
    for i in range(4):
        for y in range(6, n, 16):
            x = int(i * n / 4) + 12
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=175)
    for j in range(2):
        for x in range(6, n, 16):
            y = int(j * n / 2) + 12
            d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=175)
    h = np.asarray(img.filter(ImageFilter.GaussianBlur(0.8)), np.float32) / 255
    h += (fnoise(n, 2.5, 91) - 0.5) * 0.03
    save_normal(normal_from_height(h, 2.0), 'panels_normal.jpg')
    rough = 0.32 + (fnoise(n, 2.8, 92) - 0.5) * 0.12 + (h < 0.4) * 0.3
    save_gray(rough, 'panels_rough.jpg')


# ---------------------------------------------------------------- HDR -> RGBE PNG (web friendly)
def hdr_to_png(src, dst):
    data = open(src, 'rb').read()
    i = 0
    while True:
        e = data.index(b'\n', i)
        line = data[i:e]
        i = e + 1
        if line.startswith(b'-Y') or line.startswith(b'+Y'):
            parts = line.split()
            H, W = int(parts[1]), int(parts[3])
            break
    buf = memoryview(data)[i:]
    out = np.zeros((H, W, 4), np.uint8)
    p = 0
    for y in range(H):
        if buf[p] == 2 and buf[p + 1] == 2 and (buf[p + 2] & 0x80) == 0:
            p += 4
            for c in range(4):
                x = 0
                while x < W:
                    cnt = buf[p]; p += 1
                    if cnt > 128:
                        cnt -= 128
                        out[y, x:x + cnt, c] = buf[p]; p += 1
                    else:
                        out[y, x:x + cnt, c] = np.frombuffer(buf[p:p + cnt], np.uint8); p += cnt
                    x += cnt
        else:
            out[y] = np.frombuffer(buf[p:p + W * 4], np.uint8).reshape(W, 4); p += W * 4
    # pack: top half RGB mantissas, bottom half exponent (grey) -> opaque PNG, lossless
    packed = np.concatenate([out[..., :3], np.repeat(out[..., 3:4], 3, -1)], 0)
    Image.fromarray(packed, 'RGB').save(dst, optimize=True)


if __name__ == '__main__':
    which = sys.argv[2:] or ['concrete', 'asphalt', 'grass', 'rock', 'water', 'clouds', 'epoxy', 'fabric', 'panels', 'hdr']
    for w in which:
        if w == 'hdr':
            src = os.path.join(OUT, '..', 'hdr')
            for f in os.listdir(src):
                if f.endswith('.hdr'):
                    hdr_to_png(os.path.join(src, f), os.path.join(OUT, '..', 'env', f.replace('_1k.hdr', '.png').replace('_2', '')))
        else:
            globals()[w]()
        print('done', w, flush=True)


def clouds_hd():
    """Lit cumulus sprites (1024px) with self-shadowing and silver edges."""
    from scipy.ndimage import gaussian_filter, shift
    n = 1024
    for k in range(6):
        r = np.random.default_rng(300 + k)
        yy, xx = np.mgrid[0:n, 0:n] / n
        img = np.zeros((n, n))
        tower = 0.18 + r.random() * 0.22  # how tall the cumulus is
        for b in range(26):
            cx = 0.5 + r.normal(0, 0.15)
            cx = min(0.82, max(0.18, cx))
            centre = 1 - abs(cx - 0.5) / 0.32
            cy = 0.66 - r.random() * tower * max(0.15, centre) - 0.04
            rad = (0.06 + r.random() * 0.1) * (0.7 + centre * 0.6)
            d = np.sqrt((xx - cx) ** 2 + ((yy - cy) * 1.05) ** 2) / rad
            img = np.maximum(img, np.clip(1 - d, 0, 1) ** 0.5)
        img *= np.clip((0.72 - yy) * 14, 0, 1)  # flat base
        detail = fnoise(n, 2.2, 400 + k)
        fine = fnoise(n, 1.4, 500 + k)
        dens = np.clip(img * 1.4 - (1 - detail) * 0.42 - (1 - fine) * 0.12, 0, 1)
        dens = gaussian_filter(dens, 2.2)
        # light from upper-left: occlusion = density sampled towards the light
        occ = gaussian_filter(shift(dens, (n * 0.05, n * 0.035), order=1, mode='nearest'), 18)
        lit = np.clip(1.08 - occ * 0.32, 0.62, 1.0)
        edge = np.clip(dens * (1 - dens) * 3.2, 0, 1) * (1 - occ)  # silver lining
        base_shadow = np.clip((yy - 0.5) * 3.0, 0, 1) * 0.3
        v = np.clip(lit - base_shadow + edge * 0.25, 0, 1.15)
        rgb = np.stack([v * 0.98 + 0.03, v * 0.99 + 0.035, v * 1.0 + 0.05], -1)
        rgb = np.clip(rgb, 0, 1)
        a = np.clip(dens ** 0.9 * 1.15, 0, 1)
        Image.fromarray((np.concatenate([rgb, a[..., None]], -1) * 255).astype(np.uint8), 'RGBA').resize((768, 768), Image.LANCZOS).save(os.path.join(OUT, f'cumulus{k}.png'), optimize=True)
