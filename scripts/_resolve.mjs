// ESM resolve hook: เติม ".js" ให้ relative import ที่ไม่มีนามสกุล (lib ใช้ extensionless import)
// ใช้: node --experimental-loader ./scripts/_resolve.mjs scripts/<file>.mjs
export async function resolve(specifier, context, next){
  if((specifier.startsWith("./") || specifier.startsWith("../"))
     && !/\.(m?js|json|node)$/.test(specifier)){
    try { return await next(specifier + ".js", context); } catch {}
  }
  return next(specifier, context);
}
