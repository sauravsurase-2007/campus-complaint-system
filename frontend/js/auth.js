// Minimal Cognito client (no dependencies): talks to the Cognito Identity Provider API directly.
window.Auth = (() => {
  const C = window.APP_CONFIG;
  const KEY = 'ccms.session';

  async function idp(target, body) {
    const res = await fetch(`https://cognito-idp.${C.region}.amazonaws.com/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}` },
      body: JSON.stringify({ ClientId: C.clientId, ...body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(friendly(data));
    return data;
  }

  function friendly(d) {
    const map = {
      NotAuthorizedException: 'Incorrect email or password.',
      UserNotFoundException: 'Incorrect email or password.',
      UsernameExistsException: 'An account with this email already exists.',
      CodeMismatchException: 'That verification code is incorrect.',
      ExpiredCodeException: 'That code has expired. Request a new one.',
      LimitExceededException: 'Too many attempts. Please wait a while and retry.',
    };
    const type = (d.__type || '').split('#').pop();
    return map[type] || d.message || 'Something went wrong. Please try again.';
  }

  const decode = (t) => {
    const b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b.padEnd(Math.ceil(b.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  };

  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
  const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));

  function user() {
    const s = load();
    if (!s) return null;
    try {
      const c = decode(s.idToken);
      const groups = c['cognito:groups'] || [];
      return { id: c.sub, email: c.email, name: c.name || c.email, role: groups.includes('Admins') ? 'admin' : 'student', exp: c.exp };
    } catch { return null; }
  }

  async function login(email, password) {
    const r = await idp('InitiateAuth', { AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } });
    if (r.ChallengeName) throw new Error('This account needs a password change. Ask an administrator to set a permanent password.');
    save({ idToken: r.AuthenticationResult.IdToken, refreshToken: r.AuthenticationResult.RefreshToken });
    return user();
  }

  async function token() {
    const s = load(); const u = user();
    if (!s || !u) { logout(); throw new Error('Session expired'); }
    if (u.exp - Date.now() / 1000 > 60) return s.idToken;
    try {
      const r = await idp('InitiateAuth', { AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: s.refreshToken } });
      save({ idToken: r.AuthenticationResult.IdToken, refreshToken: s.refreshToken });
      return r.AuthenticationResult.IdToken;
    } catch { logout(); throw new Error('Session expired'); }
  }

  function logout() { localStorage.removeItem(KEY); location.replace('index.html'); }

  return {
    user, login, token, logout,
    signUp: (email, password, name) => idp('SignUp', { Username: email, Password: password, UserAttributes: [{ Name: 'email', Value: email }, { Name: 'name', Value: name }] }),
    confirm: (email, code) => idp('ConfirmSignUp', { Username: email, ConfirmationCode: code }),
    resend: (email) => idp('ResendConfirmationCode', { Username: email }),
    forgot: (email) => idp('ForgotPassword', { Username: email }),
    resetPassword: (email, code, password) => idp('ConfirmForgotPassword', { Username: email, ConfirmationCode: code, Password: password }),
    home: (u) => (u.role === 'admin' ? 'admin.html' : 'student.html'),
  };
})();
