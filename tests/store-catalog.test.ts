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

test('equipamiento y tienda tienen catálogos separados, también al forzar visibilidad iPad', async()=>{
 const {filterStoreCatalog,isEquipmentProduct}=await import('../src/lib/store-products');
 const catalog=mergeStoreCatalog([
  {productoId:'bucal_rojo',nombre:'Bucal rojo',grupo:'bucal',precio:100,ipad:true},
  {productoId:'guantes_12oz',nombre:'Guantes',detalle:'12 oz',grupo:'guantes',precio:500,ipad:true},
  {productoId:'vendas_4m',nombre:'Vendas',grupo:'vendas',precio:90,ipad:true},
  {productoId:'ropa_m',nombre:'Playera',detalle:'M',grupo:'ropa',precio:250,ipad:true},
 ]);
 const equipment=filterStoreCatalog(catalog,'equipamiento');
 assert.equal(equipment.filter(product=>["bucal_rojo","guantes_12oz","vendas_4m","ropa_m"].includes(product.id)).length,4);
 assert.ok(equipment.every(isEquipmentProduct));
 assert.ok(equipment.every(product=>product.ipad===false));
 assert.ok(filterStoreCatalog(catalog,'tienda').every(product=>!isEquipmentProduct(product)));
 assert.ok(filterStoreCatalog(catalog,'ipad').every(product=>!isEquipmentProduct(product)));
 assert.ok(filterStoreCatalog(catalog,'ipad').some(product=>product.id==='agua_1l'));
});

test('los nueve productos solicitados son plantillas sin precio ni existencias inventadas', async()=>{
 const {EQUIPMENT_TEMPLATES,filterStoreCatalog}=await import('../src/lib/store-products');
 assert.equal(EQUIPMENT_TEMPLATES.length,9);
 assert.ok(EQUIPMENT_TEMPLATES.every(product=>product.precio===0 && product.ipad===false));
 const catalog=mergeStoreCatalog([]);
 assert.equal(filterStoreCatalog(catalog,'equipamiento').length,9);
 assert.ok(filterStoreCatalog(catalog,'tienda').every(product=>!product.id.startsWith('equip_')));
});
