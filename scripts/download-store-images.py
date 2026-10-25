"""Opcional: guarda las fotografías de la tienda en public/ y actualiza el catálogo."""
import hashlib
import re
from pathlib import Path
from urllib.request import Request, urlopen

root = Path(__file__).resolve().parents[1]
catalog = root / 'src/lib/store-products.ts'
source = catalog.read_text()
folder = root / 'public/productos/ipad'
folder.mkdir(parents=True, exist_ok=True)
urls = sorted(set(re.findall(r'"imagen": "(https://[^\"]+)"', source)))
for url in urls:
    try:
        request = Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urlopen(request, timeout=25) as response:
            mime = response.headers.get_content_type()
            if mime not in ('image/jpeg', 'image/png', 'image/webp'):
                raise ValueError('La respuesta no es una fotografía compatible')
            data = response.read(8 * 1024 * 1024 + 1)
            if len(data) > 8 * 1024 * 1024:
                raise ValueError('Imagen demasiado grande')
        extension = {'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp'}[mime]
        name = hashlib.sha256(url.encode()).hexdigest()[:16] + extension
        (folder / name).write_bytes(data)
        source = source.replace(url, '/productos/ipad/' + name)
        print('Descargada:', name)
    except Exception as error:
        print('No se pudo descargar; se conserva la URL remota:', url, type(error).__name__)
catalog.write_text(source)
print('Catálogo actualizado. Revisa las fotos antes de publicar.')
