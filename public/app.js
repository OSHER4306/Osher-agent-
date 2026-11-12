const msg='היי אושר, הגעתי דרך האתר של Giovanni Social ואני רוצה להבין איך אפשר לייצר לעסק שלי לידים בלי תקציב פרסום';
const wa='https://wa.me/972559125071?text='+encodeURIComponent(msg);
document.querySelectorAll('[data-wa]').forEach(a=>{a.href=wa;a.target='_blank';a.rel='noopener'});
const progress=document.getElementById('progress');
const glow=document.getElementById('cursorGlow');
const timeline=document.getElementById('timeline');
let raf=0;
function tick(){
  const h=document.documentElement.scrollHeight-innerHeight;
  progress.style.transform='scaleX('+(h>0?scrollY/h:0)+')';
  if(timeline){
    const r=timeline.getBoundingClientRect();
    const v=Math.min(1,Math.max(0,(innerHeight*.75-r.top)/(r.height+innerHeight*.25)));
    timeline.style.setProperty('--timeline',v);
  }
}
addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(tick)},{passive:true});
tick();
if(matchMedia('(pointer:fine)').matches&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  addEventListener('pointermove',e=>{glow.style.transform='translate('+(e.clientX-130)+'px,'+(e.clientY-130)+'px)'},{passive:true});
}
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));