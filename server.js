'use strict';

// Secure Hash Food REST API and static-file server.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const PORT = Number(process.env.PORT) || 3002;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const HOST = process.env.HOST || (IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1');
const SITE_ORIGIN = 'https://hash-food-website.onrender.com';
const hasAdminUsername = Boolean(process.env.ADMIN_USERNAME);
const hasAdminPassword = Boolean(process.env.ADMIN_PASSWORD);
if (hasAdminUsername !== hasAdminPassword) throw new Error('Set both ADMIN_USERNAME and ADMIN_PASSWORD, or neither for local development');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'database', 'hashfood.sqlite');
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || (IS_PRODUCTION ? '' : 'admin');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : 'hashfood123');
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD are required in production');
if (IS_PRODUCTION && ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
if (!IS_PRODUCTION && !hasAdminUsername && !['127.0.0.1','::1','localhost'].includes(HOST)) {
  throw new Error('Configure ADMIN_USERNAME and ADMIN_PASSWORD before binding beyond localhost');
}

const ORDER_STATUSES = [
  'Pending',
  'Accepted',
  'Preparing',
  'Ready for Pickup',
  'Out for Delivery',
  'Delivered',
  'Served',
  'Completed',
  'Cancelled',
];
const ORDER_STATUS_FLOWS = {
  Delivery: ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup', 'Out for Delivery', 'Delivered'],
  'Pick-Up': ['Pending', 'Accepted', 'Preparing', 'Ready for Pickup', 'Completed'],
  'Dine-In': ['Pending', 'Accepted', 'Preparing', 'Served', 'Completed'],
};
const ORDER_STATUSES_SQL = ORDER_STATUSES.map(status => `'${status}'`).join(',');

fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    price INTEGER NOT NULL CHECK(price > 0),
    options_json TEXT NOT NULL DEFAULT '{}',
    image TEXT NOT NULL,
    popular INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL COLLATE NOCASE UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT UNIQUE NOT NULL,
    tracking_hash TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    alt_phone TEXT,
    address TEXT NOT NULL,
    order_type TEXT NOT NULL,
    instructions TEXT,
    payment_method TEXT NOT NULL,
    subtotal INTEGER NOT NULL,
    delivery_fee INTEGER NOT NULL,
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN (${ORDER_STATUSES_SQL})),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    menu_item_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0)
  );
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
if (!db.prepare('PRAGMA table_info(menu_items)').all().some(column => column.name === 'options_json')) {
  db.exec("ALTER TABLE menu_items ADD COLUMN options_json TEXT NOT NULL DEFAULT '{}'");
}

const ordersTableSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get().sql;
if (!ordersTableSql.includes('CHECK(status IN')) {
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec(`
        CREATE TABLE orders_status_migration (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          public_id TEXT UNIQUE NOT NULL,
          tracking_hash TEXT NOT NULL,
          customer_name TEXT NOT NULL,
          phone TEXT NOT NULL,
          alt_phone TEXT,
          address TEXT NOT NULL,
          order_type TEXT NOT NULL,
          instructions TEXT,
          payment_method TEXT NOT NULL,
          subtotal INTEGER NOT NULL,
          delivery_fee INTEGER NOT NULL,
          total INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN (${ORDER_STATUSES_SQL})),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO orders_status_migration
        SELECT id,public_id,tracking_hash,customer_name,phone,alt_phone,address,order_type,instructions,
          payment_method,subtotal,delivery_fee,total,
          CASE status WHEN 'Ready' THEN 'Ready for Pickup' ELSE status END,
          created_at,updated_at
        FROM orders;
        DROP TABLE orders;
        ALTER TABLE orders_status_migration RENAME TO orders;
      `);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

const defaults = [
  ['Hash Smash','Burgers','Double beef patty, cheddar, pickles and smoky hash sauce.',599,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=700&q=80',1],
  ['Fire Zinger','Burgers','Crispy chicken, fiery mayo and crunchy slaw.',499,'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=700&q=80',1],
  ['Crispy Broast','Broast','Quarter chicken, signature seasoning, fries and dip.',649,'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=700&q=80',1],
  ['Family Broast','Broast','Eight crispy chicken pieces, fries, buns and sauces.',1899,'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=700&q=80',0],
  ['Loaded Hash Fries','Fries','Crispy fries, chicken chunks, jalapeños and cheese sauce.',449,'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80',1],
  ['Pepperoni Heat','Pizza','Pepperoni, mozzarella and our chilli tomato base.',1099,'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=700&q=80',0],
  ['Chicken Tikka Pizza','Pizza','Smoky tikka chicken, onion, capsicum and mozzarella.',999,'https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=700&q=80',1],
  ['Classic Fries','Fries','Golden, salted and made for dipping.',249,'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=700&q=80',0],
  ['Chilled Drink','Drinks','Ice-cold soft drink. Choose your favourite flavour.',149,'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=700&q=80',0]
];
if (!db.prepare('SELECT 1 FROM menu_items LIMIT 1').get()) {
  const insert = db.prepare('INSERT INTO menu_items(name,category,description,price,image,popular) VALUES(?,?,?,?,?,?)');
  db.transaction(rows => rows.forEach(row => insert.run(...row)))(defaults);
}
db.prepare('INSERT OR IGNORE INTO menu_categories(name) SELECT DISTINCT category FROM menu_items').run();
const existingAdmin = db.prepare('SELECT id,password_hash FROM admins WHERE username=?').get(ADMIN_USERNAME);
if (!existingAdmin) {
  db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(ADMIN_USERNAME,bcrypt.hashSync(ADMIN_PASSWORD,12));
} else if (!bcrypt.compareSync(ADMIN_PASSWORD,existingAdmin.password_hash)) {
  db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(ADMIN_PASSWORD,12),existingAdmin.id);
  db.prepare('DELETE FROM sessions WHERE admin_id=?').run(existingAdmin.id);
}
if (IS_PRODUCTION && ADMIN_USERNAME !== 'admin') {
  db.prepare("DELETE FROM admins WHERE username='admin'").run();
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: { directives: { defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","https://fonts.googleapis.com"],fontSrc:["'self'","https://fonts.gstatic.com"],imgSrc:["'self'","data:","https://images.unsplash.com"],connectSrc:["'self'"],objectSrc:["'none'"],baseUri:["'self'"],frameAncestors:["'none'"] } },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(express.json({limit:'64kb'}));
app.use(cookieParser());

const apiLimit = rateLimit({windowMs:60_000,limit:120,standardHeaders:'draft-7',legacyHeaders:false});
const orderNetworkLimit = rateLimit({windowMs:15*60_000,limit:120,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many orders from this network. Please wait and try again.'}});
const orderLimit = rateLimit({
  windowMs:15*60_000,
  limit:12,
  standardHeaders:'draft-7',
  legacyHeaders:false,
  keyGenerator:req=>{
    const phone=clean(req.body?.phone,20).replace(/[\s-]/g,'');
    return phone?`phone:${sha256(phone)}`:`ip:${ipKeyGenerator(req.ip)}`;
  },
  message:{error:'Too many order attempts from this phone number. Please wait and try again.'}
});
const loginLimit = rateLimit({windowMs:15*60_000,limit:8,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Too many login attempts. Please try again later.'}});
app.use('/api',apiLimit);

const clean = (value,max=250)=>typeof value==='string'?value.trim().slice(0,max):'';
const sha256 = value=>crypto.createHash('sha256').update(value).digest('hex');
const token = bytes=>crypto.randomBytes(bytes).toString('base64url');
const validPhone = value=>/^[+0-9][0-9\s-]{8,17}$/.test(value);
const validImageUrl = value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol);}catch{return false;}};
const publicSettings = ()=>Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r=>[r.key,r.value]));
const orderStatusStreams = new Map();

function publishOrderStatus(orderId,status,updatedAt){
  const clients=orderStatusStreams.get(orderId);
  if(!clients)return;
  const message=`event: status\ndata: ${JSON.stringify({status,updatedAt})}\n\n`;
  for(const response of clients)if(!response.writableEnded)response.write(message);
}

function closeOrderStatusStreams(orderId){
  const clients=orderStatusStreams.get(orderId);
  if(!clients)return;
  for(const response of clients)response.end();
  orderStatusStreams.delete(orderId);
}


function sameOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  if (!origin) return next();

  try {
    const requestOrigin = new URL(origin).origin;
    const ownOrigin = `${req.protocol}://${req.get('host')}`;
    const frontendOrigin = process.env.FRONTEND_ORIGIN;

    if (
      requestOrigin === ownOrigin ||
      (frontendOrigin &&
        requestOrigin === new URL(frontendOrigin).origin)
    ) {
      return next();
    }
  } catch {}

  return res.status(403).json({ error: 'Invalid request origin' });
}
function requireAdmin(req, res, next) {
  const raw = req.cookies.hf_admin;
  if (!raw) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = db.prepare(
    'SELECT admin_id FROM sessions WHERE token_hash=? AND expires_at>?'
  ).get(sha256(raw), Date.now());

  if (!session) {
    res.clearCookie('hf_admin');
    return res.status(401).json({ error: 'Session expired' });
  }

  req.adminId = session.admin_id;
  next();
}
function menuPayload(row){
  let options=null;
  try{
    const parsed=JSON.parse(row.options_json||'{}');
    if(typeof parsed.label==='string'&&Array.isArray(parsed.items))options=parsed;
  }catch{}
  const {options_json,...item}=row;
  return {...item,options,popular:Boolean(row.popular),active:Boolean(row.active)};
}

app.get('/api/health',(req,res)=>res.json({ok:true}));
app.get('/api/menu',(req,res)=>res.json(db.prepare(`
  SELECT m.id,m.name,m.category,c.id AS categoryId,m.description,m.price,m.options_json,m.image,m.popular,m.active
  FROM menu_items m LEFT JOIN menu_categories c ON c.name=m.category COLLATE NOCASE
  WHERE m.active=1 ORDER BY m.id
`).all().map(menuPayload)));
app.get('/api/settings',(req,res)=>res.json(publicSettings()));

app.post('/api/admin/login',loginLimit,sameOrigin,(req,res)=>{
  const username=clean(req.body?.username,80);const password=String(req.body?.password||'');
  const admin=db.prepare('SELECT id,password_hash FROM admins WHERE username=?').get(username);
  if(!admin||!bcrypt.compareSync(password,admin.password_hash))return res.status(401).json({error:'Invalid username or password'});
  const raw=token(32);const expires=Date.now()+8*60*60*1000;
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());
  db.prepare('INSERT INTO sessions(token_hash,admin_id,expires_at) VALUES(?,?,?)').run(sha256(raw),admin.id,expires);
  res.cookie('hf_admin',raw,{httpOnly:true,secure:IS_PRODUCTION,sameSite:'strict',maxAge:8*60*60*1000,path:'/'}).json({ok:true});
});
app.get('/api/admin/session',(req,res)=>{const raw=req.cookies.hf_admin;const session=raw&&db.prepare('SELECT admin_id FROM sessions WHERE token_hash=? AND expires_at>?').get(sha256(raw),Date.now());res.json({authenticated:Boolean(session)});});
app.post('/api/admin/logout',sameOrigin,requireAdmin,(req,res)=>{db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha256(req.cookies.hf_admin));res.clearCookie('hf_admin',{path:'/'}).json({ok:true});});

