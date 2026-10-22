'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const Database=require('better-sqlite3');
const bcrypt=require('bcryptjs');

const root=path.join(__dirname,'..');
const dbPath=path.join(root,'test.sqlite');
const base='http://127.0.0.1:3107';
const productionDbPath=path.join(root,'production-test.sqlite');
const productionBase='http://127.0.0.1:3108';
let server;
let productionServer;

async function readEventUntil(reader,marker,timeoutMs=3000){
  const decoder=new TextDecoder();
  let text='';
  let timeout;
  try{
    return await Promise.race([
      (async()=>{
        while(!text.includes(marker)){
          const {value,done}=await reader.read();
          if(done)break;
          text+=decoder.decode(value,{stream:true});
        }
        return text;
      })(),
      new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error(`Timed out waiting for ${marker}`)),timeoutMs);}),
    ]);
  }finally{clearTimeout(timeout);}
}

test.before(async()=>{
  for(const suffix of ['','-shm','-wal']){try{fs.unlinkSync(dbPath+suffix);}catch{}}
  server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'3107',DB_PATH:dbPath,ADMIN_USERNAME:'testadmin',ADMIN_PASSWORD:'very-secure-test-password'}});
  for(let i=0;i<50;i++){try{if((await fetch(`${base}/api/health`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
  throw new Error('Test server failed to start');
});
test.after(async()=>{
  const children=[server,productionServer].filter(Boolean);
  for(const child of children)child.kill();
  await Promise.all(children.map(child=>child.exitCode!==null?Promise.resolve():new Promise(resolve=>child.once('exit',resolve))));
  for(const file of [dbPath,productionDbPath])for(const suffix of ['','-shm','-wal']){try{fs.unlinkSync(file+suffix);}catch{}}
});

test('public SEO endpoints and storefront routes',async()=>{
  const robotsResponse=await fetch(`${base}/robots.txt`);
  assert.equal(robotsResponse.status,200);
  assert.match(robotsResponse.headers.get('content-type'),/text\/plain/);
  const robots=await robotsResponse.text();
  assert.match(robots,/User-agent: \*/);
  assert.match(robots,/Allow: \//);
  assert.match(robots,/Disallow: \/api\//);
  assert.match(robots,/Sitemap: https:\/\/hash-food-website\.onrender\.com\/sitemap\.xml/);

  const menu=await (await fetch(`${base}/api/menu`)).json();
  assert.ok(menu.length>=5);
  assert.ok(menu.every(item=>Number.isInteger(item.categoryId)));
  const product=menu[0];
  const category=menu.find(item=>item.categoryId===product.categoryId);
  const productUrl=`/product/${product.id}/${product.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}`;
  const categorySlug=category.category.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const categoryUrl=`/menu/category/${category.categoryId}/${categorySlug}`;
  const sitemapResponse=await fetch(`${base}/sitemap.xml`);
  assert.equal(sitemapResponse.status,200);
  assert.match(sitemapResponse.headers.get('content-type'),/application\/xml/);
  const sitemap=await sitemapResponse.text();
  assert.match(sitemap,/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(sitemap,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const sitemapLocations=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1]);
  assert.equal(new Set(sitemapLocations).size,sitemapLocations.length);
  assert.ok(sitemapLocations.includes('https://hash-food-website.onrender.com/'));
  assert.ok(sitemapLocations.includes('https://hash-food-website.onrender.com/menu'));
  assert.ok(sitemapLocations.includes(`https://hash-food-website.onrender.com${categoryUrl}`));
  assert.ok(sitemapLocations.includes(`https://hash-food-website.onrender.com${productUrl}`));
  assert.doesNotMatch(sitemap,/\/(?:admin|checkout|track|cart)(?:\/|<)/i);
  assert.equal(sitemapLocations.filter(url=>url.includes('/product/')).length,menu.length);

  for(const [route,canonical,title] of [
    ['/', 'https://hash-food-website.onrender.com/', 'Hash Food | Karachi'],
    ['/menu', 'https://hash-food-website.onrender.com/menu', 'Hash Food Menu |'],
    [categoryUrl, `https://hash-food-website.onrender.com${categoryUrl}`, `${category.category} Menu |`],
    [productUrl, `https://hash-food-website.onrender.com${productUrl}`, `${product.name} | Hash Food`],
  ]){
    const response=await fetch(`${base}${route}`);
    assert.equal(response.status,200,`${route} direct navigation`);
    const html=await response.text();
    assert.match(response.headers.get('content-type'),/text\/html/);
    assert.match(html,new RegExp(`<link rel="canonical" href="${canonical.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}">`));
    assert.match(html,new RegExp(`<title>${title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}`));
    assert.match(html,/property="og:title"/);
    assert.match(html,/name="twitter:card" content="summary_large_image"/);
    assert.match(html,/name="description" content="[^"]+"/);
  }

  const productHtml=await (await fetch(`${base}${productUrl}`)).text();
  assert.match(productHtml,/application\/ld\+json/);
  assert.match(productHtml,/"@type":"Product"/);
  assert.match(productHtml,/"priceCurrency":"PKR"/);
  assert.match(productHtml,new RegExp(`"price":${product.price}`));
  const productRedirect=await fetch(`${base}/product/${product.id}/old-name`,{redirect:'manual'});
  assert.equal(productRedirect.status,301);
  assert.equal(productRedirect.headers.get('location'),productUrl);
  const categoryRedirect=await fetch(`${base}/menu/category/${category.categoryId}/old-name`,{redirect:'manual'});
  assert.equal(categoryRedirect.status,301);
  assert.equal(categoryRedirect.headers.get('location'),categoryUrl);
  for(const [route,canonical] of [['/menu/','/menu'],['/admin/','/admin'],['/admin/login/','/admin/login'],['/checkout/','/checkout'],['/track/','/track']]){
    const response=await fetch(`${base}${route}`,{redirect:'manual'});
    assert.equal(response.status,301,`${route} normalization`);
    assert.equal(response.headers.get('location'),canonical);
  }

  for(const privateRoute of ['/checkout','/track','/track/PRIVATE-ORDER','/admin','/admin/login']){
    const response=await fetch(`${base}${privateRoute}`);
    assert.equal(response.status,200,`${privateRoute} direct navigation`);
    assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
    assert.match(await response.text(),/name="robots" content="noindex,nofollow"/);
  }
  assert.equal((await fetch(`${base}/not-a-real-page`)).status,404);
});

test('customer order and protected admin lifecycle',async()=>{
  assert.equal((await fetch(`${base}/api/health`)).status,200);
  const menu=await (await fetch(`${base}/api/menu`)).json();
  assert.ok(menu.length>=5);
  assert.deepEqual(await (await fetch(`${base}/api/settings`)).json(),{});
  assert.deepEqual(await (await fetch(`${base}/api/admin/session`)).json(),{authenticated:false});
  assert.equal((await fetch(`${base}/api/admin/menu`)).status,401);

  const invalidLogin=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'testadmin',password:'incorrect'})});
  assert.equal(invalidLogin.status,401);

  const createdResponse=await fetch(`${base}/api/orders`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({customerName:'Test Customer',phone:'03001234567',address:'Korangi No. 4, Karachi',orderType:'Delivery',paymentMethod:'Cash',items:[{id:menu[0].id,qty:2}]})});
  assert.equal(createdResponse.status,201);
  const created=await createdResponse.json();
  assert.equal(created.total,menu[0].price*2+150);
  assert.equal((await fetch(`${base}/api/orders/${created.orderId}/events`)).status,401);

  assert.equal((await fetch(`${base}/api/admin/orders`)).status,401);
  assert.equal((await fetch(`${base}/api/admin/menu/categories`)).status,401);
  const login=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'testadmin',password:'very-secure-test-password'})});
  assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await (await fetch(`${base}/api/admin/session`,{headers:{cookie}})).json(),{authenticated:true});
  assert.equal((await fetch(`${base}/api/admin/logout`,{method:'POST'})).status,401);

  const orders=await (await fetch(`${base}/api/admin/orders`,{headers:{cookie}})).json();
  assert.equal(orders[0].id,created.orderId);
  const adminMenu=await (await fetch(`${base}/api/admin/menu`,{headers:{cookie}})).json();
  assert.equal(adminMenu.length,menu.length);

  const events=await fetch(`${base}/api/orders/${created.orderId}/events`,{headers:{'x-order-token':created.trackingToken,accept:'text/event-stream'}});
  assert.equal(events.status,200);
  assert.match(events.headers.get('content-type'),/text\/event-stream/);
  const reader=events.body.getReader();
  const snapshot=await readEventUntil(reader,'"status":"Pending"');
  assert.match(snapshot,/event: snapshot/);
  assert.equal((await fetch(`${base}/api/admin/orders/${created.orderId}/status`,{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({status:'Preparing'})})).status,409);
  assert.equal((await fetch(`${base}/api/admin/orders/${created.orderId}/status`,{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({status:'Ready'})})).status,400);
  const updated=await fetch(`${base}/api/admin/orders/${created.orderId}/status`,{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({status:'Accepted'})});
  assert.equal(updated.status,200);
  assert.match(await readEventUntil(reader,'"status":"Accepted"'),/event: status/);
  const tracked=await (await fetch(`${base}/api/orders/${created.orderId}`,{headers:{'x-order-token':created.trackingToken}})).json();
  assert.equal(tracked.status,'Accepted');
  assert.equal((await fetch(`${base}/api/orders/${created.orderId}`)).status,401);
  assert.equal((await fetch(`${base}/api/orders/not-an-order`,{headers:{'x-order-token':'invalid'}})).status,404);
  assert.equal((await fetch(`${base}/api/admin/orders/not-an-order/status`,{method:'PATCH',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({status:'Invalid'})})).status,400);

  const updateStatus=(orderId,status)=>fetch(`${base}/api/admin/orders/${orderId}/status`,{
    method:'PATCH',
    headers:{cookie,'content-type':'application/json'},
    body:JSON.stringify({status}),
  });
  const otherOrders=[];
  for(const [orderType,phone,flow] of [
    ['Pick-Up','03001112221',['Pending','Accepted','Preparing','Ready for Pickup','Completed']],
    ['Dine-In','03001112222',['Pending','Accepted','Preparing','Served','Completed']],
  ]){
    const response=await fetch(`${base}/api/orders`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({customerName:'Test Customer',phone,address:'Korangi No. 4, Karachi',orderType,paymentMethod:'Cash',items:[{id:menu[0].id,qty:1}]}),
    });
    assert.equal(response.status,201);
    const order=await response.json();
    otherOrders.push(order.orderId);
    assert.equal((await updateStatus(order.orderId,flow[2])).status,409);
    for(const status of flow.slice(1))assert.equal((await updateStatus(order.orderId,status)).status,200);
    assert.equal((await updateStatus(order.orderId,flow[1])).status,409);
  }

  const newCategoryResponse=await fetch(`${base}/api/admin/menu/categories`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({name:'Test Sides'})});
  assert.equal(newCategoryResponse.status,201);
  const newCategory=await newCategoryResponse.json();
  assert.equal(newCategory.name,'Test Sides');
  assert.equal((await fetch(`${base}/api/admin/menu/categories`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({name:'test sides'})})).status,409);
  const emptyCategory=await fetch(`${base}/api/admin/menu/categories`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({name:'Seasonal'})});
  assert.equal(emptyCategory.status,201);
  assert.equal((await fetch(`${base}/api/admin/menu/categories/${(await emptyCategory.json()).id}`,{method:'DELETE',headers:{cookie}})).status,200);

  const newItem={name:'Test Special',category:newCategory.name,description:'Integration test item.',price:725,image:'https://example.com/test.jpg',popular:true,active:true};
  const added=await fetch(`${base}/api/admin/menu`,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(newItem)});
  assert.equal(added.status,201);
  const item=await added.json();
  const categories=await (await fetch(`${base}/api/admin/menu/categories`,{headers:{cookie}})).json();
  assert.equal(categories.find(category=>category.id===newCategory.id).itemCount,1);
  assert.equal((await fetch(`${base}/api/admin/menu/categories/${newCategory.id}`,{method:'DELETE',headers:{cookie}})).status,409);
  const savedItem={...newItem,name:'Updated Test Special',price:800};
  assert.equal((await fetch(`${base}/api/admin/menu/${item.id}`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(savedItem)})).status,200);
  const movedItem={...savedItem,category:'Burgers'};
  assert.equal((await fetch(`${base}/api/admin/menu/${item.id}`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(movedItem)})).status,200);
  assert.equal((await fetch(`${base}/api/admin/menu/categories/${newCategory.id}`,{method:'DELETE',headers:{cookie}})).status,200);
  assert.equal((await fetch(`${base}/api/admin/menu/${item.id}`,{method:'DELETE',headers:{cookie}})).status,200);
  assert.equal((await fetch(`${base}/api/admin/menu/99999`,{method:'DELETE',headers:{cookie}})).status,404);
  assert.equal((await (await fetch(`${base}/api/menu`)).json()).some(p=>p.id===item.id),false);
  assert.equal((await fetch(`${base}/api/admin/menu/${item.id}/permanent`,{method:'DELETE',headers:{cookie}})).status,200);
  assert.equal((await fetch(`${base}/api/admin/menu/${item.id}/permanent`,{method:'DELETE',headers:{cookie}})).status,404);
  assert.equal((await fetch(`${base}/api/admin/menu/99999/permanent`,{method:'DELETE',headers:{cookie}})).status,404);
  assert.equal((await fetch(`${base}/api/admin/menu`,{headers:{cookie}})).status,200);

  const settings={name:'Test Hash Food',phone:'03001234567',address:'Test address',opening:'12:00 PM',closing:'2:00 AM',acceptOrders:'true',deliveryAvailable:'false'};
  const settingsResponse=await fetch(`${base}/api/admin/settings`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify(settings)});
  assert.equal(settingsResponse.status,200);
  assert.deepEqual(await (await fetch(`${base}/api/settings`)).json(),settings);

  for(const status of ['Preparing','Ready for Pickup','Out for Delivery','Delivered']){
    assert.equal((await updateStatus(created.orderId,status)).status,200);
    assert.match(await readEventUntil(reader,`"status":"${status}"`),/event: status/);
  }
  await reader.cancel();
  assert.equal((await updateStatus(created.orderId,'Completed')).status,409);
  assert.equal((await updateStatus(created.orderId,'Pending')).status,409);
  assert.equal((await updateStatus(otherOrders[0],'Cancelled')).status,409);
  const cancelledResponse=await fetch(`${base}/api/orders`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({customerName:'Test Customer',phone:'03001112223',address:'Korangi No. 4, Karachi',orderType:'Dine-In',paymentMethod:'Cash',items:[{id:menu[0].id,qty:1}]}),
  });
  const cancelledOrder=await cancelledResponse.json();
  assert.equal(cancelledResponse.status,201);
  assert.equal((await updateStatus(cancelledOrder.orderId,'Cancelled')).status,200);
  assert.equal((await updateStatus(cancelledOrder.orderId,'Accepted')).status,409);
  const cleared=await fetch(`${base}/api/admin/orders/completed`,{method:'DELETE',headers:{cookie}});
  assert.equal(cleared.status,200);
  assert.equal((await cleared.json()).deleted,4);
  assert.equal((await fetch(`${base}/api/orders/${created.orderId}`,{headers:{'x-order-token':created.trackingToken}})).status,404);

  assert.equal((await fetch(`${base}/api/admin/logout`,{method:'POST',headers:{cookie}})).status,200);
  assert.deepEqual(await (await fetch(`${base}/api/admin/session`,{headers:{cookie}})).json(),{authenticated:false});

  const db=new Database(dbPath,{readonly:true});
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
  assert.equal(db.prepare('SELECT count(*) AS n FROM menu_items').get().n,menu.length);
  assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM settings').get().n,Object.keys(settings).length);
  db.close();
});

