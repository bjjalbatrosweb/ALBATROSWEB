import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStoreCatalog, storeProductById } from '../src/lib/store-products';

test('un producto creado en administración es comprable y conserva sus metadatos', () => {
 const catalog=mergeStoreCatalog([{productoId:'producto_nuevo',nombre:'Barra de avena',detalle:'45 g',precio:18,grupo:'snack',ipad:true,imagen:'/api/tienda/imagen?sede=MMA&productoId=producto_nuevo'}]);
 const product=storeProductById('producto_nuevo',catalog);
 assert.ok(product);assert.equal(product.precio,18);assert.equal(product.nombre,'Barra de avena');assert.equal(product.ipad,true);
});
test('los ajustes por sede reemplazan los valores iniciales sin duplicar productos',()=>{
 const catalog=mergeStoreCatalog([{productoId:'gatorade_1l',nombre:'Gatorade frío',detalle:'1 L · moras',precio:31,ipad:false}]);
 assert.equal(catalog.filter(product=>product.id==='gatorade_1l').length,1);
 assert.equal(storeProductById('gatorade_1l',catalog)?.precio,31);
 assert.equal(storeProductById('gatorade_1l',catalog)?.ipad,false);
 assert.ok(storeProductById('gatorade_1l',catalog)?.imagen.includes('gatorade-1l-moras'));
});
test('las fotos propias se conservan y los identificadores de documento inválidos se descartan',()=>{
 const catalog=mergeStoreCatalog([{productoId:'../otro',nombre:'Inválido'},{productoId:'powerade_500',imagen:'/api/tienda/imagen?sede=MMA&productoId=powerade_500'}]);
 assert.equal(storeProductById('../otro',catalog),null);
 assert.ok(storeProductById('powerade_500',catalog)?.imagen.startsWith('/api/'));
});
