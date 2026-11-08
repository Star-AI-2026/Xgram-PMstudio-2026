export function adminHead(title:string){
  const description=`Xgram Super Admin — ${title.toLowerCase()} and secure network administration.`;
  return {meta:[{title:`${title} — Xgram Super Admin`},{name:'description',content:description},{property:'og:title',content:`${title} — Xgram Super Admin`},{property:'og:description',content:description},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex, nofollow'}]};
}