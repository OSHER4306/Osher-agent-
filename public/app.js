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

const teamLines=[
['עוד קמפיין? אולי קודם עוד לקוחות.','ביקוש חכם עדיף על רעש יקר.'],
['קליקים זה חמוד. עסקאות זה יפה יותר.','כן, גם אנחנו מעדיפים שיחות אמיתיות על מספרים יפים.'],
['ליד טוב לא מחפש רעש. הוא מחפש התאמה.','פחות בזבוז. יותר שיחות ששוות כסף.'],
['אם כולם מפרסמים — תופיע בזמן הנכון.','זה פחות קסם. זה יותר דיוק.'],
['הלקוחות לא נעלמו. הם פשוט עונים למישהו אחר.','עדיף שהם יענו לך.'],
['שלחו הודעה. נבדוק אם הביקוש כבר מחפש אתכם.','Giovanni Social · לידים בלי תקציב מדיה']
];
let teamIndex=0;
const teamQuote=document.getElementById('teamQuote'),teamSub=document.getElementById('teamSub'),teamDots=document.getElementById('teamDots');
if(teamQuote&&teamSub&&teamDots){
teamDots.innerHTML=teamLines.map((_,i)=>'<i'+(i===0?' class="active"':'')+'></i>').join('');
function showTeam(i){teamIndex=(i+teamLines.length)%teamLines.length;teamQuote.textContent=teamLines[teamIndex][0];teamSub.textContent=teamLines[teamIndex][1];[teamQuote,teamSub].forEach(el=>{el.classList.remove('teamSwap');void el.offsetWidth;el.classList.add('teamSwap')});[...teamDots.children].forEach((d,n)=>d.classList.toggle('active',n===teamIndex))}
document.getElementById('teamPrev')?.addEventListener('click',()=>showTeam(teamIndex-1));
document.getElementById('teamNext')?.addEventListener('click',()=>showTeam(teamIndex+1));
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){let t=setInterval(()=>{if(!document.hidden)showTeam(teamIndex+1)},5200);document.addEventListener('visibilitychange',()=>{});}
}
