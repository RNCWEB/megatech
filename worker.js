// RNCWEB
const schema = ["-- RNCWEB\nCREATE TABLE IF NOT EXISTS produtos (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  nome TEXT NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 150),\n  descricao TEXT NOT NULL DEFAULT '' CHECK(length(descricao) <= 2000),\n  categoria TEXT NOT NULL DEFAULT '' CHECK(length(categoria) <= 100),\n  preco_centavos INTEGER NOT NULL CHECK(typeof(preco_centavos) = 'integer' AND preco_centavos >= 0),\n  preco_promocional_centavos INTEGER CHECK(preco_promocional_centavos IS NULL OR (typeof(preco_promocional_centavos) = 'integer' AND preco_promocional_centavos >= 0 AND preco_promocional_centavos < preco_centavos)),\n  estoque INTEGER NOT NULL DEFAULT 0 CHECK(typeof(estoque) = 'integer' AND estoque >= 0),\n  imagem_url TEXT NOT NULL DEFAULT '' CHECK(length(imagem_url) <= 2048),\n  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0, 1)),\n  destaque INTEGER NOT NULL DEFAULT 0 CHECK(destaque IN (0, 1)),\n  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),\n  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))\n)","CREATE INDEX IF NOT EXISTS idx_produtos_catalogo ON produtos(ativo, destaque DESC, id DESC)"];
const fields = ["nome","descricao","categoria","preco_centavos","preco_promocional_centavos","estoque","imagem_url","ativo","destaque"];
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
async function digest(value){
  const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));
  return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
}
function equal(a,b){
  if(typeof a!=="string"||typeof b!=="string"||a.length!==64||b.length!==64)return false;
  let diff=0;for(let i=0;i<64;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;
}
async function adminAccess(req,env){
  const header=req.headers.get("Authorization")||"";
  const token=header.startsWith("Bearer ")&&header.length<=512?header.slice(7):"";
  if(typeof env.ADMIN_TOKEN==="string"&&env.ADMIN_TOKEN.length>=24){
    if(!token||!equal(await digest(token),await digest(env.ADMIN_TOKEN)))return json({erro:"Credencial inválida."},401);
    return null;
  }
  let row;
  try{row=await env.DB.prepare("SELECT chave_inicial, hash FROM admin_acesso WHERE id=1").first();}
  catch(e){if(String(e).includes("no such table"))return json({erro:"Configure a chave administrativa no console D1."},503);throw e;}
  if(!row)return json({erro:"Configure a chave administrativa no console D1."},503);
  if(!/^[a-f0-9]{64}$/.test(token))return json({erro:"Credencial inválida."},401);
  const hashed=await digest(token);
  if(row.hash){return equal(hashed,row.hash)?null:json({erro:"Credencial inválida."},401);}
  if(!row.chave_inicial||!equal(hashed,await digest(row.chave_inicial)))return json({erro:"Credencial inválida."},401);
  const r=await env.DB.prepare("UPDATE admin_acesso SET hash=?, chave_inicial=NULL WHERE id=1 AND hash IS NULL AND chave_inicial=?").bind(hashed,token).run();
  if(!r.meta.changes){const current=await env.DB.prepare("SELECT hash FROM admin_acesso WHERE id=1").first();if(!equal(hashed,current?.hash))return json({erro:"Credencial inválida."},401);}
  return null;
}
const photoPath=/^\/api\/fotos\/[a-f0-9-]{36}$/;
const photoId=/^[a-f0-9-]{36}$/;
const photoSchema="CREATE TABLE IF NOT EXISTS produto_fotos (id TEXT PRIMARY KEY, jpeg TEXT NOT NULL CHECK(length(jpeg)<=400000))";
async function photoResponse(db,id,admin=false){
  let row;
  try{row=await db.prepare("SELECT f.jpeg FROM produto_fotos f WHERE f.id=? AND EXISTS (SELECT 1 FROM produtos p WHERE p.imagem_url='/api/fotos/'||f.id "+(admin?"":"AND p.ativo=1")+")").bind(id).first();}
  catch(e){if(String(e).includes("no such table"))return json({erro:"Foto não encontrada."},404);throw e;}
  if(!row)return json({erro:"Foto não encontrada."},404);
  return new Response(Uint8Array.from(atob(row.jpeg),c=>c.charCodeAt(0)),{headers:{"Content-Type":"image/jpeg","Cache-Control":admin?"no-store":"public, max-age=120","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'"}});
}
function photoData(p){
  if(p.foto==null)return null;
  if(typeof p.foto!=="string"||p.foto.length>400000||p.foto.length<16||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.foto)||p.foto.length%4!==0)throw Error("Foto inválida ou muito grande.");
  let a;try{a=atob(p.foto);}catch{throw Error("Foto inválida.");}
  if(a.charCodeAt(0)!==255||a.charCodeAt(1)!==216||a.charCodeAt(2)!==255||a.charCodeAt(a.length-2)!==255||a.charCodeAt(a.length-1)!==217)throw Error("Envie uma imagem JPEG válida.");
  return p.foto;
}
async function setup(db){await db.batch([...schema,photoSchema].map(s=>db.prepare(s)));}
async function query(db,sql,args=[]){
  try{return await db.prepare(sql).bind(...args).all();}
  catch(e){if(!String(e).includes("no such table"))throw e;await setup(db);return db.prepare(sql).bind(...args).all();}
}
function validate(p){
  if(!p||typeof p!=="object"||Array.isArray(p))throw Error("Dados inválidos.");
  const str=(k,n,required=false)=>{const v=p[k]??"";if(typeof v!=="string"||v.trim().length>n||(required&&!v.trim()))throw Error("Campo inválido: "+k);return v.trim();};
  const integer=(k,max)=>{const v=p[k];if(!Number.isSafeInteger(v)||v<0||v>max)throw Error("Valor inválido: "+k);return v;};
  const flag=k=>{if(p[k]!==0&&p[k]!==1)throw Error("Campo inválido: "+k);return p[k];};
  const nome=str("nome",150,true),descricao=str("descricao",2000),categoria=str("categoria",100),preco=integer("preco_centavos",999999999),estoque=integer("estoque",999999);
  const promo=p.preco_promocional_centavos==null?null:integer("preco_promocional_centavos",999999999);
  if(promo!==null&&promo>=preco)throw Error("O preço promocional deve ser menor que o normal.");
  const imagem=str("imagem_url",2048);
  if(imagem&&!photoPath.test(imagem)){let u;try{u=new URL(imagem);}catch{throw Error("URL de imagem inválida.");}if(u.protocol!=="https:"||u.username||u.password)throw Error("Use uma URL HTTPS para a imagem.");}
  return [nome,descricao,categoria,preco,promo,estoque,imagem,flag("ativo"),flag("destaque")];
}
async function body(req){
  if(!req.headers.get("Content-Type")?.startsWith("application/json"))throw Error("Envie JSON.");
  if(Number(req.headers.get("Content-Length")||0)>420000)throw Error("Dados muito grandes.");
  const reader=req.body?.getReader();if(!reader)throw Error("Dados ausentes.");
  let bytes=0;const decoder=new TextDecoder();let text="";
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>420000){await reader.cancel();throw Error("Dados muito grandes.");}text+=decoder.decode(value,{stream:true});}
  text+=decoder.decode();return JSON.parse(text);
}
export default {async fetch(req,env){
  const url=new URL(req.url), path=url.pathname, method=req.method;
  if(!path.startsWith("/api/"))return env.ASSETS.fetch(req);
  if(!env.DB)return json({erro:"Banco ainda não vinculado."},503);
  try{
    if(method==="GET"&&photoPath.test(path))return photoResponse(env.DB,path.split("/").pop());
    if(path==="/api/produtos"&&method==="GET"){
      const r=await query(env.DB,"SELECT id,nome,descricao,categoria,preco_centavos,preco_promocional_centavos,estoque,imagem_url,destaque FROM produtos WHERE ativo=1 ORDER BY destaque DESC,id DESC LIMIT 500");
      return json({produtos:r.results});
    }
    if(!path.startsWith("/api/admin/"))return json({erro:"Não encontrado."},404);
    if(req.headers.get("Origin")&&req.headers.get("Origin")!==url.origin)return json({erro:"Origem não autorizada."},403);
    const denied=await adminAccess(req,env);if(denied)return denied;
    if(method==="GET"&&path.startsWith("/api/admin/fotos/")&&photoId.test(path.split("/").pop()))return photoResponse(env.DB,path.split("/").pop(),true);
    if(path==="/api/admin/produtos"&&method==="GET"){
      const r=await query(env.DB,"SELECT * FROM produtos ORDER BY id DESC LIMIT 500");return json({produtos:r.results});
    }
    const match=path.match(/^\/api\/admin\/produtos\/([1-9][0-9]{0,14})$/);
    if(path==="/api/admin/produtos"&&method==="POST"||match&&method==="PUT"){
      let values,p,photo;try{p=await body(req);values=validate(p);photo=photoData(p);}catch(e){return json({erro:e.message},400);}
      await setup(env.DB);
      const old=method==="PUT"?await env.DB.prepare("SELECT imagem_url FROM produtos WHERE id=?").bind(Number(match[1])).first():null;
      if(method==="PUT"&&!old)return json({erro:"Produto não encontrado."},404);
      if(photoPath.test(values[6])&&values[6]!==old?.imagem_url&&!photo)return json({erro:"Foto não vinculada ao produto."},400);
      const statements=[];
      if(photo){const id=crypto.randomUUID();values[6]="/api/fotos/"+id;statements.push(env.DB.prepare("INSERT INTO produto_fotos (id,jpeg) VALUES (?,?)").bind(id,photo));}
      const idx=statements.length;
      if(method==="POST")statements.push(env.DB.prepare("INSERT INTO produtos ("+fields.join(",")+") VALUES ("+fields.map(()=>"?").join(",")+")").bind(...values));
      else statements.push(env.DB.prepare("UPDATE produtos SET "+fields.map(k=>k+"=?").join(",")+", atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(...values,Number(match[1])));
      if(old&&photoPath.test(old.imagem_url)&&old.imagem_url!==values[6])statements.push(env.DB.prepare("DELETE FROM produto_fotos WHERE id=? AND NOT EXISTS (SELECT 1 FROM produtos WHERE imagem_url=?)").bind(old.imagem_url.split("/").pop(),old.imagem_url));
      if(photo)statements.push(env.DB.prepare("DELETE FROM produto_fotos WHERE id=? AND NOT EXISTS (SELECT 1 FROM produtos WHERE imagem_url=?)").bind(values[6].split("/").pop(),values[6]));
      const r=(await env.DB.batch(statements))[idx];
      if(method==="POST")return json({id:r.meta.last_row_id},201);
      return r.meta.changes?json({ok:true}):json({erro:"Produto não encontrado."},404);
    }
    if(match&&method==="DELETE"){
      await setup(env.DB);
      const id=Number(match[1]),old=await env.DB.prepare("SELECT imagem_url FROM produtos WHERE id=?").bind(id).first();
      const statements=[env.DB.prepare("DELETE FROM produtos WHERE id=?").bind(id)];
      if(old&&photoPath.test(old.imagem_url))statements.push(env.DB.prepare("DELETE FROM produto_fotos WHERE id=? AND NOT EXISTS (SELECT 1 FROM produtos WHERE imagem_url=?)").bind(old.imagem_url.split("/").pop(),old.imagem_url));
      const r=(await env.DB.batch(statements))[0];return r.meta.changes?json({ok:true}):json({erro:"Produto não encontrado."},404);
    }
    return json({erro:"Não encontrado."},404);
  }catch(e){console.error("Falha D1",String(e));return json({erro:"Não foi possível acessar os produtos."},503);}
}};
