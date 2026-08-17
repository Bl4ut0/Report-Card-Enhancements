(() => {
  const status = document.querySelector('#status');
  const login = document.querySelector('#login');
  const logout = document.querySelector('#logout');
  const form = document.querySelector('#report-form');
  const reportId = document.querySelector('#report-id');
  let csrfToken = '';

  const setStatus = (message, state = 'neutral') => {
    status.textContent = message;
    status.closest('.status-box').dataset.state = state;
  };

  const setAuthorized = (result) => {
    csrfToken = result.csrfToken || '';
    login.hidden = true;
    form.hidden = false;
    setStatus(`Verified as ${result.username}. You may submit reports.`, 'success');
  };

  const setSignedOut = () => {
    csrfToken = '';
    login.hidden = false;
    login.disabled = false;
    form.hidden = true;
    setStatus('Sign in with Discord to verify your guild role.');
  };

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    let result = {};
    try { result = await response.json(); }
    catch { result = { message: 'The portal returned an invalid response.' }; }
    if (!response.ok) {
      const error = new Error(result.message || 'The request could not be completed.');
      error.status = response.status;
      throw error;
    }
    return result;
  };

  login.addEventListener('click', () => location.assign('/api/discord/start'));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = reportId.value.trim();
    setStatus('Adding the report to the guild queue...', 'working');
    try {
      const result = await fetchJson('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-rce-csrf': csrfToken },
        body: JSON.stringify({ reportId: code }),
      });
      setStatus(result.message || `Report ${result.reportId || code} was accepted.`, 'success');
      if (!result.duplicate) reportId.value = '';
    } catch (error) {
      if (error.status === 401) setSignedOut();
      setStatus(error.message || 'Could not reach the report queue.', 'error');
    }
  });

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      await fetchJson('/api/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-rce-csrf': csrfToken },
        body: '{}',
      });
      setSignedOut();
    } catch (error) {
      setStatus(error.message || 'Could not end the session.', 'error');
    } finally {
      logout.disabled = false;
    }
  });

  const initialize = async () => {
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const state = params.get('state');
    const oauthError = params.get('error');

    if (oauthError) {
      history.replaceState({}, '', location.pathname);
      setSignedOut();
      setStatus('Discord authorization was cancelled or denied.', 'error');
      return;
    }

    if (code && state) {
      setStatus('Verifying Discord membership and guild role...', 'working');
      try {
        const result = await fetchJson('/api/discord/exchange', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code, state }),
        });
        history.replaceState({}, '', location.pathname);
        setAuthorized(result);
      } catch (error) {
        history.replaceState({}, '', location.pathname);
        setSignedOut();
        setStatus(error.message || 'Discord role verification failed.', 'error');
      }
      return;
    }

    try {
      const session = await fetchJson('/api/session');
      if (session.authorized) setAuthorized(session);
      else setSignedOut();
    } catch (error) {
      setSignedOut();
      setStatus(error.message || 'The authentication service is unavailable.', 'error');
    }
  };

  initialize();
})();
