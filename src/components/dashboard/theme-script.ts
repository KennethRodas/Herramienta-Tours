// Shared with the server layout: plain module (no "use client"), so the string
// below reaches the HTML as a string.

export const THEME_KEY = "wilber.panel.tema";

/**
 * Runs before the first paint on a hard load: a 4 a.m. visit never flashes
 * sand. Reads the override, or the simulated clock from the newest
 * "wilber.sim.v*" record (night is 18:00–05:30 in El Salvador, UTC-6), and
 * sets data-theme="noche" on <html>.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,s=localStorage,m=s.getItem(${JSON.stringify(THEME_KEY)}),n=m==="noche";if(!m){var t=Date.now(),best=-1,r=null;for(var i=0;i<s.length;i++){var k=s.key(i),v=k&&k.match(/^wilber\\.sim\\.v(\\d+)$/);if(v&&+v[1]>best){best=+v[1];r=s.getItem(k);}}if(r){var c=r.match(/"clock":\\{"anchorReal":(\\d+),"anchorSim":([\\d.]+),"speed":([\\d.]+),"paused":(true|false)\\}/);if(c){t=c[4]==="true"?+c[2]:+c[2]+(Date.now()-c[1])*c[3];}}var x=new Date(t-216e5),q=x.getUTCHours()*60+x.getUTCMinutes();n=q>=1080||q<330;}if(n)d.setAttribute("data-theme","noche");}catch(e){}})();`;