app.post('/api/orders',sameOrigin,orderNetworkLimit,orderLimit,(req,res)=>{
  const customerName=clean(req.body?.customerName,80),phone=clean(req.body?.phone,20),altPhone=clean(req.body?.altPhone,20),address=clean(req.body?.address,300),instructions=clean(req.body?.instructions,300);
  const orderType=clean(req.body?.orderType,20),paymentMethod=clean(req.body?.paymentMethod,20),items=Array.isArray(req.body?.items)?req.body.items:[];
  if(customerName.length<2||!validPhone(phone)||address.length<5||!['Delivery','Pick-Up','Dine-In'].includes(orderType)||paymentMethod!=='Cash'||!items.length||items.length>30)return res.status(400).json({error:'Please provide valid order details'});
  const requestedItems=[];
  for(const item of items){
    const id=Number(item.id),qty=Number(item.qty);
    if(!Number.isInteger(id)||!Number.isInteger(qty)||qty<1||qty>20||(item.option!==undefined&&typeof item.option!=='string'))return res.status(400).json({error:'Invalid order item'});
    requestedItems.push({id,qty,option:item.option});
  }
  const ids=[...new Set(requestedItems.map(item=>item.id))];const placeholders=ids.map(()=>'?').join(',');
  const menu=db.prepare(`SELECT id,name,price,options_json FROM menu_items WHERE active=1 AND id IN (${placeholders})`).all(...ids);
  if(menu.length!==ids.length)return res.status(400).json({error:'One or more menu items are unavailable'});
  const menuById=new Map(menu.map(item=>[item.id,item]));
  const orderItems=[];
  for(const request of requestedItems){
    const product=menuById.get(request.id);
    let options;
    try{options=JSON.parse(product.options_json||'{}');}catch{options={};}
    const choices=Array.isArray(options.items)?options.items:[];
    if(choices.length){
      const choice=choices.find(option=>option.name===request.option);
      if(!choice)return res.status(400).json({error:`Choose a valid option for ${product.name}`});
      orderItems.push({id:product.id,name:`${product.name} (${choice.name})`,price:choice.price,quantity:request.qty});
    }else{
      if(request.option!==undefined)return res.status(400).json({error:`${product.name} does not have selectable options`});
      orderItems.push({id:product.id,name:product.name,price:product.price,quantity:request.qty});
    }
  }
  const subtotal=orderItems.reduce((sum,item)=>sum+item.price*item.quantity,0);const deliveryFee=orderType==='Delivery'?150:0;const total=subtotal+deliveryFee;
  const publicId=`HF${Date.now().toString(36).toUpperCase().slice(-6)}${crypto.randomInt(10,99)}`;const trackingToken=token(18);
  const create=db.transaction(()=>{
    const result=db.prepare(`INSERT INTO orders(public_id,tracking_hash,customer_name,phone,alt_phone,address,order_type,instructions,payment_method,subtotal,delivery_fee,total,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(publicId,sha256(trackingToken),customerName,phone,altPhone||null,address,orderType,instructions||null,paymentMethod,subtotal,deliveryFee,total,'Pending');
    const insertItem=db.prepare('INSERT INTO order_items(order_id,menu_item_id,name,price,quantity) VALUES(?,?,?,?,?)');
    orderItems.forEach(item=>insertItem.run(result.lastInsertRowid,item.id,item.name,item.price,item.quantity));
  });
  create();res.status(201).json({orderId:publicId,trackingToken,status:'Pending',subtotal,deliveryFee,total});
});

function trackedOrder(req,res){
  const id=clean(req.params.id,30),trackingToken=clean(req.get('x-order-token'),100);
  if(!trackingToken)return res.status(401).json({error:'Tracking token required'});
  const order=db.prepare('SELECT * FROM orders WHERE public_id=? AND tracking_hash=?').get(id,sha256(trackingToken));
  if(!order)return res.status(404).json({error:'Order not found'});
  const items=db.prepare('SELECT name,price,quantity FROM order_items WHERE order_id=?').all(order.id);
  res.json({orderId:order.public_id,customerName:order.customer_name,phone:order.phone,altPhone:order.alt_phone,address:order.address,orderType:order.order_type,instructions:order.instructions,paymentMethod:order.payment_method,subtotal:order.subtotal,deliveryFee:order.delivery_fee,total:order.total,status:order.status,createdAt:order.created_at,updatedAt:order.updated_at,items});
}
app.get('/api/orders/:id',trackedOrder);
app.get('/api/orders/:id/events',(req,res)=>{
  const id=clean(req.params.id,30),trackingToken=clean(req.get('x-order-token'),100);
  if(!trackingToken)return res.status(401).json({error:'Tracking token required'});
  const order=db.prepare('SELECT status,updated_at FROM orders WHERE public_id=? AND tracking_hash=?').get(id,sha256(trackingToken));
  if(!order)return res.status(404).json({error:'Order not found'});
  res.status(200).set({
    'Content-Type':'text/event-stream; charset=utf-8',
    'Cache-Control':'no-cache, no-transform',
    Connection:'keep-alive',
    'X-Accel-Buffering':'no'
  });
  res.flushHeaders();
  const clients=orderStatusStreams.get(id)||new Set();
  clients.add(res);
  orderStatusStreams.set(id,clients);
  const cleanup=()=>{
    clearInterval(heartbeat);
    clients.delete(res);
    if(clients.size===0)orderStatusStreams.delete(id);
  };
  const heartbeat=setInterval(()=>{if(!res.writableEnded)res.write(': keep-alive\n\n');},25_000);
  res.once('close',cleanup);
  res.write(`event: snapshot\ndata: ${JSON.stringify({status:order.status,updatedAt:order.updated_at})}\n\n`);
});

app.get('/api/admin/orders',requireAdmin,(req,res)=>{
  const orders=db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 500').all();const itemStmt=db.prepare('SELECT name,price,quantity AS qty FROM order_items WHERE order_id=?');
  res.json(orders.map(o=>({id:o.public_id,customer:o.customer_name,phone:o.phone,address:o.address,type:o.order_type,instructions:o.instructions,paymentMethod:o.payment_method,subtotal:o.subtotal,deliveryFee:o.delivery_fee,total:o.total,status:o.status,time:o.created_at,items:itemStmt.all(o.id)})));
});
app.patch('/api/admin/orders/:id/status',sameOrigin,requireAdmin,(req,res)=>{
  const status=clean(req.body?.status,30);if(!ORDER_STATUSES.includes(status))return res.status(400).json({error:'Invalid status'});
  const id=clean(req.params.id,30),current=db.prepare('SELECT status,order_type FROM orders WHERE public_id=?').get(id);
  if(!current)return res.status(404).json({error:'Order not found'});
  if(current.status!==status){
    const flow=ORDER_STATUS_FLOWS[current.order_type];
    const currentIndex=flow?.indexOf(current.status) ?? -1;
    const isNextStatus=currentIndex>=0&&flow[currentIndex+1]===status;
    const isCancellation=status==='Cancelled'&&current.status!=='Completed'&&current.status!=='Delivered'&&current.status!=='Cancelled';
    if(!isNextStatus&&!isCancellation)return res.status(409).json({error:`Cannot change an order from ${current.status} to ${status}.`});
  }
  let updatedAt;
  if(current.status!==status){
    db.prepare('UPDATE orders SET status=?,updated_at=CURRENT_TIMESTAMP WHERE public_id=?').run(status,id);
    updatedAt=db.prepare('SELECT updated_at FROM orders WHERE public_id=?').get(id).updated_at;
    publishOrderStatus(id,status,updatedAt);
  }
  res.json({ok:true,status,updatedAt});
});
app.delete('/api/admin/orders/completed',sameOrigin,requireAdmin,(req,res)=>{
  const completed=db.prepare("SELECT public_id FROM orders WHERE status IN ('Delivered','Completed','Cancelled')").all();
  const result=db.prepare("DELETE FROM orders WHERE status IN ('Delivered','Completed','Cancelled')").run();
  completed.forEach(({public_id})=>closeOrderStatusStreams(public_id));
  res.json({ok:true,deleted:result.changes});
});

app.get('/api/admin/menu/categories',requireAdmin,(req,res)=>res.json(db.prepare(`
  SELECT c.id,c.name,COUNT(m.id) AS itemCount
  FROM menu_categories c LEFT JOIN menu_items m ON m.category=c.name COLLATE NOCASE
  GROUP BY c.id ORDER BY c.name COLLATE NOCASE
`).all()));
app.post('/api/admin/menu/categories',sameOrigin,requireAdmin,(req,res)=>{
  const name=clean(req.body?.name,40);
  if(name.length<2)return res.status(400).json({error:'Category name must contain at least 2 characters'});
  try{
    const result=db.prepare('INSERT INTO menu_categories(name) VALUES(?)').run(name);
    res.status(201).json({id:Number(result.lastInsertRowid),name,itemCount:0});
  }catch(error){
    if(error.code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'This category already exists'});
    throw error;
  }
});
app.delete('/api/admin/menu/categories/:id',sameOrigin,requireAdmin,(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1)return res.status(404).json({error:'Category not found'});
  const category=db.prepare('SELECT name FROM menu_categories WHERE id=?').get(id);
  if(!category)return res.status(404).json({error:'Category not found'});
  if(db.prepare('SELECT 1 FROM menu_items WHERE category=? COLLATE NOCASE LIMIT 1').get(category.name)){
    return res.status(409).json({error:'Move or remove dishes in this category before deleting it'});
  }
  db.prepare('DELETE FROM menu_categories WHERE id=?').run(id);
  res.json({ok:true});
});
app.get('/api/admin/menu',requireAdmin,(req,res)=>res.json(db.prepare('SELECT id,name,category,description,price,options_json,image,popular,active FROM menu_items ORDER BY id').all().map(menuPayload)));
function validateMenu(body){
  const item={name:clean(body?.name,100),category:clean(body?.category,40),description:clean(body?.description,300),price:Number(body?.price),image:clean(body?.image,500),popular:Boolean(body?.popular),active:body?.active!==false,options:null};
  const options=body?.options;
  if(options!==undefined&&options!==null){
    if(typeof options!=='object'||Array.isArray(options))return null;
    const label=clean(options.label,40);
    if(label.length<2||!Array.isArray(options.items)||options.items.length<2||options.items.length>12)return null;
    const names=new Set(),optionItems=[];
    for(const option of options.items){
      const name=clean(option?.name,40),price=Number(option?.price);
      if(name.length<1||names.has(name.toLowerCase())||!Number.isInteger(price)||price<1||price>100000)return null;
      names.add(name.toLowerCase());
      optionItems.push({name,price});
    }
    item.options={label,items:optionItems};
  }
  if(item.name.length<2||item.category.length<2||item.description.length<3||!Number.isInteger(item.price)||item.price<1||item.price>100000||!validImageUrl(item.image))return null;
  return item;
}
app.post('/api/admin/menu',sameOrigin,requireAdmin,(req,res)=>{
  const item=validateMenu(req.body);
  if(!item)return res.status(400).json({error:'Invalid menu item'});
  const create=db.transaction(()=>{
    db.prepare('INSERT OR IGNORE INTO menu_categories(name) VALUES(?)').run(item.category);
    return db.prepare('INSERT INTO menu_items(name,category,description,price,options_json,image,popular,active) VALUES(?,?,?,?,?,?,?,?)').run(item.name,item.category,item.description,item.price,JSON.stringify(item.options||{}),item.image,Number(item.popular),Number(item.active));
  });
  const result=create();
  res.status(201).json({id:Number(result.lastInsertRowid),...item});
});
app.put('/api/admin/menu/:id',sameOrigin,requireAdmin,(req,res)=>{
  const item=validateMenu(req.body);
  if(!item)return res.status(400).json({error:'Invalid menu item'});
  const update=db.transaction(()=>{
    const result=db.prepare('UPDATE menu_items SET name=?,category=?,description=?,price=?,options_json=?,image=?,popular=?,active=? WHERE id=?').run(item.name,item.category,item.description,item.price,JSON.stringify(item.options||{}),item.image,Number(item.popular),Number(item.active),Number(req.params.id));
    if(result.changes)db.prepare('INSERT OR IGNORE INTO menu_categories(name) VALUES(?)').run(item.category);
    return result;
  });
  const result=update();
  if(!result.changes)return res.status(404).json({error:'Menu item not found'});
  res.json({id:Number(req.params.id),...item});
});
app.delete('/api/admin/menu/:id',sameOrigin,requireAdmin,(req,res)=>{const r=db.prepare('UPDATE menu_items SET active=0 WHERE id=?').run(Number(req.params.id));if(!r.changes)return res.status(404).json({error:'Menu item not found'});res.json({ok:true});});
app.delete('/api/admin/menu/:id/permanent',sameOrigin,requireAdmin,(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1)return res.status(404).json({error:'Menu item not found'});
  const result=db.prepare('DELETE FROM menu_items WHERE id=?').run(id);
  if(!result.changes)return res.status(404).json({error:'Menu item not found'});
  res.json({ok:true});
});
app.put('/api/admin/settings',sameOrigin,requireAdmin,(req,res)=>{const allowed=['name','phone','address','opening','closing','acceptOrders','deliveryAvailable'];const upsert=db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');db.transaction(()=>allowed.forEach(k=>{if(req.body?.[k]!==undefined)upsert.run(k,clean(String(req.body[k]),300));}))();res.json({ok:true,settings:publicSettings()});});

const CLIENT_DIST = path.join(__dirname, 'client', 'dist');
const htmlEscape = value => String(value).replace(/[&<>"']/g, character => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[character]));
const xmlEscape = value => String(value).replace(/[<>&'"]/g, character => ({
  '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'
}[character]));
const slugify = value => String(value)
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g,'-')
  .replace(/^-|-$/g,'') || 'item';

function sendSeoPage(req,res,{title,description,pathname,robots='index,follow',image,ogType='website',product}){
  const indexPath=path.join(CLIENT_DIST,'index.html');
  if(!fs.existsSync(indexPath))return res.status(503).type('text/plain').send('Frontend build unavailable');
  const canonical=`${SITE_ORIGIN}${pathname}`;
  const socialImage=image||`${SITE_ORIGIN}/hash-food-icon.svg`;
  const socialTags=[
    `<link rel="canonical" href="${htmlEscape(canonical)}">`,
    `<meta name="robots" content="${htmlEscape(robots)}">`,
    `<meta property="og:type" content="${htmlEscape(ogType)}">`,
    `<meta property="og:title" content="${htmlEscape(title)}">`,
    `<meta property="og:description" content="${htmlEscape(description)}">`,
    `<meta property="og:url" content="${htmlEscape(canonical)}">`,
    `<meta property="og:image" content="${htmlEscape(socialImage)}">`,
    `<meta property="og:image:alt" content="${htmlEscape(title)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${htmlEscape(title)}">`,
    `<meta name="twitter:description" content="${htmlEscape(description)}">`,
    `<meta name="twitter:image" content="${htmlEscape(socialImage)}">`,
  ];
  if(product){
    const structuredData={
      '@context':'https://schema.org',
      '@type':'Product',
      name:product.name,
      description:product.description,
      image:product.image,
      category:product.category,
      offers:{
        '@type':'Offer',
        priceCurrency:'PKR',
        price:product.price,
        url:canonical,
      },
    };
    socialTags.push(`<script type="application/ld+json">${JSON.stringify(structuredData).replace(/</g,'\\u003c')}</script>`);
    socialTags.push(`<meta property="product:price:amount" content="${htmlEscape(product.price)}">`);
    socialTags.push('<meta property="product:price:currency" content="PKR">');
  }
  let html=fs.readFileSync(indexPath,'utf8')
    .replace(/<title>[\s\S]*?<\/title>/i,`<title>${htmlEscape(title)}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i,`<meta name="description" content="${htmlEscape(description)}">`)
    .replace(/<meta\s+name=["']robots["'][^>]*>/i,'')
    .replace(/<link\s+rel=["']canonical["'][^>]*>/i,'')
    .replace('</head>',`${socialTags.join('\n    ')}\n  </head>`);
  res.setHeader('Cache-Control','no-cache');
  if(robots.startsWith('noindex'))res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.status(200).type('html').send(html);
}

app.get('/robots.txt',(req,res)=>{
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
});
app.get('/sitemap.xml',(req,res)=>{
  const urls=[`${SITE_ORIGIN}/`,`${SITE_ORIGIN}/menu`];
  const categories=db.prepare(`
    SELECT c.id,c.name FROM menu_categories c
    JOIN menu_items m ON m.category=c.name COLLATE NOCASE AND m.active=1
    GROUP BY c.id,c.name ORDER BY c.id
  `).all();
  categories.forEach(category=>urls.push(`${SITE_ORIGIN}/menu/category/${category.id}/${slugify(category.name)}`));
  const products=db.prepare('SELECT id,name FROM menu_items WHERE active=1 ORDER BY id').all();
  products.forEach(product=>urls.push(`${SITE_ORIGIN}/product/${product.id}/${slugify(product.name)}`));
  const urlSet=urls.map(url=>`  <url><loc>${xmlEscape(url)}</loc></url>`).join('\n');
  res.set('Cache-Control','public, max-age=3600').type('application/xml')
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlSet}\n</urlset>\n`);
});

app.get(['/','/menu'],(req,res)=>{
  if(req.path==='/menu/')return res.redirect(301,'/menu');
  const isMenu=req.path==='/menu';
  sendSeoPage(req,res,{
    title:isMenu?'Hash Food Menu | Order Burgers, Broast & More':'Hash Food | Karachi’s legendary taste, delivered hot',
    description:isMenu
      ?'Explore the Hash Food menu in Karachi. Browse current dishes, descriptions and prices, and order online.'
      :'Big flavour, freshly made in Karachi. Explore the Hash Food menu and order burgers, broast, fries and more.',
    pathname:isMenu?'/menu':'/',
  });
});
app.get('/menu/category/:categoryId/:slug',(req,res)=>{
  const categoryId=Number(req.params.categoryId);
  const category=db.prepare(`
    SELECT c.id,c.name FROM menu_categories c
    JOIN menu_items m ON m.category=c.name COLLATE NOCASE AND m.active=1
    WHERE c.id=? GROUP BY c.id,c.name
  `).get(categoryId);
  if(!category)return res.status(404).set('X-Robots-Tag','noindex, nofollow').type('text/plain').send('Category not found');
  const pathname=`/menu/category/${category.id}/${slugify(category.name)}`;
  if(req.path!==pathname)return res.redirect(301,pathname);
  sendSeoPage(req,res,{
    title:`${category.name} Menu | Hash Food Karachi`,
    description:`Explore ${category.name} at Hash Food in Karachi. See current dishes, descriptions and prices, and order online.`,
    pathname,
  });
});
app.get('/product/:id/:slug',(req,res)=>{
  const id=Number(req.params.id);
  const product=db.prepare(`
    SELECT m.id,m.name,m.category,c.id AS categoryId,m.description,m.price,m.image,m.popular
    FROM menu_items m LEFT JOIN menu_categories c ON c.name=m.category COLLATE NOCASE
    WHERE m.id=? AND m.active=1
  `).get(id);
  if(!product)return res.status(404).set('X-Robots-Tag','noindex, nofollow').type('text/plain').send('Menu item not found');
  const pathname=`/product/${product.id}/${slugify(product.name)}`;
  if(req.path!==pathname)return res.redirect(301,pathname);
  sendSeoPage(req,res,{
    title:`${product.name} | Hash Food`,
    description:`${product.description} Order ${product.name} from Hash Food in Karachi.`,
    pathname,
    image:product.image,
    ogType:'product',
    product,
  });
});
app.get(['/checkout','/track','/track/:id','/admin','/admin/login'],(req,res)=>{
  if(req.path.endsWith('/'))return res.redirect(301,req.path.slice(0,-1));
  const routeInfo={
    '/checkout':['Checkout | Hash Food','/checkout'],
    '/track':['Order tracking | Hash Food','/track'],
    '/admin':['Admin dashboard | Hash Food','/admin'],
    '/admin/login':['Admin login | Hash Food','/admin/login'],
  };
  const [title,pathname]=req.path.startsWith('/track/')?['Order tracking | Hash Food',req.path]:routeInfo[req.path];
  sendSeoPage(req,res,{
    title,
    description:'Hash Food customer and account information.',
    pathname,
    robots:'noindex,nofollow',
  });
});

app.use(express.static(CLIENT_DIST, {
  index: false,
  setHeaders(res, filePath) {
    const fileName = path.basename(filePath);
    if (fileName === 'index.html') {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (/\-[A-Za-z0-9_-]{8,}\./.test(fileName)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));
app.use((req,res)=>{
  if(req.path==='/api'||req.path.startsWith('/api/'))return res.status(404).json({error:'Not found'});
  res.set('X-Robots-Tag','noindex, nofollow').status(404).type('text/plain').send('Page not found');
});
app.use((err,req,res,next)=>{if(err instanceof SyntaxError&&'body' in err)return res.status(400).json({error:'Invalid JSON'});console.error(err.message);res.status(500).json({error:'Server error'});});

if(require.main===module){app.listen(PORT,HOST,()=>console.log(`Hash Food server listening on http://${HOST}:${PORT}`));}
module.exports={app,db};
