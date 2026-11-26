// RNCWEB
const schema = ["-- RNCWEB\nCREATE TABLE IF NOT EXISTS produtos (\n  id INTEGER PRIMARY KEY AUTOINCREMENT,\n  nome TEXT NOT NULL CHECK(length(trim(nome)) BETWEEN 1 AND 150),\n  descricao TEXT NOT NULL DEFAULT '' CHECK(length(descricao) <= 2000),\n  categoria TEXT NOT NULL DEFAULT '' CHECK(length(categoria) <= 100),\n  preco_centavos INTEGER NOT NULL CHECK(typeof(preco_centavos) = 'integer' AND preco_centavos >= 0),\n  preco_promocional_centavos INTEGER CHECK(preco_promocional_centavos IS NULL OR (typeof(preco_promocional_centavos) = 'integer' AND preco_promocional_centavos >= 0 AND preco_promocional_centavos < preco_centavos)),\n  estoque INTEGER NOT NULL DEFAULT 0 CHECK(typeof(estoque) = 'integer' AND estoque >= 0),\n  imagem_url TEXT NOT NULL DEFAULT '' CHECK(length(imagem_url) <= 2048),\n  ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0, 1)),\n  destaque INTEGER NOT NULL DEFAULT 0 CHECK(destaque IN (0, 1)),\n  criado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),\n  atualizado_em TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))\n)","CREATE INDEX IF NOT EXISTS idx_produtos_catalogo ON produtos(ativo, destaque DESC, id DESC)"];
const fields = ["nome","descricao","categoria","preco_centavos","preco_promocional_centavos","estoque","imagem_url","ativo","destaque"];
const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
async function authorized(req,env){
  const key=env.ADMIN_TOKEN;
  const candidate=req.headers.get("Authorization")||"";
  if(typeof key!=="string"||key.length<24||candidate.length>512||!candidate.startsWith("Bearer "))return false;
  const hash=async v=>new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
  const [a,b]=await Promise.all([hash(candidate.slice(7)),hash(key)]);
  let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
async function setup(db){await db.batch(schema.map(s=>db.prepare(s)));}
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
  if(imagem){let u;try{u=new URL(imagem);}catch{throw Error("URL de imagem inválida.");}if(u.protocol!=="https:"||u.username||u.password)throw Error("Use uma URL HTTPS para a imagem.");}
  return [nome,descricao,categoria,preco,promo,estoque,imagem,flag("ativo"),flag("destaque")];
}
async function body(req){
  if(!req.headers.get("Content-Type")?.startsWith("application/json"))throw Error("Envie JSON.");
  if(Number(req.headers.get("Content-Length")||0)>12000)throw Error("Dados muito grandes.");
  const reader=req.body?.getReader();if(!reader)throw Error("Dados ausentes.");
  let bytes=0;const decoder=new TextDecoder();let text="";
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>12000){await reader.cancel();throw Error("Dados muito grandes.");}text+=decoder.decode(value,{stream:true});}
  text+=decoder.decode();return JSON.parse(text);
}
export default {async fetch(req,env){
  const url=new URL(req.url), path=url.pathname, method=req.method;
  if(!path.startsWith("/api/"))return env.ASSETS.fetch(req);
  if(!env.DB)return json({erro:"Banco ainda não vinculado."},503);
  try{
    if(path==="/api/produtos"&&method==="GET"){
      const r=await query(env.DB,"SELECT id,nome,descricao,categoria,preco_centavos,preco_promocional_centavos,estoque,imagem_url,destaque FROM produtos WHERE ativo=1 ORDER BY destaque DESC,id DESC LIMIT 500");
      return json({produtos:r.results});
    }
    if(!path.startsWith("/api/admin/"))return json({erro:"Não encontrado."},404);
    if(typeof env.ADMIN_TOKEN!=="string"||!env.ADMIN_TOKEN)return json({erro:"ADMIN_TOKEN ausente no Worker de produção. Configure em Settings > Variables and Secrets (não em Build)."},503);
    if(env.ADMIN_TOKEN.length<24)return json({erro:"A chave ADMIN_TOKEN configurada tem menos de 24 caracteres. Substitua por uma chave aleatória de 32 caracteres."},503);
    if(!await authorized(req,env))return json({erro:"Credencial inválida."},401);
    if(req.headers.get("Origin")&&req.headers.get("Origin")!==url.origin)return json({erro:"Origem não autorizada."},403);
    if(path==="/api/admin/produtos"&&method==="GET"){
      const r=await query(env.DB,"SELECT * FROM produtos ORDER BY id DESC LIMIT 500");return json({produtos:r.results});
    }
    const match=path.match(/^\/api\/admin\/produtos\/([1-9][0-9]{0,14})$/);
    if(path==="/api/admin/produtos"&&method==="POST"||match&&method==="PUT"){
      let values;try{values=validate(await body(req));}catch(e){return json({erro:e.message},400);}
      await setup(env.DB);
      if(method==="POST"){
        const r=await env.DB.prepare("INSERT INTO produtos ("+fields.join(",")+") VALUES ("+fields.map(()=>"?").join(",")+")").bind(...values).run();
        return json({id:r.meta.last_row_id},201);
      }
      const r=await env.DB.prepare("UPDATE produtos SET "+fields.map(k=>k+"=?").join(",")+", atualizado_em=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(...values,Number(match[1])).run();
      return r.meta.changes?json({ok:true}):json({erro:"Produto não encontrado."},404);
    }
    if(match&&method==="DELETE"){
      await setup(env.DB);const r=await env.DB.prepare("DELETE FROM produtos WHERE id=?").bind(Number(match[1])).run();
      return r.meta.changes?json({ok:true}):json({erro:"Produto não encontrado."},404);
    }
    return json({erro:"Não encontrado."},404);
  }catch(e){console.error("Falha D1",String(e));return json({erro:"Não foi possível acessar os produtos."},503);}
}};
