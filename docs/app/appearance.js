/* Theme preference is shared with the Android shell and survives app restarts. */
window.Appearance={
 mode:'dark',
 stored(key,fallback){try{const native=window.AppAppearance;if(native){const value=key==='theme'?native.getTheme():native.getTeam();if(value)return value;}return localStorage.getItem('cdm-'+key)||fallback;}catch(e){return fallback;}},
 save(key,value){try{if(window.AppAppearance){if(key==='theme')window.AppAppearance.setTheme(value);else window.AppAppearance.setTeam(value);}else localStorage.setItem('cdm-'+key,value);}catch(e){}},
 apply(value,remember=false){this.mode=value==='light'?'light':'dark';document.documentElement.dataset.theme=this.mode;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=this.mode==='light'?'#edf3fa':'#182335';if(remember)this.save('theme',this.mode);this.updateButton();},
 button(){return `<button type="button" class="profile-btn theme-btn" data-theme-toggle aria-label="${this.mode==='dark'?'Activar modo claro':'Activar modo oscuro'}" title="${this.mode==='dark'?'Modo claro':'Modo oscuro'}" aria-pressed="${this.mode==='light'}">${this.symbol()}</button>`;},
 symbol(){return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${this.mode==='dark'?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>':'<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>'}</svg>`;},
 updateButton(){const button=document.querySelector('[data-theme-toggle]');if(!button)return;const label=this.mode==='dark'?'Activar modo claro':'Activar modo oscuro';button.innerHTML=this.symbol();button.setAttribute('aria-label',label);button.title=this.mode==='dark'?'Modo claro':'Modo oscuro';button.setAttribute('aria-pressed',String(this.mode==='light'));}
};
Appearance.apply(Appearance.stored('theme','dark'));
document.addEventListener('click',e=>{if(e.target.closest('[data-theme-toggle]'))Appearance.apply(Appearance.mode==='dark'?'light':'dark',true);});
