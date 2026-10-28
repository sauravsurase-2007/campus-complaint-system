(() => {
  const $ = (s) => document.querySelector(s);
  const existing = Auth.user();
  if (existing) location.replace(Auth.home(existing));

  if (window.APP_CONFIG.userPoolId === 'REPLACE_ME') {
    $('#msg').textContent = 'App not configured yet. Run the deploy script (see README) to generate js/config.js.';
    $('#msg').className = 'msg err';
  }

  const panels = ['login', 'signup', 'verify', 'forgot', 'reset'];
  function show(name) {
    panels.forEach((p) => $(`#p-${p}`).classList.toggle('hidden', p !== name));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.show === name));
    msg('');
  }
  function msg(text, ok) { const m = $('#msg'); m.textContent = text; m.className = 'msg ' + (text ? (ok ? 'ok' : 'err') : ''); }
  document.querySelectorAll('[data-show]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); show(el.dataset.show); }));

  async function run(btn, fn) {
    btn.disabled = true;
    try { await fn(); } catch (e) { msg(e.message); } finally { btn.disabled = false; }
  }

  let pendingEmail = '';

  $('#f-login').addEventListener('submit', (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      const email = $('#l-email').value.trim().toLowerCase();
      try {
        const u = await Auth.login(email, $('#l-pass').value);
        location.replace(Auth.home(u));
      } catch (err) {
        if (/not confirmed/i.test(err.message)) { pendingEmail = email; $('#v-email').value = email; show('verify'); msg('Please verify your email first. Enter the code we sent you.', true); }
        else throw err;
      }
    });
  });

  $('#f-signup').addEventListener('submit', (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      pendingEmail = $('#s-email').value.trim().toLowerCase();
      await Auth.signUp(pendingEmail, $('#s-pass').value, $('#s-name').value.trim());
      $('#v-email').value = pendingEmail;
      show('verify');
      msg('Account created! Enter the verification code emailed to you.', true);
    });
  });

  $('#f-verify').addEventListener('submit', (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      await Auth.confirm($('#v-email').value.trim().toLowerCase(), $('#v-code').value.trim());
      show('login');
      $('#l-email').value = $('#v-email').value;
      msg('Email verified. You can sign in now.', true);
    });
  });
  $('#resend').addEventListener('click', (e) => {
    e.preventDefault();
    run(e.target, async () => { await Auth.resend($('#v-email').value.trim().toLowerCase()); msg('A new code has been sent.', true); });
  });

  $('#f-forgot').addEventListener('submit', (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      const email = $('#f-email').value.trim().toLowerCase();
      await Auth.forgot(email);
      $('#r-email').value = email;
      show('reset');
      msg('If the account exists, a reset code was emailed.', true);
    });
  });

  $('#f-reset').addEventListener('submit', (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
      await Auth.resetPassword($('#r-email').value.trim().toLowerCase(), $('#r-code').value.trim(), $('#r-pass').value);
      show('login');
      msg('Password updated. Please sign in.', true);
    });
  });
})();
