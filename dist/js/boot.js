// This small dependency-free entrypoint can recover even when the app graph fails.
(() => {
  const button=document.getElementById('signin'),label=document.getElementById('signin-label'),status=document.getElementById('startup-status');
  let app,phase='loading',attempt=0,timer;
  function message(text){status.textContent=text;status.hidden=!text;}
  function fail(error){clearTimeout(timer);phase='failed';button.disabled=false;button.removeAttribute('aria-busy');label.textContent='Try again';message(navigator.onLine?'Couldn’t open your journal. Please try again.':'You’re offline. Reconnect, then try again.');console.error('Tristana startup:',error);}
  async function load(){
    const serial=++attempt;phase='loading';button.disabled=true;button.setAttribute('aria-busy','true');label.textContent='Opening journal…';message('Restoring your session…');
    clearTimeout(timer);timer=setTimeout(()=>{if(serial===attempt&&phase==='loading')fail(new Error('Startup timed out'));},15000);
    try{app=app||await import('./app.js?v=74');await app.start();if(serial!==attempt)return;clearTimeout(timer);phase='ready';button.disabled=false;button.removeAttribute('aria-busy');label.textContent='Log in with Google';message('');}
    catch(error){if(serial===attempt)fail(error);}
  }
  window.tristanaStartup={setSignIn(handler){this.signIn=handler;},initializationFailed:fail,showError(error){message(error.message||'Sign-in could not finish. Please try again.');button.disabled=false;button.removeAttribute('aria-busy');label.textContent='Log in with Google';}};
  button.onclick=()=>{if(phase==='failed'){if(app)load();else window.location.reload();return;}if(phase!=='ready')return;
    // Invoke synchronously in the tap handler so Google’s popup keeps user activation.
    button.disabled=true;button.setAttribute('aria-busy','true');label.textContent='Signing in…';message('');
    try{Promise.resolve(window.tristanaStartup.signIn()).catch(error=>window.tristanaStartup.showError(error)).finally(()=>{if(phase==='ready'){button.disabled=false;button.removeAttribute('aria-busy');label.textContent='Log in with Google';}});}catch(error){window.tristanaStartup.showError(error);}
  };
  window.addEventListener('online',()=>{if(phase==='failed'&&app)load();});
  load();
})();