test('order attempt limits are isolated by customer phone number',async()=>{
  const menu=await (await fetch(`${base}/api/menu`)).json();
  const submitOrder=phone=>fetch(`${base}/api/orders`,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({
      customerName:'Test Customer',
      phone,
      address:'Korangi No. 4, Karachi',
      orderType:'Pick-Up',
      paymentMethod:'Cash',
      items:[{id:menu[0].id,qty:1}],
    }),
  });

  for(let attempt=0;attempt<12;attempt++)assert.equal((await submitOrder('03009876543')).status,201);
  const limited=await submitOrder('03009876543');
  assert.equal(limited.status,429);
  assert.match((await limited.json()).error,/this phone number/i);
  assert.ok(Number(limited.headers.get('retry-after'))>0);
  assert.equal((await submitOrder('03009876544')).status,201);
});

test('production startup removes demo admin and rotates configured password',async()=>{
  for(const suffix of ['','-shm','-wal']){try{fs.unlinkSync(productionDbPath+suffix);}catch{}}
  const seed=new Database(productionDbPath);
  seed.exec(`CREATE TABLE admins(id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
    CREATE TABLE orders(
      id INTEGER PRIMARY KEY AUTOINCREMENT,public_id TEXT UNIQUE NOT NULL,tracking_hash TEXT NOT NULL,
      customer_name TEXT NOT NULL,phone TEXT NOT NULL,alt_phone TEXT,address TEXT NOT NULL,
      order_type TEXT NOT NULL,instructions TEXT,payment_method TEXT NOT NULL,subtotal INTEGER NOT NULL,
      delivery_fee INTEGER NOT NULL,total INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
  seed.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run('admin',bcrypt.hashSync('hashfood123',12));
  seed.prepare(`INSERT INTO orders(public_id,tracking_hash,customer_name,phone,address,order_type,payment_method,subtotal,delivery_fee,total,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run('LEGACY1','legacy-hash','Legacy Customer','03001234567','Legacy address','Delivery','Cash',100,150,250,'Ready');
  seed.close();

  const launch=(password)=>spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:'3108',DB_PATH:productionDbPath,NODE_ENV:'production',ADMIN_USERNAME:'production-owner',ADMIN_PASSWORD:password}});
  const waitForServer=async()=>{
    for(let i=0;i<50;i++){try{if((await fetch(`${productionBase}/api/health`)).ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}
    throw new Error('Production test server failed to start');
  };

  const firstPassword='very-secure-production-password';
  productionServer=launch(firstPassword);
  await waitForServer();
  let db=new Database(productionDbPath,{readonly:true});
  assert.deepEqual(db.prepare('SELECT username FROM admins ORDER BY username').all(),[{username:'production-owner'}]);
  assert.equal(bcrypt.compareSync(firstPassword,db.prepare('SELECT password_hash FROM admins WHERE username=?').get('production-owner').password_hash),true);
  assert.equal(db.prepare("SELECT status FROM orders WHERE public_id='LEGACY1'").get().status,'Ready for Pickup');
  assert.match(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get().sql,/CHECK\(status IN/);
  assert.throws(()=>db.prepare("UPDATE orders SET status='Invalid' WHERE public_id='LEGACY1'").run());
  assert.deepEqual(db.pragma('foreign_key_check'),[]);
  db.close();

  const oldLogin=await fetch(`${productionBase}/api/admin/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'admin',password:'hashfood123'})});
  assert.equal(oldLogin.status,401);
  const activeLogin=await fetch(`${productionBase}/api/admin/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'production-owner',password:firstPassword})});
  assert.equal(activeLogin.status,200);

  await new Promise(resolve=>{productionServer.once('exit',resolve);productionServer.kill();});
  const nextPassword='another-secure-production-password';
  productionServer=launch(nextPassword);
  await waitForServer();
  db=new Database(productionDbPath,{readonly:true});
  const rotatedHash=db.prepare('SELECT password_hash FROM admins WHERE username=?').get('production-owner').password_hash;
  assert.equal(bcrypt.compareSync(nextPassword,rotatedHash),true);
  assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
  assert.equal(db.pragma('integrity_check',{simple:true}),'ok');
  db.close();
});
