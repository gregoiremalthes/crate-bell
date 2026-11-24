// Minimal stand-in for Discogs' own scripts, so the extension can be tested end to end offline.
(() => {
  const EYE = 'M951 549q-87-135-218-202 35 59';
  const MINUS = 'M805 421v109q0 23-16 39t-39 16H55';

  // Release page: the wantlist toggle.
  for (const button of document.querySelectorAll('aside button')) {
    if (!/wantlist/i.test(button.textContent)) continue;
    button.addEventListener('click', () => {
      setTimeout(() => {
        const adding = /add to wantlist/i.test(button.textContent);
        const label = button.querySelector('div');
        label.lastChild.textContent = adding ? ' Remove from Wantlist' : ' Add to Wantlist';
        button.querySelector('path').setAttribute('d', adding ? MINUS : EYE);
        const wrapper = button.parentElement.parentElement;
        if (adding) {
          wrapper.insertAdjacentHTML(
            'beforeend',
            '<div class="box_PFmyl wantlist_ramYs"><h3>In Wantlist</h3><span>Added just now</span></div>',
          );
        } else {
          wrapper.querySelector('.wantlist_ramYs')?.remove();
        }
      }, 150);
    });
  }

  // Items I Want page: the save drawer.
  const template = document.getElementById('drawer-template');
  const saveButton = document.querySelector('[data-test="button-save-search"]');
  if (template && saveButton) {
    saveButton.addEventListener('click', () => {
      document.body.appendChild(template.content.cloneNode(true));
      const drawer = document.querySelector('[data-slot="sheet-content"]');
      drawer.querySelector('[data-test="button-drawer-save-search"]').addEventListener('click', () => {
        const name = drawer.querySelector('#save-search-name').value;
        drawer.remove();
        // Like the real page, the list of saved searches refreshes a moment after the form closes.
        setTimeout(() => {
          const select = document.querySelector('[data-test="saved-searches"]');
          select.add(new Option(name, '999999', true, true));
        }, 600);
      });
      drawer.querySelector('button:not([data-test])').addEventListener('click', () => drawer.remove());
    });
  }
})();
