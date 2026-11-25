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

  // Marketplace listing: the "Add to Wantlist" / "In Wantlist" toggle.
  const toggle = document.querySelector('button.hifi-wantlist-button-toggle');
  toggle?.addEventListener('click', () => {
    setTimeout(() => {
      const label = toggle.querySelector('.hifi-wantlist-button-toggle-label');
      label.textContent = /add to/i.test(label.textContent) ? 'In Wantlist' : 'Add to Wantlist';
    }, 150);
  });

  // Items I Want page: the saved searches menu, with Delete and its confirmation.
  const select = document.querySelector('[data-test="saved-searches"]');
  function updateCount() {
    const label = document.getElementById('saved-searches');
    if (label && select) label.textContent = `${select.options.length - 1} Saved Searches`;
  }
  // Saved searches survive page loads, like on Discogs (kept in this test page's localStorage).
  const store = {
    get: () => JSON.parse(localStorage.getItem('sim-saved') || '{"added":[],"deleted":[]}'),
    set: (v) => localStorage.setItem('sim-saved', JSON.stringify(v)),
  };
  if (select) {
    const saved = store.get();
    for (const s of saved.added) {
      const option = new Option(s.name, s.id);
      option.dataset.releases = s.releases;
      select.add(option);
    }
    for (const id of saved.deleted) select.querySelector(`option[value="${id}"]`)?.remove();
    updateCount();
  }
  if (select) {
    const actions = document.createElement('div');
    select.after(actions);
    select.addEventListener('change', () => {
      actions.replaceChildren();
      const option = select.selectedOptions[0];
      if (!option || option.value === '-1') return;
      // Loading a saved search applies its filters to the address, like Discogs does.
      const url = new URL(location.href);
      url.search = '';
      for (const id of (option.dataset.releases || '').split(',').filter(Boolean))
        url.searchParams.append('release', id);
      history.replaceState(null, '', url);
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Delete';
      actions.append(del);
      del.addEventListener('click', () => {
        const box = document.createElement('div');
        box.innerHTML =
          '<p>Are you sure you want to delete this saved search?</p><div><button type="button">Cancel</button><button type="button">Delete</button></div>';
        actions.append(box);
        const [cancel, confirm] = box.querySelectorAll('button');
        cancel.addEventListener('click', () => box.remove());
        confirm.addEventListener('click', () => {
          const saved = store.get();
          saved.deleted.push(option.value);
          store.set(saved);
          option.remove();
          select.value = '-1';
          actions.replaceChildren();
          updateCount();
        });
      });
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
        const releases = new URLSearchParams(location.search).getAll('release').join(',');
        setTimeout(() => {
          const select = document.querySelector('[data-test="saved-searches"]');
          const option = new Option(name, '999999', true, true);
          option.dataset.releases = releases;
          select.add(option);
          const saved = store.get();
          saved.added.push({ id: option.value, name, releases });
          store.set(saved);
          updateCount();
        }, 600);
      });
      drawer.querySelector('button:not([data-test])').addEventListener('click', () => drawer.remove());
    });
  }
})();
